# audit

Invoke the `/audit` skill (reviewer fanout: hickey + lowy + code-police), then apply returned findings as commits. Skipped under `--minimal` (execution.md guard).

## Strategies

Invoke `/audit` via the Skill tool. `/audit` runs hickey + lowy + code-police in parallel against the current branch's diff, cross-validates parallel findings, dedupes, and writes a structured findings ledger to `.audit-results.json`. It returns the same ledger as text for convenience.

`/audit` produces findings only; it never commits. The commit-per-finding loop lives here in `/do` because committing is `/do`-specific.

### Apply each "Fix in this PR" finding as its own commit

Read `.audit-results.json` for the findings ledger. For each finding with disposition **Fix in this PR**, in turn:

1. Apply the fix narrowly — only the lines that address this specific finding.
2. Run the project's format command (from **fmt** instructions) on the changed files, if one is configured.
3. Stage the touched files only: `.../skills/vcs/vcs-op stage <files>` (or use the fixer's stage convention).
4. Commit with the appropriate conventional prefix based on the finding's source lens:
   - Hickey findings: `refactor(hickey): <short finding label>`
   - Lowy findings: `refactor(lowy): <short finding label>`
   - Police rules-pass: `fix(police): <rule-id> — <short description>`
   - Police fact-check pass: `fix(police): fact-check — <short description>`
   - Police elegance pass: `refactor(police): elegance — <short description>`
   - Cross-validation findings: `refactor(hickey): cross-validate — <label>` / `refactor(lowy): cross-validate — <label>`
5. Push after each commit so the draft PR (once created) accumulates commits in real time.

Apply commits **one per finding** — do not batch multiple findings into one commit. A reviewer reading the PR's commit history should be able to follow the structural refinement as a sequence, not decode a grab-bag diff.

### Under `--no-git`

This node still runs (the `audit` guard is `--minimal`, not `--no-git`). Apply fixes to the working tree and skip the commit/push steps entirely. Record the step as passed with verification noting "--no-git: fixes applied to working tree, not committed."

**Verify**: `/audit` returned and wrote `.audit-results.json`. Every finding with disposition **Fix in this PR** has a corresponding commit on the feature branch (`.../skills/vcs/vcs-op log-range origin/HEAD..HEAD` shows them), except under `--no-git`. No unactioned findings; no deferred findings (the `/audit` skill enforces no-defer at its boundary).
