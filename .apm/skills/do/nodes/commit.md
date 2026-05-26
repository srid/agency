---
name: commit
description: Create the primary feature commit and push.
---

# Commit

## Requires

- `--no-git` flag
- Formatted code

## Ensures

- Primary feature commit on feature branch
- Branch pushed to remote

## Strategies

**If `--no-git`**: Skip with status `skipped` and reason `"--no-git"`. Move to the next step. The working-tree changes stay uncommitted — that is the point.

Create a NEW commit (never amend) with a conventional commit message for the primary implementation. Push to the feature branch with `git push -u origin <branch>` (sets upstream on first push).

This is the **primary feature commit**. Downstream **hickey-lowy** and **police** steps produce their own follow-up commits — one per finding or violation addressed — which keeps the PR history a readable progression of "what was built, then what was refined" rather than a single opaque squash.

**Verify**: `git log -1` shows a new commit on the feature branch, and it's pushed to remote.
