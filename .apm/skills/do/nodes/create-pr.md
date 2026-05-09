---
name: create-pr
kind: node
---

# create-pr

Open the draft PR and post the hickey/lowy analysis comment. Forge-aware. One-shot (idempotent on followup runs).

## Requires

- `noGit` — caller flag
- `forge` — from sync
- `branch` — from sync (current) or branch (new feature branch)
- `review_findings` — from hickey-lowy (may be empty)
- `task`, `research.plan` — for PR body composition

## Ensures

- `pr_url` — string; absent under `noGit` or non-github forge
- (side effect) draft PR created (or re-checked if already exists)
- (side effect) hickey/lowy analysis posted as a PR comment

## Strategies

- **If `noGit`**: skip with `status="skipped"` and `reason="--no-git"`. There is no PR to create. Proceed to **ci**.
- **If `forge != github`**: skip with `status="skipped"` and `reason="non-<forge> forge: <forge>"`. (Bitbucket `bkt pr edit` wiring is tracked in [srid/agency#10](https://github.com/srid/agency/issues/10).) Proceed to **ci**.
- **If `forge == github`**:

### First run (no PR exists)

Check whether a PR already exists for this branch (`gh pr view`). If not:

1. Create a draft PR: `gh pr create --draft`. **MANDATORY**: Load the `forge-pr` skill (via Skill tool) BEFORE writing the PR title/body.

2. **Post hickey/lowy results**: Post the `review_findings` as a PR comment using `gh pr comment` with a `## [Hickey/Lowy](https://kolu.dev/blog/hickey-lowy/) Analysis` header (the heading links to the blog post explaining the two lenses, mirroring how the final step status comment links `/do` to the agency repo). Always post when the hickey-lowy node ran — reviewers should see the structural analysis even if every finding was a No-op.

   **Format the comment with a leading findings ledger.** Compose a single table from both sub-agents' Actions sections — one row per finding — so a reviewer can see disposition at a glance without parsing paragraphs. Put each lens's prose underneath as rationale:

   ```md
   ## [Hickey/Lowy](https://kolu.dev/blog/hickey-lowy/) Analysis

   | # | Lens   | Finding                                  | Disposition       |
   |---|--------|------------------------------------------|-------------------|
   | 1 | Hickey | viewportDimensions complects two roles   | Fixed in this PR  |
   | 2 | Lowy   | useViewport encapsulates ghost concern   | Fixed in this PR  |

   ### Hickey rationale
   <prose from the hickey sub-agent>

   ### Lowy rationale
   <prose from the lowy sub-agent>
   ```

   The Disposition cell mirrors the sub-agent's Actions disposition verbatim — **Fixed in this PR** or **No-op** (deletion-only / subsumed by another finding). There is no Deferred disposition; if a sub-agent emitted one, the disposition audit (in the `fanout-fix` pattern) flipped it to Fixed in this PR. The Finding cell is the short bolded label the sub-agent emits at the start of each Actions entry. If both lenses produced zero findings, write a one-line "No findings — analysis below" instead of an empty table.

### Followup runs (PR already exists, `--from` entry points)

Re-check the PR title/body against current scope. If scope changed, update via `gh pr edit` per the `forge-pr` skill. Don't re-post the hickey/lowy comment — the existing one stays as the record of the original review pass; followup runs that re-execute hickey-lowy will post a new analysis comment as part of that node, not here.

## Why this runs before `ci`

The draft PR is the canonical home for CI status. Opening it before CI runs means CI checks land directly on the PR, reviewers see the run history as it happens, and a failing run doesn't leave an orphaned branch with red statuses and no PR to explain them. If retries exhaust in **ci**, the draft PR remains as the artifact of the failed attempt — visible, reviewable, and ready to resume via `--from ci-only`.

## Receipt

```
.../skills/do/scripts/do-results step-start create-pr
# under --no-git or non-github, immediately:
.../skills/do/scripts/do-results step-end skipped "<reason>" "<reason-tag>"
# otherwise, after creating + posting:
.../skills/do/scripts/do-results step-end passed "draft PR <url> created; hickey/lowy comment posted"
```

## Verify

Draft PR exists (`gh pr view` succeeds), PR title/body matches the delivered scope, hickey/lowy findings posted if any.

## Errors

- `pr_create_failed` — halt workflow. Cannot proceed to `ci` without a PR target for status checks.
