---
name: done
kind: node
---

# done

Emit the timing summary, optimization suggestions, and the final status comment.

## Requires

- `noGit` — caller flag
- `forge` — from sync
- `pr_url` — from create-pr (absent under `noGit` or non-github)
- All preceding nodes' receipts via `.do-results.json` (read by the script)

## Ensures

- `timing_table` — markdown table of all nodes (step, status, duration, verification)
- (side effect) workflow `status` set to `completed` or `failed`
- (side effect) workflow `active` set to `false`
- (side effect, when github + not noGit) final status comment posted to the PR

## Strategies

Present a summary of all nodes with their verification status. If any node has a non-success status, retry it (max 3 attempts from done). If still failing after retries, set `status: "failed"`.

`"completed"` requires **all nodes `passed`**, with four exceptions that count toward completion (the [skip taxonomy in execution.md](../execution.md#skip-taxonomy)):

1. A node `skipped` with `reason` beginning `"non-<forge> forge:"` (detected forge isn't GitHub).
2. A node `skipped` with `reason` `"--no-git"` (user opted out of git operations).
3. A node `skipped` with `reason` `"no PR evidence section in .agency/do.md"` (project hasn't opted into the evidence step — this is the default).
4. A node `skipped` with `reason` `"--minimal"` (user opted out of structural review / docs / quality gate / evidence on a trivial diff).

A `failed` node always blocks `"completed"`. No redefining "passed," no footnote caveats. Update via `scripts/do-results set status completed` or `scripts/do-results set status failed` accordingly.

### Timing summary

Run `scripts/steps/done` in this skill's directory. It emits:

1. A markdown timing table (step, status, duration, verification), with any step that took ≥30% of total time shown in **bold**.
2. A total wall-clock line (`startedAt` of first step → `completedAt` of last step).
3. A `**Slowest step**:` line.
4. A `<<<FACTS ... FACTS` block with machine-readable summary data (`totalSeconds`, `slowestStep`, `slowestSeconds`, `dominantSteps`, `skippedSteps`, `failedSteps`) — use this to compose optimization suggestions below.

Do not compute durations yourself — the script handles all timestamp arithmetic.

### Optimization suggestions

Read the `FACTS` block the `done` script emitted and generate 2–4 concrete suggestions for reducing time-to-completion in future runs. Base these on the actual timing data — for example:

- If **ci** dominates: suggest `--from ci-only` for re-runs, or note which CI sub-step was slowest.
- If **research** was slow: suggest pre-reading relevant code before invoking `/do`.
- If **test** had retries: note the flaky test and suggest hardening it.
- If **police** required fix iterations: note which pass caught issues (rules/fact-check/elegance).
- If **implement** was the bottleneck: suggest breaking the task into smaller PRs.

Be specific to this run's data, not generic advice.

### PR comment & wrap-up

- **If `noGit`**: There is no branch or PR to report against. Print the timing table and optimization suggestions to the terminal only. List the files modified in the working tree (`git status --porcelain`) so the user can see what the agent touched. Remind the user that changes are uncommitted — the commit/push/PR steps are theirs to run.
- **If `forge != github`**: Report the branch name (and remote URL, if available via `git remote get-url origin`) instead of a PR URL. Print the timing table and optimization suggestions to the terminal only — do **not** attempt to post a PR comment. (Bitbucket `bkt pr comment` wiring is tracked in [srid/agency#10](https://github.com/srid/agency/issues/10).)
- **If `forge == github`**: Report the PR URL. Then post the final step status table as a **PR comment** using `gh pr comment`. Use the markdown table and slowest-step line emitted by `scripts/steps/done` verbatim (strip the trailing `<<<FACTS ... FACTS` block — that's internal). Format:

```sh
gh pr comment --body "$(cat <<'COMMENT'
## [\`/do\`](https://github.com/srid/agency) results

| Step | Status | Duration | Verification |
|------|--------|----------|-------------|
| sync | ✓ | 3s | ... |
| research | ✓ | 45s | ... |
...
| **Total** | | **4m 32s** | |

### Optimization suggestions

- <2–4 concrete suggestions based on timing data>

Workflow completed at <timestamp>.
COMMENT
)"
```

## Receipt

```
.../skills/do/scripts/do-results step-start done
# ... emit summary, post comment ...
.../skills/do/scripts/do-results set active false
.../skills/do/scripts/do-results set status {completed|failed}
.../skills/do/scripts/do-results step-end passed "summary emitted; status comment posted"
```

Note: `done` itself always records `step-end passed` for itself — even if the workflow status is `failed`, the done node successfully did its job (emitting the failure summary).

## Verify

- Timing table printed (or posted to PR on github + not noGit).
- Workflow `status` set to `completed` or `failed` per the predicate above.
- Workflow `active` set to `false` (the stop hook checks this to allow graceful exit).
