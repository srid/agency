# sync (audit)

Resolve the diff scope, detect forge for output, init state.

## Strategies

1. Detect VCS: `.apm/skills/vcs/vcs-op detect` → stash via `.apm/runbook/scripts/runbook-driver --workflow=audit set vcs <value>`.
2. Resolve the diff scope:
   - If a `<branch-or-revision>` argument was given, use it as the base. Otherwise use the default: `origin/<default-branch>` via `.apm/skills/vcs/vcs-op default-branch`.
   - Capture the diff via `.apm/skills/vcs/vcs-op diff-range [base]` for the fanout node.
   - Capture the changed-file list via `.apm/skills/vcs/vcs-op diff-names [base]` so the duplication-audit hint can be conditional on new files.
3. Detect forge: `.apm/skills/forge/forge-op detect` → stash via `.apm/runbook/scripts/runbook-driver --workflow=audit set forge <value>`. /audit doesn't post anywhere itself, but the forge field is preserved so a downstream consumer (e.g. /do's create-pr node) can render the right comment shape.
4. Stash the diff base for the fanout node: `.apm/runbook/scripts/runbook-driver --workflow=audit set base <ref>`.

**Verify**: state file `.audit-results.json` exists; `vcs`, `forge`, `base` fields set; diff and changed-file list captured for the fanout node.
