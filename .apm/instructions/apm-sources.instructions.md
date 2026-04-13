---
description: Redirects agents to edit .apm/ sources instead of generated agent config files
applyTo: ".claude/**,.opencode/**"
---

## Generated Files — Do Not Edit Directly

> **This rule only applies if an `.apm/` directory exists somewhere in the project** (e.g., `.apm/`, `agents/.apm/`, or any other path). If no `.apm/` directory exists anywhere, `.claude/` and `.opencode/` files are vendored directly and can be edited in place.

Everything under `.claude/` and `.opencode/` is **generated** from `.apm/` sources by APM. Direct edits will be overwritten on the next `apm install` run.

To modify agent configuration, find the nearest `.apm/` directory in the project (it may be at the root or nested under a subdirectory like `agents/.apm/`), edit the source files there, then run `apm install` to regenerate.
