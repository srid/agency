---
name: do
description: Do a task end-to-end — implement, PR, CI loop, ship. ONLY invoke when the user explicitly types `/do` or `$do`; never auto-select from a natural-language request, even one that sounds like an end-to-end task.
argument-hint: "<issue-url | prompt> [--review] [--no-git] [--minimal] [--from <step>]"
---

# Do Workflow

Take a task and do it top-to-bottom: research, branch, implement, pass CI, open a PR, and ship. (Under `--no-git`, extend the working tree in place — no branch, commit, or PR.)

**Mostly autonomous.** Do NOT use `AskUserQuestion` at any point (except during the `--review` planning pause). Make sensible default choices and keep moving. If the user wants to skip specific steps, they can say so in the prompt — honor it.

This skill is a **workflow graph**, not a single recipe. The graph and its node files live in this directory. Reading these files causes you to embody the workflow; there is no separate engine.

## Layout

```
.apm/skills/do/
  SKILL.md            # this file: the loop, the language, the cross-cutting concerns
  execution.md        # the pinned order; read this immediately after this file
  workspace.md        # bindings that cross between nodes vs scratch that stays put
  patterns/           # reusable shapes nodes instance
    worker-critic.md  # produce → critique → revise (with budget)
    check-loop.md     # run → on fail, fix → retry (optional flaky/real split)
    fanout-fix.md     # parallel reviewers → for each finding, commit per fix
  nodes/              # one file per workflow step (15 files, sync.md … done.md)
  scripts/            # do-results, steps/sync, steps/done — unchanged
```

## Language

