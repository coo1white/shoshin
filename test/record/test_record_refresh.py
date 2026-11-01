import json
import pytest

from record.document import make_document, record_key
from record.write import write_record


class FakeStore:
    def __init__(self, initial=None):
        self._data = dict(initial or {})
        self.put_calls = []

    def get(self, key, default=None):
        return self._data.get(key, default)

    def put(self, key, value):
        self.put_calls.append((key, value))
        self._data[key] = value


def _result(owner="alice", repo="demo", commit="abc123", version="0.1.0", extra=None):
    r = {"owner": owner, "repo": repo, "commit": commit, "yokoten_version": version, "checks": []}
    if extra:
        r.update(extra)
    return r


def _stored_record(result, recorded_at="2024-01-01T00:00:00Z"):
    doc = make_document(result, recorded_at)
    return {
        "sha256": "abc",
        "recorded_at": recorded_at,
        "document": doc.decode("utf-8"),
        "rekor": {"uuid": "rekor-uuid"},
        "solana": {"sig": "sol-sig"},
    }


def test_equal_result_returned_as_is_no_write():
    result = _result(extra={"b": 2, "a": 1})
    key = record_key("alice", "demo", "abc123", "0.1.0")
    stored = _stored_record(result)
    store = FakeStore({key: stored})

    def fake_rekor(doc, pem):
        raise AssertionError("should not be called")

    def fake_solana(memo, seed):
        raise AssertionError("should not be called")

    out = write_record(result, store=store, rekor=fake_rekor, solana=fake_solana, environ={})
    assert out is stored
    assert store.put_calls == []


def test_equal_result_different_key_order_no_write():
    result_a = {"owner": "alice", "repo": "demo", "commit": "abc123", "yokoten_version": "0.1.0", "a": 1, "b": 2}
    result_b = {"owner": "alice", "repo": "demo", "commit": "abc123", "yokoten_version": "0.1.0", "b": 2, "a": 1}
    key = record_key("alice", "demo", "abc123", "0.1.0")
    stored = _stored_record(result_a)
    store = FakeStore({key: stored})

    def fake_rekor(doc, pem):
        raise AssertionError("should not be called")

    def fake_solana(memo, seed):
        raise AssertionError("should not be called")

    out = write_record(result_b, store=store, rekor=fake_rekor, solana=fake_solana, environ={})
    assert out is stored
    assert store.put_calls == []


def test_different_result_leads_to_one_new_write():
    old_result = _result(extra={"value": 1})
    new_result = _result(extra={"value": 2})
    key = record_key("alice", "demo", "abc123", "0.1.0")
    stored = _stored_record(old_result)
    store = FakeStore({key: stored})

    rekor_calls = []

    def fake_rekor(doc, pem):
        rekor_calls.append(doc)
        return {"uuid": "new-rekor"}

    def fake_solana(memo, seed):
        return {"sig": "new-sol"}

    environ = {"REKOR_SIGNING_KEY": "pem-data", "SOLANA_DEVNET_SEED": "ab" * 32}
    out = write_record(new_result, store=store, rekor=fake_rekor, solana=fake_solana, environ=environ, now=lambda: 0)
    assert len(rekor_calls) == 1
    assert len(store.put_calls) == 1
    assert store.put_calls[0][0] == key
    assert store.get(key) is out
    parsed = json.loads(out["document"])
    assert parsed["result"] == new_result
    assert out["rekor"] == {"uuid": "new-rekor"}


def test_no_document_behaves_as_today():
    result = _result()
    key = record_key("alice", "demo", "abc123", "0.1.0")
    stored = {"sha256": "abc", "recorded_at": "2024-01-01T00:00:00Z", "rekor": {"uuid": "x"}, "solana": {"sig": "y"}}
    store = FakeStore({key: stored})

    def fake_rekor(doc, pem):
        raise AssertionError("should not be called")

    def fake_solana(memo, seed):
        raise AssertionError("should not be called")

    out = write_record(result, store=store, rekor=fake_rekor, solana=fake_solana, environ={})
    assert out is stored
    assert store.put_calls == []


def test_invalid_json_document_behaves_as_today():
    result = _result()
    key = record_key("alice", "demo", "abc123", "0.1.0")
    stored = {
        "sha256": "abc",
        "recorded_at": "2024-01-01T00:00:00Z",
        "document": "not-json",
        "rekor": {"uuid": "x"},
        "solana": {"sig": "y"},
    }
    store = FakeStore({key: stored})

    def fake_rekor(doc, pem):
        raise AssertionError("should not be called")

    def fake_solana(memo, seed):
        raise AssertionError("should not be called")

    out = write_record(result, store=store, rekor=fake_rekor, solana=fake_solana, environ={})
    assert out is stored
    assert store.put_calls == []
