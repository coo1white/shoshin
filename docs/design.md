# yokoten doctor (web): design

Status: draft 3, 2026-10-28; owner decisions of 2026-10-29 added. Written by Claude (design and review only).
Every line of code in this repo is written by Muse, from this document.

Changes from draft 2: the server runs the real yokoten instead of the page
re-implementing its checks; one repo holds web and server; each result can be
re-run by anyone; an optional public record of each check.

## 1. What it is

A web page for people who have never used a terminal tool like yokoten.

1. They paste a public GitHub repo URL.
2. Behind the page, the latest yokoten release checks that repo, exactly as
   `yokoten doctor` would.
3. Muse writes the missing files for *this* repo (not a template), and the page
   hands them over as a patch to download or files to copy.
4. The page ends with one line: for the full check on your own machine, run
   `npx yokoten`.

It is a front door to yokoten, not a new product. The yokoten CLI stays the
product; this page brings people to it.

Shape borrowed from ora.ai and is-agentic.com (paste a URL, get evidence and
ranked fixes). Different in three ways: it reads a code repo, not a website; it
gives the fix itself, not only advice; and nothing is hidden. yokoten is MIT,
and so is this page. Every check shows the rule it used, the page shows exactly
what was sent to Muse, the fixes need no sign-up or waitlist, and anyone can
re-run a result or run their own copy.

### The name

Same name as the `yokoten doctor` command on purpose: the judging is the same
thing, so what the page shows is what the terminal would show. The page adds
the sandbox run and the Muse-written fixes. Three rules keep the shared name
from confusing anyone:

- Where to report: a wrong check result goes to the yokoten repo; a broken
  page goes to this repo. The README and the page footer link both.
- No npm package from this repo. The one way to install is `npx yokoten`.
- One way to say it: "doctor.yokoten.app" or "yokoten doctor (web)"; the repo
  description is "The web version of `yokoten doctor`". Never a new product
  name.

## 2. Goals and non-goals

Goals, in order:

1. One paste to a useful result in under 60 seconds.
2. The result is something you can use: real files written for your repo.
3. The web result is the CLI result: the page shows what yokoten itself said.
4. Nobody has to trust our server: a result can be re-run by anyone (section 6.4).
5. Small enough for one person to finish and demo by the deadline.

Not in v1 (said out loud so nobody builds it):

- No GitHub write access. The page never opens a pull request, never pushes,
  stores no GitHub token from the user.
- No private repos. No sign-in.
- No score dial or chart as the main thing. A dashboard as the main feature is
  banned by the hackathon rules; the main thing is the generated fix.
- No chat box. (An ask box with fixed answers is an optional last step,
  section 9; it is never the main feature.)
- No checks of our own. Every mark comes from yokoten.

## 3. Rules from the hackathon that shape the design

- Fresh public repo; only work done after the kickoff counts.
- yokoten is a pre-existing tool, disclosed as one. It is an npm dependency of
  the server, like Node.js; no yokoten code is copied into this repo. What is
  new and scored: the page, the sandbox service that runs yokoten, the Muse
  part, and the re-run proof.
- Meta model use is 25% of the score, so Muse does real work at run time: it
  reads the repo and writes the files. The checks are yokoten's plain code
  (fast, the same every time); Muse is used where judgment and writing are
  needed.
- Open Weights bonus: the run-time model is Muse Spark Open, served by Baseten.
- Deadline 2026-11-05 02:00 UTC. Video 3 minutes.

## 4. User flow (one page, three states)

**State A, empty.**

- Headline: "Is your repo ready for AI agents?"
- One input: GitHub repo URL. One button: Check.
- Under the button, before any click, the privacy line (always visible):
  "We copy the public files of this repo into a throwaway sandbox, run yokoten
  on them, and send some of them to Muse Spark Open (Meta's open model, run by
  Baseten) to write the fixes. Public repos only. We keep nothing."
- Three example repos as links, so a judge can try it in one click.

