# agency

Agency[^agency] is a near-autonomous workflow for coding agents, packaged as an [APM](https://github.com/microsoft/apm) package.

> [!IMPORTANT]
> Agency has mainly been tested with Claude Code & Codex; opencode is supported but less battle-tested. YMMV with other agents.

Drop two skills into your coding agent: **`do`** runs end-to-end (research → implement → structural review → CI → ship), and **`talk`** is read-only for design discussion and code exploration.

## Quickstart

Paste this into your AI agent (Claude Code, Codex, opencode) at the root of the repo you want to set up:

```
Set up this repo to use srid/agency by following the instructions at
https://github.com/srid/agency/blob/master/docs/agency-setup.md
```

The setup instructions are repository documentation, not an installed skill.

The agent will:

- Run `apm` via `uvx` (no install needed; falls back to `nix shell nixpkgs#uv -c uvx` if you have Nix but not `uvx`)
- Create or extend `apm.yml` and run `apm install` (plus `apm compile -t codex,opencode` when those hosts are declared, since they need a project-root `AGENTS.md`)
- Draft `.agency/do.md` from your project's existing scripts

Review the staged changes before committing.

Pasting the same prompt again later acts as an **update** — it detects the existing install, refreshes `srid/agency` to the latest commit on its pinned ref (via `apm deps update srid/agency`), and regenerates the host folders.

## What's included

### Skills

`talk` and `do` are typically what you need mostly.

#### Primary skills

- **`do`** — Full pipeline: research → implement → structural review (hickey, lowy) → quality gate (code-police) → CI → evidence (opt-in) → ship. Structural review runs **post-implement on the concrete diff**, and each "Fix in this PR" finding lands as its own commit — so the PR history reads as a progression from primary implementation to each refinement. Fully autonomous; skip specific steps by mentioning them in the prompt, or pass **`--minimal`** to skip docs/hickey+lowy/police/evidence wholesale on trivially-scoped diffs (one-line fixes, typos, config tweaks).
- **`talk`** — Conversation-and-research mode. Discuss ideas, explore approaches, read code, inspect upstream sources in temporary scratch space when needed — no repo changes allowed.
- **`ralph`** — Iterative measurement-driven improvement loop. Measure, profile, mutate, re-measure, commit. Works for performance, bundle size, complexity — anything quantifiable.

#### Supporting skills

- **`hickey`** — Structural simplicity evaluation using [Rich Hickey's "Simple Made Easy"](https://www.infoq.com/presentations/Simple-Made-Easy/) framework. Catches accidental complexity that tests can't. Declares `context: fork` so `do` can run it in parallel with `lowy` post-implement via two `Skill` calls without serializing on the main conversation loop. Not auto-invoked from `talk` — complecting critique needs a concrete diff to bite.
- **`lowy`** — Volatility-based decomposition review using [Juval Lowy's framework](https://www.informit.com/articles/article.aspx?p=2995357&seqNum=2) (from [*Righting Software*](https://rightingsoftware.org/), building on [Parnas 1972](https://www.win.tue.nl/~wstomv/edu/2ip30/references/criteria_for_modularization.pdf)). Checks that module boundaries encapsulate axes of change, not just functionality. Declares `context: fork` so it runs in an isolated subagent. Auto-invoked from both `do` (post-implement, alongside hickey) and `talk` (where the design-level volatility lens is still useful on a sketch).
- **`code-police`** — Three-pass quality gate: rule checklist, fact-check for logic errors, and an elegance pass (delegates to Claude Code's `/simplify` when available, otherwise runs an iterative refinement loop).
- **`fact-check`** — Standalone correctness audit: finds silent error swallowing, unjustified fallbacks, wishful thinking, and logic errors. Prosecutor posture — no self-dismissals.
- **`elegance`** — Iterative elegance pass: understand, research, apply, verify. Runs 3 iterations by default, each building on the last.
- **`forge-pr`** — Writes PR titles and descriptions that devs actually want to read. Narrative paragraphs for the why, with lists/tables/diagrams when the content is genuinely structured. GitHub today; Bitbucket support tracked in [#10](https://github.com/srid/agency/issues/10).

### Hooks & Instructions

- **`do-stop-guard`** — Prevents Claude from stopping mid-`do` workflow. Reads `.do-results.json` to know if a run is active.
- **`apm-sources`** — Tells agents that `.claude/` is generated — edit `.apm/` sources instead.

## Structural reviews

Type-checkers, tests, and CI catch correctness. They don't catch design. An LLM-generated diff can pass every automated gate and still complect two roles into one construct, or draw a module boundary along the wrong axis of change.

`do` closes that gap with two structural-review passes that run **post-implement on the concrete diff** as parallel sub-agents. Each "Fix in this PR" finding is applied and committed individually — PR history reads as the progression from the primary implementation through each structural refinement — and the full findings ledger is posted as a PR comment:

- **`hickey`** — accidental complexity, after Rich Hickey's *Simple Made Easy*.
- **`lowy`** — volatility-based decomposition, after Juval Lowy's *Righting Software*.

Both default to Sonnet (declared as `model: sonnet` in their skill frontmatter) to keep the review cheap enough to run on every task. To run them on a different model, edit the `model:` field in the skill's frontmatter — there's no per-invocation override since the `Skill` tool doesn't accept a `model` parameter.

Read [**Hickey/Lowy on kolu.dev**](https://kolu.dev/blog/hickey-lowy/) for the full framing — what each lens looks for and why the pair catches what tests miss. Both can be extended with project-specific patterns by dropping `.agency/hickey.md` / `.agency/lowy.md` files (see [Project config](#project-config) below).

## Project config

Each agency skill reads its project-specific configuration from a single file named after itself, under a top-level `.agency/` directory:

| File | Read by | Contains |
|------|---------|----------|
| `.agency/do.md` | `/do` | `## Check command` / `## Format command` / `## Test command` / `## CI command` / `## Documentation` (required for those steps to run) and an optional `## PR evidence` section that opts into the evidence step |
| `.agency/code-police.md` | `code-police` | extra quality rules layered on top of the built-in checklist |
| `.agency/hickey.md` | `hickey` | extra complecting/fragmentation patterns extending the Layer 4 catalog |
| `.agency/lowy.md` | `lowy` | project-declared areas of volatility used by the review pass |

All four files are **plain Markdown** — no frontmatter, no `applyTo:`, no APM ceremony — and **opt-in** (the consuming skill silently skips its extension behavior when the file is missing). Each skill reads only its own file; nothing crosses, so a project can adopt skills à la carte without touching the others.

Content is free-form: inline prose, a pointer to another file (`See ./code-police-rules.md`), or a script reference all work. Example `.agency/do.md`:

```markdown
# /do config

## Check command
just check

## Format command
just fmt

## Test command
just test

## CI command
just ci

## Documentation
Keep README.md in sync with user-facing changes.

## PR evidence
For every PR that touches the UI:

1. Use the `chrome-devtools` MCP to launch `npm run dev` and navigate to the affected route.
2. Capture a screenshot of the new state and upload it via `gh api` to the repo's release-asset endpoint.
3. Embed the resulting URL inline in the PR comment under `## Evidence`.
```

Agency does not prescribe any specific tool or format — `chrome-devtools` MCP, `hyperfine`, `asciinema`, custom scripts all work.

See [Kolu's `.agency/`](https://github.com/juspay/kolu/tree/master/.agency) for a worked example.

## Examples

- **[Kolu](https://github.com/juspay/kolu)** — Terminal multiplexer that uses agency for its autonomous development workflow. See its [`apm.yml`](https://github.com/juspay/kolu/blob/master/apm.yml) and [`.apm/`](https://github.com/juspay/kolu/tree/master/.apm) for how project-specific instructions layer on top of agency's generic workflow.

## Development

```bash
just apm       # install/regenerate
just apm-audit # security audit
just apm-sync  # verify nothing drifted
```

[^agency]: _"as the term ‘pure intent’ refers to an intimate connection betwixt the near-purity of the sincerity of naiveté and the pristine-purity of that actual innocence which is inherent to living life as a flesh-and-blood body only (i.e., sans identity in toto/ the entire affective faculty) then the benedictive/ liberative impetus, or **agency** as such, *stems from and/or flows from that which is totally other than ‘me’/ completely outside of ‘me’* (this factor is very important as *it is vital that such impetus, such **agency**, be not of ‘me’ or ‘my’ doings*) and literally invisible to ‘me’ … namely: that flesh-and-blood body only being thus apperceptively conscious (i.e., apperceptively sentient)."_ — [Pure Intent](https://actualfreedom.com.au/library/topics/pureintent.htm)
