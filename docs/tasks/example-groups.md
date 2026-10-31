Show the examples on the first screen in labelled groups, so a visitor sees that the page is for Web2 and Web3, and sees good and bad results. Issue 38.

`web/src/data/sample-result.json` already has the new list. Each example now has a `group`: `web2`, `web3` or `own`. `after` can be `null`. The data files are done. Do not return data files. CSS is done by hand: use only the class names below.

Return the full text of each file you change. Keep every current test, and change only what step 4 names. Add one entry with the path `COMMIT_MSG`: `feat:` commit form, one short plain body line, no tool attribution.

1. `web/src/pages/index.astro`, in the `#checks` section. Keep the `h2` as it is. Keep the row markup as it is, and treat a null `after` as no outlined segments. Replace the single `.checks-list` with:
   - `<div class="checks-groups">` holding two `<div class="checks-group">`. Each has `<h3 class="checks-group-title">` with the text `Web2` or `Web3`, then a `.checks-list` with the rows of that group, in data order.
   - After that div, one more `<div class="checks-group">` with the title `Our own repo`, the rows of group `own`, and `<p class="checks-note">yokoten is our own tool. Four of these checks need it, so a repo without it can reach 9 of 13.</p>`.
   - Keep the current note `Green is done now. Outlined is what the files add.` after all groups.
   - Add `web/src/data/sample-result.json` no new fields.

2. `web/scripts/save-examples.mjs`: accept `fixes.muse` when it is `"ok"` or `"not needed"`. Any other value fails as before.

3. `web/src/pages/example/[slug].astro` needs no change. Tell me in your notes if you find that wrong.

4. `test/web/static-host.test.mjs`:
   - In `example saved data matches sample summary and after/files`: when `ex.after` is `null`, assert `saved.fixes.after` is `null` or missing. Otherwise keep the current assert.
   - In `example fixes.muse is ok`: accept `"ok"` or `"not needed"`, and rename the test `example fixes.muse finished`.
   - In `web/src/data/sample-result.json` checks, add: `ex.group` is `web2`, `web3` or `own`.
   - Add a test: `sample-result.json` has at least three examples in `web2` and at least three in `web3`, and within each of these two groups the highest `done` is at least 3 more than the lowest.
   - Add a test: `dist/index.html` holds the titles `Web2`, `Web3` and `Our own repo`, and the sentence `a repo without it can reach 9 of 13`.
