import base64
import hashlib
import json
import logging

import pytest
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec, ed25519

from record.document import document_hash, make_document, memo_text, record_key
from record.rekor import build_entry
from record.solana import MEMO_PROGRAM, SOLANA_RPC_URL, base58_decode, base58_encode, build_memo_message, compact_u16, sign_transaction
from record.write import RecordFailed, write_record

# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

def gen_ec_pem():
    sk = ec.generate_private_key(ec.SECP256R1())
    return sk.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption())

def gen_ed_seed():
    import os
    return os.urandom(32)

# ---------------------------------------------------------------------------
# make_document
# ---------------------------------------------------------------------------

def test_make_document_same_input_same_bytes():
    result = {"owner": "a", "repo": "b", "commit": "abc"}
    ts = "2024-01-01T00:00:00Z"
    assert make_document(result, ts) == make_document(result, ts)

def test_make_document_key_order_does_not_change_bytes():
    ts = "2024-01-01T00:00:00Z"
    r1 = {"b": 2, "a": 1}
    r2 = {"a": 1, "b": 2}
    assert make_document(r1, ts) == make_document(r2, ts)

def test_make_document_non_ascii_utf8():
    ts = "2024-01-01T00:00:00Z"
    result = {"owner": "o", "text": "café \u2603 \u65e5\u672c"}
    # actual unicode chars
    result = {"owner": "o", "text": "café ☃ 日本語"}
    doc = make_document(result, ts)
    assert "café".encode("utf-8") in doc
    assert "日本語".encode("utf-8") in doc
    # ensure not ascii-escaped
    assert b"\\u" not in doc
    # roundtrip json loads
    obj = json.loads(doc.decode("utf-8"))
    assert obj["result"]["text"] == "café ☃ 日本語"

def test_document_hash_equals_sha256():
    doc = b"hello world"
    assert document_hash(doc) == hashlib.sha256(doc).hexdigest()
    # also with make_document
    d2 = make_document({"x": 1}, "2024-01-01T00:00:00Z")
    assert document_hash(d2) == hashlib.sha256(d2).hexdigest()

def test_record_key_lower_case():
    k = record_key("Owner", "Repo", "ABCDEF", "V1")
    assert k == k.lower()
    assert k == "record:owner/repo@abcdef@v1"

def test_memo_text_holds_hash_and_repo():
    sha = "a" * 64
    m = memo_text("owner", "repo", "commit123", "1.0", sha)
    obj = json.loads(m)
    assert obj["sha256"] == sha
    assert obj["repo"] == "owner/repo"
    assert obj["commit"] == "commit123"
    assert obj["yokoten"] == "1.0"

def test_memo_text_very_long_repo_raises():
    sha = "a" * 64
    long_repo = "x" * 1000
    with pytest.raises(ValueError):
        memo_text("owner", long_repo, "commit", "1", sha)

# ---------------------------------------------------------------------------
# build_entry
# ---------------------------------------------------------------------------

def test_build_entry_exact_shape_and_hash_and_signature():
    pem = gen_ec_pem()
    doc = b"test document bytes"
    entry = build_entry(doc, pem)
    # exact shape top level keys
    assert set(entry.keys()) == {"apiVersion", "kind", "spec"}
    assert entry["apiVersion"] == "0.0.1"
    assert entry["kind"] == "hashedrekord"
    spec = entry["spec"]
    assert set(spec.keys()) == {"data", "signature"}
    assert spec["data"]["hash"]["algorithm"] == "sha256"
    digest = hashlib.sha256(doc).hexdigest()
    assert spec["data"]["hash"]["value"] == digest
    # signature content is base64 DER, public key is base64 PEM
    sig_der = base64.b64decode(spec["signature"]["content"])
    pub_pem = base64.b64decode(spec["signature"]["publicKey"]["content"])
    # verify signature with public key in entry
    pub_key = serialization.load_pem_public_key(pub_pem)
    pub_key.verify(sig_der, doc, ec.ECDSA(hashes.SHA256()))

def test_build_entry_accepts_str_pem():
    pem_bytes = gen_ec_pem()
    pem_str = pem_bytes.decode("utf-8")
    doc = b"hello"
    e1 = build_entry(doc, pem_bytes)
    e2 = build_entry(doc, pem_str)
    # both should have same public key type and valid signatures (signatures differ due to random k but both verify)
    for e in (e1, e2):
        sig_der = base64.b64decode(e["spec"]["signature"]["content"])
        pub_pem = base64.b64decode(e["spec"]["signature"]["publicKey"]["content"])
        pub_key = serialization.load_pem_public_key(pub_pem)
        pub_key.verify(sig_der, doc, ec.ECDSA(hashes.SHA256()))

