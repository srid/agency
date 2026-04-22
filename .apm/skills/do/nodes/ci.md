---
name: nodes/ci
depends_on: [nodes/create-pr]
next: [nodes/done]
skip_when:
  - project_config_missing: ci_command
    reason: "no CI command configured"
    counts_as_success: true
retry:
  max_flaky: 3
  max_real: 5
  on: failure
background: true
output_schema:
  status: "passed | failed | skipped"
  reason: "string (if skipped)"
  started_at: string
  completed_at: string
  attempts: int
  ci_commit_sha: "string (the SHA CI ran against)"
  head_commit_sha: "string (must equal ci_commit_sha)"
  verification: string
---

# CI

Read the project's instructions to find the **CI command** and verification method. Run CI with `run_in_background: true` (CI commands typically take more than a few seconds).

**Never pipe CI to `tail`/`head`**, and **never append `2>&1`** — background mode captures both streams.

**Active state**: before waiting for background CI, write `active: waiting` in the session log's run header (or as a top-level annotation). When CI returns (success or failure), flip back to `active: working`. This lets a stop hook or supervisor distinguish "idle waiting" from "actively working."

CI commands are typically local (e.g. `nix flake check`, `just ci`, `make ci`) and are **forge-independent — run them regardless of forge**. Only the verification method may be forge-specific: if the project's instructions describe verification via `gh` commit-status checks and `forge != github`, fall back to exit code + command output, and note this in the receipt.

**Verify coverage of `HEAD`.** Before recording the step as passed, compare the commit SHA CI ran against with `git rev-parse HEAD`. If they differ (e.g., a commit was pushed after CI started — a fix retry, user-requested changes, or any other source), **re-run CI against the current HEAD**. CI passing on a stale commit does not satisfy verification. Record both `ci_commit_sha` and `head_commit_sha` in the receipt — they must match.

**On failure** — read logs or output to diagnose.

**Flaky vs real**: a failure is flaky only if it **passes on a subsequent retry**. Consistent failure = real bug. Before retrying, read the failing test code to judge whether the pattern is inherently flaky.

**If flaky** (max 3 retries): retry just the failing step.
**If real bug** (max 5 fix attempts): fix → [[fmt]] → [[commit]] → retry CI. Under `--no-git`, drop [[commit]] from the loop (fix → [[fmt]] → retry). The draft PR already exists — subsequent pushes update it; no re-run of [[create-pr]] needed.
**If retries exhausted**: record `status: failed`, halt. The draft PR stays open as the record of the failed attempt — do not close, undraft, or otherwise mutate it.

After this, continue to [[done]].
