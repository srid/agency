# agency

Near-autonomous workflow for coding agents, packaged as an [APM](https://github.com/microsoft/apm) package.

## What's included

### Commands

- **`/do`** — Full autonomous pipeline: research → hickey → branch → implement → CI → ship. Hands-off from start to PR.
- **`/talk`** — Conversation-only mode. Discuss ideas, explore approaches, read code — no file changes allowed.

### Skills

- **`hickey`** — Structural simplicity evaluation using Rich Hickey's "Simple Made Easy" framework. Catches accidental complexity that tests can't.
- **`code-police`** — Three-pass quality gate: rule checklist, fact-check for logic errors, and elegance review with iterative refinement.
- **`github-pr`** — Writes PR titles and descriptions that devs actually want to read. Paragraphs over bullet lists, substance over boilerplate.

### Hooks & Instructions

- **`execute-stop-guard`** — Prevents Claude from stopping mid-`/do` workflow. Reads `.execute-results.json` to know if a run is active.
- **`apm-sources`** — Tells agents that `.claude/` is generated — edit `.apm/` sources instead.

## Usage

> **WIP** — More detailed docs on setup, project configuration (workflow instructions for `/do`), and extending skills like `code-police` with project-specific rules are coming. See [APM docs](https://microsoft.github.io/apm/) for general APM usage.

Add to your project's `apm.yml`:

```yaml
dependencies:
  apm:
    - srid/agency
```

Then:

```bash
apm install
```

## Development

```bash
just apm       # install/regenerate
just apm-audit # security audit
just apm-sync  # verify nothing drifted
```
