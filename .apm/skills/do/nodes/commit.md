---
name: nodes/commit
depends_on: [nodes/fmt]
next: [nodes/hickey, nodes/lowy]
skip_when:
  - flag: no-git
    reason: "--no-git"
    counts_as_success: true
provides: [commit_sha]
output_schema:
  status: "passed | failed | skipped"
  reason: "string (if skipped)"
  started_at: string
  completed_at: string
  provides:
    commit_sha: string
  pushed: bool
  verification: string
---

# Commit

Create a **NEW commit** (never amend) with a conventional commit message for the primary implementation. Push to the feature branch with `git push -u origin <branch>` (sets upstream on first push).

This is the **primary feature commit**. Downstream [[hickey]], [[lowy]], and [[code-police]] add their own follow-up commits — one per finding or violation addressed — keeping the PR history a readable progression of "what was built, then what was refined" rather than a single opaque squash.

Record `provides.commit_sha` as the SHA of the new commit. v1's engine will verify this SHA exists on the current branch.

After this, dispatch [[hickey]] and [[lowy]] **concurrently** — they operate on the same diff with different lenses and have no dependency on each other. On Claude Code, emit both `Agent` tool calls in a single response. On harnesses without parallel sub-agents, run them sequentially.
