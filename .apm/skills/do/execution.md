# /do execution

Read [`.../skills/runbook/RUNTIME.md`](.../skills/runbook/RUNTIME.md) for the prose grammar. Skip reasons come from the unsatisfied guard expression (`reason="not noGit"`, `reason="not minimal"`, `reason="forge != github"`).

## Order

```prose
call sync
call research
if review:
  call plan-approval
if not noGit:
  call branch
call implement
call check
if not minimal:
  call docs
call fmt
if not noGit:
  call commit
if not minimal:
  call audit
call test
if not noGit and forge == github:
  call create-pr
call ci
if not minimal:
  call evidence
call done
```

## Entry points (`--from <step>`)

| ID               | Starts at        | Use case                                |
|------------------|------------------|-----------------------------------------|
| `default`        | sync             | Full workflow from scratch              |
| `followup`       | implement        | Additional changes on existing PR       |
| `post-implement` | fmt              | Skip research/impl, start at formatting |
| `polish`         | audit            | Structural review + quality gate        |
| `ci-only`        | ci               | Just run CI                             |

Under `--from <step>`, seed the full task list (minus `--minimal` omissions) and mark earlier steps as `completed` immediately.

## Why this order

- **Cheap gates first** (`check` before `docs` before `fmt`) — fail fast on broken code.
- **`commit` before `audit`** — reviewers operate on a real diff, not a plan. Reviewing a plan tends to surface generic concerns; reviewing a diff surfaces specific interleavings.
- **`fmt` before `commit`** — primary feature commit lands already-formatted; downstream `audit` commits run `fmt` per fix inside their own loop.
- **`create-pr` before `ci`** — draft PR is the canonical home for CI status. Failing CI doesn't leave an orphaned branch.
- **`evidence` after `ci` passes** — capturing screenshots of broken code wastes the capture work.
- **`done` last** — timing table needs every node's bookend already recorded.
