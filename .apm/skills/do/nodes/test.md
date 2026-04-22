---
name: nodes/test
depends_on: [nodes/code-police]
next: [nodes/create-pr]
skip_when:
  - project_config_missing: test_command
    reason: "no test command configured"
    counts_as_success: true
retry:
  max_flaky: 0
  max_real: 4
  on: failure
output_schema:
  status: "passed | failed | skipped"
  reason: "string (if skipped)"
  started_at: string
  completed_at: string
  attempts: int
  verification: string
---

# Test

Read the project's instructions to find the **test command** and strategy. Run only the tests relevant to the code paths changed in this PR — identify changed files via `git diff origin/HEAD...HEAD --name-only` and pick the tests that cover them.

If changes are purely internal with no user-facing impact, unit tests may suffice — skip e2e if no relevant scenarios exist.

**Flaky vs real**: a test is flaky only if it **passes on a subsequent retry**. Consistent failure = real bug. Before retrying, read the failing test code to judge if the failure pattern is inherently flaky (race conditions, timing, async waits).

**On real bug** (max 4 fix attempts): fix → run [[fmt]] → [[commit]] (amend? no — **new** commit) → retry test. Under `--no-git`: fix → [[fmt]] → retry test.

After this, continue to [[create-pr]].
