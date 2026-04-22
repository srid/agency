---
name: nodes/fmt
depends_on: [nodes/docs]
next: [nodes/commit]
skip_when:
  - project_config_missing: fmt_command
    reason: "no fmt command configured"
    counts_as_success: true
output_schema:
  status: "passed | failed | skipped"
  reason: "string (if skipped)"
  started_at: string
  completed_at: string
  verification: string
---

# Fmt

Read the project's instructions to find the **format command** (typically documented in a workflow instruction). Run it.

After this, continue to [[commit]].