# ---------------------------------------------------------------------------
# write_entry with fake post
# ---------------------------------------------------------------------------

def test_write_entry_201_gives_uuid_logindex_link():
    from record.rekor import write_entry
    pem = gen_ec_pem()
    doc = b"doc bytes"
    expected_uuid = "111122223333444455556666777788889999aaaabbbbccccddddeeeeffff00001"
    def fake_post(url, body, timeout=15):
        assert "rekor.sigstore.dev" in url
        return 201, {}, json.dumps({expected_uuid: {"logIndex": 123, "integratedTime": 999}})
    res = write_entry(doc, pem, post=fake_post)
    assert res["uuid"] == expected_uuid
    assert res["log_index"] == 123
    assert res["url"] == "https://search.sigstore.dev/?logIndex=123"

def test_write_entry_409_with_location_gives_uuid_link():
    from record.rekor import write_entry
    pem = gen_ec_pem()
    doc = b"doc"
    uuid = "abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234"
    loc = f"https://rekor.sigstore.dev/api/v1/log/entries/{uuid}"
    def fake_post(url, body, timeout=15):
        return 409, {"Location": loc}, ""
    res = write_entry(doc, pem, post=fake_post)
    assert res["uuid"] == uuid
    assert res["log_index"] is None
    assert res["url"] == f"https://search.sigstore.dev/?uuid={uuid}"
    # also lower-case header key variant
    def fake_post2(url, body, timeout=15):
        return 409, {"location": loc}, ""
    res2 = write_entry(doc, pem, post=fake_post2)
    assert res2["uuid"] == uuid

def test_write_entry_409_without_location_raises():
    from record.rekor import write_entry
    pem = gen_ec_pem()
    def fake_post(url, body, timeout=15):
        return 409, {}, ""
    with pytest.raises(RecordFailed):
        write_entry(b"doc", pem, post=fake_post)

def test_write_entry_500_raises():
    from record.rekor import write_entry
    pem = gen_ec_pem()
    def fake_post(url, body, timeout=15):
        return 500, {}, "oops"
    with pytest.raises(RecordFailed):
        write_entry(b"doc", pem, post=fake_post)

# ---------------------------------------------------------------------------
# Solana base58 / compact_u16
# ---------------------------------------------------------------------------

def test_base58_decode_memo_program_is_32_bytes():
    decoded = base58_decode(MEMO_PROGRAM)
    assert len(decoded) == 32

def test_base58_encode_decode_roundtrip():
    for data in [b"", b"\x00", b"\x00\x00", b"\x00\x00abc", b"hello world", b"\x00\xff\x00\x01"]:
        assert base58_decode(base58_encode(data)) == data
    # leading zero bytes specifics
    assert base58_encode(b"\x00\x00\x01") == "112"
    assert base58_decode("112") == b"\x00\x00\x01"
    assert base58_encode(b"\x00\x00") == "11"
    assert base58_decode("11") == b"\x00\x00"

def test_compact_u16_vectors():
    assert compact_u16(0) == bytes.fromhex("00")
    assert compact_u16(127) == bytes.fromhex("7f")
    assert compact_u16(128) == bytes.fromhex("80 01")
    assert compact_u16(16383) == bytes.fromhex("ff 7f")

# ---------------------------------------------------------------------------
# build_memo_message parsed byte by byte
# ---------------------------------------------------------------------------

def test_build_memo_message_parsed_byte_by_byte():
    # valid 32-byte fee_payer and blockhash
    fee_payer = bytes(range(32))
    blockhash = bytes([255 - i for i in range(32)])
    memo = b"hello memo"
    msg = build_memo_message(fee_payer, blockhash, memo)
    # header [1,0,1]
    assert msg[0:3] == bytes([1, 0, 1])
    idx = 3
    # 2 keys compact u16 = 0x02
    assert msg[idx] == 2
    idx += 1
    # fee payer first
    assert msg[idx:idx+32] == fee_payer
    idx += 32
    # memo program second
    assert msg[idx:idx+32] == base58_decode(MEMO_PROGRAM)
    idx += 32
    # blockhash
    assert msg[idx:idx+32] == blockhash
    idx += 32
    # 1 instruction
    assert msg[idx] == 1
    idx += 1
    # program index 1
    assert msg[idx] == 1
    idx += 1
    # account indexes len 1 then [0]
    assert msg[idx] == 1
    idx += 1
    assert msg[idx] == 0
    idx += 1
    # memo data length compact_u16
    # for len 10 => 0x0a
    assert msg[idx] == len(memo)
    idx += 1
    assert msg[idx:idx+len(memo)] == memo
    idx += len(memo)
    assert idx == len(msg)
    # no other instruction present
    # already asserted exact length

