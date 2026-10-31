The web version of `yokoten doctor`.

# yokoten doctor (web)

Paste a public GitHub repo URL and see what `yokoten doctor` says about it,
without opening a terminal. The page shows the same checks as the command
line tool, then hands you the files to fix what is missing.

This repo holds the page in `web/` and the small server in `server/`. The
server runs on Modal and calls Muse Spark Open on Baseten to write the
fix files. The design is in `docs/design.md`.

## How it works

1. You paste a public GitHub repo URL.
2. A throwaway sandbox clones the repo and runs yokoten on it.
3. The page shows yokoten's checks, in the same order as the terminal.
4. Muse writes the missing files for your repo.
5. You copy the files or download them as a patch.
6. The server writes a hash of the result to Sigstore Rekor and to a Solana devnet memo. You can download the result and compare.

See `docs/public-record.md`.

## Run your own copy

You need your own Modal account and your own Baseten key. Nothing here
shares the demo's keys.

1. Put your Baseten key in the server secret store as `BASETEN_API_KEY`.
   Keep it out of this repo and out of the browser.
2. Deploy the Python app in `server/` to Modal.
3. Serve the static files in `web/` on any static host. See `docs/hosting.md`.
4. Open the page and paste a public repo URL.
5. Put `REKOR_SIGNING_KEY` and `SOLANA_DEVNET_SEED` in the server secret store to turn on the public record. Without them the page works, and writes no record.

For the full check on your own machine, run `npx yokoten`.

## Where to report

- A wrong check result goes to the yokoten repo. The checks are yokoten's;
  this page only shows them.
- A broken page goes here, in this repo's issues.

## Disclosure

This entry was built during the hackathon, with these tools:

- **Muse Spark Open** (`muse-spark-open-1026`, on Baseten) wrote the code in this repo, from task briefs. At run time it writes each repo's "This project" section.
- **Claude Opus 5.5** (Claude Code) wrote `docs/design.md` and the task briefs in `docs/tasks/`, reviewed the code, ran the tests and deploys, and made the commits. It chose what to build and how with the owner, so the briefs are detailed. It typed a few lines by hand: the API address in `web/app.js`, and small edits to docs.
- **yokoten** (`yokoten@0.2.0`) is a tool that existed before the hackathon. It is an npm dependency, and no yokoten code is copied here. The checks on the page are yokoten's.

A `Co-Authored-By` line names Muse on commits whose code it wrote. Claude's part is stated here instead of in those lines, and some commit messages also name it. Commit messages were edited once, before the first push, to change those lines.
