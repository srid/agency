---
description: Redirects agents to edit .apm/ sources instead of generated .claude/ files
applyTo: ".claude/**"
---

## Generated Files — Do Not Edit Directly

> **This rule only applies if an `.apm/` directory exists in the project root.** If there is no `.apm/` directory, `.claude/` files are vendored directly and can be edited in place.

Everything under `.claude/` (except `launch.json`) is **generated** from `.apm/` sources by APM. Direct edits will be overwritten on the next `apm install` run.

**To modify agent configuration, edit the source files in `.apm/`:**

| `.claude/` output | Source in `.apm/`                  |
| ----------------- | ---------------------------------- |
| `rules/*.md`      | `instructions/*.instructions.md`   |
| `commands/*.md`   | `prompts/*.prompt.md`              |
| `skills/*/`       | `skills/*/`                        |
| `hooks/`          | `hooks/`                           |
| `settings.json`   | Hook definitions in `hooks/*.json` |

After editing, run `apm install` to regenerate `.claude/` from sources.
