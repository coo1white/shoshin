# Task: step 8, a public record of each check

After a check, the server writes a public record: a hash of the result, in Sigstore Rekor and in a Solana devnet memo. Anyone can download the result, hash it, and find the same hash in both places. A record never stops the page, and it never holds file contents.

Return the full text of every file you add or change. Also return one entry with the path `COMMIT_MSG`: the commit message, in commit form with a type prefix, plain English, with no Co-Authored-By line and no tool attribution. No tests in this reply: they come next. Use plain imports, as the other server modules do.

## `server/record/` (new folder, with an empty `__init__.py`)

The new runtime dependency is `cryptography`. Add it to `server/requirements.txt` and to `web_image`'s `pip_install`. Everything else is the standard library.

### `server/record/document.py`: pure

- `make_document(result, recorded_at) -> bytes`. The canonical JSON of `{"schema": "yokoten-doctor/1", "recorded_at": <recorded_at>, "result": <result>}`: `json.dumps(..., sort_keys=True, separators=(",", ":"), ensure_ascii=False)`, then UTF-8. `result` is the object sent in the `result` event, which holds only yokoten's output. `recorded_at` is a UTC time such as `2026-10-31T04:00:00Z`.
- `document_hash(document) -> str`: SHA-256 as 64 lower-case hex characters.
- `record_key(owner, repo, commit, version) -> str`: lower-case `record:<owner>/<repo>@<commit>@<version>`.
- `memo_text(owner, repo, commit, version, sha256) -> str`: compact JSON with sorted keys of `{"app": "yokoten-doctor/1", "commit", "repo": "<owner>/<repo>", "sha256", "yokoten": <version>}`. Raises `ValueError` over 500 bytes in UTF-8.

### `server/record/rekor.py`

`REKOR_URL = "https://rekor.sigstore.dev/api/v1/log/entries"`. The signing key is an ECDSA P-256 private key in PEM.

- `build_entry(document, private_key_pem) -> dict`. Signs `document` with ECDSA over SHA-256 and returns exactly:
  ```json
  {"apiVersion": "0.0.1", "kind": "hashedrekord", "spec": {
    "data": {"hash": {"algorithm": "sha256", "value": "<hex sha256 of document>"}},
    "signature": {"content": "<base64 of the DER signature>", "publicKey": {"content": "<base64 of the public key PEM>"}}}}
  ```
- `write_entry(document, private_key_pem, post=post_json) -> dict`. Posts the entry. On HTTP 201, the reply is an object with one key, the entry's uuid, whose value holds `logIndex` and `integratedTime`. Returns `{"uuid", "log_index", "integrated_time", "url": "https://search.sigstore.dev/?logIndex=<log_index>"}`. On HTTP 409, the entry already exists: read the uuid from the `Location` header's last path part, and return `{"uuid", "log_index": None, "integrated_time": None, "url": "https://search.sigstore.dev/?uuid=<uuid>"}`. Anything else raises `RecordFailed`.
- `post_json(url, body, timeout) -> (status, headers, text)`. One POST with `urllib.request`. A 4xx or 5xx returns its status, not an exception. Timeout 15 seconds.

### `server/record/solana.py`

Solana devnet only. The address `https://api.devnet.solana.com` is a constant, and no argument can change it: this code must never reach mainnet. `MEMO_PROGRAM = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"`. The key is a 32-byte Ed25519 seed in hex.

- `base58_encode(data) -> str` and `base58_decode(text) -> bytes`, in pure Python, keeping leading zero bytes as `1`.
- `compact_u16(value) -> bytes`: Solana's short vector length.
- `build_memo_message(fee_payer: bytes, recent_blockhash: bytes, memo: bytes) -> bytes`. A legacy transaction message: header `[1, 0, 1]`; 2 account keys in order: the fee payer, then the memo program; the recent blockhash; 1 instruction with program index 1, account indexes `[0]`, and `memo` as its data. Lengths use `compact_u16`.
- `sign_transaction(seed: bytes, message: bytes) -> (signature: bytes, wire: bytes)`. `wire` is `compact_u16(1) + signature + message`.
- `write_memo(memo, seed_hex, rpc=rpc_call) -> dict`. Calls `getLatestBlockhash` with commitment `confirmed`, then `sendTransaction` with the base64 wire and `{"encoding": "base64", "preflightCommitment": "confirmed", "maxRetries": 2}`. A JSON-RPC `error` raises `RecordFailed`. Returns `{"signature": <base58>, "url": "https://explorer.solana.com/tx/<signature>?cluster=devnet"}`.
- `rpc_call(method, params, timeout=15) -> dict`. One POST with `urllib.request`.

