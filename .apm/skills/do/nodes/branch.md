# branch

Create a descriptive feature branch from `origin/<default>`. Skipped under `--no-git` (execution.md guard).

## Strategies

Invoke `.apm/skills/vcs/vcs-op default-branch` to detect the default branch, then `.apm/skills/vcs/vcs-op branch <name>` to create a descriptive feature branch from `origin/<default>`.

No commit, no push, no PR. The branch is pushed later in **commit**, and the PR is created in **create-pr** after all changes are done.

**Verify**: On a feature branch (not master/main). Confirm via `.apm/skills/vcs/vcs-op head-revision`.
