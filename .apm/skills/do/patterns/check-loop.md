---
name: check-loop
kind: pattern
---

# check-loop

A specialization of [worker-critic](worker-critic.md) for verification-driven retry: a deterministic command (the runner / critic) gates a fix loop (the fixer / worker). Used by **check**, **docs**, **test**, **ci**, and **police**.

## Slots

- `runner`: the command that verifies (e.g. `tsc --noEmit`, `nix flake check`, `/code-police`)
  - requires: `target` (the diff or files under inspection)
  - ensures: `verdict` (`pass` | `fail` | `flaky` | `no-command-configured`), `output`
- `fixer`: applies a corrective edit when runner returns `fail`
  - requires: `output` (the runner's failure output), `target`
  - ensures: `attempted_fix` (bool), `files_changed` (list of paths)

## Config

| Param | Default | Meaning |
|-------|---------|---------|
| `max_attempts` | `3` | Maximum real-failure fix attempts. Exhaustion halts the workflow. |
| `flaky_classification` | `false` | When `true`, runner may return `flaky` (re-run without fixing) and `flaky_budget` is consumed separately. |
| `flaky_budget` | `0` | Re-runs allowed without fixing. Only meaningful when `flaky_classification: true`. |
| `loop_artifacts` | `none` | `none`: fixes stay in the working tree only. `commit-per-fix`: each fix that lands real changes is followed by `fmt` + `commit` + `push`, with one commit per discrete fix. |
| `coverage_check` | `false` | When `true`, after `verdict == pass` the runner must also confirm the changed code paths were exercised. A green run on stale code does not satisfy verification. |
| `rerun_on_new_commit` | `false` | When `true`, before recording `pass` the pattern compares the SHA the runner ran against to current `HEAD`. If they differ, re-runs against current `HEAD`. |

## Requires

- `target`: what's being verified (typically the just-implemented diff, scoped via `git diff origin/HEAD...HEAD --name-only`)

## Ensures

- `verdict`: one of:
  - `pass` — runner returned success and (if applicable) coverage / SHA checks passed
  - `failed-after-budget` — exhausted retries; surrounding workflow halts with `status=failed`
  - `no-command-configured` — runner reports the project hasn't configured this gate; treated as `skipped` by the surrounding node

## Invariants

- `no-command-configured` short-circuits to `skipped` — never treated as failed.
- On `failed-after-budget`, the surrounding workflow halts (the surrounding node reports `step-end failed`). The pattern does not silently pass.
- `flaky` re-runs do not consume the `max_attempts` budget; only real failures do. The two budgets are independent.
- Under `loop_artifacts: commit-per-fix`, each fix is its own commit (never batched). PR history reads as a sequence of discrete fixes, not a grab-bag diff.
- Under `loop_artifacts: commit-per-fix` AND `noGit: true`: fixes go to the working tree but commit/push are skipped. The user reviews the combined working-tree delta themselves.

## Delegation

```prose
let attempts_real = 0
let attempts_flaky = 0

loop:
  let { verdict, output } = call runner
    target: target

  if verdict == "no-command-configured":
    return { verdict: "no-command-configured" }

  if verdict == "pass":
    if rerun_on_new_commit and runner.ran_against_sha != current_head_sha:
      continue   # re-run against current HEAD; verdict pass on stale code does not satisfy
    if coverage_check and not runner.coverage_satisfied:
      # treat as a real failure: runner exited 0 but didn't exercise the new behavior
      attempts_real = attempts_real + 1
      if attempts_real > max_attempts:
        return { verdict: "failed-after-budget" }
      call fixer
        output: "coverage gap: " + describe_gap()
        target: target
      if loop_artifacts == "commit-per-fix" and not noGit:
        call fmt files: fixer.files_changed
        call commit-fix message: "test: cover <new behavior>"
      continue
    return { verdict: "pass" }

  if flaky_classification and verdict == "flaky":
    attempts_flaky = attempts_flaky + 1
    if attempts_flaky > flaky_budget:
      return { verdict: "failed-after-budget" }
    continue

  # verdict == "fail"
  attempts_real = attempts_real + 1
  if attempts_real > max_attempts:
    return { verdict: "failed-after-budget" }
  call fixer
    output: output
    target: target
  if loop_artifacts == "commit-per-fix" and not noGit:
    call fmt files: fixer.files_changed
    call commit-fix message: <one-line summary derived from fixer's change>
    call push
```

## Notes

- The `runner` slot is a thin adapter around the actual command. For `check`, the runner reads `.agency/do.md`'s `## Check command` section, runs it, and classifies the exit code. For `ci`, the runner kicks off the `## CI command` (typically with `run_in_background: true`) and waits for the verification method to report.
- The flaky/real classification is a heuristic: a test that **passes on a subsequent retry** is flaky; consistent failure is real. Before retrying as flaky, the runner reads the failing test code to judge whether the failure pattern is inherently race-prone (timing, async waits, network).
- `coverage_check` is currently used by `test`. The check is: at least one of the tests run actually exercised the new behavior (per the implement node's classification). A new HTTP endpoint with no integration test, or a new NixOS service module with no VM test, is a coverage gap regardless of test exit code.
