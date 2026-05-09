---
name: fmt
kind: node
---

# fmt

Run the project's format command on changed files. One-shot — no retry pattern.

## Requires

- (none)

## Ensures

- (side effect) changed files are formatted per project conventions

## Strategies

- Read `.agency/do.md` and look for a `## Format command` section. Run it.
- If no format command is documented, skip with `status="skipped"` and `reason="no format command configured"`.
- One-shot. If the format command fails, that's a real failure (the project's formatter is broken or the code is malformed in a way the formatter can't handle); halt and surface the failure rather than retry.
- This node is also called **inside** the `commit-per-fix` arm of `check-loop` (used by police, test, ci) and `fanout-fix` (used by hickey-lowy) — those callers invoke fmt against just the files they changed. Same command, narrower scope.

## Receipt

```
.../skills/do/scripts/do-results step-start fmt
# ... run the command, or immediate skip ...
.../skills/do/scripts/do-results step-end {passed|skipped|failed} "<verification>" ["<reason>"]
```

## Verify

Format command ran without error, or no command configured.

## Errors

- `format_failed` — halt workflow with `do-results set status failed`. The formatter failed; the code is not in a shippable state.
