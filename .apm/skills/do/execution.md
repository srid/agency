# Execution

The pinned order /do walks. Each step name refers to a node file (e.g. `sync` → `nodes/sync.md`). Conditional skips are baked into each node's `### Strategies`; this file shows the order, the high-level branches, and which patterns each node instances.

This file is the **system-level Execution block** — the pinned choreography. Borrowed conceptually from OpenProse's `### Execution` ProseScript syntax, but written as readable pseudocode. The agent walks the order; nodes describe the work; patterns describe shared shapes.

## Order

```prose
# Coordination + research
call sync
  noGit: noGit                         # caller flag

call research
  task: task
  forge: sync.forge

if review:
  call plan-approval
    plan: research.plan

# Local in-place work
if not noGit:
  call branch
    default_branch: sync.default_branch

call implement
  plan: research.plan

# Cheapest verification gate first
call check                             # pattern: check-loop, max_attempts: 3
if not minimal:
  call docs                            # pattern: check-loop, max_attempts: 3

call fmt                               # one-shot, no retry pattern

if not noGit:
  call commit                          # one-shot

# Structural review fanout (post-implement, on a concrete diff)
if not minimal:
  call hickey-lowy                     # pattern: fanout-fix, reviewers: [hickey, lowy]
  call police                          # pattern: check-loop, loop_artifacts: commit-per-fix

call test                              # pattern: check-loop, coverage_check: true

# Forge integration
call create-pr                         # one-shot; skipped under --no-git or non-github

call ci                                # pattern: check-loop, flaky_classification: true
                                       # max_attempts: 5 real, flaky_budget: 3
                                       # rerun_on_new_commit: true

call evidence                          # opt-in; skipped unless .agency/do.md declares it

call done                              # one-shot; emits timing table + status
```

## Why this order

Read each node for its full rationale. The high-level reasoning:

- **Cheap gates first** (check before docs before fmt) — fail fast on broken code before any downstream node does work over it. `check` is typically `tsc --noEmit` or `cargo check` or `cabal build`, which is the cheapest verification in the pipeline.
- **commit before hickey-lowy** — reviewers operate on a real diff (`git diff origin/HEAD...HEAD`), not a plan. Reviewing a plan tends to surface generic concerns; reviewing a real diff surfaces the specific interleavings and boundary misalignments that matter.
- **fmt before commit** — the primary feature commit should land already-formatted; downstream `hickey-lowy` and `police` commits each run `fmt` on their own changes inside the `commit-per-fix` loop.
- **create-pr before ci** — the draft PR is the canonical home for CI status. Opening it before CI runs means CI checks land directly on the PR, reviewers see the run history as it happens, and a failing CI doesn't leave an orphaned branch with red statuses and no PR to explain them.
- **evidence after ci passes** — capturing screenshots/benchmarks/transcripts of broken code wastes both the capture work and the reviewer's time.
- **done last, always** — the timing table needs every node's bookend already recorded.

## Patterns referenced

| Node | Pattern | Why |
|------|---------|-----|
| check | check-loop | Run a verification command; on failure, fix the just-written code and retry. |
| docs | check-loop | Verify docs match code; on staleness, update and re-verify. |
| police | check-loop (`loop_artifacts: commit-per-fix`) | `/code-police` reports violations; each fix is its own commit. |
| test | check-loop (`coverage_check: true`, `loop_artifacts: commit-per-fix`) | Run tests; on real failure, fix + commit + retry. Coverage check verifies the new behavior is actually exercised. |
| ci | check-loop (`flaky_classification: true`, `flaky_budget: 3`, `loop_artifacts: commit-per-fix`, `rerun_on_new_commit: true`) | CI flakes are expected; real failures get fix + commit + retry. CI on a stale SHA does not satisfy verification. |
| hickey-lowy | fanout-fix | Two reviewers in parallel; one commit per finding. |

The other nodes (sync, research, plan-approval, branch, implement, fmt, commit, create-pr, evidence, done) are one-shot — they do specific work, verify, and move on. They don't instance a pattern.

## Entry points

`--from <id>` shifts the start position. Earlier nodes are still seeded in TaskCreate and immediately marked `completed` so the checklist is consistent.

| ID | Starts at | Use case |
|----|-----------|----------|
| `default` | sync | Full workflow from scratch |
| `followup` | implement | Additional changes on an existing PR |
| `post-implement` | fmt | Skip research/impl, start at formatting |
| `polish` | hickey-lowy | Structural review + quality gate |
| `ci-only` | ci | Just run CI |

When entering at `polish` or `ci-only`, the workflow assumes the PR already exists; `create-pr` re-checks via `gh pr view` and only edits title/body if scope changed.

## Skip taxonomy

A node is `skipped` for one of four reasons. Each reason carries through to `done`'s "completed" predicate (see `nodes/done.md`):

| Reason | Triggered by | Counts toward "completed" |
|--------|--------------|---------------------------|
| `--minimal` | caller flag | yes |
| `--no-git` | caller flag, on git-mutating nodes | yes |
| `non-<forge> forge: <forge>` | sync's forge detection, on PR/CI nodes | yes |
| `no <command> configured` | nodes that read `.agency/do.md` (check, docs, fmt, test, ci, evidence) | yes |

Any other skip reason is suspect. A `failed` node always blocks `completed`.
