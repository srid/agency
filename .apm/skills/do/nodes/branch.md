---
name: branch
kind: node
---

# branch

Create a descriptive feature branch from `origin/<default>`.

## Requires

- `noGit` — caller flag
- `default_branch` — from sync

## Ensures

- `branch` — overwrites the binding sync set; downstream nodes read the new feature-branch name

## Strategies

- **If `noGit`**: skip entirely with `status="skipped"` and `reason="--no-git"`. Stay on the current branch — do not create, commit, or push anything. Move to **implement**.
- Otherwise: detect the default branch with `git symbolic-ref refs/remotes/origin/HEAD` and create a descriptive feature branch from `origin/<default>`.
- That's it — just the local branch. No commit, no push, no PR. The branch is pushed later in **commit**, and the PR is created in **create-pr** after all changes are done.

## Receipt

```
.../skills/do/scripts/do-results step-start branch
# under noGit, immediately:
.../skills/do/scripts/do-results step-end skipped "stayed on current branch" "--no-git"
# otherwise, after creating:
.../skills/do/scripts/do-results step-end passed "on feature branch <name>"
```

## Verify

On a feature branch (not master/main). Under `--no-git`, on whatever branch the user started on (verify via `git symbolic-ref --short HEAD` ≠ `default_branch`, **only** when not skipped).
