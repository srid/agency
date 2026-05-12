---
name: ci
kind: node
pattern: check-loop
---

# ci

Run CI and verify it passes against current HEAD.

## Requires

- `noGit` — caller flag (CI runs locally regardless of forge, but verification method may differ)
- `forge` — from sync
- `pr_url` — from create-pr (used for `gh pr checks` verification on github)

## Ensures

- `verdict` — `pass` | `failed-after-budget` | `no-command-configured`
- `ci_run_sha` — git sha CI ran against (must equal current `HEAD` when `verdict == pass`)
- (side effect, unless `noGit`) one commit per real-failure fix, pushed

## Pattern

Instances [`check-loop`](../patterns/check-loop.md) with:

```yaml
slots:
  runner: ci-command                # reads .agency/do.md ## CI command, runs in background, classifies via verification method
  fixer: fix-ci-failure-and-commit
config:
  max_attempts: 5                   # real failures
  flaky_classification: true
  flaky_budget: 3                   # CI is allowed to flake more than test
  loop_artifacts: commit-per-fix
  rerun_on_new_commit: true         # CI on stale SHA does not satisfy verification
```

## Strategies

- Read `.agency/do.md` and look for a `## CI command` section, plus any verification method documented there. Run CI with `run_in_background: true` if the command takes more than a few seconds.
- **Never pipe CI to `tail`/`head`**, and **never append `2>&1`** — background mode captures both streams.
- **Active state**: Before waiting for background CI, run `scripts/do-results set active waiting`. When CI returns (success or failure), run `scripts/do-results set active working` before proceeding. This lets the stop hook allow graceful exits while the agent is idle.
- CI commands are typically local (e.g. `nix flake check`, `just ci`, `make ci`) and are **forge-independent** — run them regardless of forge. Only the *verification method* may be forge-specific: if `.agency/do.md` describes verification via `gh` commit-status checks and `forge != github`, fall back to exit code + command output for verification on non-GitHub forges, and note this in the step record. (Bitbucket `bkt pr checks` wiring is tracked in [srid/agency#10](https://github.com/srid/agency/issues/10).)
- **The CI result must cover `HEAD`** (the `rerun_on_new_commit: true` config). Before recording the step as passed, the runner compares the commit SHA that CI ran against with `git rev-parse HEAD`. If they differ (e.g., a commit was pushed after CI started — whether from a fix retry, user-requested changes, or any other source), the runner re-runs CI against the current HEAD. CI passing on a stale commit does not satisfy verification.

### Failure classification

Read logs or output to diagnose.

**Flaky vs real**: A test is flaky only if it **passes on a subsequent retry**. Consistent failure = real bug. Before retrying, read the failing test code to judge if the failure pattern is inherently flaky (race conditions, timing, async waits).

- **If flaky** (max 3 retries, the `flaky_budget`): retry just the failing step, no fix.
- **If real bug** (max 5 fixes, the `max_attempts`): fix → fmt → commit → retry CI. Under `noGit`, the `commit-per-fix` arm of the pattern skips the commit/push (per the pattern's `noGit` handling), so the loop becomes fix → fmt → retry CI. The draft PR already exists — subsequent pushes update it automatically, no re-run of **create-pr** needed.
- **If retries exhausted**: pattern returns `failed-after-budget`. Set workflow status to `"failed"`, skip to **done**. The draft PR stays open as the record of the failed attempt.

## Receipt

```
.../skills/do/scripts/do-results step-start ci
.../skills/do/scripts/do-results set active waiting    # before background wait
# ... CI runs ...
.../skills/do/scripts/do-results set active working    # after CI returns
.../skills/do/scripts/do-results step-end {passed|skipped|failed} "<verification>" ["<reason>"]
```

## Verify

Use the verification method described in `.agency/do.md` (e.g., checking commit statuses on GitHub, reading CI output elsewhere). If no CI command is documented, skip with `status="skipped"` and `reason="no CI command configured"`. The CI result must cover current `HEAD` — see Strategies above.

## Errors

- `failed-after-budget` (5 real fix attempts or 3 flaky retries) — halt workflow with `do-results set status failed`. The draft PR stays open; the user resumes via `--from ci-only`.
