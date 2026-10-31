# Task: step 7, limits, cost guards and the last gaps

Return full text for every file you change: `server/app.py`, `server/sandbox_run.py`, `server/github_check.py`, `server/fixes/build.py`, `web/fixes.js`, `web/app.js`. No tests in this reply: they come next.

## 1. Rate limit, in `server/app.py`

- A class `RateLimiter(store, now=time.time)`. `store` is any object with `get(key, default)` and `put(key, value)`.
- `allow(client_ip) -> "ok" | "ip" | "day"`:
  - `HOURLY_LIMIT_PER_IP = 10`, `DAILY_LIMIT_TOTAL = 300`.
  - The hour key is `limit:ip:<first 16 hex characters of sha256 of the IP>:<UTC hour number>`. The day key is `limit:day:<UTC day number>`. The raw IP is never stored or logged.
  - Check the day first, then the IP. A refused request counts nothing. An allowed request adds one to both.
  - Any exception from the store: log the type name and return "ok". A broken store must not take the page down.
- `create_api(..., limiter=None)`. None means no limit, so tests that do not care stay simple. `fastapi_app()` passes a `RateLimiter` on a `modal.Dict` named `yokoten-doctor-cache`. If opening the dict fails, it passes None.
- Client address: `request.client.host` only. Never read `X-Forwarded-For`: a caller can set it to anything.
- Order inside the stream: `progress` reading, then `parse_repo_url`, then the limit, then `public`, then the sandbox. A bad URL costs nothing.
- Refused: one `error` event, and nothing starts:
  - "ip": "You have run 10 checks this hour. Please try again later. You can also run it yourself: npx yokoten"
  - "day": "This page has reached its limit for today. Please try again tomorrow. You can also run it yourself: npx yokoten"

## 2. Cost guard, in `server/app.py`

Between `@app.function` and `@modal.asgi_app()`, add `@modal.concurrent(max_inputs=10)`. In `@app.function`, add `max_containers=3`.

## 3. GitHub's API limit, in `server/github_check.py`

GitHub allows 60 calls an hour without a token, shared by everyone on the same address. Today a 403 or 429 refuses the check, though the repo is fine.
On HTTP 403 or 429, return `{"default_branch": None, "size_kb": None}`. The sandbox clone stays the real test: it has no credentials and no prompt, so a private repo still fails, and it has a 60-second limit. A 404 and every other error stay as they are.

## 4. The default branch comes from the clone

- `server/sandbox_run.py`: after the clone, read `git -C /tmp/repo rev-parse --abbrev-ref HEAD`, and return it as `"branch"`.
- `server/app.py`: `default_branch` in the `result` event is `res.get("branch")`. Remove the code that keeps `public`'s return value.
- Do not copy `branch` into `result` under any other name.

## 5. A repo that already has CLAUDE.md

A new AGENTS.md is not read by Claude Code until CLAUDE.md imports it, and an import cannot go in a patch that only adds files.

- `server/sandbox_run.py`: add `"claude_file"` to what `_collect_fix_data` returns: `"CLAUDE.md"` when it is tracked, otherwise `".claude/CLAUDE.md"` when that is tracked, otherwise None. Compute it before `yokoten init` runs. The `except` path returns None for it.
- `server/fixes/build.py`: add `"claude_import"` to the returned dict, on every path. When the files hold `AGENTS.md` and `result["claude_file"]` is set: `{"file": "CLAUDE.md", "line": "@AGENTS.md"}`, or `{"file": ".claude/CLAUDE.md", "line": "@../AGENTS.md"}`. Otherwise null.
- `server/app.py`: `NO_FIXES` also has `"claude_import": None`.
- `web/fixes.js`: `claudeImportMessage(fixes) -> string`. With a value: `Your repo already has <file>. Add this line to it, so Claude Code reads the new rules: <line>`. Otherwise an empty string.
- `web/app.js`: show that message in the `AGENTS.md` card, above the buttons, with `textContent`.

## 6. Errors on the page, in `web/app.js`

- The error message element gets `role="alert"`.
- After an error, focus moves to the URL input and the input keeps its text. Do this only after a check, not on the first render.