**State B, working.** Shows the steps as they happen, so the wait is honest:
"Copying the repo… yokoten is checking… Muse is writing AGENTS.md…" The checks
appear the moment yokoten is done; the Muse part streams in after.

**State C, result.** Laid out like `yokoten doctor` in a terminal, so a user
who moves to the CLI sees the same thing:

1. Top line: "done 7 of 11 checks · next: <the first step not done>".
2. One sentence, written by Muse, about this repo, e.g. "An agent here would
   not know how to run the tests, because nothing in the repo says how."
3. The next step only: yokoten's own what, why and fix for it, and the file
   Muse wrote for it (path, content, Copy button).
4. "Show all checks" folds out the rest, in yokoten's road order, each with its
   mark (done / to do / needs your machine), and its own file if any.
5. One button for all fixes: "Download patch" (a `git apply` patch), with the
   two commands to apply it.
6. **Check it yourself** (always visible, small): "Checked by yokoten 0.1.3 at
   commit abc1234" and the command to re-run it, with a Copy button
   (section 6.4).
7. Two folds that make the page open:
   - **How this was judged**, inside each check: yokoten's own "how" text for
     that step and a link to that step in yokoten's source.
   - **What we sent to Muse**: the list of files read, their sizes, and the full
     prompt, as sent.

Mobile width works. No sign-in, no cookies apart from what the host needs.

## 5. Checks

The page has no checks of its own. The sandbox runs
`yokoten doctor --all --json` and `yokoten check --json` and the page shows
what they return.

`doctor --json` (seen on yokoten 0.1.2) gives `steps` (each `id`, `stage`,
`mark`: done / to do / next / can't check) and `findings` (each `id`, `what`,
`why`, `fix`). The page uses these fields as they are, with three rules
(confirmed on yokoten main, 2026-10-29; a contract test pins these keys and
types for v0.1.3, and new keys may only be added):

- Key everything on `steps[].id`. `findings` also holds notes that are not
  steps, so look a step's finding up by id; never walk `findings` as the list.
- Exit code 1 is normal (some step is to do). The runner reads the JSON on
  stdout and treats only bad JSON or a timeout as a failure.
- With no network in the sandbox, the server steps come back "can't check"
  ("gh is not installed") in about half a second; the page shows them as
  "needs your machine".
- Fields read (agreed with the yokoten lead 2026-10-29; pinned for outside
  readers by yokoten issue #1202, fields may be added, never renamed,
  removed or retyped): doctor top `version`, `stage`, `next.id`; `steps[]` `id`,
  `stage`, `mark` with exactly "done", "to do", "next", "can't check",
  "not now" (the repo's yokoten.json skips the step on purpose; it then also
  carries `reason`, shown as "skipped on purpose: <reason>"); any other value
  shows as "unknown" instead of failing the page;
  `findings[]` `id`, `what`, `why`, `fix`, optional `docs`. check top `ok`;
  `findings[]` `id`, `what`, `file`, `line`, `grade`, `why`, `fix`, where
  `what` never holds the secret value.
- A done step has no text in 0.1.2. yokoten issue #1203 (v0.1.3) adds an
  optional `how` and `why` to every `steps[]` entry, the same text
  `yokoten explain <id>` prints; the "How this was judged" fold shows it.
- v0.1.3 is wanted on npm by 2026-11-02 00:00 UTC; hard latest 2026-11-03
  12:00 UTC, or the demo pins v0.1.2 and avoids repos it misreads.

**File-based steps.** These are judged from the repo's files alone, so anyone
who re-runs the same yokoten version on the same commit gets the same mark:
`rules`, `runtime`, `tests`, `ci`, `issues`, `templates`, `no-build-output`,
`changelog`, `titles`, `codeowners`, `security-files`.

**Needs your machine.** These read the user's own machine or need admin access
to the repo, so the sandbox cannot judge them and the page does not promise
them: `tool-hook`, `commit-check`, `remote`, `bot`, `skills`, `sandbox`,
`labels`, `milestone`, `review`, `protection`, `merge-settings`,
`security-settings` and the release steps. They show as "needs your machine",
with the `npx yokoten` line.

