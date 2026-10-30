# Task: step 2, the sandbox run

Write the Python that takes a public GitHub repo URL and returns what yokoten says about it. No web
page, no Muse, no web endpoint yet.

Modal Python SDK, version 1.6: `modal.App.lookup(name, create_if_missing=True)`,
`modal.Sandbox.create(app=, image=, timeout=, cpu=, memory=, env=, outbound_domain_allowlist=[...],
outbound_cidr_allowlist=[...])`, `sb.exec("cmd", "arg", ..., timeout=)` returning a process with
`.stdout.read()`, `.stderr.read()`, `.wait()`, `.returncode`, `sb.terminate()`, and
`sb._experimental_set_outbound_network_policy(outbound_domain_allowlist=[], outbound_cidr_allowlist=[])`
to change the network of a running sandbox at once.

## Files

### `server/repo_url.py` (pure, no network, no Modal)

`parse_repo_url(text) -> (owner, repo)`. Accepts `https://github.com/o/r`, with a trailing slash,
`.git`, or `/tree/<branch>`, `http://`, `github.com/o/r`, and `o/r`. Strip surrounding whitespace.
`owner` must match `^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$`, `repo` must match `^[A-Za-z0-9._-]{1,100}$`
and not be `.` or `..`. Anything else raises `BadRepoUrl` with a plain message: "That doesn't look like
a public GitHub repo. Try https://github.com/owner/repo."

### `server/github_check.py`

`check_public(owner, repo) -> dict` calls `https://api.github.com/repos/{owner}/{repo}` with
`urllib.request`, no token, 10 s timeout, a `User-Agent` header. Returns `{"default_branch", "size_kb"}`.
Raises `RepoRefused` with a plain message when: 404 (not found or private), `private` is true, or `size`
(KB) is over 512000 ("This repo is over 500 MB, too big to check here."). Other HTTP errors raise
`RepoRefused` too, saying GitHub could not be reached. This runs outside the sandbox.

### `server/sandbox_run.py`

Constant `YOKOTEN_VERSION = "0.2.0"`. The image: `modal.Image.from_registry("node:22-slim")`, apt install
`git` and `ca-certificates`, then run `npm install -g yokoten@0.2.0`. Nothing is fetched at check time.

`run_in_sandbox(owner, repo) -> dict`:

1. Create the sandbox: `timeout=120`, `cpu=1.0`, `memory=1024`, no secrets,
   `outbound_domain_allowlist=["github.com", "*.github.com", "*.githubusercontent.com"]`,
   `outbound_cidr_allowlist=[]`, and env `HOME=/tmp/home`, `TMPDIR=/tmp/work`, `TEMP=/tmp/work`,
   `TMP=/tmp/work`, `GIT_TERMINAL_PROMPT=0`.
2. `mkdir -p /tmp/home /tmp/work`.
3. Clone with argument lists, never through a shell string:
   `git -c core.hooksPath=/dev/null clone --depth 1 --no-recurse-submodules --quiet
   https://github.com/{owner}/{repo}.git /tmp/repo`, 60 s timeout. Failure raises `SandboxFailed`.
4. Read the commit: `git -C /tmp/repo rev-parse HEAD`.
5. Cut the network: call `_experimental_set_outbound_network_policy` with both lists empty. If this call
   fails, raise `SandboxFailed`: yokoten must never run with the network open.
6. Run, with `workdir` handled by `git -C`-free means (use `bash`-free `sb.exec("env", "-C", "/tmp/repo",
   ...)`): `yokoten doctor --files --json` and `yokoten check --json`, 30 s timeout each.
   Exit codes 0 and 1 are both normal. Parse stdout as JSON; other exit codes or bad JSON raise
   `SandboxFailed`. Never run anything from the repo: no install, no build, no tests, no scripts.
7. Always terminate the sandbox, in `finally`.

Returns `{"owner", "repo", "commit", "yokoten_version", "doctor", "check", "rerun"}`. `yokoten_version` is
`doctor["version"]`. `rerun` is a dict with two command strings:
- `doctor`: `git clone https://github.com/{owner}/{repo} && cd {repo} && git checkout {commit} && npx
  yokoten@{version} doctor --files --json`
- `check`: `HOME="$(mktemp -d)" npx yokoten@{version} check --json`

### `server/result.py` (pure)

`summarize(doctor) -> dict` for the page, reading these fields only: `steps[].id`, `.title`, `.mark`,
`.how`, `.why`, `.source`, `.reason` (optional); top `next.id`; `findings[].id`, `.what`, `.why`, `.fix`,
`.docs` (optional). Returns `{"done": n, "total": m, "next": step-or-None, "steps": [...]}`.
- Count only steps whose `source` is `files`. `done` counts mark `done`.
- Each returned step has `id`, `title`, `mark`, `how`, `why`, and, if a finding has its id, `what`, `fix`,
  `docs`. `findings` also holds notes that are not steps: look up by id, never walk it as the list.
- Known marks: `done`, `to do`, `next`, `can't check`, `not now`. Any other mark becomes `unknown`, not an
  error. `not now` keeps its `reason`.
- `next`: the step named by `next.id` if its `source` is `files`; otherwise the first files step whose mark
  is not `done` or `not now`; otherwise None.
- `install_only`: the ids `tool-hook`, `runtime`, `sandbox`, returned as their own list, and not chosen as
  `next` while another step is open, because they are fixed by installing yokoten, not by the patch.

### `server/try_check.py`

A small command: `python server/try_check.py <url>` runs parse, public check and sandbox run, prints
the summary as JSON. For trying it by hand.

### Tests

`test/server/test_repo_url.py`, `test/server/test_result.py`: pure tests only, no network and no Modal. Use
`test/fixtures/doctor-files-0.2.0.json` (a real output, already in the repo) plus small hand-made dicts for
`not now`, an unknown mark, and a `next` that points at a non-files step. Bad URLs to refuse include
`../x`, `o/r/../../etc`, `https://evil.example/o/r`, `o r/x`, an empty string, `-x/y`.

Make imports work from the repo root with `pytest test/server` (add a `conftest.py` that puts `server/` on
the path). Add `pytest` nowhere in `server/requirements.txt`.

## Rules

No secrets, real names, emails or home paths anywhere. Plain English in messages. Keep each file small.
