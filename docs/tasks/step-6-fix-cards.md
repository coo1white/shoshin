# Task: step 6, show the fix files and let a person apply them

The API already sends a `fixes` event after `result`:
`{"files": [{"path", "content", "source"}], "summary": str, "muse": "ok" | "failed" | "not needed"}`.
The page shows them now. A beginner applies them on GitHub, with no terminal. We never hold write access.

Return full text for every file you add or change. No tests in this reply: they come next.

## `server/app.py` (change)

`public(owner, repo)` returns a dict with `default_branch`. Keep that value, and add `"default_branch"` to the `result` event. When `public`
returns anything without it, the value is `null`. Change nothing else.

## `web/fixes.js` (new): pure, no DOM, `// @ts-check`

- `MAX_GITHUB_LINK = 6000`. Comment: GitHub accepted a 6,000-character link and failed from 7,000, measured 2026-10-31.
- `isSafePath(path) -> boolean`. True for a relative path made of parts that are not empty, `.` or `..`, with no backslash and no control character.
- `newFileLink(owner, repo, branch, path, content) -> string`. Returns
  `https://github.com/<owner>/<repo>/new/<branch>?filename=<path>&value=<content>`. Each value goes through `encodeURIComponent`. In the branch,
  encode each part and keep `/`. A null branch means `main`.
- `fileLinkPlan(owner, repo, branch, file) -> {kind, href}`. When `newFileLink` with the content is at most `MAX_GITHUB_LINK` characters: `kind` is
  `"filled"`, with that link. Otherwise `kind` is `"copy first"`, and `href` is the link with `filename` only, with no `value`.
- `buildPatch(files) -> string`. A unified diff that adds each file whose path passes `isSafePath`, so that `git apply` accepts it:

  ```
  diff --git a/<path> b/<path>
  new file mode 100644
  --- /dev/null
  +++ b/<path>
  @@ -0,0 +1,<number of lines> @@
  +<line>
  ```

  Content that does not end in a newline adds the line `\ No newline at end of file`. Empty content has only the first four lines. Returns an empty
  string when no file is left.
- `orderFiles(files) -> {first, rest}`. Leaves out unsafe paths. `first` is `AGENTS.md` when present, otherwise the first file, or null. `rest` is the others, in order.
- `fixMessage(fixes) -> string`. `muse` is "failed": "Muse could not write the project section this time. Please fill in the section called This project yourself."
  No files: "yokoten has no files to add to this repo." Otherwise an empty string.
- `PATCH_COMMANDS`: this exact text, joined by newlines:

  ```
  git switch -c yokoten-doctor-fixes
  git apply --index yokoten-doctor.patch
  git commit -m "docs: add agent rules from yokoten doctor"
  git push -u origin yokoten-doctor-fixes
  gh pr create --fill
  ```

## `web/app.js` (change)

Keep `createElement` and `textContent` only. Links only through `createLink`.

State: `lastFixes` (null until it arrives) and `isWaitingForFixes`. A new check resets both.

The stream:
- `result` sets `isWaitingForFixes` to true.
- `fixes` stores the value, sets `isWaitingForFixes` to false, and renders. Ignore a `fixes` event when there is no result yet.
- When the stream ends or throws after a result arrived, keep the result on the page. Today a thrown read replaces it with an error. If `fixes` did not arrive, set
  `lastFixes` to `{files: [], summary: "", muse: "lost"}`, and show "The fix files did not arrive. Please run the check again." in the fix section.

A new section "Fix it", placed after the next step's block and before "Show all checks":

1. While waiting: "Writing the fix files…".
2. If `summary` is not empty: the summary as one paragraph, then the small text "Summary by Muse."
3. `fixMessage(fixes)`, if it is not empty.
4. When there are files: "Nothing changes until you click Commit on GitHub. We have no access to your repo."
5. The card for `first`, and then a `<details>` "<n> more files", holding a card for each of `rest`. No `<details>` when `rest` is empty.
6. A `<details>` "Use the terminal instead". A button "Download the patch" makes a `Blob` and downloads `yokoten-doctor.patch` with a temporary `<a download>`. Under it: "Put the file in your repo's folder, then run:"
   and `PATCH_COMMANDS` in a code block with a Copy button.

A card holds:
- The path in monospace, as the card's title.
- When `source` is "yokoten and Muse": "The section called This project is suggested by Muse. Read it before you apply it."
- `kind` "filled": a link styled as a button, "Add on GitHub". Under it: "GitHub asks you to commit. Choose a new branch to open a pull request."
- `kind` "copy first": this file is too long for one link, so two steps. A button "1. Copy the text", then a link styled as a button, "2. Open GitHub and paste". Under them: "Paste it into the empty box on GitHub. Then choose a new branch to open a pull request."
- A `<details>` "Read this file", holding the content in a code block with a Copy button.

Remember which `<details>` are open across a render, by a stable key, because the `fixes` event renders the page again while a person may be reading.

## `web/style.css` (change)

Add what the cards need, using the existing variables. A link styled as a button looks the same as the existing button. Long file text scrolls inside its code block with a maximum height of about 20 lines. Nothing scrolls sideways at 400 px.
