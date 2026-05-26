---
name: evidence
description: Attach empirical evidence to the PR (opt-in).
---

# Evidence

## Requires

- `--minimal` flag
- `--no-git` flag
- `forge` from sync
- CI passed

## Ensures

- Evidence posted as PR comment (if configured)

## Strategies

**If `--minimal`**: Skip with status `skipped` and reason `"--minimal"`.

**If `--no-git`**: Skip with status `skipped` and reason `"--no-git"`.

**If `forge != github`**: Skip with status `skipped` and reason `"non-<forge> forge: <forge>"`.

**Otherwise**: Read `.agency/do.md` and look for a `## PR evidence` section. If missing or empty, skip with status `skipped` and reason `"no PR evidence section in .agency/do.md"`.

**If the section is present**:

The section is project-specific and free-form: inline prose, pointer to another file, script reference, or any combination. Read it, then **spawn a sub-agent** (`Agent`/`task` with `subagent_type: "general-purpose"`) so the capture work doesn't pollute `/do`'s main context.

The sub-agent prompt should include:

- The literal section content from `.agency/do.md`.
- Standard PR context: PR URL, branch name, base branch, current commit SHA, and `git diff origin/HEAD...HEAD --name-only`.
- An explicit instruction that the sub-agent's job is to return a single block of markdown suitable for posting under a `## Evidence` heading.

After the sub-agent returns, post its output as one PR comment using `gh pr comment` under a `## Evidence` heading. Use the **single-quoted heredoc** pattern so backticks and `$` survive unescaped.

Embed image/asset URLs inline in the markdown — `gh pr comment` itself cannot attach files.

**Verify**: Either the step was skipped per the rules above, or a `## Evidence` PR comment exists.
