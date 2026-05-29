# Dynamic workflows in agency

[Claude Code dynamic workflows](https://claude.com/blog/introducing-dynamic-workflows-in-claude-code) are JavaScript scripts that orchestrate subagents at scale. Instead of the model driving the loop turn by turn, a script — running on the [workflow runtime](https://code.claude.com/docs/en/workflows) — holds the plan, the control flow (loops, branching, retries), and every intermediate result. Subagents do the actual work (filesystem, git, shell, web); the script can't touch disk itself. The payoff is context: the main session only ever sees the workflow's *final* answer, not the dozens of subagent turns that produced it. Runs execute in the background and are resumable, so a long pipeline doesn't hold your session hostage.

That control-flow-in-the-runtime model is exactly what a multi-step delivery pipeline wants — which is why agency ships one as a worked example.

## How this relates to agency

`do-wf` ([`.claude/workflows/do-wf.js`](../.claude/workflows/do-wf.js)) is a dynamic-workflow port of the `/do` skill ([`.apm/skills/do/SKILL.md`](../.apm/skills/do/SKILL.md)). It runs the same pipeline:

```
sync → (research ∥ branch) → implement → check → docs → fmt → commit
     → detect in parallel: (hickey ∥ lowy ∥ police ∥ test)
     → apply fixes (serial, one commit each) → revalidate
     → create-pr → ci → evidence → done
```

The difference is where the control flow lives. In the skill, the model walks the steps and a Stop hook keeps it from quitting between them. In the workflow, the *script* holds the pipeline: a generic `loopStep` runner owns the per-step retry budget (check retries 3×, test 4×, CI 5×, and so on), `sync`/`research`/`implement` abort the run on hard failure rather than blindly re-running, and `--from` entry points jump into the middle of the array. Each step is a subagent that does the work and verifies it; the script reads the structured result and decides whether to retry, abort, or advance.

Holding the plan in code also lets the script run independent work **concurrently** where the shared checkout allows it. `research` (read-only) and `branch` (just creates a git ref) start together. More importantly, the three post-commit gates — `review` (hickey+lowy), `police`, and `test` — fan their *read-only detection* out in parallel, then apply any fixes **serially** (every fix is a git commit on the one shared working tree, so they can't safely overlap) and re-run the cheap gates once via a `revalidate` step. The governing rule is simple: only read-only work parallelizes; anything that mutates the tree or git serializes. That's also why `ci` and `evidence` stay sequential — `ci` can push fix commits, and you want `evidence` to capture the *post-CI-green* state.

The piece that fits the runtime best is the post-implement structural review. `do-wf` spawns `hickey` and `lowy` as two parallel subagents over the concrete diff, then runs a **cross-validation** pass — each lens audits the other's recommendations for problems it would flag if applied — before applying every `fix` finding as its own narrow commit. That parallel-then-cross-validate shape maps directly onto the workflow adversarial-review pattern, and it is the same hickey+lowy step the `/do` skill describes. See [Hickey/Lowy on kolu.dev](https://kolu.dev/blog/hickey-lowy/) for what each lens looks for and why the pair catches what tests miss.

## Using it in a downstream project

This is the section that matters if you want `do-wf` in your own repo.

### Install

Dynamic workflows live in one of two places:

- **Project**: `.claude/workflows/<name>.js` — shared via the repo, runs as `/<name>` for everyone who clones it.
- **Personal**: `~/.claude/workflows/<name>.js` — available in every project on your machine.

Copy or symlink `do-wf.js` to whichever scope you want, then invoke it as `/do-wf`.

#### The APM caveat (read this)

`do-wf.js` is installed **manually**. APM does not generate `.claude/workflows/`, and that is not an oversight you should expect APM to fix automatically: **APM has no dynamic-workflow primitive.** APM's primitives are *chatmode*, *instruction*, and *context* (plus skills, prompts, and hooks), and its `claude` target emits `CLAUDE.md` and `.claude/commands` / `.claude/agents` / `.claude/skills` (plus hooks and rules). In APM's own vocabulary, "workflow" means a `.prompt.md` slash-command — which is a different thing entirely, unrelated to Claude Code dynamic workflows.

So `do-wf.js` is a hand-placed file, and it **survives `apm install`**: the install cleanup only removes APM-*generated* orphans, never files you placed by hand. This repo's own ignore rules make the same distinction concrete — `.claude/agents/` and `.claude/skills/` are gitignored (APM regenerates them), but `.claude/workflows/do-wf.js` is *not* ignored and is committed directly. If agency ever wants to ship `do-wf` through APM rather than by hand, that needs an upstream APM `workflows` primitive first.

### Configure

`do-wf` reads the **same** `.agency/do.md` that `/do` reads. Add the sections for the steps you want to run:

```markdown
# /do config

## Check command
just check

## Format command
just fmt

## Test command
just test

## CI command
just ci

## Documentation
Keep README.md in sync with user-facing changes.

## PR evidence
For every PR that touches the UI:

1. Use the `chrome-devtools` MCP to launch `npm run dev` and navigate to the affected route.
2. Capture a screenshot of the new state and upload it via `gh api` to the repo's release-asset endpoint.
3. Embed the resulting URL inline in the PR comment under `## Evidence`.
```

`## Check command`, `## Format command`, `## Test command`, `## CI command`, and `## Documentation` each gate their step; `## PR evidence` is optional and opts into the evidence step. **Any step whose command isn't configured self-skips** with a recorded reason — there's no failure for a gate you didn't ask for. (The agency repo itself has no `.agency/` directory, which is why a `do-wf` run *against agency* — like the one that produced this page — self-skips check/fmt/test/ci/docs/evidence.)

### Requirements for full fidelity

The review, PR, and police steps lean on agency skills/agents that must be installed via `apm install`:

- `hickey` and `lowy` (subagents) for the structural review step,
- `forge-pr` for the PR title/body,
- `code-police` for the quality gate.

Without them, those steps **degrade gracefully**. The review step tries the dedicated `hickey`/`lowy` subagent first, then falls back to a default agent that loads the same-named *skill* (so it still runs in repos that ship the skills but haven't registered the agents — e.g. a fresh checkout where the agent registry was fixed before `apm install` ran), and only if neither is present does it yield no findings rather than crashing. Likewise, if `code-police` is missing the police step falls back to running its three passes manually, and the PR step still opens a draft without the `forge-pr` polish.

### Run

```
/do-wf "<issue-url | prompt>"
```

Flags:

- `--review` — stop after **research** and return the plan, then re-run `/do-wf --from implement "<task>"` to continue. The runtime cannot pause for approval mid-run, so plan approval is staged as two separate runs.
- `--no-git` — extend the working tree in place: no branch, commit, or PR. Git-mutating steps (branch, commit, create-pr) skip.
- `--minimal` — skip docs, structural review, police, and evidence on trivially-scoped diffs.
- `--from <step>` — start at a specific step. Entry-point aliases (mirroring the skill's Entry Points table): `followup` → implement, `post-implement` → fmt, `polish` → review, `ci-only` → ci. `sync` always runs first regardless, because a fresh workflow process needs forge and branch context even when the entry point is later.

Watch progress with `/workflows` — that native phase view (Sync, Research, Branch, …, Done) is the workflow's live status display.

## How the port differs from the /do skill, and why

The runtime model forces a few deliberate deviations from the skill. Each is a tradeoff, not a regression:

1. **No mid-run user input.** The runtime can't pause for `AskUserQuestion` / `EnterPlanMode`, so `--review` runs sync + research, *stops*, and returns the plan; you approve by re-running with `--from implement`. This is the documented "run each stage as its own workflow" pattern.

2. **No stop hook / `.do-results.json` `active` field.** In the skill a Stop hook reads `.do-results.json` to keep the main loop from quitting between steps. The workflow doesn't need that machinery — background execution plus resume *is* the "don't stop" guarantee. Worse, a stale `active: working` file left behind by a workflow run would wrongly block the *main* session's own Stop hook, so `do-wf` drops the file entirely and keeps timing in script variables, posting it as the final PR comment instead.

3. **No `TaskCreate` todo UI.** The skill drives Claude Code's native todo checklist with `TaskCreate`. The workflow replaces it with the native `/workflows` phase view.

4. **Per-step retry loops instead of "retry from done".** The skill's safety net is to retry failing steps from the `done` step. The workflow holds the loop directly — `loopStep` retries each step in place against a per-step budget, which reaches the same end and matches the workflow idiom.

Everything else is preserved: step order, the gates, the test-first rule, the post-implement hickey+lowy review with cross-validation, one-commit-per-finding, forge-awareness, `--no-git`, `--minimal`, `--from`, the completion criteria, and the final timing table.

## This PR

This page was itself produced by running `/do-wf`. The workflow researched the repo, wrote this doc, ran the hickey+lowy review on the diff, and opened the PR — a self-demonstration of the dynamic workflow it documents.
