---
name: vcs
description: Semantic VCS operation dispatch (git ⊕ jujutsu). Library skill — invoke via Skill tool when a workflow needs a named VCS operation (fetch, branch, commit, push, diff-range, head-sha, etc.) instead of running `git`/`jj` directly. Auto-detects backend from `.git/` vs `.jj/`. Adding a new backend means extending one file.
---

# vcs

`/vcs` is a **library skill** — it has no `execution.md`, no nodes, no multi-step graph. It exposes a semantic operation surface that runbook tenants (and any other skill) invoke through `vcs-op`. The operations are *named* (e.g. `diff-range`), not syntactic (`git diff origin/HEAD...HEAD`); each VCS backend maps the name internally.

## Why

Today's /do has 24 distinct `git ` references baked into its prose. Adding Jujutsu (jj) support without this skill means touching all those references plus /do's sync script, reviewer skills, and lints (the PR #184 sprawl). With this skill: jj support is a one-file change — add the `jj)` arm in each case statement of `vcs-op`.

## Invocation

Skills invoke `vcs-op` directly as a script. The script lives at `.apm/skills/vcs/vcs-op` and is executable.

```sh
.apm/skills/vcs/vcs-op <operation> [args...]
```

Detection: reads `$vcs` from the calling workflow's state file if present (e.g. `.do-results.json` under `--workflow=do`); otherwise falls back to filesystem detection (`.jj/` → jj, `.git/` → git).

## Operation surface

| Operation                        | Returns / Effect                                                                                  |
|----------------------------------|---------------------------------------------------------------------------------------------------|
| `detect`                         | Prints `git`, `jj`, or `unknown`                                                                  |
| `fetch`                          | Fetch from remote                                                                                 |
| `remote-url`                     | Prints origin URL                                                                                 |
| `head-revision`                  | Prints current branch/bookmark identifier                                                         |
| `head-commit-sha`                | Prints current commit SHA (for CI verification)                                                   |
| `default-branch`                 | Prints default branch name (e.g. `master`)                                                        |
| `current-branch`                 | Prints current branch name (git only; jj uses head-revision)                                      |
| `dirty`                          | Exit 0 if working copy has uncommitted changes, 1 if clean                                        |
| `dirty-files`                    | Prints list of files with uncommitted changes (one per line)                                      |
| `diff-range [base]`              | Diff between base (default origin/HEAD) and current — three-dot semantic                          |
| `diff-names [base]`              | diff-range, name-only                                                                             |
| `diff-stat [base]`               | diff-range, summary/stat                                                                          |
| `new-files [base]`               | Files newly added in current range                                                                |
| `log-range [base]`               | One-line log between base and current                                                             |
| `log-head`                       | One-line log of current revision                                                                  |
| `branch <name> [base]`           | Create + check out a feature branch/bookmark from base (default: default-branch)                  |
| `commit <msg>`                   | Stage all changes and create/describe a commit                                                    |
| `stage <files...>`               | Stage specific files                                                                              |
| `commit-staged <msg>`            | Commit already-staged files only (no `add -A`)                                                    |
| `push [ref]`                     | Push to remote (with `-u` semantics on first push when ref is given)                              |
| `up-to-date`                     | Exit 0 if working tree is at-or-ahead of upstream, prints `behind=<N> ahead=<N>` on stderr        |
| `ff-pull`                        | Fast-forward pull if behind, no-op if ahead or even                                               |

## Adding a new backend

To add support for a new VCS (e.g. Fossil, Pijul): edit `vcs-op` and add a new arm to each operation's case statement plus a filesystem detection rule. No other file in the repo needs to change. The CI lint script (`.apm/scripts/lint-vcs-refs.sh`) catches any new raw `git`/`jj` reference in skill files outside `/vcs`.
