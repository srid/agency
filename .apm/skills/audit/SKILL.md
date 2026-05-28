---
name: audit
description: Evaluate a diff for structural complecting (hickey), volatility encapsulation (lowy), and rule/fact/elegance violations (code-police). ONLY invoke when explicitly typed `/audit` or `$audit`, or when invoked as a sub-skill by another runbook (e.g. /do). Returns a structured findings ledger; never commits.
argument-hint: "[<branch-or-revision>]"
---

# /audit

Run hickey + lowy + code-police as a coordinated review fanout against a given diff. Emit a structured findings ledger to `.audit-results.json` and to stdout. **Never commits.** Callers (standalone CLI use or `/do`'s `audit` node) decide what to do with the findings.

**This is a runbook.** The graph lives in [`execution.md`](execution.md); each step is a node file under [`nodes/`](nodes/). Read [`../../runbook/RUNTIME.md`](../../runbook/RUNTIME.md) for walking conventions.

## Two entry points, one execution

`/audit` produces the same artifact in both contexts — the ledger — so the execution graph doesn't branch on context:

- **Standalone**: `/audit [<branch-or-revision>]` — defaults to the current branch's diff against `origin/<default>`. Prints the ledger.
- **Sub-skill from `/do`**: `/do`'s `audit` node invokes `/audit` via the Skill tool, then reads `.audit-results.json` to apply each "Fix in this PR" finding as its own commit. The commit-per-finding loop lives in `/do`, not here.

## Arguments

- `<branch-or-revision>` (optional): a git/jj revision to audit. Defaults to the current branch's diff against `origin/<default>`.

## How to walk

Same protocol as any runbook tenant — see [`../../runbook/RUNTIME.md`](../../runbook/RUNTIME.md):

1. `runbook-driver --workflow=audit init`
2. Seed the harness task list with `sync`, `fanout`, `done`.
3. For each node in execution.md: `runbook-driver --workflow=audit start <node>` → read `nodes/<node>.md` → `runbook-driver --workflow=audit end <status> "<verif>"`.
4. The `done` node invokes `.apm/runbook/scripts/done --workflow=audit` for timing + writes the ledger to `.audit-results.json`.

## No deferrals

The hickey and lowy skills emit two dispositions: **Fix in this PR** and **No-op**. `/code-police` emits violation findings that must all be fixed. There is no Defer. If a sub-agent emits anything resembling a defer — `Defer #N`, "out of scope", "follow-up", any phrasing that punts a finding to a future issue — treat it as a sub-agent rule violation. Flip the disposition to **Fix in this PR** unconditionally. The only way out of a finding is through it.

`No-op` survives without code action — but it is narrow: the diff already deletes the offending code, or the finding is subsumed verbatim by another entry. Anything resembling deferred-work-for-later is a Fix, not a No-op.

ARGUMENTS: $ARGUMENTS
