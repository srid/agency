# test

Run the project's test command.

## Strategies

Read `.agency/do.md` and look for a `## Test command` section. Run only the tests relevant to the code paths changed in this PR.

Use `.apm/skills/vcs/vcs-op diff-names` to identify changed files and determine which tests are relevant.

If changes are purely internal with no user-facing impact, unit tests may suffice — skip e2e if no relevant scenarios exist. If no test command is documented, skip with a note (`.apm/runbook/scripts/runbook-driver --workflow=do end skipped "no test command configured" "..."`).

**Coverage gap check**: After the test command exits 0, confirm at least one of the tests run actually exercised the new behavior (per the **implement** step's classification). A green run that didn't touch the changed code paths — e.g. a new NixOS service module with no corresponding VM test, or a new endpoint with no integration test — is a coverage gap, not a pass. Refactor/docs/internal-cleanup diffs are exempt. The implement step should have caught this; if it didn't, treat it as a real failure: write the missing test, then loop through **fmt** → **commit** → **test** as below.

**Verify**: Tests pass (exit code 0) **and** the new behavior is covered, or the diff is exempt from the coverage check, or no relevant tests to run.
**If failed** (max 4 attempts): Analyze the failure. If flaky, re-run. If real: fix → go to **fmt**, then retry. Under `--no-git`, drop **commit** from the loop.
