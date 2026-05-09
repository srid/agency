---
name: test
kind: node
pattern: check-loop
---

# test

Run tests relevant to the diff. Verify the new behavior is actually exercised.

## Requires

- `noGit` — caller flag
- `default_branch` — from sync (used to scope the diff)

## Ensures

- `verdict` — `pass` | `failed-after-budget` | `no-command-configured`
- (side effect, unless `noGit`) one commit per test-driven fix, pushed

## Pattern

Instances [`check-loop`](../patterns/check-loop.md) with:

```yaml
slots:
  runner: run-test-command          # reads .agency/do.md ## Test command, runs scoped to changed files
  fixer: fix-test-failure-and-commit
config:
  max_attempts: 4
  flaky_classification: true       # tests can be flaky; classification logic in runner
  flaky_budget: 0                   # test does NOT budget flaky retries; that's ci's job. Real fix-loop only.
  loop_artifacts: commit-per-fix
  coverage_check: true             # green run on stale code is not a pass
```

## Strategies

- Read `.agency/do.md` and look for a `## Test command` section. Run only the tests relevant to the code paths changed in this PR.
- Use `git diff origin/<default_branch>...HEAD --name-only` to identify changed files and determine which tests are relevant.
- If changes are purely internal with no user-facing impact, unit tests may suffice — skip e2e if no relevant scenarios exist. If no test command is documented, the runner returns `no-command-configured`; record as `skipped`.
- **Coverage gap check (the `coverage_check: true` config)**: After the test command exits 0, confirm at least one of the tests run actually exercised the new behavior (per the **implement** node's classification). A green run that didn't touch the changed code paths — e.g., a new NixOS service module with no corresponding VM test, or a new endpoint with no integration test — is a coverage gap, not a pass. Refactor/docs/internal-cleanup diffs are exempt. The implement node should have caught this; if it didn't, the pattern treats it as a real failure and the fixer writes the missing test.
- **Why `flaky_budget: 0` here but flaky enabled in ci**: at this stage we want to know if the fresh tests are stable; treating flakes as worth retrying without fixing masks real timing issues that should be fixed before CI sees them. The ci node (where flakes are unavoidable in shared infrastructure) sets a real budget.

## Receipt

```
.../skills/do/scripts/do-results step-start test
# ... pattern delegation ...
.../skills/do/scripts/do-results step-end {passed|skipped|failed} "<verification>" ["<reason>"]
```

## Verify

Tests pass (exit code 0) **and** the new behavior is covered, or the diff is exempt from the coverage check, or no relevant tests to run.

## Errors

- `failed-after-budget` (4 attempts) — halt workflow. Tests cannot be brought green within the fix budget; the implementation is incorrect or the test approach is wrong.
