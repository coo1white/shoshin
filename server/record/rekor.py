import base64
import hashlib
import json
import urllib.request
import urllib.error

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec

from .write import RecordFailed

REKOR_URL = "https://rekor.sigstore.dev/api/v1/log/entries"


def build_entry(document, private_key_pem) -> dict:
    if isinstance(private_key_pem, str):
        private_key_pem = private_key_pem.encode("utf-8")
    private_key = serialization.load_pem_private_key(private_key_pem, password=None)
    signature_der = private_key.sign(document, ec.ECDSA(hashes.SHA256()))
    digest_hex = hashlib.sha256(document).hexdigest()
    public_pem = private_key.public_key().public_bytes(
        serialization.Encoding.PEM,
        serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    return {
        "apiVersion": "0.0.1",
        "kind": "hashedrekord",
        "spec": {
            "data": {"hash": {"algorithm": "sha256", "value": digest_hex}},
            "signature": {
                "content": base64.b64encode(signature_der).decode("ascii"),
                "publicKey": {"content": base64.b64encode(public_pem).decode("ascii")},
            },
        },
    }


def post_json(url, body, timeout=15):
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            status = resp.status
            headers = dict(resp.headers)
            text = resp.read().decode("utf-8", errors="replace")
            return status, headers, text
    except urllib.error.HTTPError as e:
        try:
            text = e.read().decode("utf-8", errors="replace")
        except Exception:
            text = ""
        headers = dict(e.headers) if e.headers else {}
        return e.code, headers, text


def write_entry(document, private_key_pem, post=post_json) -> dict:
    entry = build_entry(document, private_key_pem)
    status, headers, text = post(REKOR_URL, entry, timeout=15)
    if status == 201:
        try:
            obj = json.loads(text) if text else {}
        except Exception:
            raise RecordFailed("bad response")
        if not isinstance(obj, dict) or len(obj) != 1:
            raise RecordFailed("bad response")
        uuid = next(iter(obj))
        val = obj[uuid]
        log_index = val.get("logIndex") if isinstance(val, dict) else None
        integrated_time = val.get("integratedTime") if isinstance(val, dict) else None
        return {
            "uuid": uuid,
            "log_index": log_index,
            "integrated_time": integrated_time,
            "url": f"https://search.sigstore.dev/?logIndex={log_index}",
        }
    if status == 409:
        loc = ""
        for k, v in headers.items():
            if k.lower() == "location":
                loc = v
                break
        uuid = loc.rstrip("/").split("/")[-1] if loc else ""
        if not uuid:
            raise RecordFailed("bad response")
        return {
            "uuid": uuid,
            "log_index": None,
            "integrated_time": None,
            "url": f"https://search.sigstore.dev/?uuid={uuid}",
        }
    raise RecordFailed(f"rekor status {status}")
