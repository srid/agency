---
name: branch
description: Create a descriptive feature branch from origin/defaultBranch.
---

# Branch

## Requires

- `--no-git` flag
- `defaultBranch` from sync

## Ensures

- Feature branch checked out

## Strategies

Detect the default branch: `git symbolic-ref refs/remotes/origin/HEAD`

1. Create a descriptive feature branch from `origin/<default>`

That's it — just the local branch. No commit, no push, no PR. The branch is pushed later in **commit**, and the PR is created in **create-pr** after all changes are done.

**Verify**: On a feature branch (not master/main).
