---
name: plan-approval
kind: node
---

# plan-approval

Pause for user plan approval. Conditional — runs only when the caller passed `--review`.

## Requires

- `review` — caller flag; if `false`, this node is not invoked at all (see [`execution.md`](../execution.md))
- `research.plan` — from research

## Ensures

- (no binding) — control passes back to the caller (the workflow continues from `branch` or `implement`)

## Strategies

- **Clarify ambiguities first** — ask via `AskUserQuestion` if anything in the plan is unclear. Don't guess. This is the **only** node permitted to call `AskUserQuestion`.
- **High-level plan**: what to do and why, not implementation details. Include an **Architecture section** (affected modules, new abstractions, ripple effects).
- **Split non-trivial plans into phases** — MVP first, each phase functionally self-sufficient.
- Use `EnterPlanMode` to enter plan-mode, present the plan, and `ExitPlanMode` to exit.
- Once approved, continue autonomously to **branch** (or **implement** under `--no-git`).

## Why no review on the diff later

Structural critique from hickey/lowy isn't available at this point — it runs post-implement on a concrete diff and surfaces as commits + a PR comment later. The review point here is **pre-implement**, before any code is written. Reviewing a plan tends to surface generic concerns; reviewing a real diff surfaces the specific interleavings and boundary misalignments that matter.

## Receipt

```
.../skills/do/scripts/do-results step-start plan-approval
# ... present plan, await approval ...
.../skills/do/scripts/do-results step-end passed "user approved plan via ExitPlanMode"
```

This node is not in the default TaskCreate seed list (because `--review` is opt-in). When `--review` is set, insert it after `research` and before `branch` at seed time.
