# agency

Near-autonomous workflow for coding agents, packaged as an [APM](https://github.com/microsoft/apm) package.

## What's included

| Primitive | Name | Description |
|-----------|------|-------------|
| Prompt | `/execute` | Full autonomous pipeline: research → hickey → branch → implement → CI → ship |
| Prompt | `/probe` | Talk-only mode — discuss ideas without touching files |
| Skill | `hickey` | Structural simplicity evaluation (Rich Hickey's "Simple Made Easy") |
| Skill | `code-police` | Three-pass quality gate: rule checklist, fact-check, elegance |
| Skill | `github-pr` | Non-boring PR titles and descriptions |
| Hook | `execute-stop-guard` | Prevents Claude from stopping mid-workflow |
| Instruction | `apm-sources` | Redirects edits from generated `.claude/` to `.apm/` sources |

## Usage

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
