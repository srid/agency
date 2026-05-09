---
name: fanout-fix
kind: pattern
---

# fanout-fix

Spawn N reviewer sub-agents in parallel, gather a flat list of findings, then apply each finding as its own discrete commit. Used by **hickey-lowy**.

## Slots

- `reviewers`: list of reviewer skills/sub-agents (e.g. `[hickey, lowy]`)
  - each requires: `diff`, `task_context`
  - each ensures: `findings` — list of `{ lens, label, rationale, disposition }`
- `applier`: applies a single finding as a discrete code change
  - requires: `finding`, `diff`
  - ensures: `applied` (bool), `files_changed` (list of paths)

## Config

| Param | Default | Meaning |
|-------|---------|---------|
| `disposition_audit` | `["Defer"]` | Forbidden dispositions that get flipped to `"Fix in this PR"` automatically. /do passes `["Defer", "out of scope", "follow-up", "pre-existing", "should be its own change"]` to catch all phrasings. |
| `commit_prefix_per_lens` | `{}` | Map from lens name → conventional-commit prefix. e.g. `{ hickey: "refactor(hickey)", lowy: "refactor(lowy)" }`. |
| `comment_under_heading` | `null` | Optional markdown heading. When set and `forge == github`, post a flat findings table + per-lens rationale to the PR under this heading. |
| `noGit` | `false` | When `true`, apply each finding to the working tree but skip fmt/commit/push entirely. |

## Requires

- `diff`: scope to review (typically `git diff origin/HEAD...HEAD`)
- `task_context`: the original task prompt + research findings (sub-agents do not inherit the calling agent's context)

## Ensures

- `findings_table`: flat list of all findings with their final dispositions (after audit)
- `commits_added`: count of new commits on the feature branch (zero under `noGit`)
- `comment_url`: PR comment URL when `comment_under_heading` is set, `forge == github`, and findings posted

## Invariants

- **Reviewers run in parallel.** Single assistant turn with N parallel `Agent` tool_use blocks. Sequential reviewer invocations are a regression — one reviewer at a time blocks the second's start time on the first's full output.
- **No Defer disposition survives the audit.** Every finding is either `Fix in this PR` or `No-op`. If a sub-agent emitted `Defer #N` / `out of scope` / `follow-up` / `pre-existing` / `should be its own change`, the audit flips it to `Fix in this PR` unconditionally. /do is not optimizing for minimal diff — it is optimizing for the simpler artifact landing in `master`.
- **One commit per Fix finding.** Never batched. PR history reads as a sequence of structural refinements, not an opaque "review pass" commit covering 8 unrelated things. Under `noGit`, the equivalent is "one discrete edit per finding to the working tree" — the user reviews the combined delta.
- **`No-op` is narrow.** It survives without code action only when the diff already deletes the offending code, or the finding is verbatim-subsumed by another entry in the same review. Anything resembling deferred-work-for-later is a Fix, not a No-op.
- **Sub-agent prompts must be self-contained.** Sub-agents do not inherit context. The prompt includes the full task prompt, relevant research findings (file paths, intended approach, key constraints), and the diff scope (`git diff origin/HEAD...HEAD`). The sub-agent already knows to read its skill file — don't re-state the methodology.
- **Model selection lives in the reviewer skill, not in the pattern.** Both `hickey/SKILL.md` and `lowy/SKILL.md` declare `model: sonnet` in their frontmatter. Don't pass `model:` at the `Agent` tool level — the skill frontmatter is the single source of truth.

## Delegation

```prose
parallel:
  for r in reviewers:
    let r.findings = call r
      diff: diff
      task_context: task_context

let all_findings = flatten([r.findings for r in reviewers])

# disposition audit — flip forbidden dispositions to Fix in this PR
for finding in all_findings:
  if finding.disposition in disposition_audit:
    finding.disposition = "Fix in this PR"

# apply each Fix finding as its own commit
let commits_added = 0
for finding in all_findings where finding.disposition == "Fix in this PR":
  call applier
    finding: finding
    diff: diff
  if not noGit:
    call fmt files: applier.files_changed
    call commit-fix
      message: "{commit_prefix_per_lens[finding.lens]}: {finding.label}"
      body: finding.rationale
    call push
    commits_added = commits_added + 1

# post findings comment if requested
let comment_url = null
if comment_under_heading and forge == "github":
  comment_url = post_pr_comment(comment_under_heading, render_findings_table(all_findings) + render_per_lens_rationales(reviewers))

return { findings_table: all_findings, commits_added: commits_added, comment_url: comment_url }
```

## Fallback (when sub-agent invocation fails)

If a sub-agent invocation fails for harness/tooling reasons before producing a review, retry that reviewer once. If it still cannot produce a sub-agent review, run that review in the main model by loading the reviewer skill against the same diff. This fallback is slower and uses more main-context budget, but it is still the fanout-fix step. Do not replace it with an informal/manual review, and do not mark the surrounding node `skipped` because a preferred model was unavailable.

If the harness cannot honor the model declared in the reviewer skill's frontmatter, run the reviewer as a sub-agent on the available model — this is the expected path on harnesses that ignore Claude Code's `model:` skill extension (opencode, Codex, etc.).

## Coordination findings (out of scope of this PR)

Findings that genuinely require coordination outside this repo (upstream library bug, breaking dep upgrade, schema migration that must ship separately) shouldn't have surfaced as findings of this structural review in the first place; if one did, apply a local workaround or interface boundary in this PR rather than punt. Flag the upstream dependency in the PR description as a strategic note, not as a deferred finding.
