# agency

Agency[^agency] is a near-autonomous workflow for coding agents, packaged as an [APM](https://github.com/microsoft/apm) package. Two skills: **`talk`** for design and code exploration (read-only), **`do`** for shipping end-to-end (research → implement → structural review → CI → done).

> [!IMPORTANT]
> Agency has mainly been tested with Claude Code & Codex; opencode is supported but less battle-tested. YMMV with other agents.

Landing page: <https://srid.github.io/agency/>. Source under [`website/`](./website/).

## How the loop works

`talk` and `do` are separate entry points, not steps in a single flow. Pick based on whether the spec is already clear:

- **Spec is clear** → `/do <thing>` directly. Concrete change, scope obvious, you know what "done" looks like.
- **Spec isn't obvious** → `/talk` first. Discuss the approach, read code, sketch an interface, let `hickey` and `lowy` chew on the sketch. Once you both converge on a plan, hand it to `/do`.

`/do` does not include a design-exploration phase. Its "research" step is implementation-level — what files to touch, what APIs to use — not "what should we build". Pasting a thin plan (or a one-shot outline from another model) straight into `/do` produces a thin implementation; the fix isn't to make `/do` smarter, it's to do the design work in `/talk` first.

### Feedback is the bottleneck

The autonomous loop is only as good as the feedback signal it gets. If the agent can't tell whether its change actually worked, no amount of model capability papers over that gap. End-to-end tests are a prerequisite, not a nice-to-have — unit tests and type-checks alone aren't enough. What "e2e" means depends on the surface:

- **Frontend** → screenshot evidence in PRs ([example](https://github.com/juspay/kolu/pull/702#issuecomment-4315162808)). First-class evidence as a workflow step is tracked in [#106](https://github.com/srid/agency/issues/106).
- **Nix-based infra** → NixOS VM tests. Honest tradeoff: a VM isn't a live environment, mocking is often required, and reaching real fidelity for non-trivial infra takes effort — but it's still the closest thing to an executable spec the agent can drive.
- **Backend / library** → fast, deterministic e2e suites the agent can run in a tight loop. Slow or flaky suites destroy the loop; a 30-second deterministic run beats a 10-minute thorough one.

### State, within and across PRs

**Within a PR**, `/do` writes per-step lifecycle, status, and timing to `.do-results.json` at the repo root. The `do-stop-guard` Stop hook reads this so the agent can't bail mid-workflow — if a run is still `working`, stops are blocked until it reaches `done` or is explicitly marked `failed`.

**Across PRs**, there is no built-in memory, by design. Scope each PR small enough to land end-to-end in a day or two; branches that linger longer are a smell. When a piece of work genuinely doesn't fit in one PR, have `/talk` produce a GitHub issue with explicit phases, then run `/do` against each phase as its own PR — the issue is the cross-PR memory. See [juspay/kolu#514](https://github.com/juspay/kolu/issues/514) for the shape.

### Structural reviews catch what tests don't

Type-checkers, tests, and CI catch correctness; they don't catch design. An LLM-generated diff can pass every automated gate and still complect two roles into one construct, or draw a module boundary along the wrong axis of change.

`/do` closes that gap with two structural-review passes that run **post-implement on the concrete diff** as parallel sub-agents:

- **`hickey`** — accidental complexity, after Rich Hickey's [*Simple Made Easy*](https://www.infoq.com/presentations/Simple-Made-Easy/).
- **`lowy`** — volatility-based decomposition, after Juval Lowy's [*Righting Software*](https://rightingsoftware.org/) (building on [Parnas 1972](https://www.win.tue.nl/~wstomv/edu/2ip30/references/criteria_for_modularization.pdf)).

Each "Fix in this PR" finding lands as its own commit, so PR history reads as a progression from primary implementation through each structural refinement. The full findings ledger is posted as a PR comment. Both default to Sonnet to keep review cheap enough to run on every task; pass **`--review-model=opus`** when the diff warrants a deeper pass. Both are also auto-invoked from `/talk` against design sketches, so the same lenses shape the spec before you ship it.

Read [**Hickey/Lowy on kolu.dev**](https://kolu.dev/blog/hickey-lowy/) for the full framing — what each lens looks for and why the pair catches what tests miss. Both can be extended with project-specific patterns via `.agency/hickey.md` / `.agency/lowy.md` (see [Project config](#project-config)).

## Quickstart

Paste this into your AI agent (Claude Code, Codex, opencode) at the root of the repo you want to set up:

```
Set up this repo to use srid/agency by following the instructions at
https://github.com/srid/agency/blob/master/docs/agency-setup.md
```

The setup instructions are repository documentation, not an installed skill. The agent will:

- Run `apm` via `uvx` (no install needed; falls back to `nix shell nixpkgs#uv -c uvx` if you have Nix but not `uvx`)
- Create or extend `apm.yml` and run `apm install` (plus `apm compile -t codex,opencode` when those hosts are declared, since they need a project-root `AGENTS.md`)
- Migrate any pre-existing `AGENTS.md` / `CLAUDE.md` content into `.apm/instructions/` so `apm compile` doesn't overwrite hand-written instructions ([#132](https://github.com/srid/agency/issues/132))
- Draft `.agency/do.md` from your project's existing scripts

Review the staged changes before committing. Pasting the same prompt again later acts as an **update** — it detects the existing install, refreshes `srid/agency` to the latest commit on its pinned ref (via `apm deps update srid/agency`), and regenerates the host folders.

## What's included

### Primary skills

- **`do`** — Full pipeline: research → implement → structural review (`hickey`, `lowy`) → quality gate (`code-police`) → CI → evidence (opt-in) → ship. Skip specific steps by mentioning them in the prompt, or pass **`--minimal`** to skip docs / structural review / police / evidence wholesale on trivially-scoped diffs (one-line fixes, typos, config tweaks).
- **`talk`** — Conversation-and-research mode. Discuss ideas, explore approaches, read code, inspect upstream sources in temporary scratch space when needed — no repo changes allowed. Auto-runs `hickey` + `lowy` on design sketches.
- **`ralph`** — Iterative measurement-driven improvement loop. Measure, profile, mutate, re-measure, commit. Works for performance, bundle size, complexity — anything quantifiable.

### Supporting skills

- **`hickey`** — Structural simplicity evaluation, shipped as a sub-agent (`@agent-hickey`) so it can run in parallel with `lowy`.
- **`lowy`** — Volatility-based decomposition review, shipped as a sub-agent (`@agent-lowy`).
- **`code-police`** — Three-pass quality gate: rule checklist, fact-check for logic errors, and an elegance pass (delegates to Claude Code's `/simplify` when available, otherwise runs an iterative refinement loop).
- **`fact-check`** — Standalone correctness audit: silent error swallowing, unjustified fallbacks, wishful thinking, logic errors. Prosecutor posture, no self-dismissals.
- **`elegance`** — Iterative elegance pass: understand, research, apply, verify. 3 iterations by default, each building on the last.
- **`forge-pr`** — PR titles and descriptions devs actually want to read. Narrative paragraphs for the why; lists/tables/diagrams when the content is genuinely structured. GitHub today; Bitbucket support tracked in [#10](https://github.com/srid/agency/issues/10).

### Hooks & instructions

- **`do-stop-guard`** — Reads `.do-results.json` to keep the agent from stopping mid-`do` workflow.
- **`apm-sources`** — Tells agents that `.claude/` is generated — edit `.apm/` sources instead.

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

## Resources

- [Video walkthrough: adding a /code-police rule](https://youtu.be/IFp0bb2D0ZE?si=1ISdAYeFw5LTaMW1&t=426)

[^agency]: _"as the term ‘pure intent’ refers to an intimate connection betwixt the near-purity of the sincerity of naiveté and the pristine-purity of that actual innocence which is inherent to living life as a flesh-and-blood body only (i.e., sans identity in toto/ the entire affective faculty) then the benedictive/ liberative impetus, or **agency** as such, *stems from and/or flows from that which is totally other than ‘me’/ completely outside of ‘me’* (this factor is very important as *it is vital that such impetus, such **agency**, be not of ‘me’ or ‘my’ doings*) and literally invisible to ‘me’ … namely: that flesh-and-blood body only being thus apperceptively conscious (i.e., apperceptively sentient)."_ — [Pure Intent](https://actualfreedom.com.au/library/topics/pureintent.htm)
