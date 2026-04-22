---
name: nodes/code-police
depends_on: [nodes/hickey, nodes/lowy]
next: [nodes/test]
invokes_skill: code-police
requires_tool: Skill
skip_when:
  - predicate: nodes/docs-only-check
    reason: "docs-only changes"
    counts_as_success: true
  - flag: no-git
    reason: "--no-git (code-police applies fixes as commits; under --no-git, apply to working tree and skip node)"
    counts_as_success: true
retry:
  max: 3
  on: violations
  to: self
output_schema:
  status: "passed | failed | skipped"
  reason: "string (if skipped)"
  started_at: string
  completed_at: string
  attempts: int
  passes:
    rules: "clean | violations_fixed"
    fact_check: "clean | violations_fixed"
    elegance: "clean | refactors_applied"
  commits_added: "string[] (SHAs of fix(police): / refactor(police): commits)"
  verification: string
---

# Node: Code police

Wraps the top-level [[code-police]] skill with graph edges. Waits for **both** [[hickey]] and [[lowy]] to complete before running.

**Skip condition**: run the [[docs-only-check]] predicate. If all changed files are documentation-only, skip this node.

Invoke `/code-police` via the Skill tool. It runs three passes: rule checklist, fact-check, and elegance (which delegates to `/simplify` when available). When it asks about scope: **changes in the current branch/PR only**.

**Commit each violation fix individually.** Same rule as [[hickey]] and [[lowy]]: PR history is the story of the work, and a reviewer should see one commit per rule violation or elegance refinement, not a lump "police pass" commit covering eight unrelated things.

For each violation reported by `/code-police`, in turn:

1. Apply the fix — scope the edit tightly.
2. Run the project's format command on changed files.
3. `git add <changed files>` — stage only this fix.
4. Commit with a conventional prefix identifying the pass and rule:
   - Rules pass: `fix(police): <rule-id> — <short description>`
   - Fact-check pass: `fix(police): fact-check — <short description>`
   - Elegance pass (`/simplify`-applied or inline-loop-applied): `refactor(police): elegance — <short description>`
5. `git push`.

For the elegance pass specifically: `/simplify` applies fixes in batches across three lenses (reuse, quality, efficiency). Commit each distinct refactor as a separate commit — do not roll them into one "elegance" commit.

Re-invoke `/code-police` after each round of fixes. Up to 3 attempts total.

Record the per-pass status and the list of added commit SHAs in the receipt. After this, continue to [[test]].
