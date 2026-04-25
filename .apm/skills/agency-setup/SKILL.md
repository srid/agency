---
name: agency-setup
description: Bootstrap or update srid/agency in this project — run apm via uvx, configure apm.yml, install skills, draft workflow instructions. Use for first-time setup or to refresh an existing install.
argument-hint: "[--update]"
---

# Agency Setup

Configure (or refresh) this repo to use [srid/agency](https://github.com/srid/agency). Detect what state the project is in and do the right thing — first-time bootstrap vs. refreshing an existing install.

This skill is **idempotent** and safe to re-run. Don't commit anything — leave changes staged for the user to review.

## Modes

Detect the mode from repo state — **don't require the user to pass a flag**. The Quickstart prompt is the same for first-time setup and updates; users who paste it again after install expect it to refresh, not start over.

- **First-time setup** — `apm.yml` is missing, or it exists but has no `srid/agency` entry under `dependencies.apm:`.
- **Update** — `apm.yml` already pins `srid/agency`. Skip steps that would clobber the user's existing config; just refresh.

`--update` in `ARGUMENTS` is an explicit hint that **also** requests bumping the `srid/agency` ref back to `#master` (in case the user pinned it to a tag/sha and wants to move forward). Without the flag, leave the existing pin alone in update mode. Strip the flag before treating the rest as additional context.

## 1. Pick an `apm` invocation

`apm` does not need to be installed — run it through `uvx`. Try in order, stopping at the first that works:

1. `uvx --from apm-cli apm --version`
2. `nix shell nixpkgs#uv -c uvx --from apm-cli apm --version`

If neither works (no `uvx` and no `nix`), tell the user to install one of [`uv`](https://docs.astral.sh/uv/) or [`nix`](https://nixos.asia/en/install) and stop. Don't try to install package managers yourself.

Use whichever prefix succeeded as the `apm` invocation for every subsequent `apm` call in this run (e.g., `uvx --from apm-cli apm install`).

## 2. Detect the host targets

The host targets go into `apm.yml` as a `targets:` list (next step) — `apm install` reads them, no `-t` flag needed. Detect from what's already on disk and the host you're running in:

- `.claude/` exists, or you're running in Claude Code → `claude`
- `.opencode/` exists, or you're running in opencode → `opencode`
- `.codex/` exists, or you're running in Codex → `codex`

Multiple matches are fine — declare all of them. If nothing matches and the host you're in isn't one of the three, use `AskUserQuestion` to confirm. Do **not** guess silently — installing for the wrong target wastes a round trip.

## 3. Create or extend `apm.yml`

If `apm.yml` does not exist, write:

```yaml
name: <repo-directory-name>
version: 1.0.0
type: hybrid

targets:
  - <detected-target>

dependencies:
  apm:
    - srid/agency#master
```

If `apm.yml` already exists:

- In **first-time** mode: append `srid/agency#master` to `dependencies.apm:`, preserving every existing entry. If `dependencies.apm:` doesn't exist, add it. If `targets:` is missing or doesn't include the detected host, add the host to it (don't remove existing targets).
- In **update** mode: leave `apm.yml` alone unless `--update` was passed explicitly — in that case, re-pin the `srid/agency` line to `#master`. Don't touch other entries.

## 4. Run `apm install`

Run `<apm-invocation> install` from the directory containing `apm.yml`. `apm` reads `targets:` from the yml and generates `.claude/` / `.opencode/` / `.codex/` accordingly, plus adds `apm_modules/` to `.gitignore`.

If install fails, surface the error verbatim and stop — don't paper over it.

## 5. Ensure `.gitignore` covers agency runtime artifacts

`apm install` adds `apm_modules/` for you, but `do` writes `.do-results.json` at the repo root during a workflow run and that should not be committed. Make sure both lines exist in `.gitignore` (create the file if missing), idempotently — don't duplicate entries that are already there:

- `/.do-results.json`
- `/apm_modules/` (verify; `apm install` may already have added it as `apm_modules/` — either form is fine)

## 6. Draft `.apm/instructions/workflow.instructions.md`

Skip this step in **update** mode if the file already exists.

`do` runs autonomously but needs to know your project's check, format, test, and CI commands. Inspect the project to figure them out — look at:

- `package.json` `scripts:` (Node)
- `justfile` (just)
- `Makefile`
- `Cargo.toml`, `flake.nix`, `pyproject.toml`
- `.github/workflows/` for CI hints

For each of the four sections (Check, Format, Test, CI), there are three possible outcomes:

- **Found a clear command** in the project → fill it in.
- **Found a plausible command but you're not certain** → use `AskUserQuestion` to confirm. Offer the candidate as one option and "skip this section" as another, with a free-form fallback for the user to type a different command.
- **Found nothing** → use `AskUserQuestion` to ask the user directly. Always include a "skip this section" option so they can explicitly discard it. Don't fabricate commands.

Sections the user discards are **omitted from the generated file entirely** — no `# TODO` placeholders. `do` already handles missing sections by skipping the corresponding step with a note, which is the right behavior for a section the user has consciously declined.

Final file uses this template, including only the sections the user kept:

```markdown
---
description: Workflow commands for the do pipeline
applyTo: "**"
---

## Check command
<command>

## Format command
<command>

## Test command
<command>

## CI command
<command>

## Documentation
Keep `README.md` in sync with user-facing changes.
```

After writing this file, **re-run `apm install`** so the new instructions get picked up by the generated host config.

## 7. Report back

Summarize for the user, in this order:

1. Which `apm` invocation you used (so the user knows the exact command for ad-hoc `apm` calls later).
2. Which `targets:` ended up in `apm.yml`.
3. Which workflow sections were filled in (and from where) versus skipped at the user's request.
4. Files changed (staged, not committed). Tell them to review the diff before committing.
5. **Restart the agent CLI** (Claude Code, Codex, opencode, etc.) so it picks up the newly generated skills — without a restart, `/talk` and `/do` won't be available in the running session.
6. After restart, try `/talk <question>` or `/do <task>` to verify everything works.

ARGUMENTS: $ARGUMENTS
