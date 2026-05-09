---
name: commit
kind: node
---

# commit

Create the primary feature commit and push the branch. One-shot.

## Requires

- `noGit` — caller flag
- `branch` — from sync (current) or branch (new feature branch)

## Ensures

- `primary_commit_sha` — git sha of the new commit (absent under `noGit`)
- (side effect) feature branch pushed to remote with `git push -u origin <branch>`

## Strategies

- **If `noGit`**: skip with `status="skipped"` and `reason="--no-git"`. Move to **hickey-lowy**. The working-tree changes stay uncommitted — that is the point.
- Otherwise: create a NEW commit (never amend) with a conventional commit message for the primary implementation. Push to the feature branch with `git push -u origin <branch>` (the `-u` sets upstream on first push).
- This is the **primary feature commit**. Downstream **hickey-lowy** and **police** nodes produce their own follow-up commits — one per finding or violation addressed — which keeps the PR history a readable progression of "what was built, then what was refined" rather than a single opaque squash.

## Receipt

```
.../skills/do/scripts/do-results step-start commit
# under noGit, immediately:
.../skills/do/scripts/do-results step-end skipped "no commit; working tree unchanged" "--no-git"
# otherwise, after committing + pushing:
.../skills/do/scripts/do-results step-end passed "primary commit <sha> pushed to origin/<branch>"
```

## Verify

- Under `noGit`: skipped, no git operations performed.
- Otherwise: `git log -1` shows a new commit on the feature branch, and it's pushed to remote (verify via `git rev-parse origin/<branch>` matching local HEAD).

## Errors

- `push_failed` — halt workflow. The branch is local-only and the rest of the workflow assumes it's pushed.
