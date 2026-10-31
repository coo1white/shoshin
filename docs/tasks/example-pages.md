Build a static result page for each example repo, from a saved real response. A visitor sees the result at once and spends no live check. Issue 18.

Return the full text of each file you change or add. Keep every current test, except the one test named in step 6. Add one entry with the path `COMMIT_MSG`: `feat:` commit form, one short plain body line, no tool attribution.

1. New file `web/scripts/save-examples.mjs`. It takes no arguments. It reads the `examples` list in `web/src/data/sample-result.json`. For each `repo`, it POSTs `{"url":"https://github.com/<repo>"}` to `https://yokoten-doctor--yokoten-doctor-fastapi-app.us-east.modal.run/api/check`, and reads the event stream to its end. Blocks are separated by a blank line. Each block has `event:` and `data:` lines. It writes `web/src/data/examples/<owner>-<repo>.json`, with `/` replaced by `-` in the name, as indented JSON with a final newline: `{"result":<data of result>,"fixes":<data of fixes>,"record":<data of record>}`. If `result`, `fixes` or `record` is missing, or `fixes.muse` is not `"ok"`, it prints the repo name, sets a failing exit code and writes no file for that repo. It uses only Node's built-in modules and `fetch`. I run it. Do not return any data files.

2. New file `web/src/pages/example/[slug].astro`.
   - `getStaticPaths` uses `import.meta.glob("../../data/examples/*.json", { eager: true })`. The slug is the file name without `.json`.
   - It renders `Page`, `Header`, a note, `<main id="app" hidden></main>`, `Footer`, and `<script src="../../client/app.ts"></script>`.
   - `Page` gets a new optional prop `noindex`. When it is true, the head holds `<meta name="robots" content="noindex" />`. The example page sets it, because a saved result is a copy of a live one.
   - The note is `<div class="section-inner"><p class="small muted">Saved check from {date}, at commit {short commit}. <a href={liveHref}>Check again</a> for a live result.</p></div>`. `date` is the first 10 characters of `record.recorded_at`. The short commit is the first 7 characters of `result.commit`. `liveHref` is `/?repo=<owner>/<repo>`.
   - The saved data goes in `<script type="application/json" id="saved-check" set:html={text}></script>`. `text` is `JSON.stringify(data).replace(/</g, "\\u003c")`. Repo text is untrusted, so this replace is required. This block does not run, so the page's Content-Security-Policy still holds.

3. `web/src/client/app.ts`: before the `?repo=` block at the end, read the element `saved-check`. If it exists, parse its text, set `lastResult`, `lastFixes` and `lastRecord`, set `isWaitingForFixes` to false and `state` to `"result"`, call `render()`, and do not read `?repo=`. Add a function `showSavedCheck` for this. It returns true when it showed a saved check. Do not use `innerHTML`. A bad parse leaves the page as it is, with no thrown error.

4. `web/src/client/ui/result.ts`: "Check another repo" links to `/`. "Check again" links to `/?repo=<owner>%2F<repo>`. Its click handler stays only when `window.location.pathname` is `/`. On any other path the link works as a normal link, because a reload would cancel the move to the new page.

5. Links must work from a page that is not the home page. In `web/src/components/Header.astro`, change `./` to `/`, and `./#how` and `./#questions` to `/#how` and `/#questions`, in all places. In `web/src/pages/index.astro`, the example rows link to `/example/<owner>-<repo>`, with `/` in the repo replaced by `-`. Change nothing else on that page.

6. `test/web/static-host.test.mjs`: replace the test named `example links in dist/index.html are relative and start with ?repo=` with one that checks each example row links to `/example/<slug>`. Add these tests, which read `dist/example/<slug>.html` and `web/src/data/examples/<slug>.json` for each example in `sample-result.json`:
   - The page exists, and holds `name="robots" content="noindex"`.
   - The saved data's `result.commit` starts with the example's `commit`, `result.summary.done` equals `done`, `result.summary.total` equals `total`, `fixes.after.done` equals `after`, and `fixes.files.length` equals `files`.
   - `fixes.muse` is `"ok"`.
   - The text inside the `saved-check` block has no `<` character, and parses to data that deep-equals the saved file.
   - Apart from `saved-check`, each `<script>` has a `src`.

Rules: only the syntax Node can strip in `web/src/client/`, and imports name the `.ts` file. No new dependency.
