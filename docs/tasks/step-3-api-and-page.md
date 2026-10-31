# Task: step 3 and 4, the API and the page, with yokoten's results only

No Muse in this step, no patch, no fix files, no rate limit yet. A person pastes a public repo URL and sees what
yokoten says, laid out like `yokoten doctor` in a terminal, with the commands to re-run it.

Return full text for every file you add or change.

## Server

### `server/sandbox_run.py` (change)

`run_in_sandbox(owner, repo, on_progress=None)`. When given, call `on_progress(step)` with `"copying"` before the
clone and `"checking"` after the network is cut. Nothing else changes. Also return `"about"`: the `description` from
the installed package, read in the sandbox with
`node -p "require('/usr/local/lib/node_modules/yokoten/package.json').description"` (exec argument list, no shell).
Empty string if that fails: it must not fail the run.

### `server/app.py` (new)

A Modal app `yokoten-doctor` serving FastAPI with `@app.function(image=web_image, timeout=180)` and `@modal.asgi_app()`.
`web_image = modal.Image.debian_slim().pip_install("fastapi", "modal")`. Sibling modules must import when deployed with
`modal deploy server/app.py`. Keep the FastAPI object in a plain function `create_api(run=run_in_sandbox, public=check_public)`
so tests can pass fakes without Modal.

- CORS: allow only `https://doctor.yokoten.app` and `http://localhost:8000`, methods POST and GET.
- `GET /api/health`: `{"ok": true}`.
- `POST /api/check`, JSON body `{"url": "..."}`: a streaming response of server-sent events, media type
  `text/event-stream`, each `event: <name>\ndata: <json>\n\n`:
  1. `progress` `{"step":"reading"}` first; then run `parse_repo_url` and `check_public`.
  2. `progress` `{"step":"copying"}`, `{"step":"checking"}` from the sandbox's `on_progress`. Run the sandbox in a worker
     thread and pass progress through a `queue.Queue`, so events reach the browser while it runs.
  3. `result`, once: `{"owner","repo","commit","yokoten_version","about","rerun","summary","secrets"}`.
     `summary` is `summarize(doctor)`. `secrets` lists `check` findings whose `id` is not `layout`:
     each `{"id","what","file","line","grade","why","fix"}`, never any other field.
  4. `error`, instead of the rest, `{"message": "..."}`. `BadRepoUrl` and `RepoRefused` send their own message. Any other
     exception sends exactly "The check could not finish. Please try again in a minute." and logs the error on the
     server. Exception text from the sandbox must never reach the browser.
- A body over 2 KB or a URL field over 300 characters: an `error` event about the URL. Never echo the user's text back.

`server/requirements.txt`: `modal` and `fastapi`.

## Page: plain JavaScript, no build step

Delete nothing yourself; `web/app.ts` and `web/patch.ts` will be removed. Write `web/index.html`, `web/style.css`,
`web/view.js` (pure, no DOM, testable in Node), `web/app.js` (DOM and network). Both modules start with `// @ts-check`.
Set the API URL in one constant at the top of `web/app.js`: `const API = "https://REPLACE.modal.run"`.

Build every element with `createElement` and `textContent`. Never `innerHTML`, never `insertAdjacentHTML`: everything from a
repo or from yokoten is untrusted text. Links only from `https://github.com/` and `https://yokoten.app/` or a `docs`
value starting with `https://`; anything else is shown as text.

### `web/view.js`

- `PROGRESS` maps `reading`, `copying`, `checking` to: "Reading the repo's details…", "Copying the public files into a
  throwaway sandbox…", "yokoten is checking, with the network off…".
- `markLabel(mark, reason)`: `done` → "done", `to do` and `next` → "to do", `not now` → "skipped on purpose: <reason>",
  `can't check` → "can't tell from the web", anything else → "unknown".
