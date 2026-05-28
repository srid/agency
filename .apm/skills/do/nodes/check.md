# check

Fast static-correctness gate.

## Strategies

Read `.agency/do.md` and look for a `## Check command` section — a fast static-correctness gate (e.g. `tsc --noEmit`, `cargo check`, `cabal build`, `mypy`, `dune build @check`). Run it.

This is the cheapest gate in the pipeline, so it runs first — fail fast on broken code before any downstream step does work over it. If no check command is documented, skip this step with a note (record via `.../skills/runbook/runbook-driver --workflow=do end skipped "no check command configured" "no check command configured"`).

**Verify**: Check ran without errors, or no command configured.
**If failed** (max 3 attempts): Fix the errors and re-run check. Do not fall back to **implement** — the agent is already in fix mode and the failure is local to just-written code.
