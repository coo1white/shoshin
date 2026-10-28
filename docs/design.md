# yokoten doctor (web): design

Status: draft 2, 2026-10-28. Written by Claude (design and review only).
Every line of code in this repo is written by Muse, from this document.

## 1. What it is

A web page for people who have never used a terminal tool like yokoten.

1. They paste a public GitHub repo URL.
2. The page reads the repo and says, in plain words, where an AI coding agent
   would get stuck or do damage there.
3. Muse writes the missing files for *this* repo (not a template), and the page
   hands them over as a patch to download or files to copy.
4. The page ends with one line: for the full check on your own machine, run
   `npx yokoten`.

It is a front door to yokoten, not a new product. The yokoten CLI stays the
product; this page brings people to it.

Shape borrowed from ora.ai and is-agentic.com (paste a URL, get evidence and
ranked fixes). Different in two ways: it reads a code repo, not a website, and it
gives the fix itself, not only advice.

And one more: nothing is hidden. yokoten is MIT, and so is this page. Every check
shows the rule it used, the page shows exactly what was sent to Muse, the fixes
need no sign-up or waitlist, and anyone can run their own copy.

## 2. Goals and non-goals

Goals, in order:

1. One paste to a useful result in under 60 seconds.
2. The result is something you can use: real files written for your repo.
3. The web result and `yokoten doctor` never disagree (same check names, same
   meaning).
4. Small enough for one person to finish and demo by the deadline.

Not in v1 (said out loud so nobody builds it):

- No GitHub write access. The page never opens a pull request, never pushes,
  stores no GitHub token from the user. (Possible v2, see section 10.)
- No private repos. No sign-in.
- No score dial or chart as the main thing. A dashboard as the main feature is
  banned by the hackathon rules; the main thing is the generated fix.
- No chat box. (An ask box with fixed answers is an optional last step,
  section 9; it is never the main feature.)
- Not every yokoten check. Only the ones a reader can judge from the repo's files
  (section 5).

## 3. Rules from the hackathon that shape the design

- Fresh public repo; only work done after the kickoff counts. yokoten is
  disclosed as a pre-existing tool. This repo copies no yokoten code; it only
  uses yokoten's public check names and links to it.
- Meta model use is 25% of the score, so Muse does real work at run time:
  it reads the repo and writes the files. The checks themselves are plain code
  (fast, the same every time); Muse is used where judgment and writing are
  needed.
- Open Weights bonus: the run-time model is Muse Spark Open, served by Baseten.
- Deadline 2026-11-05 02:00 UTC. Video 3 minutes.

## 4. User flow (one page, three states)

**State A, empty.**

