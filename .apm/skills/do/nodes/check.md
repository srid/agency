---
name: check
kind: node
pattern: check-loop
---

# check

Cheapest static-correctness gate in the pipeline (typeck/buildcheck). Runs first so broken code fails fast before any downstream node does work over it.

## Requires

- `noGit` — caller flag (does not skip this node; only affects whether fixes commit)

## Ensures

- `verdict` — `pass` | `failed-after-budget` | `no-command-configured`

## Pattern

Instances [`check-loop`](../patterns/check-loop.md) with:

```yaml
slots:
  runner: run-check-command       # reads .agency/do.md ## Check command, runs it, classifies exit code
  fixer: fix-check-errors          # re-reads just-changed files, applies minimal fix
config:
  max_attempts: 3
  flaky_classification: false      # check failures are not flaky; they're real
  loop_artifacts: none             # fixes stay in the working tree (commit happens later in commit node)
```

## Strategies

- Read `.agency/do.md` and look for a `## Check command` section — a fast static-correctness gate (e.g. `tsc --noEmit`, `cargo check`, `cabal build`, `mypy`, `dune build @check`). Run it.
- If no check command is documented, the runner returns `no-command-configured`; record this node as `skipped` with reason `"no check command configured"`.
- This is the cheapest gate in the pipeline, so it runs first.
- On failure: fix the errors and re-run check. Do not fall back to **implement** — the agent is already in fix mode and the failure is local to just-written code.

## Receipt

```
.../skills/do/scripts/do-results step-start check
# ... pattern delegation ...
.../skills/do/scripts/do-results step-end {passed|skipped|failed} "<verification>" ["<reason>"]
```

## Verify

Check command ran without errors, or no command configured. Specifically: pattern returned `verdict == pass` or `verdict == no-command-configured`.

## Errors

- `failed-after-budget` (3 attempts) — halt workflow with `do-results set status failed`. The just-written code does not pass static correctness; downstream gates would all be operating on broken code.
