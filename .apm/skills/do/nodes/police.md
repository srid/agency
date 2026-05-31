---
name: police
description: Three-pass quality gate.
---

# Police

## Requires

- `--minimal` flag
- `--no-git` flag
- Diff `git diff origin/HEAD...HEAD`

## Ensures

- All 3 passes clean
- Violation fixes committed individually (or working-tree fixes under --no-git)

## Pattern

Instances [check-loop](../patterns/check-loop.md) with:
- `runner`: invoke `/code-police` skill
- `fixer`: apply one violation fix at a time
- Config: `max_attempts: 3`, `loop_artifacts: commit-per-fix`

## Strategies

Use `git diff origin/HEAD...HEAD --name-only` to check if the PR contains code changes. If all changed files are documentation-only (e.g., `.md`, `.txt`, `README`, docs/) — skip this step with a note.

Otherwise, invoke the `/code-police` skill via the Skill tool. It runs three passes: rule checklist, fact-check, and elegance.

When `/code-police` asks about scope: **changes in the current branch/PR only**.

**Commit each violation fix individually.** The same rule as **hickey + lowy**: one commit per violation, not a lump.

For each violation reported by `/code-police` (across all three passes), in turn:

1. Apply the fix for that one violation — scope the edit tightly.
2. Run the project's format command on changed files, if configured.
3. `git add <changed files>` — stage only this fix.
4. Commit with a conventional prefix:
   - Rules pass: `fix(police): <rule-id> — <short description>`
   - Fact-check pass: `fix(police): fact-check — <short description>`
   - Elegance pass: `refactor(police): elegance — <short description>`
5. `git push`.

**Under `--no-git`**: Skip commit/push. Apply fixes to working tree.

**Verify**: All 3 passes clean ("All clear").
**If violations found** (max 3 attempts): Fix the violations and re-invoke `/code-police`.

## Delegation

```prose
let attempts_real = 0

loop:
  if diff is docs-only:
    return { verdict: "no-command-configured" }

  invoke /code-police skill (3 passes: rule checklist, fact-check, elegance)
  if "All clear":
    return { verdict: "pass" }

  attempts_real += 1
  if attempts_real > 3:
    return { verdict: "failed-after-budget" }

  for each violation reported:
    apply fix for that one violation
    run fmt on changed files
    git add changed files
    commit with conventional prefix (fix/refactor(police): ...)
    git push

  continue  # re-invoke /code-police
```
