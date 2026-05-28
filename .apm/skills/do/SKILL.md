---
name: do
description: Do a task end-to-end — implement, PR, CI loop, ship. ONLY invoke when the user explicitly types `/do` or `$do`; never auto-select from a natural-language request, even one that sounds like an end-to-end task.
argument-hint: "<issue-url | prompt> [--review] [--no-git] [--minimal] [--from <step-id>]"
---

# Do Workflow

Take a task and do it top-to-bottom: research, branch, implement, pass CI, open a PR, and ship. (Under `--no-git`, extend the working tree in place — no branch, commit, or PR.)

> All paths in this skill are relative to the skill's base directory.

**This is a workflow graph.** The graph lives in [`execution.md`](execution.md); each step is a node file under [`nodes/`](nodes/); reusable shapes live under [`patterns/`](patterns/). The agent is the runtime — there is no separate engine.

**Mostly autonomous.** Do NOT use `AskUserQuestion` at any point (except during the `--review` planning pause). Make sensible default choices and keep moving.

## How to walk the graph

1. Parse arguments (see [Arguments](#arguments)).
2. Call `scripts/do-driver init <flags> <task>` to initialize state.
3. Read [`execution.md`](execution.md) for the pinned order, conditional branches, entry points, and pattern instances.
4. Seed the task checklist (see [Progress tracking](#progress-tracking)).
5. For each step in order:
   - Call `scripts/do-driver start <step>`.
   - Read `nodes/<step>.md` and do the work.
   - Call `scripts/do-driver end <status> "<verification>" [reason]`.
6. Call `scripts/do-driver summary` to emit the timing table.

## Arguments

Parse the arguments string: `[--review] [--no-git] [--minimal] [--from <step-id>] <task description or issue-url>`

The workflow is **forge-aware**: it auto-detects whether the repo lives on GitHub or elsewhere during the **sync** step. Only GitHub has an active code path today — Bitbucket/other forges gracefully skip PR-related steps. Tracking: [srid/agency#10](https://github.com/srid/agency/issues/10).

- `--review`: Pause after **research** for user plan approval via `EnterPlanMode`/`ExitPlanMode`, then continue autonomously.
- `--no-git`: Extend the working tree **in place** — do not create a branch, commit, push, or touch any PR. Git-mutating nodes skip with `reason="--no-git"`.
- `--minimal`: Skip the steps whose value is disproportionate on trivially-scoped diffs: **docs**, **hickey-lowy**, **police**, and **evidence**.
- `--from <step-id>`: Start from a specific node. See [`execution.md`](execution.md) for entry points.

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

Drive the harness's native todo UI so the user sees a live checklist. At workflow start, seed all steps in order (omitting `--minimal` skips). Mark `--from` pre-steps as `completed` immediately.

Rules:

- **Flip to `in_progress` when a step starts, `completed` when it verifies.** One step `in_progress` at a time.
- **Retries stay `in_progress`.** Do not flicker the task state during retry loops.
- **Skipped steps that stay in the list** (e.g. `branch` under `--no-git`) go straight to `completed`.
- **`--minimal` skips are omitted from the list entirely.**
- **Failure**: leave the failing step `in_progress`, mark `done` `completed` after the summary, and run `do-driver set status failed`.

## Entry Points

| ID | Starts at | Use case |
| -- | --------- | -------- |
| `default` | sync | Full workflow from scratch |
| `followup` | implement | Additional changes on existing PR |
| `post-implement` | fmt | Skip research/impl, start at formatting |
| `polish` | hickey-lowy | Structural review + quality gate |
| `ci-only` | ci | Just run CI |

## Rules

- **Never skip steps** (unless skipped by `--no-git`, forge detection, or — for **evidence** — the project hasn't filled in a `## PR evidence` section in `.agency/do.md`). Run them in order from entry point to **done**.
- **Every commit is NEW.** Never amend, rebase, or force-push.
- **Feature branches only.** Never commit to master/main.
- **Background for CI.** Run CI with `run_in_background: true`.
- **No questions.** Don't use `AskUserQuestion` outside the `--review` plan pause (post-research).
- **Never stop between steps.** After completing a step, immediately proceed to the next one.
- **Complete the full workflow.** The task is not done until a PR URL (GitHub), a pushed branch name (non-GitHub forges), or a working-tree summary (`--no-git`) is reported.
- **Exhausted retries = halt.** If `ci` or `test` retries are exhausted, set status to `"failed"` and skip to **done**.
