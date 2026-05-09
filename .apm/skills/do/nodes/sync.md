---
name: sync
kind: node
---

# sync

Fetch origin, classify the forge, fast-forward (unless `--no-git`), and stash coordination state.

## Requires

- `noGit` — caller flag (default `false`)

## Ensures

- `forge`: `github` | `bitbucket` | `unknown`
- `branch`: current git branch name
- `default_branch`: e.g. `master` or `main`
- (side effect) origin fetched; if not `noGit` and behind, fast-forwarded with `git pull --ff-only`

## Strategies

- The `scripts/steps/sync` script encapsulates fetching, fast-forwarding, dirty-tree hinting, forge classification, and the do-results init+sync record. Don't reimplement; just invoke.
- Under `noGit`: fetch happens but the working tree is never touched — uncommitted work is preserved.
- When the tree is dirty and not `noGit`: print a hint to stderr (no pause) suggesting `--no-git`; continue regardless. The hint:

  > _Dirty tree detected. Continuing will create a fresh branch on top of these changes. If you wanted the agent to extend your WIP in place without touching git, re-run with `--no-git`._

- Forge classification reads `git remote get-url origin`:
  - `github.com` → `github`
  - `bitbucket.` (covers `bitbucket.org` and self-hosted servers like `bitbucket.juspay.net`) → `bitbucket`
  - otherwise → `unknown`

  Only `github` has an active PR/CI integration code path today. Bitbucket and unknown cause forge-dependent nodes (`branch`, `commit`, `create-pr`, `ci`, `evidence`) to skip gracefully. Bitbucket support is tracked in [srid/agency#10](https://github.com/srid/agency/issues/10).

## Receipt

**Special case.** The `scripts/steps/sync` script handles its own bookend internally — it calls `do-results init <forge> <noGit>` then `do-results step sync passed ...`. The agent does **not** call `step-start sync` / `step-end sync` itself for this node.

After the script returns, the agent reads `forge=`, `branch=`, `defaultBranch=` from stdout and re-stashes them via `do-results set forge ...`, `set noGit ...`, `set branch ...`, `set default_branch ...` so downstream nodes can read them as bindings.

## Invocation

```
.../skills/do/scripts/steps/sync <noGit>
```

(Pass `true` or `false` for `<noGit>`.)

## Verify

Script exited 0 and printed three lines on stdout: `forge=<value>`, `branch=<value>`, `defaultBranch=<value>`. Sync silences `do-results`' own confirmation echoes so the protocol stays clean.

## Errors

- `script_exit_nonzero` — the sync script failed (network, git error, malformed remote URL). Halt the workflow with `do-results set status failed`. Do not proceed to research; coordination state is required.
