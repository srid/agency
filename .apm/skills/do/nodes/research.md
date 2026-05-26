---
name: research
description: Research the task thoroughly before writing code.
---

# Research

## Requires

- Task prompt or issue URL
- `forge` from sync

## Ensures

- Research map: file paths, intended approach, key constraints
- Plan (if `--review`)

## Strategies

- If given a GitHub issue URL **and** `forge == github`, fetch with `gh issue view`. On non-GitHub forges, treat any issue-like URL as opaque context — use the prompt text as-is and do not attempt to fetch. (Bitbucket issue/Jira fetching is tracked in #10.)
- **Never assume** how something works. Read the code. Check the config.
- If the prompt involves external tools/libraries, prefer `git clone` to a scratch dir (e.g. `/tmp/<name>`) at the version the project actually uses, then read the source on disk with `Read`/`Grep`/`Glob`. Fall back to `WebSearch`/`WebFetch` only when the source genuinely isn't a clonable repo (vendor docs, blog posts, RFCs).

**Delegation rule — keep the main context lean.** Before your third `Read` in this step, stop and delegate the rest via `Agent(subagent_type=Explore)`. Main-context reads are reserved for:

  (a) specific files the user named in the prompt,
  (b) verifying a specific file:line an Explore subagent cited — and only with `offset`/`limit`, never full-file.

Anything that smells like "map the codebase", "find all callers", "understand how X works across the repo" — delegate. The Explore subagent returns a file:line map; keep that map and reference it in later steps instead of re-reading. Use `Grep`/`Glob` before `Read`: if the question can be answered by searching, don't open the file.

**Verify**: Can articulate what needs to change, where, and why, with file:line citations drawn from the research map (not re-read in main context).
