# commit

Create the primary feature commit. Skipped under `--no-git` (execution.md guard).

## Strategies

Create a NEW commit (never amend) with a conventional commit message for the primary implementation, then push to the feature branch:

```
/vcs op commit "<conventional message>"
/vcs op push <branch-name>          # -u semantics on first push
```

This is the **primary feature commit**. Downstream **audit** produces follow-up commits (one per finding addressed), which keeps the PR history a readable progression of "what was built, then what was refined" rather than a single opaque squash.

**Verify**: `/vcs op log-head` shows a new commit on the feature branch, and it's pushed to remote.
