# create-pr

Open the draft PR and post the hickey/lowy/police findings comment. Skipped under `--no-git` or `forge != github` (execution.md guard).

## Strategies

Check whether a PR already exists for this branch: `.apm/skills/forge/forge-op view-pr`.

### If no PR exists (first run, normal path)

1. Create a draft PR: `.apm/skills/forge/forge-op create-pr --draft`

   **MANDATORY**: Load the `forge-pr` skill (via Skill tool) BEFORE writing the PR title/body.

2. **Post hickey/lowy/police results** as a PR comment.

   Read `.audit-results.json` (written by the **audit** node when it invoked `/audit`). Compose a single ledger comment from the findings list:

   ```md
   ## [Hickey/Lowy](https://kolu.dev/blog/hickey-lowy/) Analysis

   | # | Lens   | Finding                                  | Disposition         |
   |---|--------|------------------------------------------|---------------------|
   | 1 | Hickey | viewportDimensions complects two roles   | Fixed in this PR    |
   | 2 | Lowy   | useViewport encapsulates ghost concern   | Fixed in this PR    |
   | 3 | Lowy   | clipboard.ts named after a consumer      | ⚠️ **No-op**        |

   ### Hickey rationale
   <prose from the hickey reviewer>

   ### Lowy rationale
   <prose from the lowy reviewer>

   ### Police findings
   <prose from /code-police>
   ```

   The Disposition cell mirrors the audit ledger's disposition verbatim — **Fixed in this PR** or **No-op**. **Render every No-op as `⚠️ **No-op**`** (warning emoji + bold) so the reviewer's eye lands on it. There is no Deferred disposition.

   If `/audit` produced zero findings, write a one-line "No findings — analysis below" instead of an empty table.

   Post via `.apm/skills/forge/forge-op comment-pr`.

### If PR already exists (followup runs, `--from` entry points)

Re-check the PR title/body against current scope. If scope changed, update via `.apm/skills/forge/forge-op edit-pr` per the `forge-pr` skill.

**Why this runs before `ci`**: The draft PR is the canonical home for CI status. Opening it before CI runs means CI checks land directly on the PR, reviewers see the run history as it happens, and a failing run doesn't leave an orphaned branch with red statuses and no PR to explain them.

**Verify**: Draft PR exists (`.apm/skills/forge/forge-op view-pr` succeeds), PR title/body matches the delivered scope, hickey/lowy/police findings posted if any.
