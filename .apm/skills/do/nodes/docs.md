---
name: nodes/docs
depends_on: [nodes/check]
next: [nodes/fmt]
skip_when:
  - project_config_missing: docs_files
    reason: "no docs files configured"
    counts_as_success: true
retry:
  max: 3
  on: outdated
  to: self
output_schema:
  status: "passed | failed | skipped"
  reason: "string (if skipped)"
  started_at: string
  completed_at: string
  attempts: int
  verification: string
---

# Docs

Read the project's instructions to find which documentation files to keep in sync (e.g., `README.md`). Compare those files against the changes in this PR.

**If outdated**, fix the outdated sections and re-verify. Up to 3 attempts.

After this, continue to [[fmt]].
