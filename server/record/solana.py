import base64
import json
import time
import urllib.request
import urllib.error

from cryptography.hazmat.primitives.asymmetric import ed25519

from .write import RecordFailed

SOLANA_RPC_URL = "https://api.devnet.solana.com"
MEMO_PROGRAM = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"

_B58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
_B58_IDX = {c: i for i, c in enumerate(_B58_ALPHABET)}


def base58_encode(data: bytes) -> str:
    if not data:
        return ""
    n = int.from_bytes(data, "big")
    res = ""
    while n > 0:
        n, r = divmod(n, 58)
        res = _B58_ALPHABET[r] + res
    pad = 0
    for b in data:
        if b == 0:
            pad += 1
        else:
            break
    return "1" * pad + res if res else "1" * pad


def base58_decode(text: str) -> bytes:
    if not text:
        return b""
    n = 0
    for c in text:
        if c not in _B58_IDX:
            raise ValueError("invalid base58")
        n = n * 58 + _B58_IDX[c]
    pad = 0
    for c in text:
        if c == "1":
            pad += 1
        else:
            break
    if n == 0:
        decoded = b""
    else:
        h = hex(n)[2:]
        if len(h) % 2:
            h = "0" + h
        decoded = bytes.fromhex(h)
    return b"\x00" * pad + decoded


def compact_u16(value: int) -> bytes:
    out = bytearray()
    v = value
    while True:
        b = v & 0x7F
        v >>= 7
        if v:
            out.append(b | 0x80)
        else:
            out.append(b)
            break
    return bytes(out)


def build_memo_message(fee_payer: bytes, recent_blockhash: bytes, memo: bytes) -> bytes:
    if len(fee_payer) != 32:
        raise ValueError("fee_payer must be 32 bytes")
    if len(recent_blockhash) != 32:
        raise ValueError("recent_blockhash must be 32 bytes")
    memo_program = base58_decode(MEMO_PROGRAM)
    header = bytes([1, 0, 1])
    keys_len = compact_u16(2)
    keys = fee_payer + memo_program
    bh = recent_blockhash
    program_index = bytes([1])
    account_indexes = bytes([0])
    inst_data = (
        program_index
        + compact_u16(len(account_indexes))
        + account_indexes
        + compact_u16(len(memo))
        + memo
    )
    instructions_len = compact_u16(1)
    return header + keys_len + keys + bh + instructions_len + inst_data


def sign_transaction(seed: bytes, message: bytes):
    if len(seed) != 32:
        raise ValueError("seed must be 32 bytes")
    private_key = ed25519.Ed25519PrivateKey.from_private_bytes(seed)
    signature = private_key.sign(message)
    wire = compact_u16(1) + signature + message
    return signature, wire


def rpc_call(method, params, timeout=15):
    body = {"jsonrpc": "2.0", "id": 1, "method": method, "params": params}
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(SOLANA_RPC_URL, data=data, headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        text = resp.read().decode("utf-8", errors="replace")
        return json.loads(text)


def write_memo(memo, seed_hex, rpc=rpc_call, sleep=time.sleep, now=time.monotonic, wait_seconds=20) -> dict:
    if isinstance(memo, str):
        memo = memo.encode("utf-8")
    seed = bytes.fromhex(seed_hex)
    if len(seed) != 32:
        raise RecordFailed("bad seed")
    private_key = ed25519.Ed25519PrivateKey.from_private_bytes(seed)
    fee_payer = private_key.public_key().public_bytes_raw()
    resp = rpc("getLatestBlockhash", [{"commitment": "confirmed"}])
    if isinstance(resp, dict) and "error" in resp and resp["error"] is not None:
        raise RecordFailed("rpc error")
    try:
        blockhash_b58 = resp["result"]["value"]["blockhash"]
    except Exception:
        raise RecordFailed("bad blockhash")
    recent_blockhash = base58_decode(blockhash_b58)
    if len(recent_blockhash) != 32:
        raise RecordFailed("bad blockhash length")
    message = build_memo_message(fee_payer, recent_blockhash, memo)
    signature, wire = sign_transaction(seed, message)
    wire_b64 = base64.b64encode(wire).decode("ascii")
    resp2 = rpc("sendTransaction", [wire_b64, {"encoding": "base64", "preflightCommitment": "confirmed", "maxRetries": 2}])
    if isinstance(resp2, dict) and "error" in resp2 and resp2["error"] is not None:
        raise RecordFailed("rpc error")
    try:
        sig_b58 = resp2["result"]
    except Exception:
        raise RecordFailed("bad sendTransaction")
    if not isinstance(sig_b58, str):
        raise RecordFailed("bad signature")
    start = now()
    while True:
        try:
            resp3 = rpc("getSignatureStatuses", [[sig_b58], {"searchTransactionHistory": False}])
        except Exception:
            resp3 = None
            is_error = True
        else:
            is_error = isinstance(resp3, dict) and "error" in resp3 and resp3["error"] is not None
        if not is_error and resp3 is not None:
            try:
                value = resp3["result"]["value"][0]
            except Exception:
                value = None
                should_continue = True
            else:
                if value is None:
                    should_continue = True
                else:
                    err = value.get("err")
                    if err is not None:
                        raise RecordFailed("transaction err")
                    cs = value.get("confirmationStatus")
                    if cs in ("confirmed", "finalized"):
                        return {
                            "signature": sig_b58,
                            "url": f"https://explorer.solana.com/tx/{sig_b58}?cluster=devnet",
                        }
                    should_continue = True
        else:
            should_continue = True
        if should_continue:
            elapsed = now() - start
            if elapsed >= wait_seconds:
                raise RecordFailed("not confirmed")
            sleep(1)