- `viewModel(result)` returns `{headline, next, others, installOnly, secrets, evidence}`:
  - `headline`: `done <done> of <total> file checks`, with ` · next: <next.title>` when there is a next step.
  - `next`: `{title, id, what, why, fix, how, docs}` or null. When null, and no install-only step is open, the page
    says "Every file check is done."
  - `others`: the steps that are neither `next` nor install-only, in the order given, each with its `label`.
  - `installOnly`: the `summary.install_only` steps with titles.
  - `secrets`: as given.
  - `evidence`: `{version, commit, shortCommit (first 7 characters), doctorCommand, checkCommand}`.

### `web/index.html` and `web/app.js`: one page, three states

**Empty.** Headline "Is your repo ready for AI agents?" One text input (label "GitHub repo URL", placeholder
`https://github.com/owner/repo`) and a button "Check". Always visible under it: "We copy the public files of this repo into
a throwaway sandbox, run yokoten on them, and keep nothing. Public repos only." Three example links that fill the input
and start the check: `Uniswap/v4-core`, `OpenZeppelin/openzeppelin-contracts`, `jup-ag/jupiter-quote-api-node`, labelled
"Try one:". One sentence for people with no repo: "An AI coding agent can run commands, change files and push code. These
checks show whether a repo tells it the rules."

**Working.** The current step's text, with the earlier ones ticked. Button disabled. Read the event stream with `fetch` and a
stream reader, not `EventSource` (this is a POST).

**Result.** In this order, in a terminal-like panel that reads well on a phone:
1. If any secrets: a warning block first, "yokoten found something that looks private in this repo", each with `what`, `file`,
   `line`, and `fix`.
2. The repo name, then the headline.
3. The next step: title large, step id small underneath, `what`, `why`, `fix`.
4. `<details>` "Show all checks": each other step, title, id small, its label.
5. If install-only steps are open: one line "Fixed when you install yokoten" with their titles, and `npx yokoten init`.
6. Inside the next step and each step in the list, `<details>` "How this was judged": the `how` text.
7. "Check it yourself" (always visible, small): "Checked by yokoten <version> at commit <shortCommit>", the doctor command
   and the check command, each in a code block with a Copy button, and under the check command: "Run this one in a clean
   home folder: on your own machine, check also looks for your own private marks, which this page never had."
8. Closing: the `about` sentence from the result, and `npx yokoten` with a link to `https://yokoten.app/`.
   Footer: "A wrong check result or a broken page? Tell yokoten: github.com/yokoten-labs/yokoten/issues."

Errors: show the message in the page, keep the input filled, enable the button. A dropped connection says "The connection
dropped. Please try again."

Copy buttons call `navigator.clipboard.writeText` in the click handler, and on failure select the text.

### `web/style.css`

Define colours as custom properties on `:root`, with a `prefers-color-scheme: dark` set. A calm tool look: no red crosses, no
hospital imagery, no gradients, no emoji as markers. Body background from a variable. System font stack, monospace for commands
and ids. Reading width about 70 characters. At 400 px wide nothing scrolls sideways except inside code blocks. Visible focus on
all controls; respect `prefers-reduced-motion`.

## Tests

- `test/server/test_api.py`: `fastapi.testclient.TestClient` on `create_api` with fake `run` and `public`. Checks: event order for a
  good run; a bad URL gives one `error` event with the plain message; an unexpected exception gives the fixed message and not its
  text; `secrets` drops `layout` and unknown fields; a long URL is refused and not echoed.
- `test/web/view.test.mjs`: `viewModel` on a result built from `test/fixtures/doctor-files-0.2.0.json`-like data, each mark label
  including an unknown mark, the all-done case.
- `test/web/no-html-injection.test.mjs`: reads `web/app.js` and `web/view.js` and fails if they contain `innerHTML`,
  `insertAdjacentHTML`, `outerHTML`, `document.write` or `eval(`.
- Update `test/web/smoke.test.mjs` only if `web/index.html` needs it.
- `.github/workflows/test.yml`: change the pip line to `pip install pytest -r server/requirements.txt httpx`. Change nothing else.

Importing `server/app.py` in tests must work with `modal` installed but no Modal login.

Plain English on the page, short sentences. No secrets, real names, emails or home paths anywhere.
