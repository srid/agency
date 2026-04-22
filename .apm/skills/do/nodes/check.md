---
name: nodes/check
depends_on: [nodes/implement]
next: [nodes/docs]
skip_when:
  - project_config_missing: check_command
    reason: "no check command configured"
    counts_as_success: true
retry:
  max: 3
  on: failure
  to: self
output_schema:
  status: "passed | failed | skipped"
  reason: "string (if skipped)"
  started_at: string
  completed_at: string
  attempts: int
  verification: string
---

# Check

Read the project's instructions to find the **check command** — a fast static-correctness gate (e.g. `tsc --noEmit`, `cargo check`, `cabal build`, `mypy`, `dune build @check`). Run it.

This is the cheapest gate in the pipeline, so it runs first — fail fast on broken code before any downstream step does work over it.

**If the command fails**, fix the errors and re-run. Up to 3 attempts total. Do not fall back to [[implement]] — the agent is already in fix mode and the failure is local to just-written code. Record `attempts` in the receipt.

After this, continue to [[docs]].
