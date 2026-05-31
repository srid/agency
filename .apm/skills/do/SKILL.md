---
name: do
description: Do a task end-to-end — implement, PR, CI loop, ship. ONLY invoke when the user explicitly types `/do` or `$do`; never auto-select from a natural-language request, even one that sounds like an end-to-end task.
argument-hint: "<issue-url | prompt> [--review] [--no-git] [--minimal] [--from <step-id>]"
---

# Do Workflow

Take a task and do it top-to-bottom: research, branch, implement, pass CI, open a PR, and ship. (Under `--no-git`, extend the working tree in place — no branch, commit, or PR.)

> All paths in this skill are relative to the skill's base directory.

**This is a workflow graph.** Step order, skip predicates, and pattern configs live in [`workflow.ncl`](workflow.ncl); each step's activity is a node file under [`nodes/`](nodes/). The agent is the runtime — there is no separate engine.

**Mostly autonomous.** Do NOT use `AskUserQuestion` at any point (except during the `--review` planning pause). Make sensible default choices and keep moving.

## How to walk the graph

1. Parse arguments: `[--review] [--no-git] [--minimal] [--from <step-id>] <task>`
2. Call `scripts/do-driver init <flags> <task>` to initialize state.
3. Seed the task checklist using Nickel:
   ```bash
   nickel eval workflow.ncl --field cli_seed --arg "<from>" --arg "$(cat .do-results.json)"
   ```
   This returns `[{ name, initial_status }]` — mark `completed` steps and seed the todo UI.
4. For each step, ask Nickel what to do next:
   ```bash
   next=$(nickel eval workflow.ncl --field cli --arg "$(cat .do-results.json)")
   ```
   This returns `{ step, skip, pattern, instructions, requires, pattern_config }`.
   - If `skip` is true, call `scripts/do-driver skip <step> <reason>` and continue.
   - Otherwise: call `scripts/do-driver start <step>`, read `nodes/<step>.md`, do the work, then call `scripts/do-driver end <status> "<verification>" [reason]`.
5. When Nickel returns `{ done = true }`, call `scripts/do-driver summary`.

## Arguments

The workflow is **forge-aware**: it auto-detects whether the repo lives on GitHub or elsewhere during the **sync** step. Only GitHub has an active code path today — Bitbucket/other forges gracefully skip PR-related steps. Tracking: [srid/agency#10](https://github.com/srid/agency/issues/10).

- `--review`: Pause after **research** for user plan approval via `EnterPlanMode`/`ExitPlanMode`, then continue autonomously.
- `--no-git`: Extend the working tree **in place** — do not create a branch, commit, push, or touch any PR. Git-mutating nodes skip with `reason="--no-git"`.
- `--minimal`: Skip **docs**, **hickey-lowy**, **police**, and **evidence** (omitted from todo list entirely).
- `--from <step-id>`: Start from a specific node. Entry points: `default`→sync, `followup`→implement, `post-implement`→fmt, `polish`→hickey-lowy, `ci-only`→ci.

## Results Tracking

Every node is bookended by `scripts/do-driver start <name>` before work and `scripts/do-driver end <status> "<verification>" [reason]` after verification. The driver wraps `scripts/do-results`, which persists step records in `.do-results.json`.

**Trust the driver's stdout.** Every mutation echoes a one-line confirmation.

The `scripts/do-results` script tracks:

- Step `status` — `passed`, `failed`, or `skipped`.
- `active` — state enum (`working`, `waiting`, `false`). The stop hook uses this.
- Workflow `status` — `completed` or `failed`.

**Workflow fields** stashed via `do-driver set <field> <value>`:

- `forge` — `github`, `bitbucket`, or `unknown`.
- `noGit` — `true` or `false`.
- `minimal` — `true` or `false`.

## Progress tracking

Drive the harness's native todo UI so the user sees a live checklist. Use `cli_seed` from Nickel to get the initial step list with correct statuses.

Rules:

- **Flip to `in_progress` when a step starts, `completed` when it verifies.** One step `in_progress` at a time.
- **Retries stay `in_progress`.** Do not flicker the task state during retry loops.
- **Skipped steps that stay in the list** (e.g. `branch` under `--no-git`) go straight to `completed`.
- **`--minimal` skips are omitted from the list entirely.**
- **Failure**: leave the failing step `in_progress`, mark `done` `completed` after the summary, and run `do-driver set status failed`.

## Rules

- **Never skip steps** (unless Nickel reports `skip = true`, or — for **evidence** — the project hasn't filled in a `## PR evidence` section in `.agency/do.md`). Run them in order from entry point to **done**.
- **Every commit is NEW.** Never amend, rebase, or force-push.
- **Feature branches only.** Never commit to master/main.
- **Background for CI.** Run CI with `run_in_background: true`.
- **No questions.** Don't use `AskUserQuestion` outside the `--review` plan pause (post-research).
- **Never stop between steps.** After completing a step, immediately proceed to the next one.
- **Complete the full workflow.** The task is not done until a PR URL (GitHub), a pushed branch name (non-GitHub forges), or a working-tree summary (`--no-git`) is reported.
- **Exhausted retries = halt.** If `ci` or `test` retries are exhausted, set status to `"failed"` and skip to **done**.
