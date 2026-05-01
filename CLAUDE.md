# Notes for coding agents

## Keep `README.md` and the landing page in sync

When your changes affect anything user-facing — the list of commands, skills, hooks, instructions, install steps, the workflow story, or the `.apm/` layout shown as the example — update **both** of:

- [`README.md`](./README.md) — the canonical source.
- [`website/src/pages/index.astro`](./website/src/pages/index.astro) — the landing page (hero, the loop, feedback, state, structural reviews, in-the-wild).

Drift between what ships, what the README describes, and what the landing page promises is a bug.

Not every change needs either edit. Internal refactors, skill prompt tweaks that don't alter the skill's user-facing purpose, and test/tooling updates don't. When in doubt, re-read the affected README section and the matching site section and ask: would a new user following each still get the same picture?
