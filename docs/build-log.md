# Build log

This counts how many rounds of fixes each task needed after the first code came back, and what found the problem. Counted from the task files on 2026-10-31.

| Task | Fix rounds | Found by |
|---|---|---|
| 1. Repo base | 1 | test |
| 2. Sandbox run | 1 | review |
| 3 and 4. API and page | 4 | review, test, real deploy, real page |
| 5. Fix files and Muse | 2 | review, test |
| 6. Fix cards and patch | 2 | review, commit check |
| 7. Limits and Pages | 3 | test, commit check, test |
| 8. Public record | 2 | review, review |
| Page polish | 1 | review |
| Review rules and build log | 0 | none |

16 rounds over 8 tasks: a mean of 2. Found by review 7, tests 5, the commit check 2, real runs 2.

Two of the problems no test could have caught: a deploy that left out modules, and a page buried by 26 repeated warnings. Both needed a real run.

This is one small project. These numbers show how this work went. They are not a benchmark.

Add one row for each new task.
