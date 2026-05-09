---
name: evidence
kind: node
---

# evidence

Opt-in: capture and post empirical evidence (screenshots, benchmarks, transcripts) to the PR. Most projects skip this.

## Requires

- `noGit` — caller flag
- `minimal` — caller flag
- `forge` — from sync
- `pr_url` — from create-pr (skipped if absent)

## Ensures

- (side effect, when applicable) `## Evidence` PR comment posted with markdown returned by the capture sub-agent

## Strategies

- **If `minimal`**: skip with `status="skipped"` and `reason="--minimal"`. Move to **done**.
- **If `noGit`**: skip with `status="skipped"` and `reason="--no-git"`. There is no PR to attach evidence to.
- **If `forge != github`**: skip with `status="skipped"` and `reason="non-<forge> forge: <forge>"`. (Bitbucket comment wiring is tracked in [srid/agency#10](https://github.com/srid/agency/issues/10).)
- **Otherwise**: read `.agency/do.md` and look for a `## PR evidence` section. If `.agency/do.md` is missing, or the section is missing or empty, skip with `status="skipped"` and `reason="no PR evidence section in .agency/do.md"` — the default for projects that haven't opted in.

### When the section is present

The section is project-specific and free-form: it can be inline prose describing the capture procedure, a pointer to another file (`See ./scripts/capture-evidence.md`), a script reference (`Run ./scripts/capture-pr-evidence.sh and use its stdout`), or any combination. Don't second-guess the form — read it, then **spawn a sub-agent** (`Agent(subagent_type: "general-purpose", ...)`) so the capture work (MCP calls, screenshot uploads, gh API requests) doesn't pollute /do's main context.

The sub-agent prompt should include:

- The literal section content from `.agency/do.md`.
- Standard PR context: `pr_url`, `branch`, `default_branch`, `git rev-parse HEAD`, and `git diff origin/<default_branch>...HEAD --name-only` so the sub-agent knows which routes/files to exercise.
- An explicit instruction that the sub-agent's job is to return a single block of markdown (image links embedded, table data inline, etc.) suitable for posting under a `## Evidence` heading. The sub-agent should not post the comment itself — only return the markdown.

After the sub-agent returns, post its output as one PR comment using `gh pr comment` under a `## Evidence` heading. Use the **single-quoted heredoc** pattern (see `forge-pr` → "Passing the body to `gh` safely") so backticks and `$` survive unescaped:

```sh
gh pr comment --body "$(cat <<'EOF'
## Evidence

<markdown returned by the sub-agent>
EOF
)"
```

Embed image/asset URLs inline in the markdown — `gh pr comment` itself cannot attach files; the workflow section is responsible for telling the sub-agent how to host any binary artifacts so they end up referenceable.

## Receipt

```
.../skills/do/scripts/do-results step-start evidence
# under any skip condition, immediately:
.../skills/do/scripts/do-results step-end skipped "<reason>" "<reason-tag>"
# otherwise, after sub-agent returns + comment posted:
.../skills/do/scripts/do-results step-end passed "evidence comment posted to PR"
```

## Verify

Either the node was skipped per the rules above, or a `## Evidence` PR comment exists (`gh pr view --comments` or equivalent) populated from the sub-agent's output.

## Errors

- `subagent_failed` — the capture sub-agent could not produce evidence. Halt workflow only if the project explicitly opted in to evidence (the section was present and non-empty); otherwise treat as `failed` to surface the issue.
