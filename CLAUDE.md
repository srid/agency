# Notes for coding agents

## Keep `README.md` in sync

When your changes affect anything user-facing — the list of commands, skills, hooks, instructions, install steps, or the `.apm/` layout shown as the example — update [`README.md`](./README.md) in the same change. Drift between what ships and what the README describes is a bug.

Not every change needs a README edit. Internal refactors, skill prompt tweaks that don't alter the skill's user-facing purpose, and test/tooling updates don't. When in doubt, re-read the affected README section and ask: would a new user following this still get the right picture?
