Keep the reviewer's text short. Reviews now run long, and people must read them. Use the same limits as the yokoten reviewer.

Return the full text of `.github/review/review.mjs` and `test/review/review.test.mjs`. Keep every current test, except where a step below changes what it holds. Add one entry with the path `COMMIT_MSG`: `ci:` commit form, one short plain body line, no tool attribution.

1. Add and export `MAX_TEXT_CHARS = 300` and `MAX_FINDINGS = 10`.

2. `cleanText(text, limit = MAX_TEXT_CHARS)`: when the text is longer than `limit`, cut it to `limit - 1` characters and add `…`. The other cleaning stays.

3. `buildReviewBody`: put findings in the order high, medium, low. Keep the order within a severity. Show at most `MAX_FINDINGS`. When some are left out, add one line: `<n> more findings not shown.` The cut changes only the text. `decideEvent` still reads every finding, so a high finding past the cut still blocks. Do not change `parseAnswer`: length is never a reason to fail.

4. The "Not reviewed, saved data" line: pass `cleanText` a limit of 600, because it holds paths.

5. `systemMessage`: add this as a new paragraph: `Be short. The summary is one sentence. Give at most 5 findings, the most severe first, each in one or two sentences. Report only what can break users, leak data or state something false. Do not report style.` The lead later changed this wording by hand; the pull request says so.

6. Tests:
   - A text of 400 characters comes back with 300 characters, ending in `…`. A text of 300 characters comes back unchanged.
   - With 12 low findings, the body has 10 finding lines and the line `2 more findings not shown.`
   - A low finding given before a high one is shown after it.
   - With 11 low findings and one high finding given last, `decideEvent` is `REQUEST_CHANGES`, and the body shows the high finding.
