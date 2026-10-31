Two changes. Return the full text of `web/app.js`, `web/style.css` if it changes, `README.md`, and `test/web/static-host.test.mjs`. Keep every current test. Also return one entry with the path `COMMIT_MSG`: `docs:` commit form, one short plain body line, no Co-Authored-By line, no tool attribution.

1. `web/app.js`: "1. Copy the text" must look like the filled buttons, as "2. Open GitHub and paste" does. It is a main step. It still uses `addCopyButton`, and it goes back to its own label after "Copied".

2. Say plainly who made this. Use these words exactly.

   In `web/app.js`, on every state of the page, in the footer, above the current sentence when that is shown:
   "How this was made: Muse Spark Open wrote the code and writes each repo's project section. Claude Opus 5.5 wrote the design and task briefs, reviewed the code, and set the API address. yokoten is an existing tool, used as a dependency."
   Then a link with the text "Full details" to `https://github.com/yokoten-labs/yokoten#readme` is NOT wanted: add no link here.

   In `README.md`, replace the whole text under "## Disclosure" with:

   ```
   This entry was built during the hackathon, with these tools:

   - **Muse Spark Open** (`muse-spark-open-1026`, on Baseten) wrote the code in this repo, from task briefs. At run time it writes each repo's "This project" section.
   - **Claude Opus 5.5** (Claude Code) wrote `docs/design.md` and the task briefs in `docs/tasks/`, reviewed the code, ran the tests and deploys, and made the commits. It chose what to build and how with the owner, so the briefs are detailed. It typed a few lines by hand: the API address in `web/app.js`, and small edits to docs.
   - **yokoten** (`yokoten@0.2.0`) is a tool that existed before the hackathon. It is an npm dependency, and no yokoten code is copied here. The checks on the page are yokoten's.

   A `Co-Authored-By` line names Muse on commits whose code it wrote. Claude's part is stated here instead of in those lines, and some commit messages also name it. Commit messages were edited once, before the first push, to change those lines.
   ```

   In `test/web/static-host.test.mjs`, add a test: `web/app.js` holds the words "How this was made", "Muse Spark Open" and "Claude Opus 5.5".
