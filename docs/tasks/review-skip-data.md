The reviewer could not give an answer on PR 34. That diff was 194 KB, and most of it was saved example data in `web/src/data/examples/`. Remove that data from what the model reads, and say so in the review. Issue 35.

Return the full text of `.github/review/review.mjs` and `test/review/review.test.mjs`. Keep every current test. Add one entry with the path `COMMIT_MSG`: `ci:` commit form, one short plain body line, no tool attribution.

1. Add and export `splitSavedData(diff)`. A section of a diff starts at a line that starts with `diff --git `. A section is saved data when its first line is exactly `diff --git a/<path> b/<path>` and `<path>` matches `web/src/data/examples/<name>.json`, where `<name>` has no `/`. The function returns `{ diff, skipped }`. `diff` is the text of the other sections, in order and unchanged. `skipped` is the list of skipped paths, in order.

2. In `main`, call `splitSavedData` on the fetched diff. Use its `diff` for the size limit and for the model.

3. `buildReviewBody(answer, model, skipped = [])`: when `skipped` is not empty, add this line just above the last line, and also when `answer` is null: `Not reviewed, saved data: ` followed by the paths, joined with `, `. Pass the text through `cleanText`.

4. `userMessage`: when files were skipped, add a line above `Diff:`: `These saved data files are left out of the diff: ` and the paths.

5. When the model's answer can not be used, print one line to the log: `review: no usable answer, length <n>`, or `review: model request failed` when the request threw. `<n>` is the length of the last text. Print no text from the model, and no key. Do not change which review event is posted.

6. Tests, in `test/review/review.test.mjs`:
   - `splitSavedData` removes a section under `web/src/data/examples/`, keeps the sections before and after it unchanged, and names the path.
   - It keeps `web/src/data/sample-result.json` and `web/src/data/examples/deep/x.json`.
   - It returns an empty `skipped` for a diff with no such section, and an unchanged diff.
   - A line inside a section's text that holds the words `diff --git` but does not start with them does not start a new section.
   - `buildReviewBody` names the skipped paths above the last line, with an answer and with a null answer. With no skipped paths, its output is the same as before.

No failure may produce an approval. Add no dependency.
