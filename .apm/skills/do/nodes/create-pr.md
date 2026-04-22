---
name: nodes/create-pr
depends_on: [nodes/test]
next: [nodes/ci]
skip_when:
  - flag: no-git
    reason: "--no-git"
    counts_as_success: true
  - state_var_not_equal:
      key: forge
      value: github
    reason: "non-github forge"
    counts_as_success: true
requires_skill: forge-pr
provides: [pr_url]
output_schema:
  status: "passed | failed | skipped"
  reason: "string (if skipped)"
  started_at: string
  completed_at: string
  provides:
    pr_url: string
  hickey_lowy_comment_posted: bool
  verification: string
---

# Create PR

Check whether a PR already exists for this branch (`gh pr view`).

**If no PR exists** (first run, normal path):

1. **Load the `forge-pr` skill via the Skill tool BEFORE writing the PR title/body.** Mandatory.
2. Create a draft PR: `gh pr create --draft`.
3. **Post hickey/lowy results** as a PR comment using `gh pr comment` with this heading:

   ```md
   ## [Hickey/Lowy](https://kolu.dev/blog/hickey-lowy/) Analysis
   ```

   Format a leading findings ledger table from both sub-agents' receipts — one row per finding — so a reviewer sees dispositions at a glance:

   ```md
   | # | Lens   | Finding                                  | Disposition       |
   |---|--------|------------------------------------------|-------------------|
   | 1 | Hickey | viewportDimensions complects two roles   | Fixed in this PR  |
   | 2 | Lowy   | useViewport encapsulates ghost concern   | Deferred [#123]   |

   ### Hickey rationale
   <prose from hickey sub-agent>

   ### Lowy rationale
   <prose from lowy sub-agent>
   ```

   Always post when the hickey/lowy nodes ran, even if all findings are deferred or out of scope — reviewers should see the structural analysis. If both produced zero findings, write a one-line "No findings — analysis below" instead of an empty table.

**If PR already exists** (followup runs, `--from` entry points):

Re-check PR title/body against current scope. If scope changed, update via `gh pr edit` per the `forge-pr` skill.

**Surface deferred hickey/lowy findings in the PR body.** If the [[hickey]] or [[lowy]] receipts record any `Deferred #<issue>` findings, append a line to the PR body (via `gh pr edit`):

```md
> **Deferred:** #123, #124
```

Reviewers miss this in a PR comment — the description is what they actually read.

**Why this runs before [[ci]]**: the draft PR is the canonical home for CI status. Opening it before CI means checks land on the PR, reviewers see run history as it happens, and a failing run doesn't leave an orphaned branch. If [[ci]] exhausts retries later, the draft PR stays as the artifact of the failed attempt.

After this, continue to [[ci]].
