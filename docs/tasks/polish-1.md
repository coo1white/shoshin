# Task: polish the page for someone seeing it for the first time

No new features on the server. Keep every behaviour and test that this task does not change. Keep `createElement` and `textContent` only, and links only through `createLink`. No inline `style` attributes in HTML, and no inline scripts: the page's Content-Security-Policy refuses them. Use yokoten's words as they are: add labels around them, never rewrite them.

Return the full text of each file you change: `web/app.js`, `web/view.js`, `web/style.css`, `web/index.html`, `web/favicon.svg`, `server/sandbox_run.py`. Also return one entry with the path `COMMIT_MSG`: commit form with a `feat:` prefix, 2 or 3 plain body lines, no Co-Authored-By line, no tool attribution. No tests in this reply: they come next.

## 1. The result comes first

- In the working and result states, the input card shows only the label, the input and the Check button. The explaining sentences and "Try one:" show only in the empty state, and after an error.
- The input and the button sit on one row, and the button wraps under the input only below 400 px. The input and button are in a `<form>`, so pressing Enter starts a check.
- When the result arrives, scroll its panel into view, with `behavior: "auto"` when `prefers-reduced-motion` is set and `"smooth"` otherwise. Do this once for each check, not again when `fixes` or `record` arrive.

## 2. The score

Under the repo name, replace the headline line with:
- A large line `<done> of <total> file checks are done`.
- A native `<progress>` with `value` and `max`, and an `aria-label` holding the same sentence. Style it with the existing colour variables.
- `viewModel` keeps `headline` for tests, and also returns `score: {done, total, text}`.
- When Muse's `summary` is not empty, it moves here, under the score, with the small text "Summary by Muse." Remove it from "Fix it".
- The private-findings warning block moves from above the repo name to below the score.

## 3. The next step reads as a sentence

In the next step, and in each step under "Show all checks" that has them, show `what`, `why` and `fix` with small labels above each: "What we found", "Why it matters", "How to fix it". A step with no value for one leaves that label out.

Add `splitCode(text) -> [{text, isCode}]` to `web/view.js`. It splits on pairs of backticks. An unmatched backtick stays as plain text. Use it for `what`, `why`, `fix` and `how`, and for private findings: a code part goes in a `<code>` element.

The step id stays small, below the title, with the label "Step id: ".

## 4. "Fix it" says one thing

Inside "Fix it", in this order:
1. The file cards, as they are now, or the waiting and failure messages.
2. The install-only steps move here from below "Show all checks". With open install-only steps: "These need yokoten in your repo:", then their titles as a list, then `npx yokoten init` in a code block with a Copy button.
3. Change the no-files message: when there are no files and install-only steps are open, show no message about files. `fixMessage` stays as it is; the page decides not to show that one message in this case.

When there are no files and no open install-only steps, show "Nothing to fix here." unless the message is about Muse failing.

"Show all checks" stays after "Fix it".

## 5. Fewer loud buttons

- Add a class `button-quiet`: small, with a border, no fill, using the existing variables. Every Copy button, "Download the patch" and "Download the result" use it. Only Check, "Add on GitHub", "1. Copy the text" and "2. Open GitHub and paste" stay filled.
- A Copy button sits at the top right inside its code block's wrapper, and does not take a row of its own. The code block leaves room for it, so the two never overlap, also at 400 px. The file-reading block keeps its scrolling.

## 6. "Check it yourself" is short until asked

- Always visible: "Checked by yokoten <version> at commit <shortCommit>."
- When a record is there, a second line: "Hash recorded publicly on <time>:", then the "Rekor entry" and "Solana devnet memo" links on one line, and the devnet sentence small under them.
- `<details>` "Run the same check yourself": the doctor command and the check command, each with its Copy button, and the clean-home-folder sentence.
- `<details>` "Compare the hash": the sentence about downloading, the hash in monospace, "Download the result", and the `sha256sum` command with a Copy button. Show `message` from `recordView` outside the details, when it is not empty.
- Show the time as `2026-10-31 05:45 UTC`. Add `formatRecordTime(iso) -> string` in `web/view.js`. Text it cannot read comes back unchanged.

The details keep their stable `data-key` values.

## 7. A result can be shared

- When a check starts from any route, set the address with `history.replaceState` to `?repo=<owner>/<repo>`, encoded, when the input parses as one. Add `repoFromInput(text) -> "owner/repo"|null` and `repoFromQuery(search) -> "owner/repo"|null` in `web/view.js`. Each accepts only GitHub-legal names: letters, digits, `-`, `_` and `.`, with no part being `.` or `..`. `repoFromInput` accepts `owner/repo` and `https://github.com/owner/repo` with an optional `.git` or trailing slash. It is only for the address: the server still judges the input.
- On load, when `repoFromQuery` returns a value, fill the input and start the check.
- In the result, next to the repo name, a `button-quiet` button "Copy link to this result". It uses `addCopyButton`, with the page's current address.

## 8. The re-run command works on big repos

In `server/sandbox_run.py`, `rerun["doctor"]` becomes these lines, joined by a newline:

```
git clone --filter=blob:none https://github.com/<owner>/<repo>
cd <repo>
git checkout <commit>
npx yokoten@<version> doctor --files --json
```

`rerun["check"]` becomes `HOME="$(mktemp -d)" npx yokoten@<version> check --json`, as now. Code blocks keep line breaks.

## 9. `web/index.html`

- `<title>`: `Is your repo ready for AI agents? · yokoten doctor`.
- `<meta name="description">` and `og:title`, `og:description`, `og:type` `website`, `og:url` `https://doctor.yokoten.app/`. Description: "Paste a public GitHub repo. See what an AI coding agent would find, and get the files to fix it. Free and open source."
- `<link rel="icon" href="favicon.svg" type="image/svg+xml">`. Keep the Content-Security-Policy tag word for word.

`web/favicon.svg`: a plain, small SVG with no script: a rounded square in `#2a5bd7` with a white check mark.

## 10. Style

Keep the existing variables and their dark values. Add dark values for anything new. Headings, spacing and labels should make the groups easy to scan. At 400 px nothing scrolls sideways except inside code blocks.
