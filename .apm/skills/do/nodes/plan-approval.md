---
name: nodes/plan-approval
depends_on: [nodes/research]
next: [nodes/implement]
skip_when:
  - flag_not_set: review
    reason: "--review not passed"
    counts_as_success: true
requires_tool: EnterPlanMode
output_schema:
  status: "passed | skipped"
  reason: "string (if skipped)"
  started_at: string
  completed_at: string
  verification: string
---

# Plan approval

Conditional pass-through. **Skip unless `--review` is set.**

When active:

- **Clarify ambiguities first** — ask via `AskUserQuestion` if anything is unclear. Don't guess.
- **Present a high-level plan**: what to do and why, not implementation details. Include an **Architecture section** — affected modules, new abstractions, ripple effects.
- **Split non-trivial plans into phases** — MVP first; each phase functionally self-sufficient.
- Use `EnterPlanMode` to present the plan; `ExitPlanMode` once approved.

Once approved, continue to [[implement]] autonomously.

Structural critique (hickey/lowy) isn't available at this point — it runs post-implement on a concrete diff via [[hickey]] and [[lowy]] and surfaces as commits + a PR comment later.
