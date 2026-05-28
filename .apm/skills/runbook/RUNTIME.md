# Runbook RUNTIME

The runbook engine is a convention for organizing multi-step skills as a graph: one `execution.md` declares the order in a small **prose pseudo-DSL**, and one file per step under `nodes/` describes what to do when that step runs. The agent IS the runtime — there is no separate engine binary. Two scripts under `.../skills/runbook/` provide state recording and a timing summary; both are workflow-agnostic and parameterized by `--workflow=<name>`.

A skill is a **runbook tenant** when its directory contains an `execution.md` next to its `SKILL.md`. Today's tenants: `/do`, `/audit`.

## Prose grammar

The `execution.md` body uses a tiny declarative grammar the agent reads top-to-bottom:

- `call <node>` — open `nodes/<node>.md` and do what it says. The node's last act is `runbook-driver --workflow=<name> end <status> "<verification>" [reason]`.
- `if <expr>:` / `if not <expr>:` — guard the next indented block on a flag the workflow stashed via `runbook-driver set` (e.g. `noGit`, `minimal`, `review`, `forge`).
- Two-space indentation marks nested blocks. Unindented `call` lines are top-level.
- When a guarded `call` is skipped, the surrounding driver records the step as `skipped` with `reason="<guard text>"` (e.g. `reason="not noGit"`, `reason="not minimal"`, `reason="forge != github"`). No separate skip table — the `if` guard is the single source.

Example:

```prose
call sync
if not noGit:
  call branch
call implement
if not minimal:
  call audit
```

The grammar is intentionally small. Anything more elaborate (loops, parallelism, sub-graph composition) is expressed in **node prose** invoking the relevant tool (`Skill` for sub-skill, `Agent` for parallel subagents), not in the grammar.

## How an agent walks a runbook

1. Parse the skill's own arguments. Stash mode flags via `runbook-driver set <field> <value>` (e.g. `set noGit true`, `set minimal false`, `set review true`).
2. Seed the harness's task list with the node names in `execution.md` order. Run the seeding calls in parallel (single round-trip).
3. For each `call <node>` reached in order:
   - `runbook-driver --workflow=<name> start <node>` — bookend the step.
   - Read `nodes/<node>.md` and follow its instructions. Use whatever tools the node prescribes (Bash, Skill, Agent, Read, Edit, …).
   - `runbook-driver --workflow=<name> end <status> "<verification>" [reason]` — bookend the close.
4. For a guarded line whose guard is false: `runbook-driver --workflow=<name> skip <node> "<guard text>"`.
5. When all calls in `execution.md` have been visited, the tenant's `done` node typically invokes `.../skills/runbook/done --workflow=<name>` to emit the universal timing table.

The agent's discipline (bookending every step, not lying about results, honest skip reasons) is the same trust model as any prose-driven skill today. The driver doesn't enforce; it records.

## State

Each tenant writes a per-skill state file in the CWD: `.do-results.json`, `.audit-results.json`, etc. Sub-skill invocation (one tenant calling another via the Skill tool) is just a Skill invocation — each tenant manages its own state file independently. There is no nested or shared state shape.

The state schema:

```json
{
  "workflow": "<name>",
  "startedAt": "<iso>",
  "active": "working|waiting|false",
  "status": "running|completed|failed",
  "steps": [
    {"name": "<node>", "status": "passed|failed|skipped", "verification": "...", "startedAt": "...", "completedAt": "...", "reason": "<optional>"}
  ],
  "pendingStep": {"name": "<node>", "startedAt": "..."}
}
```

Tenant-specific fields (e.g. /do's `forge`, `noGit`, `minimal`) are stashed via `runbook-driver set <field> <value>` and live as top-level keys alongside the lifecycle fields. The driver doesn't interpret them — it just remembers them.

## Scripts

`.../skills/runbook/runbook-driver` — state writer. Subcommands: `init`, `step-start <name>`, `step-end <status> <verif> [reason]`, `skip <name> <reason>`, `set <field> <value>`. All accept `--workflow=<name>` (or `RUNBOOK_WORKFLOW=<name>` env var) to choose the state file `.${name}-results.json`.

`.../skills/runbook/done` — timing-table + FACTS-block report. Reads `.${name}-results.json` given `--workflow=<name>`. Emits a markdown table (step, status, duration, verification) plus a `<<<FACTS …` block with `totalSeconds`, `slowestStep`, `dominantSteps`, `skippedSteps`, `failedSteps`.

Both scripts are deliberately small. The tenant's nodes do the actual work; the engine just tracks it.
