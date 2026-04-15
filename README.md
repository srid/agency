# agency

Agency[^agency] is a near-autonomous workflow for coding agents, packaged as an [APM](https://github.com/microsoft/apm) package.

## What's included

### Commands

`/talk` and `/do` are typically what you need mostly.

- **`/do`** — Full autonomous pipeline: research → hickey → branch → implement → CI → ship. Hands-off from start to PR.
- **`/talk`** — Conversation-only mode. Discuss ideas, explore approaches, read code — no file changes allowed.
- **`/ralph`** — Iterative measurement-driven improvement loop. Measure, profile, mutate, re-measure, commit. Works for performance, bundle size, complexity — anything quantifiable.

### Skills

- **`hickey`** — Structural simplicity evaluation using [Rich Hickey's "Simple Made Easy"](https://www.infoq.com/presentations/Simple-Made-Easy/) framework. Catches accidental complexity that tests can't.
- **`lowy`** — Volatility-based decomposition review using [Juval Lowy's framework](https://www.informit.com/articles/article.aspx?p=2995357&seqNum=2) (from [*Righting Software*](https://rightingsoftware.org/), building on [Parnas 1972](https://www.win.tue.nl/~wstomv/edu/2ip30/references/criteria_for_modularization.pdf)). Checks that module boundaries encapsulate axes of change, not just functionality.
- **`code-police`** — Three-pass quality gate: rule checklist, fact-check for logic errors, and elegance review with iterative refinement.
- **`fact-check`** — Standalone correctness audit: finds silent error swallowing, unjustified fallbacks, wishful thinking, and logic errors. Prosecutor posture — no self-dismissals.
- **`elegance`** — Iterative elegance pass: understand, research, apply, verify. Runs 3 iterations by default, each building on the last.
- **`ralph`** — The measurement loop engine behind `/ralph`. Profiles a quantifiable metric, finds the biggest contributor, applies a targeted mutation, and re-measures. Only commits changes that demonstrably move the needle.
- **`forge-pr`** — Writes PR titles and descriptions that devs actually want to read. Paragraphs over bullet lists, substance over boilerplate. GitHub today; Bitbucket support tracked in [#10](https://github.com/srid/agency/issues/10).

### Hooks & Instructions

- **`do-stop-guard`** — Prevents Claude from stopping mid-`/do` workflow. Reads `.do-results.json` to know if a run is active.
- **`apm-sources`** — Tells agents that `.claude/` is generated — edit `.apm/` sources instead.

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

This generates `.claude/` with agency's commands, skills, and hooks, and adds `apm_modules/` to `.gitignore`. You now have `/do` and `/talk` available in Claude Code.

For a more involved setup, see https://github.com/juspay/AI

### 2. Tell `/do` about your project

`/do` runs autonomously but needs to know your project's check, format, test, and CI commands. Without this, it skips those steps.

Create `.apm/instructions/workflow.instructions.md`:

```markdown
---
description: Workflow commands for the /do pipeline
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

The `/do` steps that read these instructions: **check**, **fmt**, **test**, **ci**, and **docs**. Each step looks for its heading in your project instructions and runs whatever command you specified. If a step finds nothing documented, it skips with a note.

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

### Putting it together

Your project's `.apm/` directory ends up looking something like:

```
.apm/
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
