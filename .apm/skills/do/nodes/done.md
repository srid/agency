# done

Summarize the run, emit timing table, post final PR comment.

## Strategies

Present a summary of all steps with their verification status. If any step has a non-success status, retry it (max 3 attempts from done). If still failing after retries, set `status: "failed"`.

`"completed"` requires **all steps `passed`**, with the following exceptions that count toward completion:

1. A step `skipped` with `reason` beginning `"non-<forge> forge:"` (detected forge isn't GitHub).
2. A step `skipped` with `reason` `"not noGit"` or beginning `"--no-git"` (user opted out of git operations).
3. A step `skipped` with `reason` `"no PR evidence section in .agency/do.md"` (project hasn't opted into evidence — default).
4. A step `skipped` with `reason` `"not minimal"` or beginning `"--minimal"` (user opted out on a trivial diff).
5. A step `skipped` with `reason` beginning `"no <X> command configured"` (project hasn't configured that gate).

A `failed` step always blocks `"completed"`. Update via `.../skills/runbook/runbook-driver --workflow=do set status completed` or `set status failed`.

### Timing summary

Run `.../skills/runbook/done --workflow=do`. It emits:

1. A markdown timing table (step, status, duration, verification), with any step that took ≥30% of total time shown in **bold**.
2. A `**Slowest step**:` line.
3. A `<<<FACTS ... FACTS` block with machine-readable summary data — use this to compose optimization suggestions below.

Do not compute durations yourself — the script handles all timestamp arithmetic.

### Optimization suggestions

Read the `FACTS` block and generate 2–4 concrete suggestions for reducing time-to-completion in future runs. Base these on actual timing data — for example:

- If **ci** dominates: suggest `--from ci-only` for re-runs.
- If **research** was slow: suggest pre-reading relevant code before invoking `/do`.
- If **test** had retries: note the flaky test and suggest hardening it.
- If **audit** required fix iterations: note which lens caught the most.
- If **implement** was the bottleneck: suggest breaking the task into smaller PRs.

Be specific to this run's data, not generic advice.

### PR comment & wrap-up

**If `--no-git`**: There is no branch or PR. Print the timing table and optimization suggestions to the terminal only. List the files modified in the working tree (`.../skills/vcs/vcs-op dirty-files` or equivalent) so the user can see what the agent touched. Remind the user that changes are uncommitted.

**If `forge != github`**: Report the branch name (and remote URL via `.../skills/vcs/vcs-op remote-url`) instead of a PR URL. Print the timing table and optimization suggestions to the terminal only — do not attempt to post a PR comment.

**If `forge == github`**: Report the PR URL. Post the final step status table as a PR comment via `.../skills/forge/forge-op comment-pr`. Use the markdown table and slowest-step line emitted by the runbook done script verbatim (strip the trailing `<<<FACTS ... FACTS` block — that's internal). Format:

```md
## [`/do`](https://github.com/srid/agency) results

| Step | Status | Duration | Verification |
|------|--------|----------|--------------|
| sync | ✓ | 3s | ... |
| research | ✓ | 45s | ... |
...
| **Total** | | **4m 32s** | |

### Optimization suggestions

- <2–4 concrete suggestions based on timing data>

Workflow completed at <timestamp>.
```
