---
name: docs
description: Keep documentation in sync with code changes.
---

# Docs

## Requires

- `--minimal` flag
- Implemented code

## Ensures

- Documentation matches current code

## Pattern

Instances [check-loop](../patterns/check-loop.md) with:
- `runner`: read `.agency/do.md` for `## Documentation`, compare listed files against changes
- `fixer`: update outdated sections
- Config: `max_attempts: 3`

## Strategies

**If `--minimal`**: Skip with status `skipped` and reason `"--minimal"`. Move to the next step.

Read `.agency/do.md` and look for a `## Documentation` section listing which docs to keep in sync (e.g., README.md). Compare those files against changes in this PR.

If no documentation files are documented, skip this step with a note.

**Verify**: Docs match current code.
**If outdated** (max 3 attempts): Fix the outdated sections and re-verify.
