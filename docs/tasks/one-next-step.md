The result page can show two different next steps. The Next step box uses `vm.next`, which skips steps that the page's files can not add. The checks list keeps yokoten's own mark, so it can mark another step as next. Make the list follow the box.

Return the full text of each file you change. Keep every current test. Add one entry with the path `COMMIT_MSG`: `fix:` commit form, one short plain body line, no tool attribution.

1. `web/src/client/view.ts`: add and export `shownMark(mark, stepId, nextId)`. It returns `"next"` when `stepId` equals `nextId`. It returns `"to do"` when `mark` is `"next"` and `stepId` does not equal `nextId`. In every other case it returns `mark`. When `nextId` is null, a `"next"` mark stays `"next"`.

2. `web/src/client/ui/result.ts`, in the loop that fills the `DOCTOR` terminal: use `shownMark(s.mark, s.id, vm.next ? vm.next.id : null)` in place of `s.mark`. Change nothing else.

3. `test/web/view.test.mjs`: add tests for `shownMark`:
   - A step with the mark `next` that is not `nextId` shows `to do`.
   - A step with the mark `to do` that is `nextId` shows `next`.
   - A step with the mark `done` that is not `nextId` shows `done`.
   - With `nextId` null, the mark `next` stays `next`.