(The split above is read from yokoten's `src/setup/road.ts` today. If a later
yokoten moves a step, the page follows yokoten, not this list; a test fails if
a step id in the list is no longer in doctor's output.)

**Secrets.** `yokoten check --json` runs on the same copy. A secret hit is shown
first, above everything else, with yokoten's masked text only; the value is
never shown or sent to Muse. (Wallet keys are not found yet; that is yokoten
issue #1168.)

Known yokoten misreads that show up on real repos (Foundry tests, Renovate,
Changesets and more) are yokoten issue #1167; the page shows what yokoten says
and does not patch around it. The demo repos are picked with that in mind.

## 6. Architecture

```
browser (static page)
   │  POST /api/check {url}
   ▼
API (Modal web endpoint) ── Baseten: Muse Spark Open (summary + files)
   │  starts one sandbox per check
   ▼
sandbox (Modal, throwaway): git clone --depth 1 → yokoten doctor/check --json
   │  returns the JSON and the few files Muse may read
   ▲
streamed events (server-sent events) back to the browser
```

- One repo, `coo1white/yokoten-doctor`, holds web and server.
- Web: static files (one HTML file, one TS file, one CSS file), on any static
  host. Served at `doctor.yokoten.app` (owner, 2026-10-29). Trust does not
  rest on the host (section 6.4).
- Server: Modal, which gives one throwaway sandbox per check. (Not checked yet:
  the exact Modal sandbox and web endpoint API, and how far the hackathon
  credits go. The credits must first be claimed by the owner.)
- yokoten version: the server image installs the latest yokoten release from
  npm at each deploy, and a daily job rebuilds it; nothing is fetched at check
  time. The version used is written into every result. yokoten v0.1.3 ships
  before 2026-11-02 UTC with the misread fixes (issue #1167, issue #1169) and
  a contract test that pins the `doctor --all --json` shape.
- Language (decided 2026-10-29): TypeScript for the web page and its tests;
  a small Python app on Modal for the server (receive the URL, start the
  sandbox, call Muse, stream back). Modal's web endpoints and Functions are
  Python only; its JS SDK (npm `modal`) can drive sandboxes but cannot define
  an endpoint, so a TypeScript server would need a second host. This is a
  stated exception to the owner's "no new Python in TS projects" rule, kept
  to `server/`. Modal credits: claimed, valid during the hackathon only.
- Secrets live only in the server's secret store, never in the repo, never in
  the browser, never inside the sandbox, never in a Muse prompt:
  `BASETEN_API_KEY`.

### 6.1 The sandbox run

- Accept `https://github.com/<owner>/<repo>` (with or without `.git`, a trailing
  slash, `/tree/<branch>`). Anything else: a plain error.
- Ask GitHub (public API, no token) whether the repo is public, its default
  branch and size. Private or over 500 MB: stop with a plain message.
- In a fresh sandbox:
  - `git clone --depth 1 --no-recurse-submodules` with hooks off
    (`-c core.hooksPath=/dev/null`), then note the commit;
  - `yokoten doctor --all --json` and `yokoten check --json`;
  - read the files Muse may see: README, AGENTS.md, CLAUDE.md, the package file
    (package.json / pyproject.toml / Cargo.toml / go.mod / foundry.toml /
    Anchor.toml / Makefile, whichever exist), the workflow files, CODEOWNERS,
    the first 3 KB of CHANGELOG.md. Each cut at 20 KB, 120 KB in all.
- The sandbox never runs the repo's own code: no install, no build, no tests,
  no scripts. It has no secrets. Limits: 2 minutes, 1 CPU, 1 GB memory, 1 GB
  disk. Destroyed after the run.
- Two rules taken from the yokoten desk, whose recent bugs came from exactly
  these (owner's yokoten lead, 2026-10-29):
  - Network to an allowlist only: GitHub for the clone, and nothing at all
    while yokoten runs. doctor then skips the GitHub-settings steps; yokoten
    v0.1.3 has a test that it does so without waiting or failing.
  - A writable temp folder of the sandbox's own, set in `TMPDIR`, `TEMP` and
    `TMP`.
- Never read or send to Muse: anything matching `.env*`, `*.pem`, `*.key`,
  `id_*`, `*keypair*.json`, or any file a `check` hit points to.

### 6.2 Muse at run time

- One call per check run, streamed, made by the API, outside the sandbox.
  Model: Muse Spark Open on Baseten, through Baseten's OpenAI-compatible chat
  API. Model slug `meta-models/muse-spark-open-1026` (other entrants report it
  working in the hackathon's Baseten channel, 2026-10-29; base URL not checked
  yet). The hackathon key comes without a usage page, and some entrants report
  429 rate-limit errors at low use, so the page must spend few calls:
  - one Muse call per repo commit: the result (checks + Muse files) is cached
    for 24 hours, keyed by repo, commit and yokoten version (a small Modal
    key-value store holding public data only); a second check of the same
    commit costs no call;
  - on 429, wait and retry once, then show the checks without Muse files.
- Input: the repo facts (name, description, file list, the files read in 6.1)
  and doctor's findings for the file-based steps that are not done.
- Output: one JSON object, validated by the API before anything is shown:

```json
{
  "summary": "one sentence about this repo, plain English, at most 30 words",
  "files": [
    { "path": "AGENTS.md", "step": "rules", "why": "one line", "content": "..." }
  ]
}
```

- Only paths for a step that is not done may come back: `rules` (AGENTS.md and
  the import line in an existing CLAUDE.md), `tests` (a CI workflow), `templates`
  (issue and pull request templates), `changelog` (CHANGELOG.md), `codeowners`
  (CODEOWNERS), `security-files` (SECURITY.md, Dependabot config; never a
  license). Any other path is dropped. A file that already exists is never
  replaced.
- Run-time prompt (system), to be used as written:

  > You help a developer get their repository ready for AI coding agents. You
  > get facts about one repository and the checks it failed. For each failed
  > check that lists a file, write that file for THIS repository: use its real
  > test command, language, folders and owner. Never invent a command that the
  > files do not show; if you cannot tell, write a short TODO line in the file
  > saying what the owner must fill in. Keep AGENTS.md under 80 lines: how to
  > build, how to test, what not to touch, how to open a pull request. Plain
  > English, short sentences. Reply with one JSON object in the given shape and
  > nothing else.

- If Muse fails or returns bad JSON: retry once; then show the checks without
  generated files and say so. The checks never wait on Muse.
- Muse's files are suggestions, not results: a model's output is not the same
  twice, so it is not re-runnable. The page says "Suggested by Muse; read
  before you apply."

### 6.2a Write once: the fix files come from `yokoten init`

The files are yokoten's own standard, not Muse's invention (owner,
2026-10-29: "write once, run everywhere"; v0.1.3 is where the standard
settles):

- The sandbox runs `yokoten init` (no `--github`, no network) in the
  throwaway clone and takes only these paths from `git status`: AGENTS.md,
  `.github/ISSUE_TEMPLATE/*`, `.github/pull_request_template.md`,
  `.github/SECURITY.md`, `.github/dependabot.yml`, `.github/CODEOWNERS` (with
  the repo owner's handle in place of the placeholder), and later the test
  workflow. It drops `.yokoten/` (the 3.6 MB runtime), `.githooks/` and every
  agent config: those need yokoten installed, which `npx yokoten` does.
- Muse writes only AGENTS.md's "## This project" section (build, test, what
  not to touch), the one place init leaves for the project. Everything above
  it is yokoten's core rules, word for word.
- So a user gets the same files from the page as from `yokoten init`, and a
  change to the standard reaches the page with the next yokoten release.
- Asked of yokoten, not blocking: `yokoten init --dry-run --json` printing
  {path, content, step} without writing, so the page needs no path list of
  its own. Not checked yet: that init runs no repo code (it looked so on a
  scratch repo, 2026-10-29).

### 6.3 Patch

Built in the browser from `files`: a unified diff that adds each file (and the
one-line CLAUDE.md change), downloadable as `yokoten-doctor.patch`. The page
shows `git apply yokoten-doctor.patch` under the button.

- The patch is made against the commit that was checked (shown on the page).
  It only adds files (plus the one CLAUDE.md line), so it still applies after
  main has moved on; if someone added a same-named file meanwhile, `git apply`
  stops with an error and overwrites nothing.
- First, for beginners (shown first, largest): each generated file gets an
  "Add on GitHub" button. It opens GitHub's own new-file page for that repo
  with the file name and content filled in
  (`https://github.com/<owner>/<repo>/new/<branch>?filename=<path>&value=<content>`);
  the user reads it and clicks "Commit changes", choosing a new branch and a
  pull request. No install, no terminal, and we still hold no write access.
  Not checked yet, to test on a scratch repo in build step 6: that GitHub
  still fills `value`, and the longest content that fits in the link; a file
  too long for the link falls back to its Copy button.
- Then the patch download above, folded.
- Last, folded, a copyable block turns the patch into a pull request from
  the user's own machine, with the user's own account (we still hold no write
  access):

  ```
  git switch -c yokoten-doctor-fixes
  git apply yokoten-doctor.patch
  git add -A && git commit -m "docs: add agent rules from yokoten doctor"
  git push -u origin yokoten-doctor-fixes
  gh pr create --fill
  ```

### 6.4 Check it yourself (re-run)

Nobody has to trust the server, as with Sourcify, Solana verified builds and
OpenSSF Scorecard: the hosted run is a convenience, and anyone can re-run it.

- Every result carries: the repo, the full commit hash, the exact yokoten
  version, and the command:

  ```
  git clone https://github.com/<owner>/<repo> && cd <repo>
  git checkout <commit>
  npx yokoten@<version> doctor --all --json
  ```

- The promise is for the file-based steps only (section 5): their marks must be
  the same. Steps that read the user's machine or GitHub settings may differ,
  and the page says so next to the command.
- The result JSON (what the page shows, minus Muse's files) can be downloaded,
  with its SHA-256 shown, so a user can keep it and compare later.

### 6.5 Optional, if time is left: a public record of each check

The owner supports recording every check publicly. Only if steps 1–7 of the
build order are done. What is recorded: repo, commit, yokoten version, time and
the SHA-256 of the result JSON. No file contents, nothing private.

Two records, both free (decided by the owner 2026-10-28: Solana devnet):

1. **Sigstore Rekor** (public, append-only transparency log; yokoten already
   uses it for `check --anchor`). The server signs with a signing key kept in
   its secret store; no money behind it. This is the lasting record.
2. **A Solana devnet memo transaction** carrying the same hash, through
   Solana's built-in Memo program: one transaction per check, readable in any
   Solana explorer set to devnet. Devnet SOL comes free from the faucet and is
   worth nothing, so the server's devnet wallet key cannot lose real money.
   Devnet can be reset, so this record may disappear; Rekor stays. Mainnet is
   a later decision of the owner's, not part of this build. Claude and Muse
   never move funds on any network.

The result page links to both entries. If only one fits in the time, Rekor
first.

## 7. Safety and abuse

- Public repos only; checked through the GitHub API before cloning.
- Rate limit: 10 checks per IP per hour, 300 per day in all. Over the limit: a
  plain message and the `npx yokoten` line.
- Size caps in 6.1; over 20,000 files: checks only, no Muse.
- The sandbox runs no repo code and holds no secrets (6.1).
- Everything from the repo, from yokoten or from Muse is shown as text,
  escaped; nothing is put into the page as HTML.
- No logs of repo contents. Logs keep only: time, owner/repo, commit, yokoten
  version, marks, durations, error type.
- Meta's free credits may use content for product improvement. Only public repo
  content goes to Muse, and the privacy line says so.

## 8. Repo layout

```
web/index.html, web/app.ts, web/style.css
web/patch.ts             6.3
server/                  Modal app: API, sandbox run (6.1), Muse (6.2), record (6.5)
test/web/                page states with saved doctor JSON, patch building
test/server/             URL parsing, JSON validation, path filter, file-based list
test/fixtures/           doctor and check JSON saved from real runs
README.md, LICENSE (MIT), SECURITY.md, AGENTS.md
```

Most tests run on saved JSON, with no network, no Modal and no Muse.

## 9. Build order (each step is one Muse task, reviewed by Claude)

1. Repo base: README (with "run your own copy": your own Modal and Baseten
   keys), MIT LICENSE, AGENTS.md, CI running the tests. The repo passes
   yokoten's own file-based steps (eat our own food, and it shows in the demo).
   Server in Python on Modal, web in TypeScript (section 6).
2. The sandbox run (6.1), returning doctor and check JSON for a URL. No page,
   no Muse.
3. The API with streaming, and the page states A, B, C with yokoten's results
   only.
4. "Check it yourself" (6.4).
5. Muse (6.2): streaming, JSON validation, path filter.
6. Fix cards and the patch download.
7. Rate limit, error states, mobile check, deploy.
8. Optional, if time is left: the public record (6.5), Rekor first.
9. Optional, cut first: the ask box (below).
10. Demo video.

**The ask box (optional).** One input under the result: "Ask about agent
safety in this repo". Muse only picks which yokoten step the question is about
(one of the step ids, or "none"). The answer shown is yokoten's own text for
that step (what, why, how), word for word, under the label "Answer from
yokoten's rules, not generated". "none" gets a fixed reply that points to
`npx yokoten`. Rule code is never presented as a model.

Done when, for the whole page: on three real public repos (one bare, one half
ready, one fully ready) a check finishes in under 60 s; the patch applies with
`git apply` on a fresh clone; the re-run command in 6.4 gives the same marks
for the file-based steps; and `npx yokoten doctor` on the patched clone shows
the patched steps as done.

## 10. Later (not for the hackathon)

- **Results from the project's own CI** (the OpenSSF Scorecard model): the
  project adds the yokoten GitHub Action; the run is signed with GitHub's OIDC
  identity through Sigstore and logged in Rekor, as yokoten's own anchor
  workflow already does; this page gets a lookup ("show the signed result for
  this repo") and a README badge. A private repo never goes into a public
  record (Rekor or a chain): even a hash entry names the repo and its commit.
  Private repos use the CLI or the Action in their own CI only; this page
  never touches them. yokoten issue #1205 makes this a rule in yokoten (refuse a
  private repo, fail closed when visibility can't be read) and blocks
  offering anchoring or CI-signed results to users until it lands. Strongest proof for web3 users. Mostly
  yokoten repo work; worth a place in yokoten's own plan.
- A files-only mode in `yokoten doctor`, so a re-run on any machine gives the
  same output with no "needs your machine" steps. yokoten repo work.
- Open a pull request for the user through a GitHub App: smallest scope, a new
  branch only, never the default branch, no token kept.
- A link from yokoten.app, added by the site lead once this page is stable.

## 11. Demo (3 minutes)

1. (0:00) The problem in one line: agents work in repos that tell them nothing.
2. (0:20) Paste a real bare repo. yokoten's checks appear, then Muse writes
   AGENTS.md for that repo: point at its real test command.
3. (1:20) Download the patch, `git apply`, run `npx yokoten doctor`: the same
   steps turn done. Web and CLI agree, because the web is the CLI.
4. (2:00) "Don't trust us": copy the re-run command, run it, same marks. (If
   6.5 is built: open the public record.)
5. (2:30) What runs where: real yokoten in a throwaway sandbox, Muse Spark Open
   on Baseten for the writing, no write access, public repos only.
6. (2:50) `npx yokoten` for the rest.

## 12. Open questions for the owner

- Subdomain `doctor.yokoten.app`: decided 2026-10-29; the owner adds the DNS
  record when the page is deployed.
- Modal: the hackathon credits must be claimed through the approval email.
- The public record (6.5): decided, Rekor plus a Solana devnet memo; mainnet
  later, only if the owner decides.
