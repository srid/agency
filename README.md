# agency

Agency[^agency] is a near-autonomous workflow for coding agents, packaged as an [APM](https://github.com/microsoft/apm) package.

## What's included

### Skills

`talk` and `do` are typically what you need mostly.

#### Primary skills

- **`do`** — Full pipeline: research → implement → structural review (hickey, lowy) → quality gate (code-police) → CI → ship. Structural review runs **post-implement on the concrete diff**, and each "Fix in this PR" finding lands as its own commit — so the PR history reads as a progression from primary implementation to each refinement. Pauses once after research to confirm which steps are relevant for the task; pass `--skip-setup` for fully hands-off.
- **`talk`** — Conversation-and-research mode. Discuss ideas, explore approaches, read code, inspect upstream sources in temporary scratch space when needed — no repo changes allowed.
- **`ralph`** — Iterative measurement-driven improvement loop. Measure, profile, mutate, re-measure, commit. Works for performance, bundle size, complexity — anything quantifiable.

#### Supporting skills

- **`hickey`** — Structural simplicity evaluation using [Rich Hickey's "Simple Made Easy"](https://www.infoq.com/presentations/Simple-Made-Easy/) framework. Catches accidental complexity that tests can't. Ships as a sub-agent (`@agent-hickey`) so `do` can run it in parallel with `lowy` post-implement without serializing on the main conversation loop. Not auto-invoked from `talk` — complecting critique needs a concrete diff to bite.
- **`lowy`** — Volatility-based decomposition review using [Juval Lowy's framework](https://www.informit.com/articles/article.aspx?p=2995357&seqNum=2) (from [*Righting Software*](https://rightingsoftware.org/), building on [Parnas 1972](https://www.win.tue.nl/~wstomv/edu/2ip30/references/criteria_for_modularization.pdf)). Checks that module boundaries encapsulate axes of change, not just functionality. Ships as a sub-agent (`@agent-lowy`). Auto-invoked from both `do` (post-implement, alongside hickey) and `talk` (where the design-level volatility lens is still useful on a sketch).
- **`code-police`** — Three-pass quality gate: rule checklist, fact-check for logic errors, and an elegance pass (delegates to Claude Code's `/simplify` when available, otherwise runs an iterative refinement loop).
- **`fact-check`** — Standalone correctness audit: finds silent error swallowing, unjustified fallbacks, wishful thinking, and logic errors. Prosecutor posture — no self-dismissals.
- **`elegance`** — Iterative elegance pass: understand, research, apply, verify. Runs 3 iterations by default, each building on the last.
- **`forge-pr`** — Writes PR titles and descriptions that devs actually want to read. Paragraphs over bullet lists, substance over boilerplate. GitHub today; Bitbucket support tracked in [#10](https://github.com/srid/agency/issues/10).

### Hooks & Instructions

- **`do-stop-guard`** — Prevents Claude from stopping mid-`do` workflow. Reads `.do-results.json` to know if a run is active.
- **`apm-sources`** — Tells agents that `.claude/` is generated — edit `.apm/` sources instead.

## Structural reviews

Type-checkers, tests, and CI catch correctness. They don't catch design. An LLM-generated diff can pass every automated gate and still complect two roles into one construct, or draw a module boundary along the wrong axis of change.

`do` closes that gap with two structural-review passes that run **post-implement on the concrete diff** as parallel sub-agents. Each "Fix in this PR" finding is applied and committed individually — PR history reads as the progression from the primary implementation through each structural refinement — and the full findings ledger is posted as a PR comment:

- **`hickey`** — accidental complexity, after Rich Hickey's *Simple Made Easy*.
- **`lowy`** — volatility-based decomposition, after Juval Lowy's *Righting Software*.

Both default to Sonnet to keep the review cheap enough to run on every task. Pass **`--review-model=opus`** to `do` (or `talk`, which only runs Lowy) when the diff warrants a deeper pass — large or architecturally significant changes, cross-module refactors, anything you want extra-careful eyes on. `haiku` is also accepted for cheap scans.

Read [**Hickey/Lowy on kolu.dev**](https://kolu.dev/blog/hickey-lowy/) for the full framing — what each lens looks for, why the pair catches what tests miss, and how to extend them with project-specific vectors (see *Add project-specific structural review vectors* below).

## Usage

### 0. Create `apm.yml`

```
name: yourproject
version: 1.0.0
type: hybrid

dependencies:
  apm:
    - srid/agency#master
    - juspay/skills/skills/nix-justfile
```

### 1. Install

Or via [uvx](https://docs.astral.sh/uv/guides/tools/):

```bash
# Use `nix shell nixpkgs#uv -c uvx` if you don't have uvx
uvx --from apm-cli apm install -t claude
```

This generates `.claude/` with agency's skills, agents, and hooks, and adds `apm_modules/` to `.gitignore`. You now have the `do` and `talk` skills available in supported hosts.

For a more involved setup, see https://github.com/juspay/AI

### 2. Tell `do` about your project

`do` runs autonomously but needs to know your project's check, format, test, and CI commands. Without this, it skips those steps.

Create `.apm/instructions/workflow.instructions.md`:

```markdown
---
description: Workflow commands for the do pipeline
applyTo: "**"
---

## Check command
`npm run typecheck` — fast static-correctness gate (e.g. `tsc --noEmit`, `cargo check`, `cabal build`, `mypy`).

## Format command
`npm run lint:fix`

## Test command
`npm test` — run only tests relevant to changed code paths.

## CI command
`npm run ci` — verify by checking exit code 0.

## Documentation
Keep `README.md` in sync with user-facing changes.
```

Run `apm install` again to regenerate `.claude/`.

The `do` steps that read these instructions: **check**, **fmt**, **test**, **ci**, and **docs**. Each step looks for its heading in your project instructions and runs whatever command you specified. If a step finds nothing documented, it skips with a note.

### 3. Add project-specific quality rules (optional)

`code-police` ships with generic rules. Layer on your own by creating `.apm/instructions/code-police-rules.instructions.md`:

```markdown
---
description: Project-specific code-police rules
---

## Code Police Rules

### no-raw-sql
Use the query builder for all database access. No raw SQL strings outside migrations.

### always-use-server-functions
Data fetching must go through server functions, never direct API calls from components.
```

These get checked alongside the built-in rules during the police pass.

### 4. Add project-specific structural review vectors (optional)

`hickey` and `lowy` ship with generic catalogs. Extend them with project-specific vectors by dropping an `.apm/instructions/*.instructions.md` file with an `applyTo:` glob. APM generates a `paths:`-scoped rule under `.claude/rules/`, and Claude Code auto-surfaces it as a system-reminder to the hickey/lowy subagent the moment it reads a matching file — no `do` plumbing, no extra wiring.

**Hickey (complecting patterns).** Extends the Layer 4 catalog. File name is conventionally `hickey-catalog.instructions.md`. Schema:

```markdown
---
description: Project-specific complecting patterns
applyTo: "packages/client/src/**"
---

## Additional Complecting Patterns

| Construct | What it complects | Simpler alternative |
|-----------|-------------------|---------------------|
| `createEffect` that writes to signals (effect-as-state-machine) | When + what + control flow | `createMemo` for derived values; `on()` for explicit dependency tracking |
```

**Lowy (areas of volatility).** Consumed in the "Name the Volatility" step. File name is conventionally `lowy-volatilities.instructions.md`. Schema is loosely based on Lowy's TradeMe enumeration in *Righting Software* Ch. 5:

```markdown
---
description: Project-declared areas of volatility
applyTo: "packages/client/src/**"
---

## Areas of Volatility

| Area of volatility | What changes | Why volatile (likelihood × effect) | Expected encapsulation |
|--------------------|--------------|------------------------------------|------------------------|
| Server-pushed state delivery | Transport for live server state (polling RPC → WebSocket → oRPC async iterables → future SSE/RSC) | Likelihood: already migrated twice in this codebase; Effect: every consumer of live state would need rewriting if the transport leaked into components | Behind the `createSubscription` seam — consumers see a SolidJS-signal-shaped API regardless of transport |
```

Each row must pass Lowy's variable-vs-volatile bar — *state what the volatility is, why it is volatile, and what risk it poses in likelihood and effect*. Rows are not findings; they are surviving candidates from the project's own screen. The subagent re-applies the bar, challenges rows that fail it, and audits whether boundaries under review actually encapsulate the surviving volatilities (adapting Lowy's Manager/Engine/Resource targeting to whatever encapsulation vocabulary fits the stack — `createSubscription` seams, hook modules, etc.).

See [Kolu's `agents/.apm/instructions/hickey-catalog.instructions.md`](https://github.com/juspay/kolu/blob/master/agents/.apm/instructions/hickey-catalog.instructions.md) for a worked hickey-side example.

### Putting it together

Your project's `.apm/` directory ends up looking something like:

```
.apm/
  agents/                           # Claude Code sub-agents (thin wrappers over skills)
    hickey.md
    lowy.md
  instructions/
    workflow.instructions.md        # fmt, test, ci, docs commands
    code-police-rules.instructions.md  # project-specific quality rules
    architecture.instructions.md    # optional: architectural constraints
```

See [Kolu's `agents/.apm/`](https://github.com/juspay/kolu/tree/master/agents/.apm) for a real-world example with workflow config, architecture docs, and custom code-police rules layered on top of agency.

## Examples

- **[Kolu](https://github.com/juspay/kolu)** — Terminal multiplexer that uses agency for its autonomous development workflow. See its [`apm.yml`](https://github.com/juspay/kolu/blob/master/apm.yml) and [`agents/.apm/`](https://github.com/juspay/kolu/tree/master/agents/.apm) for how project-specific instructions layer on top of agency's generic workflow.

## Development

```bash
just apm       # install/regenerate
just apm-audit # security audit
just apm-sync  # verify nothing drifted
```

[^agency]: _"as the term ‘pure intent’ refers to an intimate connection betwixt the near-purity of the sincerity of naiveté and the pristine-purity of that actual innocence which is inherent to living life as a flesh-and-blood body only (i.e., sans identity in toto/ the entire affective faculty) then the benedictive/ liberative impetus, or **agency** as such, *stems from and/or flows from that which is totally other than ‘me’/ completely outside of ‘me’* (this factor is very important as *it is vital that such impetus, such **agency**, be not of ‘me’ or ‘my’ doings*) and literally invisible to ‘me’ … namely: that flesh-and-blood body only being thus apperceptively conscious (i.e., apperceptively sentient)."_ — [Pure Intent](https://actualfreedom.com.au/library/topics/pureintent.htm)