def test_build_memo_message_no_other_instruction():
    fee_payer = b"\x01" * 32
    blockhash = b"\x02" * 32
    msg = build_memo_message(fee_payer, blockhash, b"x")
    # after header+keys+bh, we should have exactly 1 instruction
    # parse to ensure no trailing bytes
    # header 3 + 1(keys len) +64(keys)+32(bh)+1(instr count)=101
    # then instruction: 1(prog)+1(acct len)+1(acct)+1(memo len)+1(memo)=5
    assert len(msg) == 101 + 5

def test_sign_transaction_verifies_and_wire():
    seed = gen_ed_seed()
    fee_payer = ed25519.Ed25519PrivateKey.from_private_bytes(seed).public_key().public_bytes_raw()
    blockhash = b"\xab" * 32
    memo = b"test"
    message = build_memo_message(fee_payer, blockhash, memo)
    sig, wire = sign_transaction(seed, message)
    # wire is 01 + signature + message
    assert wire[0:1] == compact_u16(1)
    assert wire[1:65] == sig
    assert wire[65:] == message
    # signature verifies with seed's public key
    pub = ed25519.Ed25519PrivateKey.from_private_bytes(seed).public_key()
    pub.verify(sig, message)

# ---------------------------------------------------------------------------
# write_memo with fake rpc
# ---------------------------------------------------------------------------

def test_solana_rpc_url_holds_devnet():
    assert "devnet" in SOLANA_RPC_URL

def test_write_memo_two_calls_in_order_with_right_params():
    from record.solana import write_memo
    seed = gen_ed_seed()
    seed_hex = seed.hex()
    memo = "hello"
    # prepare blockhash that decodes to 32 bytes
    fake_blockhash_bytes = b"\x55" * 32
    fake_blockhash_b58 = base58_encode(fake_blockhash_bytes)
    sig_b58 = base58_encode(b"\x99" * 32)
    calls = []
    def fake_rpc(method, params, timeout=15):
        calls.append((method, params))
        if method == "getLatestBlockhash":
            # check params
            assert params == [{"commitment": "confirmed"}]
            return {"result": {"value": {"blockhash": fake_blockhash_b58}}}
        elif method == "sendTransaction":
            assert method == "sendTransaction"
            assert isinstance(params[0], str)
            assert params[1] == {"encoding": "base64", "preflightCommitment": "confirmed", "maxRetries": 2}
            return {"result": sig_b58}
        else:
            raise AssertionError("unknown method")
    res = write_memo(memo, seed_hex, rpc=fake_rpc)
    assert len(calls) == 2
    assert calls[0][0] == "getLatestBlockhash"
    assert calls[1][0] == "sendTransaction"
    assert res["signature"] == sig_b58
    assert res["url"] == f"https://explorer.solana.com/tx/{sig_b58}?cluster=devnet"

def test_write_memo_rpc_error_on_first_raises():
    from record.solana import write_memo
    seed_hex = gen_ed_seed().hex()
    def fake_rpc(method, params, timeout=15):
        return {"error": {"code": -32603, "message": "oops"}}
    with pytest.raises(RecordFailed):
        write_memo("hi", seed_hex, rpc=fake_rpc)

def test_write_memo_rpc_error_on_second_raises():
    from record.solana import write_memo
    seed_hex = gen_ed_seed().hex()
    fake_blockhash_b58 = base58_encode(b"\x01" * 32)
    def fake_rpc(method, params, timeout=15):
        if method == "getLatestBlockhash":
            return {"result": {"value": {"blockhash": fake_blockhash_b58}}}
        else:
            return {"error": {"code": 1, "message": "fail"}}
    with pytest.raises(RecordFailed):
        write_memo("hi", seed_hex, rpc=fake_rpc)

