# Task: step 1, the repo base

Read `docs/design.md` first, sections 1 to 3, 6, 8 and 9. You write all the code in this repo;
Claude planned it and reviews it. This task adds no page and no server logic yet.

## Build

1. `README.md`: what this is, in plain words, for someone new. First line: "The web version of
   `yokoten doctor`." How it works in five short lines. "Run your own copy" (your own Modal and
   Baseten keys). Where to report: a wrong check result goes to the yokoten repo, a broken page
   goes here. Disclosure: yokoten is a pre-existing tool used as an npm dependency; Muse wrote the
   code; Claude planned and reviewed.
2. `LICENSE`: MIT, copyright holder "yokoten-doctor contributors", year 2026.
3. The standard files, from the real tool, not written by hand. In a throwaway copy of this repo run
   `npx --yes yokoten@0.2.0 init`, then copy ONLY these into the repo: `AGENTS.md`,
   `.github/ISSUE_TEMPLATE/*`, `.github/pull_request_template.md`, `.github/SECURITY.md`,
   `.github/dependabot.yml`, `.github/CODEOWNERS`. Never copy `.yokoten/`, `.githooks/` or any agent
   config: this repo must hold no pre-existing yokoten code.
   - Fill AGENTS.md's "## This project" section: how to build and test here, what not to touch
     (no secrets, no yokoten code copied in, never run a scanned repo's code).
   - CODEOWNERS: put the repo owner's GitHub handle in place of the placeholder.
4. `CHANGELOG.md` with an `## Unreleased` section.
5. Layout from section 8: `web/`, `server/`, `test/web/`, `test/server/`, `test/fixtures/`, each with
   the smallest real file. `package.json` (private, `"test": "node --test test/web/"`, Node 22+, no
   runtime dependencies) and `server/requirements.txt` holding only `modal`.
6. `test/web/smoke.test.mjs` and `test/server/test_smoke.py`: each one real assertion.
7. `.github/workflows/test.yml`: on push and pull request, run `npm test` and `python -m pytest
   test/server`, with actions pinned to a full commit hash.
8. `.gitignore`: `.env*`, `node_modules/`, `__pycache__/`, `.yokoten/`.

## Rules

- Nothing private anywhere: no real names, emails, paths or keys. Secrets never enter this repo.
- Commit on the current branch with `TZ=UTC git commit`. Do not push.
- Do not change `docs/design.md`. If it looks wrong, say so in your report.

## Done when

- `npm test` and `python3 -m pytest test/server` both pass.
- `npx --yes yokoten@0.2.0 doctor --files` shows rules, tests, ci, templates, changelog, codeowners
  and security-files done (titles, tool-hook, runtime and sandbox may stay to do: they need yokoten
  installed, which this repo deliberately does not vendor).
- `git status` is clean, and `git log` shows your commit.

Report: what you did, the two test results, the doctor marks, and anything in the design that
looked wrong.
