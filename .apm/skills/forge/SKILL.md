---
name: forge
description: Semantic forge (GitHub today; Bitbucket planned) operation dispatch. Library skill — invoke `forge-op` when a workflow needs a named forge operation (create-pr, edit-pr, comment-pr, view-pr, fetch-issue, ci-status, etc.) instead of running `gh` directly. Adding a new forge means extending one file.
---

# forge

`/forge` is a **library skill** — it has no `execution.md`, no nodes, no multi-step graph. It exposes a semantic operation surface that runbook tenants invoke through `forge-op`. The operations are *named* (e.g. `comment-pr`), not syntactic (`gh pr comment --body ...`); each forge backend maps the name internally.

`/forge` is the **operational** surface (CRUD on PRs, comments, issues). The sister skill `/forge-pr` is the **composition** surface — it writes good PR titles and bodies. `/forge` invokes `/forge-pr` (via the Skill tool) when it needs body content. They are complementary, not redundant.

## Why

Today's /do has 13 distinct `gh ` references in its prose. Adding Bitbucket support without this skill means touching all of them plus /do's nodes. With this skill: Bitbucket support is a one-file change — add the `bitbucket)` arm in each case statement of `forge-op`. Tracking: [#10](https://github.com/srid/agency/issues/10).

## Invocation

Skills invoke `forge-op` directly as a script. The script lives at `.../skills/forge/forge-op` and is executable.

```sh
.../skills/forge/forge-op <operation> [args...]
```

Detection: reads `$forge` from the calling workflow's state file if present (e.g. `.do-results.json`); otherwise classifies by inspecting `origin` URL via `/vcs op remote-url`.

## Operation surface

| Operation                              | Returns / Effect                                                                              |
|----------------------------------------|-----------------------------------------------------------------------------------------------|
| `detect`                               | Prints `github`, `bitbucket`, or `unknown`                                                    |
| `fetch-issue <url-or-number>`          | Prints issue title + body                                                                     |
| `view-pr [<branch>]`                   | Prints PR JSON (or empty + exit 1 if none). Defaults to current branch.                       |
| `view-pr-url`                          | Prints the PR's HTML URL                                                                      |
| `view-pr-comments`                     | Prints PR comments (markdown bodies)                                                          |
| `create-pr [--draft] --title <t> --body <b>` | Create a PR. Use the `--body-file` form internally with a tempfile to survive backticks. |
| `edit-pr --title <t> --body <b>`       | Edit existing PR. Same body-file safety.                                                      |
| `comment-pr --body <b>`                | Post a comment on the current branch's PR.                                                    |
| `ci-status [<sha>]`                    | Print CI status for a commit (default: HEAD). Exit 0 if all green, 1 if pending, 2 if failed. |

The `--body` argument to `create-pr`/`edit-pr`/`comment-pr` is read from a heredoc when piped, or from a temp file when passed directly — backticks and `$` survive unescaped without per-caller heredoc plumbing.

## Adding a new forge

To add Bitbucket: edit `forge-op` and add a new arm to each operation's case statement (mapping `bitbucket)` to `bkt pr create ...` etc.) plus a detection rule for `*bitbucket.*` URLs. No other file in the repo needs to change. The CI lint script (`.apm/scripts/lint-vcs-refs.sh`) catches any new raw `gh ` reference in skill files outside `/forge` and `/forge-pr`.
