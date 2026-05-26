---
name: done
description: Timing summary, optimization suggestions, and wrap-up.
---

# Done

## Requires

- All prior steps completed

## Ensures

- Timing table emitted
- Final PR comment posted (if github)
- Workflow status set to completed or failed

## Strategies

Present a summary of all steps with their verification status. If any step has a non-success status, retry it (max 3 attempts from done). If still failing after retries, set `status: "failed"`.

`"completed"` requires **all steps `passed`**, with six exceptions that count toward completion:

1. A step `skipped` with `reason` beginning `"non-<forge> forge:"`.
2. A step `skipped` with `reason` `"--no-git"`.
3. A step `skipped` with `reason` `"no PR evidence section in .agency/do.md"`.
4. A step `skipped` with `reason` `"--minimal"`.
5. A step `skipped` with `reason` beginning `"no * command configured"`.
6. A step `skipped` with `reason` `"docs-only changes"`.

A `failed` step always blocks `"completed"`.

#### Timing summary

Call `scripts/do-driver summary`. It delegates to `scripts/steps/done` and emits:

1. A markdown timing table (step, status, duration, verification), with any step that took ≥30% of total time shown in **bold**.
2. A total wall-clock line.
3. A `**Slowest step**:` line.
4. A `<<<FACTS ... FACTS` block with machine-readable summary data.

Do not compute durations yourself — the script handles all timestamp arithmetic.

#### Optimization suggestions

Read the `FACTS` block the `done` script emitted and generate **2–4 concrete suggestions** for reducing time-to-completion in future runs. Base these on the actual timing data — for example:

- If **ci** dominates: suggest `--from ci-only` for re-runs.
- If **research** was slow: suggest pre-reading relevant code before invoking `/do`.
- If **test** had retries: note the flaky test and suggest hardening it.
- If **police** required fix iterations: note which pass caught issues.
- If **implement** was the bottleneck: suggest breaking the task into smaller PRs.

Be specific to this run's data, not generic advice.

#### PR comment & wrap-up

**If `--no-git`**: Print the timing table and optimization suggestions to the terminal only. List files modified in the working tree (`git status --porcelain`). Remind the user that changes are uncommitted.

**If `forge != github`**: Report the branch name (and remote URL via `git remote get-url origin`). Print timing table and suggestions to the terminal only.

**If `forge == github`**: Report the PR URL. Then post the final step status table as a **PR comment** using `gh pr comment`.
