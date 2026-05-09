---
name: worker-critic
kind: pattern
---

# worker-critic

Adapted from OpenProse's bundled `std/patterns/worker-critic` (see [`/tmp/prose/tests/open-prose/smoke/worker-critic.prose.md`](https://github.com/openprose/prose/blob/main/tests/open-prose/smoke/worker-critic.prose.md) for the original).

A reusable shape for produce → critique → revise loops with a bounded round budget.

## Slots

- `worker`: produces or revises the work product
  - requires: `task`, optional `feedback`
  - ensures: `output`
- `critic`: evaluates the worker output against the quality bar
  - requires: `output`
  - ensures: `accepted` (bool), `feedback`

## Config

- `max_rounds`: integer, default `2`

## Requires

- `task`: what to produce
- `quality_bar`: acceptance criteria (often inlined in the critic's prompt rather than passed as data)

## Ensures

- `result`: accepted worker output, or the best-effort output with final critique when the round budget is exhausted

## Invariants

- Stop when `critic.accepted` is true or after `max_rounds`.
- On exhaustion: return the latest worker output with the latest critique. Do not silently pass.
- Each iteration is a fresh attempt — never amend earlier rounds.

## Delegation

```prose
let current = call worker
  task: task
let final_review = "not yet evaluated"

repeat max_rounds:
  let review = call critic
    output: current
  if review.accepted:
    return { result: current }
  current = call worker
    task: task
    feedback: review.feedback
  final_review = review

return { result: current, final_feedback: final_review }
```

## Where /do uses this

**Indirectly.** /do does not instance worker-critic directly because its critic loops are mostly `worker = "the implementer"` and `critic = "a deterministic verification command"` (e.g. `tsc --noEmit`, `nix flake check`, `/code-police`). That specialization is captured by [`check-loop.md`](check-loop.md), which shares the same shape but optimizes for runner-as-critic.

The pattern is documented here so future workflow-graph workflows (e.g. `/ship` with a polish phase, or a `/draft` workflow with editor critique) can instance it directly without re-deriving the shape.
