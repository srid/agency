---
name: nodes/research
depends_on: [nodes/sync]
next: [nodes/plan-approval]
provides: [research_map]
output_schema:
  status: "passed | failed"
  started_at: string
  completed_at: string
  provides:
    research_map: "string (file:line citations of what must change)"
  verification: string
---

# Research

Research the task thoroughly before writing code.

- If given a GitHub issue URL **and** `forge == github`, fetch with `gh issue view`. On non-GitHub forges, treat any issue-like URL as opaque context — use the prompt text as-is.
- **Never assume** how something works. Read the code. Check the config.
- If the prompt involves external tools/libraries, use WebSearch/WebFetch.

**Delegation rule — keep main context lean.** Before your third `Read`, delegate further exploration via `Agent(subagent_type=Explore)`. Main-context reads reserved for:

(a) specific files the user named in the prompt,
(b) `.apm/instructions/**` and files referenced from them,
(c) targeted verification of a `file:line` cited by an Explore subagent — `offset`/`limit` only, never full-file.

Anything that smells like "map the codebase", "find all callers", "understand how X works across the repo" — delegate. Use `Grep`/`Glob` before `Read` when a search answers the question.

Record the research map (file:line citations) as your `provides.research_map` in the receipt, so downstream nodes reference the map instead of re-reading.

After this, continue to [[plan-approval]] — it's a pass-through unless `--review` is set.
