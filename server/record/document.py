import hashlib
import json


def make_document(result, recorded_at) -> bytes:
    obj = {"schema": "yokoten-doctor/1", "recorded_at": recorded_at, "result": result}
    text = json.dumps(obj, sort_keys=True, indent=2, ensure_ascii=False)
    text = text + "\n"
    return text.encode("utf-8")


def document_hash(document) -> str:
    return hashlib.sha256(document).hexdigest()


def record_key(owner, repo, commit, version) -> str:
    return f"record:{owner}/{repo}@{commit}@{version}".lower()


def memo_text(owner, repo, commit, version, sha256) -> str:
    obj = {
        "app": "yokoten-doctor/1",
        "commit": commit,
        "repo": f"{owner}/{repo}",
        "sha256": sha256,
        "yokoten": version,
    }
    text = json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    if len(text.encode("utf-8")) > 500:
        raise ValueError("memo too long")
    return text
