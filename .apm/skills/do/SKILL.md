---
name: do
description: Do a task end-to-end — implement, PR, CI loop, ship. Graph-based workflow; start at `nodes/sync` and follow each node's `next:` edge.
argument-hint: "<issue-url | prompt> [--review] [--no-git] [--from <step>] [--review-model=<opus|sonnet|haiku>]"
entry: nodes/sync
entry_points:
  default: nodes/sync
  followup: nodes/implement
  post-implement: nodes/fmt
  polish: nodes/hickey
  ci-only: nodes/ci
flags:
  review: { desc: "Pause post-research for plan approval via EnterPlanMode" }
  no-git: { desc: "Extend working tree in place; skip branch/commit/create-pr" }
  from: { type: string, desc: "Entry point name; see entry_points" }
  review-model: { type: enum, values: [opus, sonnet, haiku], desc: "Model for hickey/lowy sub-agents" }
---

# Do Workflow

A task, top-to-bottom: research, branch, implement, pass CI, ship.

**This skill is a graph.** Each step is a node file under `nodes/`. Nodes declare their edges (`next`, `depends_on`) and their output contract (`output_schema`) in YAML frontmatter. Prose bodies include `[[wikilinks]]` that carry meaning — they explain *why* one node depends on another, not just *that* it does.

Tracking: [srid/agency#98](https://github.com/srid/agency/issues/98) (v1 engine is the follow-up). This v0 runs on agent discipline alone — the engine in v1 enforces what v0 asks nicely for.

## The agent's loop

On first invocation:

1. Resolve the starting node: `entry_points[--from]` if `--from` was passed, otherwise `entry`.
2. Open `.apm/sessions/do-$(date -u +%Y%m%dT%H%M%SZ).md` and write the run header (workflow name, flags, starting node). This is your **session log** — same file for every receipt in this run.
3. If `--from` skipped past earlier nodes, append one receipt per skipped node with `status: skipped, reason: "--from <entry-point>"`.

Per node:

1. Read the node file fully.
2. Honor its frontmatter in this order:
   - `skip_when`: if any predicate matches, append a `status: skipped` receipt with the declared reason and advance to `next`.
   - `requires_tool`: if your harness lacks the named tool, append `status: skipped, reason: "harness lacks <tool>"` and advance.
3. Do the work the body describes.
4. Append a receipt to the session log under `## <node-name>`, as a YAML block matching the node's `output_schema`. Include `started_at` and `completed_at` in UTC.
5. On failure, honor `retry:` — loop up to `max` attempts, then record the final `status: failed` and halt. Halting leaves the workflow incomplete; do not advance past a failed node.
6. Read the next node from `next:`. If `next` has multiple targets, dispatch them concurrently when the harness supports it (e.g. two `Agent` tool calls in one response). Downstream nodes with `depends_on: [a, b]` wait until both `a` and `b` have receipts.

The session log is markdown so a human can open it; it's structured enough that the v1 engine parses the same file and validates retroactively.

## Completion

The workflow is complete when the `nodes/done` receipt is appended and no node has `status: failed`. Skipped nodes count toward completion if their reason falls into: `--no-git`, `--from <entry>`, `non-<forge> forge`, `no <tool> command configured`, `docs-only changes`, `harness lacks <tool>`.

ARGUMENTS: $ARGUMENTS