- Headline: "Is your repo ready for AI agents?"
- One input: GitHub repo URL. One button: Check.
- Under the button, before any click, the privacy line (always visible):
  "We read the public files of this repo and send some of them to Muse Spark
  Open (Meta's open model, run by Baseten) to write the fixes. Public repos
  only. We keep nothing."
- Three example repos as links, so a judge can try it in one click.

**State B, working.** Shows the steps as they happen, so the wait is honest:
"Reading files… Checking 8 things… Muse is writing AGENTS.md…" Each check
appears with its mark the moment it is known; the Muse part streams in.

**State C, result.** Laid out like `yokoten doctor` in a terminal, so a user
who moves to the CLI sees the same thing:

1. Top line: "done 5 of 8 checks · next: <the first failed check>".
2. One sentence, written by Muse, about this repo, e.g. "An agent here would
   not know how to run the tests, because nothing in the repo says how."
3. The next step only: what is wrong, why it matters (one line each), and the
   file Muse wrote for it (path, content, Copy button).
4. "Show all 8 checks" folds out the rest, in the road order, each with its
   mark (done / missing / can't tell from the web), and its own file if any.
5. One button for all fixes: "Download patch" (a `git apply` patch), with the
   two commands to apply it.
6. Two folds that make the page open:
   - **How this was judged**, inside each check: the exact rule (the "done
     when" in section 5) and a link to that step in yokoten's source.
   - **What we sent to Muse**: the list of files read, their sizes, and the full
     prompt, as sent.
4. The closing line: "This page checks only what it can see from the web.
   For the whole check on your machine, and a guard that stops risky commands
   while the agent works: `npx yokoten`" with a link to yokoten.app.

Mobile width works. No sign-in, no cookies apart from what the host needs.

## 5. Checks

The page uses the key and meaning of the yokoten road step with the same name
(yokoten 0.1.1, `src/setup/road.ts`). Only steps that can be judged from a
repo's public files are in v1:

| key | done when (read from the repo files) | fixed by Muse? |
|---|---|---|
| `rules` | `AGENTS.md` at the root; if a `CLAUDE.md` (root or `.claude/`) exists, it imports it with a line `@AGENTS.md` (`@../AGENTS.md` from `.claude/`) | yes: writes AGENTS.md for this repo, and the import line |
| `tests` | a workflow in `.github/workflows` has a `run:` step that runs the tests (`npm test`, `node --test`, `go test`, `pytest`, `cargo test`, `make test`…) | yes: writes a CI workflow that runs this repo's own test command |
| `issues` | no `TODO.md`, `TODO`, `todo.md` or `docs/todo` | no: advice only |
| `templates` | `.github/ISSUE_TEMPLATE/` has a file and `.github/pull_request_template.md` exists | yes |
| `no-build-output` | no tracked file under `dist/`, `build/` or `out/` | no: advice plus the `.gitignore` lines |
| `changelog` | `CHANGELOG.md` with an `Unreleased` heading, or a `changes/` folder | yes: CHANGELOG.md with an Unreleased section |
| `codeowners` | a CODEOWNERS file (`.github/`, root or `docs/`) naming an owner | yes: with the repo owner's handle, for rules, CI and agent config paths |
| `security-files` | `SECURITY.md`, a Dependabot config, and a license file | SECURITY.md and Dependabot yes; license: advice only (the owner must choose) |

Each row on the page links to that step in the yokoten docs.

Not on the page (they need the user's machine or admin access):
`tool-hook`, `commit-check`, `runtime`, `remote`, `ci`, `titles`, `bot`,
`skills`, `sandbox`, `review`, `protection`, `merge-settings`,
`security-settings`, `labels`, `milestone`. The closing line says these exist
and that `npx yokoten` checks them.

The texts on the page are this page's own, short and plain. Only the keys and
the "done when" meaning must match yokoten.

**Drift test.** A test runs `npx yokoten@0.1.1 doctor --json` in a sample repo
and fails if any key in the table above is not one of doctor's step keys.
(Not checked yet: the exact JSON shape of `doctor --json`. Muse writes this
test after reading one real output.)

## 6. Architecture

```
browser (static page) ──POST /api/check {url}──▶  Worker
                                                   │ 1. parse + validate URL
                                                   │ 2. GitHub REST: repo info + file tree + a few files
                                                   │ 3. run the checks (plain code)
                                                   │ 4. Baseten: Muse Spark Open writes summary + files
                                                   ▼
                         ◀── streamed events (server-sent events) ──
```

- Host: Cloudflare Pages for the page, one Cloudflare Worker for `/api/check`.
  Served at `doctor.yokoten.app` (one DNS record by the owner, later). Its own
  repo and deploy; the yokoten.app site is not touched.
- Language: TypeScript. No framework for the page (one HTML file, one TS file,
  one CSS file). No database.
- Secrets live only in the Worker's settings, never in the repo, never in the
  browser, never in a Muse prompt:
  - `BASETEN_API_KEY`
  - `GITHUB_TOKEN`: a fine-grained token with no repo access at all (public
    read only), used only to raise the GitHub rate limit.

### 6.1 Reading the repo

- Accept `https://github.com/<owner>/<repo>` (with or without `.git`, a trailing
  slash, `/tree/<branch>`). Anything else: a plain error.
- `GET /repos/{owner}/{repo}`: must be public, not archived is fine either way;
  take `default_branch`, `size`.
- `GET /repos/{owner}/{repo}/git/trees/{branch}?recursive=1`: file list. If
  `truncated`, say the result covers part of the repo.
- Read at most these files, each cut at 20 KB, total at most 120 KB:
  README, AGENTS.md, CLAUDE.md, package.json / pyproject.toml / Cargo.toml /
  go.mod / Makefile (whichever exist), the workflow files, CODEOWNERS,
  CHANGELOG.md (first 3 KB).
- Never read or send: anything matching `.env*`, `*.pem`, `*.key`, `id_*`,
  files over 20 KB that were not listed above.

### 6.2 Muse at run time

- One call per check run, streamed. Model: Muse Spark Open on Baseten, through
  Baseten's OpenAI-compatible chat API. (Not checked yet: the exact model slug
  and base URL on Baseten. Muse confirms them from the Baseten dashboard before
  writing the client.)
- Input: the repo facts (name, description, languages, file list, the files
  read in 6.1) and the list of failed checks with their meaning.
- Output: one JSON object, validated by the Worker before anything is shown:

```json
{
  "summary": "one sentence about this repo, plain English, at most 30 words",
  "files": [
    { "path": "AGENTS.md", "check": "rules", "why": "one line", "content": "..." }
  ]
}
```

- Only paths that a failed check allows may come back (the table in section 5).
  Any other path is dropped. A file that already exists is never replaced, only
  added (except the one-line import added to an existing CLAUDE.md).
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

### 6.3 Patch

Built in the browser from `files`: a unified diff that adds each file (and the
one-line CLAUDE.md change), downloadable as `yokoten-doctor.patch`. The page shows
`git apply yokoten-doctor.patch` under the button.

## 7. Safety and abuse

- Public repos only; the Worker checks `private: false` from the API.
- Rate limit: 10 checks per IP per hour, 300 per day in all (Cloudflare rate
  limiting rule). Over the limit: a plain message and the `npx yokoten` line.
- Repo size cap: skip Muse when the tree has over 20,000 files; still show the
  checks.
- The generated files are shown as text, escaped; nothing from the repo or from
  Muse is put into the page as HTML.
- No logs of repo contents. Logs keep only: time, owner/repo, checks result,
  durations, error type.
- Meta's free credits may use content for product improvement. Only public repo
  content goes to Muse, and the privacy line says so.

## 8. Repo layout

```
public/index.html, public/app.ts, public/style.css
worker/index.ts          route + streaming
worker/github.ts         6.1
worker/checks.ts         section 5, pure functions: (files) -> results
worker/muse.ts           6.2
worker/patch.ts          6.3 (shared with the page)
test/checks.test.ts      one fixture repo per check, pass and fail
test/muse.test.ts        JSON validation and path filtering, with fake replies
test/drift.test.ts       section 5 drift test
README.md, LICENSE (MIT), SECURITY.md, AGENTS.md
```

`checks.ts` is pure (no network) so it is fully tested without GitHub or Muse.

## 9. Build order (each step is one Muse task, reviewed by Claude)

1. Repo base: README (with "run your own copy": clone, set your own Baseten
   key, deploy), MIT LICENSE, AGENTS.md, CI running the tests. The page must
   pass its own check (eat our own food, and it shows in the demo).
2. `checks.ts` and its tests, from section 5.
3. `github.ts` and `/api/check` returning checks only, with no Muse.
4. Page states A, B, C with checks only.
5. `muse.ts`, streaming, JSON validation, path filter.
6. Fix cards and the patch download.
7. Rate limit, error states, mobile check, deploy.
8. Optional, cut first if time is short: the ask box (below).
9. Demo video.

**The ask box (optional).** One input under the result: "Ask about agent
safety in this repo". Muse only picks which yokoten step the question is about
(one of the step keys, or "none"). The answer shown is yokoten's own text for
that step (what, why, how), word for word, under the label "Answer from
yokoten's rules, not generated". "none" gets a fixed reply that points to
`npx yokoten`. Rule code is never presented as a model. (Not checked yet:
whether `yokoten explain` can print JSON; if not, that is a small change in the
yokoten repo, through its own pull request process, and not hackathon work.)

Done when, for the whole page: on three real public repos (one bare, one half
ready, one fully ready) a check finishes in under 60 s, the patch applies with
`git apply` on a fresh clone, and running `npx yokoten doctor` on the patched
clone shows those same checks as done.

## 10. Later (not for the hackathon)

- Open a pull request for the user through a GitHub App: smallest scope
  (contents and pull requests on the chosen repo), a new branch only, never the
  default branch, no token kept.
- A link from yokoten.app, added by the site lead once this page is stable.

## 11. Demo (3 minutes)

1. (0:00) The problem in one line: agents work in repos that tell them nothing.
2. (0:20) Paste a real bare repo. Checks appear, then Muse writes AGENTS.md for
   that repo: point at its real test command.
3. (1:20) Download the patch, `git apply`, run `npx yokoten doctor`: the same
   checks turn done. Web and CLI agree.
4. (2:20) What runs where: plain-code checks, Muse Spark Open on Baseten for the
   writing, no GitHub write access, public repos only.
5. (2:45) `npx yokoten` for the rest.

## 12. Open questions for the owner

- Subdomain `doctor.yokoten.app`: needs the owner's yes and one DNS record.
