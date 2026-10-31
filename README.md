The web version of `yokoten doctor`.

# yokoten doctor (web)

Paste a public GitHub repo URL and see what `yokoten doctor` says about it,
without opening a terminal. The page shows the same checks as the command
line tool, then hands you the files to fix what is missing.

This repo holds the page in `web/src/` and the small server in `server/`. The
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
3. Serve the static files from `dist/` after `npm run build` on any static host. See `docs/hosting.md`.
4. Open the page and paste a public repo URL.
5. Put `REKOR_SIGNING_KEY` and `SOLANA_DEVNET_SEED` in the server secret store to turn on the public record. Without them the page works, and writes no record.

For the full check on your own machine, run `npx yokoten`.

## How this is built

Each tool does what it is good at. Claude Opus 5.5 plans and reviews. Muse Spark Open writes the code from task briefs, and writes each repo's project section at run time. yokoten makes the checks, which give the same result every time. Modal runs one throwaway sandbox for each check, and Baseten serves Muse Spark Open. See `REVIEW.md` and `docs/build-log.md`.

## Where to report

- A wrong check result goes to the yokoten repo. The checks are yokoten's;
  this page only shows them.
- A broken page goes here, in this repo's issues.

## Disclosure

This entry was built during the hackathon, with these tools:

- **Muse Spark Open** (`muse-spark-open-1026`, on Baseten) wrote the code in this repo, from task briefs. At run time it writes each repo's "This project" section.
- **Claude Opus 5.5** (Claude Code) wrote `docs/design.md` and the task briefs in `docs/tasks/`, reviewed the code, ran the tests and deploys, and made the commits. It chose what to build and how with the owner, so the briefs are detailed. It typed a few lines by hand: the API address in `web/src/client/app.ts`, small edits to docs, and small fixes that each pull request names.
- **yokoten** (`yokoten@0.2.0`) started before the hackathon, and it kept changing during it, in its own repo. This page uses version 0.2.0, released on 2026-10-30. That version holds two things made during the hackathon that this page uses: `doctor --files`, and the `how` field in its JSON. None of yokoten's commits from that time name Muse. yokoten is an npm dependency, no yokoten code is copied here, and its work is not part of this entry. The checks on the page are yokoten's.
- **A reviewer model** that writes no code here reviews each pull request, through OpenCode Go, from PR #22 on. Each review names its model.

yokoten's logo and site style existed before this project, and the page's style follows them.

A `Co-Authored-By` line names Muse on commits whose code it wrote. Claude's part is stated here instead of in those lines, and some commit messages also name it. Commit messages were edited once, before the first push, to change those lines.

### A note for the organizers

As we understand the rules, all contributors must be approved participants. One person made this entry, and that person is the only participant. Muse and Claude are AI tools used in this work, not people on a team. Our notes on the rules do not say whether an AI tool counts as a contributor, so we state our use of them here, in the open. If this use of Claude is not allowed, please tell us, and we will follow your decision.
