# ci

Run CI command and verify against the current HEAD.

## Strategies

Read `.agency/do.md` and look for a `## CI command` section, plus any verification method documented there. Run CI with `run_in_background: true` if the command takes more than a few seconds.

**Never pipe CI to `tail`/`head`**, and **never append `2>&1`** — background mode captures both streams.

**Active state**: Before waiting for background CI, run `runbook-driver --workflow=do set active waiting`. When CI returns (success or failure), run `runbook-driver --workflow=do set active working` before proceeding. This lets the stop hook allow graceful exits while the agent is idle.

CI commands are typically local (e.g. `nix flake check`, `just ci`, `make ci`) and are forge-independent — **run them regardless of forge**. Only the *verification method* may be forge-specific: if `.agency/do.md` describes verification via GitHub commit-status checks and `forge != github`, fall back to exit code + command output for verification on non-GitHub forges, and note this in the step record. (Bitbucket support is tracked in [#10](https://github.com/srid/agency/issues/10).)

**Verify**: Use the verification method described in `.agency/do.md` (e.g., `/forge op ci-status` on GitHub, reading CI output elsewhere). If no CI command is documented, skip with a note. **The CI result must cover `HEAD`.** Before recording the step as passed, compare the commit SHA that CI ran against with `/vcs op head-commit-sha`. If they differ (e.g., a commit was pushed after CI started), re-run CI against the current HEAD. CI passing on a stale commit does not satisfy verification.

**On failure** — read logs or output to diagnose.

**Flaky vs real**: A test is flaky only if it **passes on a subsequent retry**. Consistent failure = real bug. Before retrying, read the failing test code to judge if the failure pattern is inherently flaky (race conditions, timing, async waits).

**If flaky** (max 3 retries): Retry just the failing step.
**If real bug** (max 5 fixes): Fix → **fmt** → **commit** → retry CI. Under `--no-git`, drop **commit** from the loop. The draft PR already exists — subsequent pushes update it automatically, no re-run of **create-pr** needed.
**If retries exhausted**: Set workflow status to `"failed"`, skip to **done**. The draft PR stays open as the record of the failed attempt.
