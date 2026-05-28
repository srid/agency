# /audit execution

```prose
call sync
call fanout
call done
```

Three nodes, no conditionals. Same flow for standalone and sub-skill invocation — the output (a findings ledger in `.audit-results.json` plus stdout) is identical in both contexts.

## Why this order

- `sync` first — resolve the diff scope (from `<branch-or-revision>` argument or default to current branch's diff against `origin/<default>`); detect forge for output formatting; init state.
- `fanout` — spawn hickey + lowy + code-police in parallel; cross-validate if both hickey and lowy returned findings; dedupe; assemble the ledger.
- `done` — write `.audit-results.json` (the ledger), print it, emit timing table via `.../skills/runbook/done --workflow=audit`.

## Entry points

There's only one. `/audit` is small enough that `--from <step>` would just add machinery without saving anyone time.
