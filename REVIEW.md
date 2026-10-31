# Review

## What failure looks like here

- The page says something untrue: a check result that yokoten did not give, or a record that was not written.
- A repo's text reaches the page as HTML, or reaches a log.
- A key reaches the repo, the browser, the sandbox, a Muse prompt or a log.
- The sandbox runs a repo's code, or keeps its network after the clone.
- Code can reach Solana mainnet, or move coins.
- A failed optional step stops the page, or leaves the reader waiting.
- A fix file replaces a file the repo already has.
- The disclosure no longer matches who did the work.

## How to review

- Read the diff against the task brief and this file.
- Review in a fresh context where possible: the one who wrote the brief also misses things.
- Each finding gives a file and a line, and what goes wrong.
- A finding is Important, Nit or Pre-existing. At most 3 nits. Pre-existing findings do not hold a change back.
- Report a whole class of bug once, so every instance gets fixed.
- Start the summary with the count of findings. Say plainly when nothing needs fixing.

## When to stop

After 3 rounds of fixes on one task, stop fixing. Look at the brief instead: a task that will not converge usually means the brief is wrong.

## Before a change is called done

Run the tests and show the output. For a change to what the server does, deploy it and run one real check. For a change to the page, look at it at 400 px wide. A test passing does not prove any of these.

## Who approves

The tiers in the pull request template decide this. An AI review never counts as the owner's approval.
