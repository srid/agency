---
name: nodes/lowy
depends_on: [nodes/commit]
next: [nodes/code-police]
invokes_skill: lowy
requires_tool: Agent
skip_when:
  - flag: no-git
    reason: "--no-git (lowy applies fixes as commits; under --no-git, apply to working tree and skip node)"
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
  commits_added: "string[] (SHAs of refactor(lowy): commits)"
  verification: string
---

# Node: Lowy volatility review

Wraps the top-level [[lowy]] skill with graph edges. Invoke `Agent(subagent_type="lowy")` in **parallel** with [[hickey]] — same scope (`git diff origin/HEAD...HEAD`), same model-override rules, volatility lens instead of complecting lens.

See [[hickey]] for the full mechanics (model override, commit-per-finding rule, sub-agent briefing). The only differences:

- Commit prefix: `refactor(lowy): <short finding label>`.
- The critique lens is Lowy's volatility framework, not Hickey's simple-made-easy.

Record findings + dispositions + commit SHAs the same way hickey does. After this, continue to [[code-police]].
