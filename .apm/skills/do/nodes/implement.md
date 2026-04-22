---
name: nodes/implement
depends_on: [nodes/plan-approval]
next: [nodes/check]
output_schema:
  status: "passed | failed"
  started_at: string
  completed_at: string
  touched_paths: "string[]"
  verification: string
---

# Implement

**Branch first (unless `--no-git`).** Detect the default branch (`git symbolic-ref refs/remotes/origin/HEAD`), then create a descriptive feature branch from `origin/<default>`. Local only — no commit or push yet.

Under `--no-git`, stay on whatever branch the user started on. Do not create, commit, or push anything.

Then:

- If the task is a bug fix: write a failing test first (e2e or unit, whichever fits), then fix the bug.
- Otherwise: implement the planned changes. Prefer simplicity. Do the boring obvious thing.

**E2E coverage**: when the change introduces multiple user-facing paths (e.g., a dialog that appears under different conditions), enumerate the paths and write an e2e scenario for **each distinct path**.

Record every file you touched under `touched_paths` in the receipt — v1's engine will verify this matches `git status --porcelain`.

After this, continue to [[check]] — fastest gate first, fail fast on broken code.
