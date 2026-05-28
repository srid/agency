# plan-approval

Pause for user plan approval via `EnterPlanMode`/`ExitPlanMode`. Only invoked when `--review` is set (the execution.md guard handles this).

## Strategies

Use `EnterPlanMode` to present the approach for user approval:

- **Clarify ambiguities** first — ask via `AskUserQuestion` if anything is unclear. Don't guess.
- **High-level plan**: what to do and why, not implementation details. Include an **Architecture section** (affected modules, new abstractions, ripple effects).
- **Split non-trivial plans into phases** — MVP first, each phase functionally self-sufficient.

Use `ExitPlanMode` to present the plan. Once approved, continue autonomously to **branch**.

Structural critique from /audit isn't available at this point — it runs post-implement on a concrete diff and surfaces as commits + a PR comment later.

**Verify**: User approved the plan via `ExitPlanMode`.
