---
name: docs
kind: node
pattern: check-loop
---

# docs

Keep declared documentation in sync with code changes.

## Requires

- `minimal` — caller flag

## Ensures

- `verdict` — `pass` | `failed-after-budget` | `no-command-configured`
- (side effect) docs files updated if they were stale

## Pattern

Instances [`check-loop`](../patterns/check-loop.md) with:

```yaml
slots:
  runner: docs-staleness            # reads .agency/do.md ## Documentation, compares listed files vs current diff
  fixer: docs-update                 # updates the stale section(s)
config:
  max_attempts: 3
  flaky_classification: false
  loop_artifacts: none               # docs fixes go to the working tree; they're commited later (or in a follow-up commit during hickey-lowy/police if a finding requires it)
```

## Strategies

- **If `minimal`**: skip with `status="skipped"` and `reason="--minimal"`. Move to **fmt**.
- Read `.agency/do.md` and look for a `## Documentation` section listing which docs to keep in sync (e.g., `README.md`, `website/src/pages/index.astro`). Compare those files against changes in this PR.
- If no documentation files are documented, the runner returns `no-command-configured`; record as `skipped` with reason `"no documentation declared in .agency/do.md"`.

## Receipt

```
.../skills/do/scripts/do-results step-start docs
# ... pattern delegation, or immediate skip under --minimal ...
.../skills/do/scripts/do-results step-end {passed|skipped|failed} "<verification>" ["<reason>"]
```

## Verify

Docs match current code, or no docs declared, or `--minimal` skip.

## Errors

- `failed-after-budget` (3 attempts) — halt workflow. The fixer couldn't bring docs into sync within the budget; this is unusual and warrants stopping.
