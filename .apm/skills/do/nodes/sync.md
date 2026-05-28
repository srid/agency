# sync

Initialize state, fetch, classify forge, resolve branch info.

## Strategies

Run the colocated `sync` script in this directory, passing `true` or `false` for `--no-git`:

```
.apm/skills/do/nodes/sync <noGit>
```

The script:

- Calls `.../skills/runbook/runbook-driver --workflow=do init`.
- Fetches `origin` and pins `origin/HEAD` (via `.../skills/vcs/vcs-op fetch`).
- If `--no-git` is **not** set and the branch is behind origin (ahead-count 0), fast-forwards. Under `--no-git`, fetching happens but the working tree is not touched — uncommitted work preserved.
- Prints the dirty-tree hint to stderr (no pause) when the tree is dirty and `--no-git` is not set:

  > _Dirty tree detected. Continuing will create a fresh branch on top of these changes. If you wanted the agent to extend your WIP in place without touching git, re-run with `--no-git`._

- Classifies the forge from `origin` URL — `github.com` → `github`, `bitbucket.` → `bitbucket`, otherwise `unknown`.
- Calls `.../skills/runbook/runbook-driver --workflow=do set forge <value>`, `set noGit <value>`, `set vcs <git|jj>`.
- Records the sync step as passed via `.../skills/runbook/runbook-driver --workflow=do step sync passed ...`.
- Prints `forge=<value>`, `branch=<value>`, `defaultBranch=<value>`, `vcs=<value>` on stdout for downstream steps.

**Only `github` has an active code path today.** Both `bitbucket` and `unknown` cause forge-dependent steps (PR creation, PR comments, PR edits, CI status) to skip gracefully. Bitbucket support is planned — see [#10](https://github.com/srid/agency/issues/10).

After the script returns, stash the remaining mode flags:

```
.../skills/runbook/.../skills/runbook/runbook-driver --workflow=do set minimal <true|false>
.../skills/runbook/.../skills/runbook/runbook-driver --workflow=do set review <true|false>
```

**Verify**: Script exited 0 and printed `forge=`, `branch=`, `defaultBranch=`, `vcs=` lines on stdout. The script records its own step status; do NOT bracket it with additional `start`/`end` calls.
