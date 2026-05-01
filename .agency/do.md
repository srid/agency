# /do config

## Check command
just apm-sync

## Documentation

When changes affect user-facing concepts (skills, hooks, workflow story, install steps, the `.apm/` example), update **both** of:

- `README.md` — the canonical source.
- `website/src/pages/index.astro` — the landing page narrative (hero, the loop, feedback, state, structural reviews, in-the-wild).

Drift between the README and the landing page is a bug. Internal-only changes (skill prompt tweaks that don't alter the user-facing purpose, refactors, test/tooling updates) don't need either edit.

When in doubt, re-read the affected README section and the matching site section side by side and ask: would a new user following each one get the same picture?
