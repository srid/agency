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

Read `.agency/do.md` and look for a `## Documentation` section listing which docs to keep in sync (e.g., README.md). Compare those files against changes in this PR.

If no documentation files are documented, skip this step with a note.

**Verify**: Docs match current code.
**If outdated** (max 3 attempts): Fix the outdated sections and re-verify.

## Delegation

```prose
let attempts_real = 0

loop:
  read .agency/do.md for "## Documentation"
  if no docs listed:
    return { verdict: "no-command-configured" }

  compare listed docs against changes in this PR
  if docs match:
    return { verdict: "pass" }

  attempts_real += 1
  if attempts_real > 3:
    return { verdict: "failed-after-budget" }

  update outdated sections
  continue  # re-verify
```
