---
name: do
description: Do a task end-to-end — implement, PR, CI loop, ship. ONLY invoke when the user explicitly types `/do` or `$do`; never auto-select from a natural-language request, even one that sounds like an end-to-end task.
argument-hint: "<issue-url | prompt> [--review] [--no-git] [--minimal] [--from <step>]"
---

# Do Workflow

Take a task and do it top-to-bottom: research, branch, implement, pass CI, open a PR, and ship. (Under `--no-git`, extend the working tree in place — no branch, commit, or PR.)

**This is a runbook.** The graph lives in [`execution.md`](execution.md); each step is a node file under [`nodes/`](nodes/). Read [`.apm/runbook/RUNTIME.md`](.apm/runbook/RUNTIME.md) for walking conventions. The agent is the runtime.

**Mostly autonomous.** Do NOT use `AskUserQuestion` at any point (except during the `--review` planning pause). Make sensible default choices and keep moving. If the user wants to skip specific steps, they can say so in the prompt — honor it.

## Arguments

Parse `[--review] [--no-git] [--minimal] [--from <step>] <task description or issue-url>`.

- `--review`: Pause after **research** for user plan approval via `EnterPlanMode`/`ExitPlanMode`, then continue autonomously.
- `--no-git`: Extend the working tree in place — no branch, commit, push, or PR. Research, implement, check, docs, audit, fmt, and test run; git-mutating steps are skipped. Use when extending uncommitted local work without taking over git state. Feedback in [#26](https://github.com/srid/agency/issues/26).
- `--minimal`: Skip steps whose value is disproportionate on trivially-scoped diffs: **docs**, **audit**, **evidence**.
- `--from <step>`: Start from a specific step (see [`execution.md`](execution.md) entry points).

The workflow is **forge-aware**: it auto-detects whether the repo lives on GitHub or elsewhere during **sync**. Only GitHub has an active code path today — Bitbucket/other forges gracefully skip PR-related steps. Tracking: [#10](https://github.com/srid/agency/issues/10).

## How to walk the runbook

1. Parse arguments. Stash mode flags after `sync` initializes state:
   - `.apm/runbook/scripts/.apm/runbook/scripts/runbook-driver --workflow=do set noGit <true|false>`
   - `.apm/runbook/scripts/.apm/runbook/scripts/runbook-driver --workflow=do set minimal <true|false>`
   - `.apm/runbook/scripts/.apm/runbook/scripts/runbook-driver --workflow=do set review <true|false>`
2. Seed the harness task list with the node names in [`execution.md`](execution.md) order. Run all `TaskCreate` calls in a single parallel batch — one round-trip, not one per task. Under `--minimal`, omit `docs`, `audit`, `evidence` from the seeded list.
3. For each `call <node>` in order:
   - `.apm/runbook/scripts/.apm/runbook/scripts/runbook-driver --workflow=do start <node>`
   - Read `nodes/<node>.md` and follow it.
   - `.apm/runbook/scripts/.apm/runbook/scripts/runbook-driver --workflow=do end <status> "<verification>" [reason]`
4. For a guarded `call` whose guard is false: `.apm/runbook/scripts/.apm/runbook/scripts/runbook-driver --workflow=do skip <node> "<guard text>"`. Skip reasons are the unsatisfied guard expression (e.g. `"not noGit"`, `"not minimal"`, `"forge != github"`).
5. The `done` node invokes `.apm/runbook/scripts/done --workflow=do` for the timing table, then composes the final PR comment.

## Progress tracking

Drive the harness's native todo UI alongside `runbook-driver`. The script's state drives the stop hook; the task list is the human-facing UI. Miss either and the workflow is inconsistent.

- **Flip to `in_progress` when a step starts, `completed` when it verifies.** One step `in_progress` at a time.
- **Retries stay `in_progress`.** If `check`, `test`, or `ci` loop through their retry budget, do not bounce the task back to `pending`.
- **`--from <step>` entry points**: seed the full list (minus `--minimal` omissions). Mark earlier steps as `completed` immediately after seeding.
- **Skipped steps that stay in the list** (e.g. `branch`/`commit`/`create-pr` under `--no-git`) go straight to `completed`; the runbook-driver records the skip.
- **Failure**: leave the failing step `in_progress`, mark `done` `completed` after the failure summary is written, run `.apm/runbook/scripts/runbook-driver --workflow=do set status failed`.

## Rules

- **Never skip steps** (unless skipped by `--no-git`, `--minimal`, or forge detection).
- **Every commit is NEW.** Never amend, rebase, or force-push.
- **Feature branches only.** Never commit to master/main.
- **Background for CI.** Run CI with `run_in_background: true`.
- **No questions.** Don't use `AskUserQuestion` outside the `--review` plan pause.
- **Never stop between steps.** After completing a step, immediately proceed to the next one.
- **Complete the full workflow.** The task is not done until a PR URL (GitHub), a pushed branch name (non-GitHub), or a working-tree summary (`--no-git`) is reported.
- **Exhausted retries = halt.** If `ci` or `test` retries are exhausted, set status to `"failed"` and skip to **done**.

ARGUMENTS: $ARGUMENTS
