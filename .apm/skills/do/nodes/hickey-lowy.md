---
name: hickey-lowy
description: Parallel structural review with hickey and lowy sub-agents.
---

# Hickey + Lowy

## Requires

- `--minimal` flag
- `--no-git` flag
- Diff `git diff origin/HEAD...HEAD`
- Full task prompt + research context

## Ensures

- Review findings applied as individual commits (or working-tree fixes under --no-git)
- Findings ledger for PR comment

## Pattern

Instances [fanout-fix](../../patterns/fanout-fix.md) with:
- `reviewer_a`: `hickey` sub-agent
- `reviewer_b`: `lowy` sub-agent
- Config: `cross_validate: true`

## Strategies

**If `--minimal`**: Skip with status `skipped` and reason `"--minimal"`. Move to the next step. Do not spawn either sub-agent.

Invoke `hickey` and `lowy` as two **parallel sub-agents** via the harness's agent tool (`subagent_type: "hickey"` and `subagent_type: "lowy"`). On opencode this is the `task` tool (with `subagent_type` parameter).

**Fallback, never skip.** If the harness cannot honor the model declared in the reviewer skill's frontmatter, run hickey and lowy as sub-agents on the available model instead. If a sub-agent invocation fails for harness/tooling reasons before producing a review, retry that reviewer once; if it still cannot produce a sub-agent review, run that review in the main model by loading the reviewer skill against the same diff.

**Why post-implement, not pre-implement.** Hickey's complecting critique and Lowy's volatility lens both bite harder on a concrete diff than on a plan sketch. Reviewing a plan tends to surface generic concerns; reviewing a real diff surfaces the specific interleavings and boundary misalignments that matter.

<use_parallel_tool_calls>
For maximum efficiency, invoke the `hickey` and `lowy` Agent tools **in parallel** rather than sequentially. You MUST use parallel tool calls: emit both `Agent`/`task` tool_use blocks in a single response, with no other tool calls or text in that response.
</use_parallel_tool_calls>

Each prompt must be self-contained. Brief each one with:

- The full task prompt plus anything relevant that **research** uncovered
- Scope: the actual diff, `git diff origin/HEAD...HEAD`
- **Duplication-audit hint**, when the diff adds new files — check with `git diff --diff-filter=A --name-only origin/HEAD...HEAD` and only include the hint if the output is non-empty

**Do not seed structural questions.** The implementer's prompt must NOT include pre-formed questions like _"Is module X the right home for function Y?"_

**Model selection lives in the skill, not here.** Both skills declare `model: sonnet` in their frontmatter — Claude Code honors this; opencode/Codex ignore the field and fall through to the active model.

**No deferrals.** There is no "Defer" disposition. `/do` is not optimizing for minimal diff — it is optimizing for the simpler artifact landing in `master`. A PR that grows because hickey caught a real fragmentation bug is a *better* PR.

If a sub-agent emits anything resembling a defer, flip the disposition to **Fix in this PR** unconditionally and apply the fix here.

**Cross-validate the parallel findings.** After first-pass reviews, for each reviewer that produced findings, spawn a second invocation of *that same skill* with a self-contained prompt containing the diff and the other reviewer's full findings output. Ask: _"Apply your lens to the diff **and** to the other reviewer's recommendations. Does any recommendation, if applied, create a problem your lens would flag?"_

Run the two cross-validation calls in parallel. If either surfaces a new finding, treat it identically to a first-pass finding.

**Apply each "Fix in this PR" finding as its own commit** — do not batch:

1. Apply the fix narrowly — only the lines that address this specific finding.
2. Run the project's format command on the changed files, if configured.
3. `git add <changed files>` — stage only the files this fix touched.
4. `git commit -m "refactor(hickey): <short finding label>"` (or `refactor(lowy): …`). Body restates the finding in one line.
5. `git push` — push after each commit.

**Under `--no-git`**: Skip commit/push. Apply fixes to working tree.

**Verify**: Both hickey and lowy produced review output. Cross-validation ran (or skipped because zero findings). Every finding has action recorded: **Fix in this PR** or **No-op**. Every "Fix" has a corresponding commit, except under `--no-git`.
