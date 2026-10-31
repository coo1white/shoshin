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

## Run your own copy

You need your own Modal account and your own Baseten key. Nothing here
shares the demo's keys.

1. Put your Baseten key in the server secret store as `BASETEN_API_KEY`.
   Keep it out of this repo and out of the browser.
2. Deploy the Python app in `server/` to Modal.
3. Serve the static files in `web/` on any static host. See `docs/hosting.md`.
4. Open the page and paste a public repo URL.

For the full check on your own machine, run `npx yokoten`.

## Where to report

- A wrong check result goes to the yokoten repo. The checks are yokoten's;
  this page only shows them.
- A broken page goes here, in this repo's issues.

## Disclosure

yokoten is a pre-existing tool, used here as an npm dependency
(`yokoten@0.2.0`). No yokoten code is copied into this repo. Muse
wrote the code in this repo. Claude planned it and reviewed it.
