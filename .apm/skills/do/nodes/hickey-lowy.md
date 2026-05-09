---
name: hickey-lowy
kind: node
pattern: fanout-fix
---

# hickey-lowy

Structural review: hickey (complecting critique) and lowy (volatility lens), in parallel, on the concrete diff. Each finding lands as its own commit.

## Requires

- `noGit` — caller flag
- `minimal` — caller flag
- `forge` — from sync (controls whether the analysis comment is posted to a PR)
- `default_branch` — from sync (used to scope the diff)
- `task` — caller arg (passed as `task_context` to sub-agents)
- `research.plan` — from research (passed as `task_context` to sub-agents)

## Ensures

- `review_findings` — flat findings table (lens, label, rationale, disposition); may be empty
- (side effect, unless `noGit`) one commit per Fix-in-this-PR finding, all pushed
- (side effect, deferred to create-pr) findings table posted as a PR comment under `## [Hickey/Lowy](https://kolu.dev/blog/hickey-lowy/) Analysis`

## Pattern

Instances [`fanout-fix`](../patterns/fanout-fix.md) with:

```yaml
slots:
  reviewers: [hickey, lowy]
  applier: apply-review-finding    # one commit per finding
config:
  disposition_audit: ["Defer", "out of scope", "follow-up", "pre-existing", "should be its own change"]
  commit_prefix_per_lens:
    hickey: "refactor(hickey)"
    lowy: "refactor(lowy)"
  comment_under_heading: "## [Hickey/Lowy](https://kolu.dev/blog/hickey-lowy/) Analysis"
  noGit: noGit
```

## Strategies

- **If `minimal`**: skip with `status="skipped"` and `reason="--minimal"`. Move to **police** (which also skips under `--minimal`). Do not spawn either sub-agent.
- Invoke `hickey` and `lowy` as two **parallel sub-agents** via the harness's agent tool (`subagent_type: "hickey"` and `subagent_type: "lowy"`). On Claude Code this is the `Agent` tool. On opencode this is the `task` tool (with `subagent_type` parameter). On Codex this is the sub-agent spawning tool for delegated work. Invoking `/do` is explicit authorization to run these two review agents; do not wait for a second user prompt before spawning them.
- **Fallback, never skip.** If the harness cannot honor the model declared in the reviewer skill's frontmatter, run hickey and lowy as sub-agents on the available model instead. If a sub-agent invocation fails for harness/tooling reasons before producing a review, retry that reviewer once; if it still cannot produce a sub-agent review, run that review in the main model by loading the reviewer skill against the same diff. This fallback is slower and uses more main-context budget, but it is still the hickey-lowy step. Do not replace it with an informal/manual review, and do not mark the node `skipped` because a preferred model was unavailable.
- **Why post-implement, not pre-implement.** Hickey's complecting critique and Lowy's volatility lens both bite harder on a concrete diff than on a plan sketch. Reviewing a plan tends to surface generic concerns; reviewing a real diff surfaces the specific interleavings and boundary misalignments that matter. Running here also means the review covers *everything* the diff contains — including whatever the plan glossed over and whatever drifted during implementation.
- **Sub-agent prompts must be self-contained.** Sub-agents do not inherit context. Brief each one with: the full task prompt + relevant `research.plan` content (file paths, intended approach, key constraints) + the diff scope (`git diff origin/<default_branch>...HEAD` — same scope regardless of entry point, since the branch at this point holds the primary feature commit and no further work is pending). The sub-agent already knows to read its skill file; don't re-state the methodology.
- **No deferrals.** See [Invariants](../SKILL.md#invariants-workflow-wide) and the `disposition_audit` config above. The pattern flips any deferred-work-for-later finding to "Fix in this PR" before applying.
- **Apply each Fix finding as its own commit** — see the pattern's `commits_added` invariant.

<use_parallel_tool_calls>
For maximum efficiency, invoke the `hickey` and `lowy` Agent tools **in parallel** rather than sequentially. You MUST use parallel tool calls: emit both `Agent` tool_use blocks (one with `subagent_type: "hickey"`, one with `subagent_type: "lowy"`) in a single response, with no other tool calls or text in that response.
</use_parallel_tool_calls>

## Receipt

```
.../skills/do/scripts/do-results step-start hickey-lowy
# under --minimal, immediately:
.../skills/do/scripts/do-results step-end skipped "structural review skipped on trivial diff" "--minimal"
# otherwise, after pattern delegation:
.../skills/do/scripts/do-results step-end passed "<N> findings, <M> Fix commits, <K> No-op; analysis posted to PR"
```

## Verify

- Both hickey and lowy produced review output using their respective skills, either through sub-agents or the main-model fallback.
- Every finding has an action recorded — either **Fix in this PR** or **No-op** (no Defers; if a sub-agent emitted one, the disposition audit flipped it to Fix).
- Every "Fix in this PR" finding has a corresponding commit on the feature branch (`git log origin/<default_branch>..HEAD --oneline`), except under `noGit` (where fixes land in the working tree only).
- No unactioned findings; no deferred findings.

## Errors

- `subagent_persistent_failure` — both sub-agent invocations failed and the main-model fallback also failed. Halt workflow.
- `findings_unactioned` — the pattern returned with findings still marked Defer (the audit failed to flip them). Halt workflow; this is a sub-agent rule violation that needs investigation.
