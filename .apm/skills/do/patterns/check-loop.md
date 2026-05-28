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
    if coverage_check:
      confirm coverage via test logs / SHA comparison
    if rerun_on_new_commit:
      if runner_sha != HEAD:
        continue  # re-run against current HEAD
    return { verdict: "pass" }

  if verdict == "flaky":
    attempts_flaky += 1
    if attempts_flaky > flaky_budget:
      return { verdict: "failed-after-budget" }
    continue  # re-run without fixing

  if verdict == "fail":
    attempts_real += 1
    if attempts_real > max_attempts:
      return { verdict: "failed-after-budget" }

    let { attempted_fix, files_changed } = call fixer
      output: output
      target: target

    if loop_artifacts == "commit-per-fix" and attempted_fix:
      call fmt on files_changed
      if not noGit:
        git add files_changed
        git commit -m "<prefix>: <short description>"
        git push

    continue  # re-run runner
```
