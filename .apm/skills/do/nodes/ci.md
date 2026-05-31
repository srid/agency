---
name: ci
description: Run CI and verify it covers HEAD.
---

# CI

## Requires

- Changes in current branch
- Draft PR created (if github)

## Ensures

- CI passes on current HEAD

## Pattern

Instances [check-loop](../patterns/check-loop.md) with:
- `runner`: read `.agency/do.md` for `## CI command`, run it
- `fixer`: fix real bugs; retry flaky without fixing
- Config: `max_attempts: 5`, `flaky_classification: true`, `flaky_budget: 3`, `loop_artifacts: commit-per-fix`, `rerun_on_new_commit: true`

## Strategies

Read `.agency/do.md` and look for a `## CI command` section, plus any verification method documented there. Run CI with `run_in_background: true` if the command takes more than a few seconds.

**Never pipe CI to `tail`/`head`**, and **never append `2>&1`** — background mode captures both streams.

**Active state**: Before waiting for background CI, run `scripts/do-results set active waiting`. When CI returns, run `scripts/do-results set active working` before proceeding.

CI commands are typically local (e.g. `nix flake check`, `just ci`, `make ci`) and are **forge-independent — run them regardless of forge**. Only the *verification method* may be forge-specific: if `.agency/do.md` describes verification via `gh` commit-status checks and `forge != github`, fall back to exit code + command output.

**Verify coverage of `HEAD`.** Before recording the step as passed, compare the commit SHA CI ran against with `git rev-parse HEAD`. If they differ, **re-run CI against the current HEAD**. CI passing on a stale commit does not satisfy verification.

**On failure** — read logs or output to diagnose.

**Flaky vs real**: A failure is flaky only if it **passes on a subsequent retry**. Consistent failure = real bug. Before retrying, read the failing test code to judge whether the pattern is inherently flaky.

**If flaky** (max 3 retries): Retry just the failing step.
**If real bug** (max 5 fixes): Fix → **fmt** → **commit** → retry CI. Under `--no-git`, drop **commit** from the loop.
**If retries exhausted**: Record `status: failed`, halt. The draft PR stays open as the record of the failed attempt.

## Delegation

```prose
let attempts_real = 0
let attempts_flaky = 0

loop:
  read .agency/do.md for "## CI command"
  if no command configured:
    return { verdict: "no-command-configured" }

  run CI (run_in_background: true if slow)
  set active = waiting before waiting, active = working when done
  if exit 0:
    if rerun_on_new_commit:
      if CI_sha != HEAD:
        continue  # re-run against current HEAD
    return { verdict: "pass" }

  diagnose failure: flaky or real?
  if flaky (passes on retry without fix):
    attempts_flaky += 1
    if attempts_flaky > 3:
      return { verdict: "failed-after-budget" }
    continue  # re-run without fixing

  attempts_real += 1
  if attempts_real > 5:
    return { verdict: "failed-after-budget" }

  fix → fmt → commit (drop commit if --no-git)
  continue  # re-run CI
```
