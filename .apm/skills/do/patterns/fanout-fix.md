# fanout-fix

Parallel reviewers produce findings; each finding is applied as its own commit. Used by **hickey-lowy**.

## Slots

- `reviewer_a`: first reviewer (e.g. `hickey`)
  - requires: `diff`, `task`, `context`
  - ensures: `findings` (list of `{label, disposition, rationale}`)
- `reviewer_b`: second reviewer (e.g. `lowy`)
  - requires: `diff`, `task`, `context`
  - ensures: `findings` (list of `{label, disposition, rationale}`)
- `fixer`: applies a single finding
  - requires: `finding`, `diff`
  - ensures: `commit_sha` (string or null if no-op)

## Config

| Param | Default | Meaning |
|-------|---------|---------|
| `cross_validate` | `true` | When `true` and both reviewers produced findings, run each reviewer a second time against the other reviewer's findings to catch cross-effects. |

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
let findings_a = spawn reviewer_a(diff, task, context)
let findings_b = spawn reviewer_b(diff, task, context)
await both

let all_findings = findings_a + findings_b

# Phase 2: cross-validation (if both found something)
if cross_validate and findings_a.nonempty and findings_b.nonempty:
  let cv_a = spawn reviewer_a(diff, task, context, other_findings: findings_b)
  let cv_b = spawn reviewer_b(diff, task, context, other_findings: findings_a)
  await both
  merge new findings into all_findings

# Phase 3: apply fixes
let commits = []
for finding in all_findings where disposition == "Fix in this PR":
  call fixer(finding, diff)
  if not noGit and commit_sha:
    commits.push(commit_sha)

return { commits, findings_ledger }
```