This file holds no transfer instruction and no airdrop. The only instruction it can build is a memo.

### `server/record/write.py`

- `RecordFailed` lives here, and the other two modules import it.
- `write_record(result, store=None, now=time.time, rekor=write_entry, solana=write_memo, environ=os.environ) -> dict`. Returns `{"sha256", "recorded_at", "document": <the canonical text as str>, "rekor": dict|None, "solana": dict|None}`, or None when `result` lacks `owner`, `repo`, `commit` or `yokoten_version`. It never raises.
  - One record for each repo, commit and yokoten version. When `store.get(record_key(...), None)` returns a record whose `rekor` is set, return it as it is, with no new write. A record with `rekor` None is tried again.
  - `REKOR_SIGNING_KEY` holds the PEM with `\n` written as the two characters backslash and n, because the secret file is one line per value: turn them back before use. `SOLANA_DEVNET_SEED` holds the hex seed. A missing value skips that write and leaves its field None.
  - Each write is in its own `try`. Log only the error's type name. An error's text, a key or a document must never reach a log or the caller.
  - Store the record with `store.put` when `rekor` or `solana` is set. A store that raises counts as no store.

## `server/app.py` (change)

- `create_api(..., write_public_record=None)`. None means no record and no `record` event, so tests that do not care stay as they are. `fastapi_app()` passes a function calling `write_record(result, store=open_cache())`.
- The new event `record` comes after `fixes`, and then the stream ends. Pass it the same object that the `result` event sent. It carries `{"sha256", "recorded_at", "document", "rekor", "solana"}`.
- Run it in the worker, after `fixes`. If it raises or returns None, or the 170-second limit is reached, send no `record` event and end the stream. Never send an `error` event after `result`. When no recorder is given, the stream ends at `fixes`, as it does now.
- `web_image`: also `.add_local_dir(HERE / "record", "/root/record")`.
- `@app.function` also gets `modal.Secret.from_name("yokoten-doctor-record")`.

## `web/fixes.js` (change)

- `recordView(record) -> {sha256, recordedAt, documentName, documentText, verifyCommand, rekorUrl, solanaUrl, message}`, or null for a null record.
  - `documentName` is `yokoten-doctor-<first 12 characters of sha256>.json`.
  - `verifyCommand` is `sha256sum <documentName>`.
  - `rekorUrl` and `solanaUrl` come from the record, kept only when `rekorUrl` starts with `https://search.sigstore.dev/` and `solanaUrl` starts with `https://explorer.solana.com/` and ends with `?cluster=devnet`. Otherwise null.
  - `message` is an empty string when both are set. With only Rekor: "The devnet record could not be written this time." With neither: "The public record could not be written this time. The result above is still right."

## `web/app.js` (change)

Handle the `record` event: store it, and render. A new check clears it. Keep `createElement` and `textContent` only, and links only through `createLink`.

Add to "Check it yourself", after the commands, a part called "Public record":
- "A hash of this result is in a public log. Download the result, hash it, and compare. The record holds no file contents."
- The hash in monospace, and `recordedAt`.
- A button "Download the result", which downloads `documentText` exactly, as UTF-8, under `documentName`.
- `verifyCommand` in a code block with a Copy button.
- Links: "Rekor entry", and "Solana devnet memo". Next to the second, in small text: "Devnet is a test network. It can be reset, and it holds no real money."
- `message`, when it is not empty.

## `web/index.html` (change)

Nothing here reaches another host from the browser: the links are normal links, and the page does not call Rekor or Solana. The Content-Security-Policy stays as it is.

## `.github/workflows/test.yml` (change)

No change is needed if `pip install -r server/requirements.txt` already runs. Leave it as it is in that case.

## `README.md` (change)

In "How it works", add a step after the last one: "6. The server writes a hash of the result to Sigstore Rekor and to a Solana devnet memo. You can download the result and compare." Under "Run your own copy", add one step: "Put `REKOR_SIGNING_KEY` and `SOLANA_DEVNET_SEED` in the server secret store to turn on the public record. Without them the page works, and writes no record." Keep the Disclosure section word for word.
