---
name: nodes/done
depends_on: [nodes/ci]
next: []
output_schema:
  status: "passed | failed"
  started_at: string
  completed_at: string
  workflow_status: "completed | failed"
  pr_url: "string (if forge == github)"
  pr_comment_posted: "bool (if forge == github)"
  verification: string
---

# Done

Terminal node. Compute the timing summary and post the wrap-up.

## Completion policy

Workflow `status: "completed"` requires **all nodes `passed` or skipped-with-accepted-reason**. Accepted skip reasons: `--no-git`, `--from <entry>`, `non-<forge> forge`, `no <tool> command configured`, `docs-only changes`, `harness lacks <tool>`, `--review not passed` (for [[plan-approval]]).

Any `failed` node blocks `completed` — record `workflow_status: "failed"` in the receipt.

## Timing summary

Read the session log (`.apm/sessions/do-<timestamp>.md`). For each node's receipt, compute duration = `completed_at - started_at`. Emit a markdown table:

```md
| Node | Status | Duration | Verification |
|------|--------|----------|-------------|
| sync | ✓ | 3s | ... |
| research | ✓ | 45s | ... |
...
| **Total** | | **4m 32s** | |
```

Bold any node that took ≥30% of total time. Record the slowest node and its duration on a separate line.

## Optimization suggestions

Based on the actual timing data, generate **2–4 concrete suggestions** for reducing time-to-completion in future runs. Base these on this run's data, not generic advice:

- If [[ci]] dominates: suggest `--from ci-only` for re-runs.
- If [[research]] was slow: suggest pre-reading relevant code before invoking `/do`.
- If [[test]] had retries: note the flaky test and suggest hardening it.
- If [[code-police]] required fix iterations: note which pass caught issues (rules/fact-check/elegance).
- If [[implement]] was the bottleneck: suggest breaking the task into smaller PRs.

## PR comment & wrap-up

**If `--no-git`**: print the timing table and optimization suggestions to the terminal only. List files modified in the working tree (`git status --porcelain`) so the user sees what the agent touched. Remind the user that changes are uncommitted.

**If `forge != github`**: report the branch name (and remote URL via `git remote get-url origin`) instead of a PR URL. Print the timing table and suggestions to the terminal only — do **not** attempt to post a PR comment.

**If `forge == github`**: report the PR URL. Then post the final step status as a **PR comment** using `gh pr comment`:

```md
## [`/do`](https://github.com/srid/agency) results

| Node | Status | Duration | Verification |
|------|--------|----------|-------------|
| sync | ✓ | 3s | ... |
...
| **Total** | | **4m 32s** | |

### Optimization suggestions

- <2–4 concrete suggestions based on timing data>

Workflow completed at <timestamp>.
```

Record the final receipt. The workflow is complete.
