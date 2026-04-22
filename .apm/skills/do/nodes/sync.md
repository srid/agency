---
name: nodes/sync
next: [nodes/research]
provides: [forge, branch, defaultBranch]
output_schema:
  status: "passed | failed | skipped"
  reason: "string (if skipped)"
  started_at: string
  completed_at: string
  provides:
    forge: "github | bitbucket | unknown"
    branch: string
    defaultBranch: string
  verification: string
---

# Sync

Fetch `origin`. If `--no-git` is **not** set and the branch is behind, fast-forward with `git pull --ff-only`. Under `--no-git`, fetch only — do not touch the working tree (preserves uncommitted work).

Classify the forge from `git remote get-url origin`:
- Contains `github.com` → `github`
- Contains `bitbucket.` (covers bitbucket.org and self-hosted) → `bitbucket`
- Otherwise → `unknown`

Detect the default branch: `git symbolic-ref refs/remotes/origin/HEAD`.

If the tree is dirty and `--no-git` isn't set, print to the user:

> _Dirty tree detected. Continuing will create a fresh branch on top of these changes. If you wanted the agent to extend your WIP in place without touching git, re-run with `--no-git`._

After this, continue to [[../nodes/research]] — it (and every downstream node) depends on `forge` being resolved.
