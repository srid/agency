# fanout-fix

Parallel reviewers produce findings; each finding is applied as its own commit. Used by **hickey-lowy**.

## Slots

- `reviewers`: list of reviewer slots (e.g. `[hickey, lowy]`)
  - each requires: `diff`, `task`, `context`
  - each ensures: `findings` (list of `{label, disposition, rationale}`)
- `fixer`: applies a single finding
  - requires: `finding`, `diff`
  - ensures: `commit_sha` (string or null if no-op)

## Config

| Param | Default | Meaning |
|-------|---------|---------|
| `cross_validate` | `true` | When `true` and at least two reviewers produced findings, run each reviewer a second time against the other reviewers' findings to catch cross-effects. |

## Requires

- `diff`: `git diff origin/HEAD...HEAD`
- `task`: the original task prompt
- `context`: file paths, approach, constraints from research

## Ensures

- `commits`: list of commit SHAs, one per "Fix in this PR" finding
- `findings_ledger`: markdown table of all findings with dispositions

## Invariants

- Reviewers run in parallel, not sequentially.
- Each "Fix in this PR" finding gets its own commit — never batched.
- `No-op` findings require no commit.
- There is no "Defer" disposition. Any reviewer output resembling a defer is treated as "Fix in this PR".
- Under `--no-git`: fixes go to working tree, no commits.

## Delegation

```prose
# Phase 1: parallel first-pass
let all_first_pass = []
for reviewer in reviewers:
  all_first_pass.push(spawn reviewer(diff, task, context))
await all

let all_findings = concat all_first_pass

# Phase 2: cross-validation (if at least two reviewers found something)
if cross_validate and count_nonempty(all_first_pass) >= 2:
  for reviewer in reviewers where reviewer.findings.nonempty:
    let others = all_findings excluding this reviewer's findings
    let cv = spawn reviewer(diff, task, context, other_findings: others)
    await cv
    merge new findings into all_findings

# Phase 3: apply fixes
let commits = []
for finding in all_findings where disposition == "Fix in this PR":
  call fixer(finding, diff)
  if not noGit and commit_sha:
    commits.push(commit_sha)

return { commits, findings_ledger }
```
