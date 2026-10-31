Review of step 8. Fix these. Return the full text of each file you change: `server/app.py`, `server/record/rekor.py`, `web/fixes.js`, `AGENTS.md`, `docs/public-record.md`, `README.md`, `.github/workflows/test.yml`. No tests in this reply. Also return one entry with the path `COMMIT_MSG`, replacing the earlier message: commit form with a type prefix, a body of 2 or 3 plain lines, no Co-Authored-By line, no tool attribution.

1. `server/app.py`: a stream that hangs. When `write_public_record` returns None or raises, the worker puts nothing on the queue, so the generator waits for the 170-second limit.
   - The worker always puts exactly one `("record", value)` item when a recorder is given, with `value` None on failure.
   - The generator handles `record` once: it sends the event when `value` is not None, then returns. It always returns.
   - Add one function `build_result_event(res) -> dict`: `build_result(res)` plus `default_branch`. Use it for both the `result` event and the recorder, so both get the same object. Remove the repeated code.
   - Time limit: replace the branches with one rule. `not result_sent`: the generic `error`. `result_sent and not fixes_sent`: `fixes` with `NO_FIXES`. Otherwise send nothing. Then return. Remove the branches that can never run.
   - Remove the local `import modal as _modal` style and any unused import. Keep the `record` import inside `_write_public_record`, so that tests can import `app` without `cryptography`.

2. `server/record/rekor.py`: move `import hashlib` to the top. On HTTP 409 with no uuid in `Location`, raise `RecordFailed`, so no empty link is returned.

3. `web/fixes.js`: in `recordView`, remove the long comments and the branch for only Solana. The message rule: both links set gives an empty string; `rekorUrl` set and no `solanaUrl` gives "The devnet record could not be written this time."; no `rekorUrl` gives "The public record could not be written this time. The result above is still right." Also return null unless `sha256` is 64 lower-case hex characters.

4. `AGENTS.md`: in "This project", under "Build", the server's runtime dependencies are now `modal`, `fastapi` and `cryptography`. Under "Test", the server tests also include `test/record/`. Change nothing else in the file.

5. `.github/workflows/test.yml`: change the last line to `python -m pytest test/server test/record`. Change nothing else.

6. `docs/public-record.md` (new). Plain English, short sentences, at most 45 lines.
   - What is recorded: a SHA-256 of the result, the repo, the commit, the yokoten version and the time. No file contents. Only public repos are checked, so only public repos are recorded. There is one record for each repo, commit and yokoten version.
   - How to check a record: download the result from the page; run `sha256sum` on it; open the Rekor entry and compare the hash; open the Solana memo and compare the hash.
   - Who signed it. The Rekor entries are signed with this public key:
     ```
     -----BEGIN PUBLIC KEY-----
     MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEv0r+aFPqK5dpXDY7YFcYxrjbJGAU
     7uYN++yltBw4UbETGnrjJjfwbv5JuDekJLsj33bcSuIkgDtoSQ9/M5y0Ag==
     -----END PUBLIC KEY-----
     ```
     The Solana memos are sent by the devnet address `4MXB78yjboUTWhQHVcnnTbT5FXBkQzHy6NptVWhT8x76`.
   - What a record proves and what it does not. It proves that this server held this result at that time, and that the result has not changed since. It does not prove the server ran yokoten honestly: for that, re-run the commands on the page.
   - Solana devnet is a test network. It can be reset, so its records may disappear. Rekor is the lasting record. The devnet coins have no value, and this code cannot reach mainnet.

7. `README.md`: at the end of "How it works", add the line "See `docs/public-record.md`." Keep the Disclosure section word for word.
