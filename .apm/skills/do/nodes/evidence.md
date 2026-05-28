# evidence

Opt-in step. Skipped under `--minimal` (execution.md guard).

## Strategies

**Opt-in step.** Most projects skip this. The step exists so projects with empirical "did the feature actually work" needs — UI screenshots, performance benchmarks, demo recordings, output transcripts — can attach that evidence to the PR without baking the mechanism into agency.

**If `--no-git`**: Skip with status `skipped` and reason `"--no-git"` — there's no PR to attach evidence to.

**If `forge != github`**: Skip with reason `"non-<forge> forge: <forge>"`. (Bitbucket comment wiring is tracked in [#10](https://github.com/srid/agency/issues/10).)

**Otherwise**: Read `.agency/do.md` and look for a `## PR evidence` section. If `.agency/do.md` is missing, or the section is missing or empty, skip with status `skipped` and reason `"no PR evidence section in .agency/do.md"` — the default for projects that haven't opted in.

**If the section is present**:

The section is project-specific and free-form: it can be inline prose describing the capture procedure, a pointer to another file (`See ./scripts/capture-evidence.md`), a script reference (`Run ./scripts/capture-pr-evidence.sh and use its stdout`), or any combination. Don't second-guess the form — read it, then **spawn a sub-agent** (`Agent(subagent_type: "general-purpose", ...)`) so the capture work doesn't pollute `/do`'s main context.

The sub-agent prompt should include:

- The literal section content from `.agency/do.md`.
- Standard PR context: PR URL, branch name, base branch, current commit SHA (via `.apm/skills/vcs/vcs-op head-commit-sha`), and `.apm/skills/vcs/vcs-op diff-names` output so the sub-agent knows which routes/files to exercise.
- An explicit instruction that the sub-agent's job is to return a single block of markdown (image links embedded, table data inline, etc.) suitable for posting under a `## Evidence` heading. The sub-agent should not post the comment itself — only return the markdown.

After the sub-agent returns, post its output as one PR comment via `.apm/skills/forge/forge-op comment-pr` under a `## Evidence` heading.

Embed image/asset URLs inline in the markdown — the forge comment surface cannot attach files; the workflow section is responsible for telling the sub-agent how to host any binary artifacts.

**Verify**: Either the step was skipped per the rules above, or a `## Evidence` PR comment exists (`.apm/skills/forge/forge-op view-pr-comments`) populated from the sub-agent's output.