def test_write_memo_good_reply_gives_devnet_link():
    from record.solana import write_memo
    seed_hex = gen_ed_seed().hex()
    fake_blockhash_b58 = base58_encode(b"\x02" * 32)
    sig_b58 = base58_encode(b"\x03" * 32)
    def fake_rpc(method, params, timeout=15):
        if method == "getLatestBlockhash":
            return {"result": {"value": {"blockhash": fake_blockhash_b58}}}
        return {"result": sig_b58}
    res = write_memo("hi", seed_hex, rpc=fake_rpc)
    assert "?cluster=devnet" in res["url"]
    assert sig_b58 in res["url"]

# ---------------------------------------------------------------------------
# write_record with fake writers and dict-backed store
# ---------------------------------------------------------------------------

class DictStore:
    def __init__(self, d=None):
        self.d = d if d is not None else {}
    def get(self, key, default=None):
        return self.d.get(key, default)
    def put(self, key, value):
        self.d[key] = value

def _result():
    return {"owner": "owner", "repo": "repo", "commit": "abc123", "yokoten_version": "1.0", "extra": "data"}

def _pem_with_newlines():
    return gen_ec_pem()

def test_write_record_both_succeed():
    store = DictStore()
    def fake_rekor(doc, pem):
        return {"uuid": "u1", "url": "https://search.sigstore.dev/?logIndex=1"}
    def fake_solana(memo, seed_hex):
        return {"signature": "sig", "url": "https://explorer.solana.com/tx/sig?cluster=devnet"}
    env = {"REKOR_SIGNING_KEY": _pem_with_newlines().decode(), "SOLANA_DEVNET_SEED": gen_ed_seed().hex()}
    rec = write_record(_result(), store=store, now=lambda: 0, rekor=fake_rekor, solana=fake_solana, environ=env)
    assert rec["rekor"] is not None
    assert rec["solana"] is not None
    assert rec["sha256"]

def test_write_record_existing_rekor_makes_no_new_write():
    existing = {"rekor": {"uuid": "old"}, "solana": None, "sha256": "x"}
    store = DictStore()
    key = record_key("owner", "repo", "abc123", "1.0")
    store.d[key] = existing
    called = []
    def fake_rekor(doc, pem):
        called.append("rekor")
        return {"uuid": "new"}
    def fake_solana(memo, seed_hex):
        called.append("solana")
        return {"signature": "s"}
    env = {"REKOR_SIGNING_KEY": _pem_with_newlines().decode(), "SOLANA_DEVNET_SEED": gen_ed_seed().hex()}
    rec = write_record(_result(), store=store, now=lambda: 0, rekor=fake_rekor, solana=fake_solana, environ=env)
    assert rec is existing
    assert called == []

def test_write_record_existing_rekor_none_writes_again():
    existing = {"rekor": None, "solana": None, "sha256": "x"}
    store = DictStore()
    key = record_key("owner", "repo", "abc123", "1.0")
    store.d[key] = existing
    def fake_rekor(doc, pem):
        return {"uuid": "new"}
    def fake_solana(memo, seed_hex):
        return {"signature": "s", "url": "u"}
    env = {"REKOR_SIGNING_KEY": _pem_with_newlines().decode(), "SOLANA_DEVNET_SEED": gen_ed_seed().hex()}
    rec = write_record(_result(), store=store, now=lambda: 0, rekor=fake_rekor, solana=fake_solana, environ=env)
    assert rec is not existing
    assert rec["rekor"]["uuid"] == "new"

def test_write_record_missing_key_skips_writer():
    store = DictStore()
    def fake_rekor(doc, pem):
        raise AssertionError("should not be called")
    def fake_solana(memo, seed_hex):
        raise AssertionError("should not be called")
    env = {}
    rec = write_record(_result(), store=store, now=lambda: 0, rekor=fake_rekor, solana=fake_solana, environ=env)
    # no writer configured -> both None -> not stored but returned with None results
    assert rec["rekor"] is None
    assert rec["solana"] is None
    # store should not have stored because both None
    assert len(store.d) == 0

def test_write_record_backslash_n_reaches_writer_as_real_newlines():
    store = DictStore()
    pem_bytes = gen_ec_pem()
    pem_str = pem_bytes.decode("utf-8")
    literal = pem_str.replace("\n", "\\n")
    seen = {}
    def fake_rekor(doc, pem):
        seen["pem"] = pem
        return {"uuid": "u"}
    def fake_solana(memo, seed_hex):
        return None
    env = {"REKOR_SIGNING_KEY": literal}
    write_record(_result(), store=store, now=lambda: 0, rekor=fake_rekor, solana=fake_solana, environ=env)
    assert "\n" in seen["pem"]
    assert "\\n" not in seen["pem"]
    assert seen["pem"] == pem_str

