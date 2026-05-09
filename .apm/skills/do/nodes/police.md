---
name: police
kind: node
pattern: check-loop
---

# police

Run `/code-police` (rules → fact-check → elegance) and commit each violation fix individually.

## Requires

- `noGit` — caller flag
- `minimal` — caller flag
- `default_branch` — from sync (used to scope the diff)

## Ensures

- `verdict` — `pass` | `failed-after-budget` | `no-command-configured`
- (side effect, unless `noGit`) one commit per violation fix, pushed

## Pattern

Instances [`check-loop`](../patterns/check-loop.md) with:

```yaml
slots:
  runner: code-police              # invokes /code-police via the Skill tool, parses violations from output
  fixer: fix-violation-with-commit  # one commit per violation
config:
  max_attempts: 3
  flaky_classification: false      # police findings are deterministic
  loop_artifacts: commit-per-fix
```

## Strategies

- **If `minimal`**: skip with `status="skipped"` and `reason="--minimal"`. Move to **test**. Do not invoke `/code-police`.
- Use `git diff origin/<default_branch>...HEAD --name-only` to check if the PR contains code changes. If all changed files are documentation-only (e.g., `.md`, `.txt`, `README`, `docs/`) — skip with `status="skipped"` and `reason="docs-only diff"`.
- Otherwise, invoke the `/code-police` skill via the Skill tool. It runs three passes: rule checklist, fact-check, and elegance (which delegates to `/simplify` when available).
- When `/code-police` asks about scope: **changes in the current branch/PR only**.
- **Commit each violation fix individually.** The same rule as `hickey-lowy`: PR history is the story of the work, and a reviewer should see one commit per rule violation or elegance refinement, not a lump "police pass" commit covering eight unrelated things.

For each violation reported by `/code-police` (across all three passes), the `commit-per-fix` arm of the pattern produces a commit:

- Rules pass: `fix(police): <rule-id> — <short description>` (e.g. `fix(police): no-dead-code — remove commented-out fallback`)
- Fact-check pass: `fix(police): fact-check — <short description>` (e.g. `fix(police): fact-check — propagate error from loader`)
- Elegance pass: `refactor(police): elegance — <short description>`

For the elegance pass specifically: `/simplify` applies fixes in batches across three lenses (reuse, quality, efficiency). Commit each distinct refactor as a separate commit — do not roll them into one "elegance" commit. If a lens produces multiple independent changes (two reuse-via-helper refactors in different files, say), those are separate commits too.

**Under `noGit`**: pass-through to the pattern, which will skip the commit/push arm. Apply fixes to the working tree and continue. The user reviews the combined delta.

## Receipt

```
.../skills/do/scripts/do-results step-start police
# under --minimal or docs-only, immediately:
.../skills/do/scripts/do-results step-end skipped "<reason>" "<reason-tag>"
# otherwise, after pattern delegation:
.../skills/do/scripts/do-results step-end passed "<N> violations addressed across <M> passes; all clear"
```

## Verify

All 3 passes clean ("All clear"). Under `noGit`, the tree reflects the fixes; otherwise `git log origin/<default_branch>..HEAD --oneline` shows one commit per violation addressed.

## Errors

- `failed-after-budget` (3 attempts) — halt workflow. /code-police could not be brought to clean within the budget; further attempts are not productive.
