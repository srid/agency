# worker-critic

Produce → critique → revise (with budget). The general shape of which `check-loop` is a specialization.

## Slots

- `worker`: produces an artifact
  - requires: `spec`
  - ensures: `artifact`
- `critic`: evaluates the artifact against a standard
  - requires: `artifact`
  - ensures: `verdict` (`pass` | `fail` | `flaky`), `critique`
- `reviser`: revises the artifact given the critique
  - requires: `artifact`, `critique`
  - ensures: `revised_artifact`, `changed` (bool)

## Config

| Param | Default | Meaning |
|-------|---------|---------|
| `max_attempts` | `3` | Maximum revision rounds. |
| `early_exit` | `true` | If critic returns `pass` on first attempt, stop immediately. |

## Requires

- `spec`: what the worker should produce

## Ensures

- `final_artifact`: the artifact after zero or more revision rounds
- `attempts`: how many rounds were consumed
- `verdict`: `pass` | `failed-after-budget`

## Invariants

- The critic is always applied to the latest artifact, not the original.
- Each round that produces a real change counts as one attempt.
- If `early_exit` is `true` and the first round passes, `attempts == 0`.

## Delegation

```prose
let artifact = call worker(spec: spec)
let attempts = 0

loop:
  let { verdict, critique } = call critic(artifact: artifact)
  if verdict == "pass":
    return { final_artifact: artifact, attempts: attempts, verdict: "pass" }
  if attempts >= max_attempts:
    return { final_artifact: artifact, attempts: attempts, verdict: "failed-after-budget" }
  let { revised_artifact, changed } = call reviser(artifact: artifact, critique: critique)
  if not changed:
    return { final_artifact: artifact, attempts: attempts, verdict: "pass" }
  artifact = revised_artifact
  attempts += 1
```
