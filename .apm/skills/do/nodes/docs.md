# docs

Documentation sync gate. Skipped under `--minimal` (execution.md guard).

## Strategies

Read `.agency/do.md` and look for a `## Documentation` section listing which docs to keep in sync (e.g., README.md). Compare those files against changes in this PR (use `/vcs op diff-names` to get changed files).

If no documentation files are documented, skip this step with a note (`runbook-driver --workflow=do end skipped "no documentation section in .agency/do.md" "..."`).

**Verify**: Docs match current code.
**If outdated** (max 3 attempts): Fix the outdated sections and re-verify.
