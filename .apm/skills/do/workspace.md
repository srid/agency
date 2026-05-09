# Workspace and Bindings

Adapting OpenProse's workspace/bindings boundary: each node has private scratch (working-tree mutations, sub-agent transcripts, do-results internal state, mid-step retry attempts) but only a small declared set of values crosses between nodes. The list below is the complete cross-node binding vocabulary for /do.

## Bindings (cross between nodes)

| Binding | Producer | Consumers | Notes |
|---------|----------|-----------|-------|
| `noGit` | caller flag, sync stashes via `do-results set` | branch, commit, hickey-lowy, police, create-pr, ci, evidence, done | bool |
| `minimal` | caller flag | docs, hickey-lowy, police, evidence | bool |
| `review` | caller flag | research (controls plan-approval pause) | bool |
| `forge` | sync (script's stdout) | branch, commit, create-pr, ci, evidence, done | `github` / `bitbucket` / `unknown` |
| `branch` | sync (current), branch (new feature branch) | commit, create-pr | string |
| `default_branch` | sync | branch, hickey-lowy, police, test, ci | `master` / `main` |
| `task` | caller arg | research | the prompt or issue URL |
| `research.plan` | research | plan-approval, implement | structured plan + file:line citations |
| `research.map` | research | implement (referenced rather than re-read) | file:line index from Explore subagent |
| `primary_commit_sha` | commit | hickey-lowy, police | git sha; absent under `noGit` |
| `review_findings` | hickey-lowy | create-pr (posted as PR comment) | structured table; may be empty |
| `pr_url` | create-pr | ci, evidence, done | string; absent under `noGit` or non-github forge |
| `ci_run_sha` | ci | done | git sha CI ran against |
| `timing_table` | done (via `scripts/steps/done`) | terminal, PR comment | markdown table |

## What is NOT a binding

These are durable but not bindings — they're side effects on shared state. Downstream nodes read them from the world, not from a binding:

- **Git tree state** — implement, hickey-lowy, police, test all mutate it. `git diff origin/HEAD...HEAD` is the canonical query.
- **Pushed commits** — commit, hickey-lowy, police, test all push. `git log origin/HEAD..HEAD` is the canonical query.
- **GitHub PR state** — create-pr opens the draft, hickey-lowy posts the analysis comment, evidence posts the evidence comment, done posts the status comment. `gh pr view` is the canonical query.
- **CI status** — ci writes statuses to GitHub. `gh pr checks` (or equivalent) is the canonical query.
- **`.do-results.json`** — the receipt envelope. Treat as write-only from per-node code; use the script API, don't read the file directly.

## Scratch (does not cross node boundaries)

Anything not in the bindings table above is scratch. Examples:

- **Sub-agent transcripts.** When `hickey-lowy` spawns hickey + lowy as parallel sub-agents, only the structured `findings` cross back. The internal reasoning, file dumps, and intermediate edits the sub-agents made stay in their sessions.
- **Mid-step retry attempts.** `check-loop`'s intermediate runner outputs (e.g. the second-to-last failing tsc output) are scratch — only the final verdict crosses.
- **File reads done for verification.** `git diff --name-only` to count changed files; `gh pr view` to confirm a comment posted. The values are queried, used for a local decision, and discarded.
- **Tool outputs from research.** Files Explore reads internally are scratch; the file:line *map* it returns crosses as `research.map`.

## Why this boundary matters

Without it, the agent's context bloats with intermediate state by step seven and the original goal gets lost. With it, each node has a clean handoff and the rest of the noise stays in the node that produced it. This is the same insight OpenProse encodes with `workspace/` (per-service scratch) vs. `bindings/` (declared cross-service outputs).

The bindings table above is the contract for how nodes talk to each other. Adding a new binding (or expanding an existing one's consumers) is a deliberate design change to this skill, not an ad-hoc decision in a single node.

## Receipt envelope (the run trace)

The do-results JSON tracks workflow state independently of bindings. Its top-level fields:

| Field | Owner | Set by |
|-------|-------|--------|
| `workflow` | do-results script | `init` |
| `startedAt` | do-results script | `init` |
| `active` | /do | `set active <working\|waiting\|false>` |
| `status` | /do | `set status <completed\|failed>` (set by `done`) |
| `forge` | /do | `set forge <value>` (set by `sync`) |
| `noGit` | /do | `set noGit <value>` (set by `sync`) |
| `steps[]` | do-results script | `step-start` / `step-end` / `step` |

Each step record has: `name`, `status`, `verification`, `startedAt`, `completedAt`, optional `reason`.

The receipt envelope is the audit trail of the run. It does not interpret /do-specific concepts — it just remembers them. New /do fields go in via `set`; the script never grows /do-specific knowledge.