def test_write_record_one_writer_raising_leaves_other():
    store = DictStore()
    def fake_rekor(doc, pem):
        raise RuntimeError("boom")
    def fake_solana(memo, seed_hex):
        return {"signature": "sig", "url": "u"}
    env = {"REKOR_SIGNING_KEY": gen_ec_pem().decode(), "SOLANA_DEVNET_SEED": gen_ed_seed().hex()}
    rec = write_record(_result(), store=store, now=lambda: 0, rekor=fake_rekor, solana=fake_solana, environ=env)
    assert rec["rekor"] is None
    assert rec["solana"] is not None

def test_write_record_store_that_raises_still_returns():
    class BadStore:
        def get(self, k, d=None):
            raise RuntimeError("get fail")
        def put(self, k, v):
            raise RuntimeError("put fail")
    def fake_rekor(doc, pem):
        return {"uuid": "u"}
    env = {"REKOR_SIGNING_KEY": gen_ec_pem().decode()}
    rec = write_record(_result(), store=BadStore(), now=lambda: 0, rekor=fake_rekor, solana=lambda m,s: None, environ=env)
    assert rec is not None
    assert rec["rekor"]["uuid"] == "u"

def test_write_record_failed_both_none_not_stored():
    store = DictStore()
    def fake_rekor(doc, pem):
        raise RuntimeError("fail")
    def fake_solana(memo, seed_hex):
        raise RuntimeError("fail")
    env = {"REKOR_SIGNING_KEY": gen_ec_pem().decode(), "SOLANA_DEVNET_SEED": gen_ed_seed().hex()}
    rec = write_record(_result(), store=store, now=lambda: 0, rekor=fake_rekor, solana=fake_solana, environ=env)
    assert rec["rekor"] is None
    assert rec["solana"] is None
    assert len(store.d) == 0

def test_write_record_result_missing_commit_returns_none():
    store = DictStore()
    result = {"owner": "o", "repo": "r", "yokoten_version": "1"}  # missing commit
    rec = write_record(result, store=store, now=lambda: 0, rekor=lambda d,p: {"uuid":"u"}, solana=lambda m,s: None, environ={})
    assert rec is None
    # missing commit returns None even without store
    assert write_record(result, store=None, now=lambda: 0, rekor=lambda d,p: {"uuid":"u"}, solana=lambda m,s: None, environ={}) is None

def test_write_record_result_missing_commit_returns_none_variants():
    # non-dict result
    assert write_record(None, store=None, now=lambda: 0, rekor=lambda d,p: {"uuid":"u"}, solana=lambda m,s: None, environ={}) is None
    assert write_record("string", store=None, now=lambda: 0, rekor=lambda d,p: {"uuid":"u"}, solana=lambda m,s: None, environ={}) is None

def test_write_record_exception_secret_not_in_caplog_and_key_not_in_caplog(caplog):
    caplog.set_level(logging.ERROR)
    secret = "SECRET-TEXT"
    pem_bytes = gen_ec_pem()
    pem_str = pem_bytes.decode()
    # writer that raises with secret in message
    def fake_rekor(doc, pem):
        raise RuntimeError(secret)
    env = {"REKOR_SIGNING_KEY": pem_str, "SOLANA_DEVNET_SEED": gen_ed_seed().hex()}
    # put a solana writer that also fails with secret to ensure not leaked
    def fake_solana(memo, seed_hex):
        raise RuntimeError(secret)
    write_record(_result(), store=DictStore(), now=lambda: 0, rekor=fake_rekor, solana=fake_solana, environ=env)
    assert secret not in caplog.text
    # signing key should never appear in logs
    for line in pem_str.splitlines():
        if len(line) > 10:
            assert line not in caplog.text

def test_write_record_result_missing_commit_returns_none_explicit():
    # ensure writer not called when result incomplete
    called = []
    def fake_rekor(doc, pem):
        called.append(1)
        return {"uuid":"u"}
    rec = write_record({"owner":"o"}, store=DictStore(), now=lambda: 0, rekor=fake_rekor, solana=fake_rekor, environ={"REKOR_SIGNING_KEY":"k"})
    assert rec is None
    assert called == []
