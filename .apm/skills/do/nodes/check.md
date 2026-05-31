---
name: check
description: Fast static-correctness gate.
---

# Check

## Requires

- Implemented code

## Ensures

- Static correctness verified

## Pattern

Instances [check-loop](../patterns/check-loop.md) with:
- `runner`: read `.agency/do.md` for `## Check command`, run it
- `fixer`: fix errors in just-written code
- Config: `max_attempts: 3`

## Strategies

Read `.agency/do.md` and look for a `## Check command` section — a fast static-correctness gate (e.g. `tsc --noEmit`, `cargo check`, `cabal build`, `mypy`, `dune build @check`). Run it.

This is the cheapest gate in the pipeline, so it runs first — fail fast on broken code before any downstream step does work over it. If no check command is documented, skip this step with a note.

**Verify**: Check ran without errors, or no command configured.
**If failed** (max 3 attempts): Fix the errors and re-run check. Do not fall back to **implement** — the agent is already in fix mode and the failure is local to just-written code.

## Delegation

```prose
let attempts_real = 0

loop:
  read .agency/do.md for "## Check command"
  if no command configured:
    return { verdict: "no-command-configured" }

  run the check command
  if exit 0:
    return { verdict: "pass" }

  attempts_real += 1
  if attempts_real > 3:
    return { verdict: "failed-after-budget" }

  fix the errors
  continue  # re-run check
```
