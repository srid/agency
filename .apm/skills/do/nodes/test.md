---
name: test
description: Run relevant tests.
---

# Test

## Requires

- Implemented code
- Changes in current branch

## Ensures

- Tests pass
- New behavior is actually exercised

## Pattern

Instances [check-loop](../../patterns/check-loop.md) with:
- `runner`: read `.agency/do.md` for `## Test command`, run relevant tests
- `fixer`: fix test failures
- Config: `max_attempts: 4`, `coverage_check: true`, `loop_artifacts: commit-per-fix`

## Strategies

Read `.agency/do.md` and look for a `## Test command` section. Run only the tests relevant to the code paths changed in this PR.

Use `git diff origin/HEAD...HEAD --name-only` to identify changed files and determine which tests are relevant.

If changes are purely internal with no user-facing impact, unit tests may suffice — skip e2e if no relevant scenarios exist. If no test command is documented, skip with a note.

**Coverage gap check**: After the test command exits 0, confirm at least one of the tests run actually exercised the new behavior (per the **implement** step's classification). A green run that didn't touch the changed code paths is a coverage gap, not a pass. Refactor/docs/internal-cleanup diffs are exempt. If a gap is found, treat it as a real failure: write the missing test, then loop through **fmt** → **commit** → **test**.

**Verify**: Tests pass (exit code 0) **and** the new behavior is covered, or the diff is exempt from the coverage check, or no relevant tests to run.
**If failed** (max 4 attempts): Analyze the failure. If flaky, re-run. If real: fix → go to **fmt**, then retry.
