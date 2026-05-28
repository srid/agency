---
name: runbook
description: Internal runbook engine — the convention + scripts that runbook tenants like `/do` and `/audit` share. NOT a user-invocable skill; never type `/runbook` directly. Workflow tenants reference its files (`RUNTIME.md`, `runbook-driver`, `done`) at `.../skills/runbook/` from inside their own SKILL.md and node prose.
---

# Runbook engine

`/runbook` is **not user-invocable** — it has no execution, no nodes, no operations a user would ever run. It exists as a skill folder solely so APM propagates its files (`RUNTIME.md`, `runbook-driver`, `done`) into consuming projects' `.claude/skills/runbook/`, the same way it propagates `/vcs` and `/forge`.

If you (the user) typed `/runbook`, you probably meant `/do` or `/audit`.

## What's here

- [`RUNTIME.md`](RUNTIME.md) — the prose convention runbook tenants follow. Read this first if you're authoring a new runbook tenant.
- [`runbook-driver`](runbook-driver) — generic state writer. Subcommands: `init`, `start <name>`, `end <status> <verif> [reason]`, `step <name> <status> <verif> <startedAt> <completedAt> [reason]`, `skip <name> <reason>`, `set <field> <value>`. All take `--workflow=<name>` (or `RUNBOOK_WORKFLOW=<name>` env).
- [`done`](done) — generic timing-table + FACTS-block summarizer. Reads `.${workflow}-results.json`, writes a markdown table + machine-readable FACTS block. Takes `--workflow=<name>`.

## Authoring a new runbook tenant

See `RUNTIME.md`. Briefest version: drop an `execution.md` + `nodes/` next to your SKILL.md, then in your SKILL.md tell the agent to read `.../skills/runbook/RUNTIME.md` and walk the graph.
