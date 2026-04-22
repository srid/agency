---
name: nodes/hickey
depends_on: [nodes/commit]
next: [nodes/code-police]
invokes_skill: hickey
requires_tool: Agent
skip_when:
  - flag: no-git
    reason: "--no-git (hickey applies fixes as commits; under --no-git, apply to working tree and skip node)"
    counts_as_success: true
output_schema:
  status: "passed | failed | skipped"
  reason: "string (if skipped)"
  started_at: string
  completed_at: string
  findings:
    - label: string
      disposition: "Fixed in this PR | Deferred #<issue> | No-op"
      commit_sha: "string (if Fixed)"
  commits_added: "string[] (SHAs of refactor(hickey): commits)"
  verification: string
---

# Node: Hickey structural review

Wraps the top-level [[hickey]] skill with graph edges. Invoke `Agent(subagent_type="hickey")` with:

- The full task prompt plus anything relevant that [[research]] uncovered (file paths, intended approach, key constraints).
- Scope: the diff `git diff origin/HEAD...HEAD` — the branch at this point holds the primary feature commit.

**Why post-implement, not pre-implement.** Hickey's complecting critique bites harder on a concrete diff than on a plan sketch. Plan-stage review surfaces generic concerns; diff-stage review surfaces the specific interleavings and boundary misalignments that matter.

**Model override.** If the user passed `--review-model=<model>`, pass `model: "<model>"` in the `Agent` tool call — this overrides the `model: sonnet` in the hickey skill's frontmatter. Accept only `opus`, `sonnet`, `haiku`; reject anything else at argument-parse time.

The sub-agent already knows to read its own skill file; don't re-state methodology in the prompt.

**Apply each "Fix in this PR" finding as its own commit**:

1. Apply the fix narrowly — only the lines that address this finding.
2. Run the project's format command on changed files.
3. `git add <changed files>`; `git commit -m "refactor(hickey): <short finding label>"`. Body of the message restates the finding in one line.
4. `git push`.

Findings marked **Defer #issue** or **No-op** are surfaced in the PR comment by [[create-pr]] but not acted on here. Record all findings + dispositions + commit SHAs in the receipt under `findings`.

After this, continue to [[code-police]] (which also waits on [[lowy]]).
