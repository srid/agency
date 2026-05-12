---
name: research
kind: node
---

# research

Research the task thoroughly before writing code.

## Requires

- `task` — caller arg (prompt or issue URL)
- `forge` — from sync (controls whether issue URLs are fetched)
- `review` — caller flag (controls whether plan-approval runs after this node)

## Ensures

- `research.plan` — articulation of what needs to change, where, and why, with file:line citations
- `research.map` — file:line index from Explore subagent(s) (downstream nodes reference this rather than re-reading)

## Strategies

- If given a GitHub issue URL **and** `forge == github`, fetch with `gh issue view`. On non-GitHub forges, treat any issue-like URL as opaque context — use the prompt text as-is and do not attempt to fetch. (Bitbucket issue / Jira fetching is tracked in [srid/agency#10](https://github.com/srid/agency/issues/10).)
- **Never assume** how something works. Read the code. Check the config.
- If the prompt involves external tools/libraries, prefer `git clone` to a scratch dir (e.g. `/tmp/<name>`) at the version the project actually uses, then read the source on disk with `Read`/`Grep`/`Glob`. Fall back to `WebSearch`/`WebFetch` only when the source genuinely isn't a clonable repo (vendor docs, blog posts, RFCs).

### Delegation rule — keep the main context lean

Before your third `Read` in this node, stop and delegate the rest via `Agent(subagent_type=Explore)`. Main-context reads are reserved for:

(a) specific files the user named in the prompt,
(b) verifying a specific file:line an Explore subagent cited — and only with `offset`/`limit`, never full-file.

Anything that smells like "map the codebase", "find all callers", "understand how X works across the repo" — delegate. The Explore subagent returns a file:line map; keep that map (`research.map`) and reference it in later nodes instead of re-reading. Use `Grep`/`Glob` before `Read`: if the question can be answered by searching, don't open the file.

## Receipt

```
.../skills/do/scripts/do-results step-start research
# ... do the work ...
.../skills/do/scripts/do-results step-end passed "articulated approach with file:line citations"
```

## Verify

Can articulate what needs to change, where, and why, with file:line citations drawn from `research.map` (not re-read in main context).

## Then

If `review`, the next node is [`plan-approval`](plan-approval.md). Otherwise, the next node is [`branch`](branch.md) (or [`implement`](implement.md) under `--no-git`).