Each node and pattern is a Markdown file with YAML frontmatter and a small set of canonical `###` sections. The vocabulary is borrowed from [OpenProse](https://github.com/openprose/prose) — see [Provenance](#provenance) below — but this skill ships no runtime dependency on it. The agent is the runtime, same as today.

Node sections:

| Section | Meaning |
|---------|---------|
| `### Requires` | Inputs the node needs — caller flags or values published by upstream nodes |
| `### Ensures` | Values the node publishes for downstream nodes, **plus** durable side effects (commits, PR comments) |
| `### Strategies` | Judgment rules: when to skip, what to fall back to, how to classify failures |
| `### Errors` | Declared failure modes (`max_attempts_exhausted`, etc.) and what each does to workflow status |
| `### Pattern` | If this node instances a pattern, name it and bind its slots and config |
| `### Receipt` | The `do-results` bookend protocol for this node |

Pattern sections:

| Section | Meaning |
|---------|---------|
| `### Slots` | Sub-roles the pattern needs from its caller (with their own Requires/Ensures) |
| `### Config` | Pattern parameters with defaults |
| `### Requires` / `### Ensures` | Outer contract: what the pattern instance needs from its caller and produces back |
| `### Invariants` | Properties that hold regardless of slot implementation |
| `### Delegation` | Pseudocode describing slot interaction and termination |

Unknown `###` sections are documentation; only the names above are load-bearing.

## How to walk the graph

1. Parse arguments (see [Arguments](#arguments)).
2. Read [`execution.md`](execution.md) for the pinned order, conditional branches, and entry points.
3. Read [`workspace.md`](workspace.md) for the bindings that cross between nodes — **only these survive the boundary**; per-node scratch (sub-agent transcripts, mid-step retry attempts, file reads done for verification) does not.
4. Seed the TaskCreate checklist (see [Progress tracking](#progress-tracking)).
5. Initialize results: `.../scripts/do-results init`, then stash the caller flags (`set forge ...`, `set noGit ...`).
6. For each node in order:
   - Read `nodes/<name>.md`.
   - If the node has a `### Pattern` section, also read `patterns/<pattern-name>.md` and embody the pattern with the slot bindings.
   - Bookend with `step-start <name>` then `step-end <status> "<verification>" [reason]` (sync is the exception — its script handles its own bookend).
   - Update the corresponding TaskCreate task to `in_progress` then `completed`.

## Arguments

Parse the arguments string: `[--review] [--no-git] [--minimal] [--from <step-id>] <task description or issue-url>`

The workflow is **forge-aware**: it auto-detects whether the repo lives on GitHub or elsewhere during the **sync** node. Only GitHub has an active code path today — Bitbucket/other forges gracefully skip PR-related steps. Tracking: [srid/agency#10](https://github.com/srid/agency/issues/10).

- `--review`: Pause after **research** for user plan approval via `EnterPlanMode`/`ExitPlanMode`, then continue autonomously.
- `--no-git`: Extend the working tree **in place** — do not create a branch, commit, push, or touch any PR. Research, implement, check, docs, police, fmt, hickey-lowy, and test all run; git-mutating nodes (**branch**, **commit**, **create-pr**) skip.
- `--minimal`: Skip the nodes whose value is disproportionate on trivially-scoped diffs: **docs**, **hickey-lowy**, **police**, and **evidence**. Use this for one-line bug fixes, typos, config tweaks. The four skipped nodes record `status="skipped"` with `reason="--minimal"`.
- `--from <step-id>`: Start from a specific node. See [`execution.md`](execution.md) for entry points.

## Results Tracking

Every node is bookended by two `scripts/do-results` calls: `step-start <name>` before the work begins, and `step-end <status> <verification> [reason]` after verification. This is what keeps per-step timing accurate — collapsing both into a single end-of-step call produces zero-second durations and worthless timing tables. The script tracks workflow state and emits the final timing table during **done**.

**Trust the script's stdout.** Every mutation echoes a one-line confirmation. Treat that line as your confirmation that the write succeeded; the script is the only public surface, and whatever it persists internally is private.

**Lifecycle the script tracks intrinsically**:

- Node `status` — `passed`, `failed`, or `skipped`. A `skipped` node must include a `reason` (e.g. `"non-github forge: bitbucket"`, `"--no-git"`, `"--minimal"`, `"no check command configured"`).
- `active` — state enum (not a boolean). Set to `working` when the workflow starts (**sync**), `waiting` when the agent is idle waiting for an external process (e.g. background CI), back to `working` when that process returns, and `false` when **done** is reached. The stop hook uses this: `working` blocks exits; `waiting` and `false` allow them.
- Workflow `status` — `completed` when **done** finishes, `failed` if halted. Informational.

**Workflow fields /do also stashes via `set`** (the script doesn't interpret these — it just remembers them):

- `forge` — `github`, `bitbucket`, or `unknown`. Populated by `scripts/steps/sync` after forge detection.
- `noGit` — `true` or `false`. Reflects the `--no-git` flag.

**Commands** (invoke with the full path, e.g. `.../skills/do/scripts/do-results ...`):

- `init` — initialize the workflow's lifecycle skeleton. Echoes `init: startedAt=<ts>`.
- `step-start <name>` — call before node work. Echoes `pending: <name>`.
- `step-end <status> "<verification>" ["<reason>"]` — call after verification. Echoes `recorded: <name> <status> (steps=<count>, pending=<none|name>)`.
- `step <name> <status> "<verification>" <startedAt> <completedAt> ["<reason>"]` — single-call form used by `scripts/steps/sync`. Agent code should prefer `step-start` / `step-end`.
- `set <field> <value>` — set an arbitrary top-level field. Echoes `set: <field>=<value>`.

**Discipline**:

- Bookend every node with `step-start` at the top and `step-end` at the bottom. Calling `step-end` without a prior `step-start` is an error; calling `step` with `now` for both timestamps collapses duration to 0 — neither pattern is allowed. Exceptions: `sync` is recorded by `scripts/steps/sync` itself, and skipped nodes (duration always 0) may use back-to-back `step-start` / `step-end skipped`.
- Don't run `date` yourself or guess timestamps — `do-results` resolves UTC internally.
- The bookending is per-node, declared in each node's `### Receipt` section. Re-state nothing here that the node already declares.

## Progress tracking

Drive Claude Code's native todo UI via the `TaskCreate` tool so the user sees a live checklist of the workflow. At the start of **sync** (or the chosen `--from` entry point), seed a task list with the node names in order from `execution.md`:

```
sync, research, branch, implement, check, docs, fmt, commit, hickey-lowy, police, test, create-pr, ci, evidence, done
```

**Emit all `TaskCreate` calls as parallel `tool_use` blocks in a single assistant turn** — one model round-trip, not one per task. The seeded nodes have no dependencies declared in TaskCreate (the dependency model lives in `execution.md`), so there is nothing to serialize on. Sequential seeding (15 round-trips before any real work) is a regression: it adds latency and clutters the transcript.

**Under `--minimal`, omit the four nodes the flag skips** (`docs`, `hickey-lowy`, `police`, `evidence`) from the seeded list — the user explicitly opted out, so they shouldn't clutter the human-facing checklist. The seeded list becomes 11 items in `--minimal` runs. (Run-inherent skips like `--no-git` and forge skips stay in the list — see Skipped nodes below.)

The `scripts/do-results` lifecycle still records `--minimal`-skipped nodes with `status="skipped"` and `reason="--minimal"` via back-to-back `step-start` / `step-end` calls — that's what keeps the final timing table and `completed`-status logic correct. The task UI is independent of that recording.

At each node boundary, update task state **alongside** the `scripts/do-results` script call — they are not redundant. The script's state drives the stop hook; the task list is the human-facing UI. Miss either and the workflow is inconsistent.

Rules:

- **Flip to `in_progress` when a node starts, `completed` when it verifies.** One node `in_progress` at a time.
- **Retries stay `in_progress`.** If `check`, `test`, `ci`, or `docs` loop through their retry budget, do **not** bounce the task state back to `pending` or flicker it — leave it `in_progress` until the node finally verifies (or retries exhaust and the workflow fails).
- **`--from <step>` entry points**: still seed the full list (minus any `--minimal` omissions). Mark nodes earlier than the entry point as `completed` immediately after seeding.
- **Skipped nodes that stay in the list** (e.g. `branch`/`commit`/`create-pr` under `--no-git`, or PR steps on non-GitHub forges) go straight to `completed`. Record the skip with a back-to-back `do-results step-start` / `step-end skipped ... "<reason>"`.
- **Failure**: if retries exhaust and the workflow halts, leave the failing node `in_progress`, mark `done` `completed` after the failure summary is written, and run `scripts/do-results set status failed`.

## Invariants (workflow-wide)

These hold regardless of which nodes are running:

- **Never skip nodes** unless skipped by `--no-git`, forge detection, `--minimal`, or — for **evidence** — the project hasn't filled in a `## PR evidence` section in `.agency/do.md`. Run them in order from entry point to **done**.
- **Every commit is NEW.** Never amend, rebase, or force-push.
- **Feature branches only.** Never commit to master/main. (Under `--no-git`, no commits happen at all, so this is moot.)
- **Background for CI.** Run CI with `run_in_background: true`.
- **No questions.** Don't use `AskUserQuestion` outside the `--review` plan pause.
- **Never stop between nodes.** After completing a node, immediately proceed to the next one.
- **Complete the full workflow.** Implementing code is one node of many. The task is not done until a PR URL (GitHub), a pushed branch name (non-GitHub), or a working-tree summary (`--no-git`) is reported.
- **Exhausted retries = halt.** If `ci` or `test` retries are exhausted, set status to `"failed"` and skip to **done**. On `ci` failure the draft PR (opened in the preceding **create-pr** node) stays open as the record of the failed attempt — do not close, undraft, or otherwise mutate it.
- **No Defer disposition.** The hickey-lowy node and the `fanout-fix` pattern's disposition audit flip any deferred-work-for-later finding to "Fix in this PR". The only way out of a finding is through it.

## Provenance

The section vocabulary (`### Requires`, `### Ensures`, `### Strategies`, `### Errors`, `### Pattern`) and the pattern-as-reusable-shape concept are lifted from [OpenProse](https://github.com/openprose/prose) — specifically from `skills/open-prose/contract-markdown.md` and the bundled `worker-critic` pattern. The bindings/scratch boundary in [`workspace.md`](workspace.md) mirrors OpenProse's workspace/bindings split. We do **not** depend on the OpenProse runtime, harness adapter, or `*.prose.md` file convention; this skill is self-contained markdown that the agent reads directly. See PR #99's discussion thread for the design rationale and how this differs from PR #99's bespoke `next:`/`depends_on:`/`output_schema:` frontmatter.

ARGUMENTS: $ARGUMENTS
