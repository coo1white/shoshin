In `server/record/write.py`, a stored record with `rekor` set is returned as it is, so a record stored while Solana was down or the wallet was empty never gets its memo.

Change `write_record`:
- A stored record with both `rekor` and `solana` set: return it as it is, with no write.
- A stored record with `rekor` set and `solana` None, and `SOLANA_DEVNET_SEED` set: keep its `sha256`, `recorded_at`, `document` and `rekor`. Write only the memo, using the stored `sha256`. On success, store the record with `solana` set, and return it. On failure, log the type name, and return the stored record unchanged.
- Everything else stays as it is.

Add tests to `test/record/test_record.py`: a stored record with `rekor` set and `solana` None calls only the Solana writer, keeps the same hash and time, and stores the result; that writer raising returns the stored record and stores nothing; with no seed, no writer is called; both set means no writer is called. Keep every current test. A current test that says a stored record with `rekor` set makes no new write should store `solana` as set too.

Return the full text of `server/record/write.py` and `test/record/test_record.py`, and also one entry with the path `COMMIT_MSG`: `fix:` commit form, one short body line, no Co-Authored-By line, no tool attribution.
