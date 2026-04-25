---
name: agency-setup
description: Bootstrap or update srid/agency in this project — run apm via uvx, configure apm.yml, install skills, draft workflow instructions. Use for first-time setup or to refresh an existing install.
argument-hint: "[--update]"
---

# Agency Setup

Configure (or refresh) this repo to use [srid/agency](https://github.com/srid/agency). Each step below is **idempotent** — it inspects what's already on disk and acts only on what's missing or out of date. The skill works equally well as first-time bootstrap, full refresh, or **partial-install upgrade** (e.g. user already added `srid/agency` to `apm.yml` manually but never created `workflow.instructions.md` — the skill detects the gap and fills it without re-doing the parts that already exist).

Don't commit anything — leave changes staged for the user to review.

## The `--update` flag

`--update` in `ARGUMENTS` is the only explicit mode hint, and it does exactly one thing: re-pin the `srid/agency` ref in `apm.yml` to `#master` (in case the user pinned it to an older tag/sha and wants to move forward). **Every other step runs unconditionally** — they each decide for themselves whether they have work to do.

Strip the flag before treating the rest as additional context.

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

If `apm.yml` already exists, edit it idempotently:

- If `dependencies.apm:` is missing the `srid/agency` entry, append `srid/agency#master`. Preserve every existing entry. If the `dependencies.apm:` block itself is missing, add it.
- If `targets:` is missing or doesn't include the detected host, add the host. Don't remove existing targets.
- If `--update` was passed explicitly **and** `srid/agency` is already pinned to something other than `#master`, re-pin it to `#master`. Without the flag, leave the existing pin alone.

Don't touch unrelated entries.

## 4. Run `apm install`

Run `<apm-invocation> install` from the directory containing `apm.yml`. `apm` reads `targets:` from the yml and generates `.claude/` / `.opencode/` / `.codex/` accordingly, plus adds `apm_modules/` to `.gitignore`.

If install fails, surface the error verbatim and stop — don't paper over it.

## 5. Ensure `.gitignore` covers agency runtime artifacts

`apm install` adds `apm_modules/` for you, but `do` writes `.do-results.json` at the repo root during a workflow run and that should not be committed. Make sure both lines exist in `.gitignore` (create the file if missing), idempotently — don't duplicate entries that are already there:

- `/.do-results.json`
- `/apm_modules/` (verify; `apm install` may already have added it as `apm_modules/` — either form is fine)

## 6. Draft `.apm/instructions/workflow.instructions.md`

If this file already exists, **leave it alone** — the user has either already configured it or is intentionally hand-maintaining it. Skip to step 7.

If it's missing (whether this is a first-time setup or an upgrade where the user added `srid/agency` to `apm.yml` themselves but never wrote workflow instructions), create it now.

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
5. **Optional instructions to consider adding** — list whichever of these files do **not** yet exist under `.apm/instructions/`, and explain briefly what each is for. They're project-specific and can't be auto-generated, but the user should know they exist so they can layer them on:
   - `code-police-rules.instructions.md` — project-specific quality rules checked alongside the built-in `code-police` rules.
   - `hickey-catalog.instructions.md` — project-specific complecting patterns extending the Hickey Layer 4 catalog.
   - `lowy-volatilities.instructions.md` — project-declared areas of volatility used by the Lowy review pass.

   Point them at [Kolu's `.apm/instructions/`](https://github.com/juspay/kolu/tree/master/.apm/instructions) as a worked example. Skip files that already exist.
6. **Restart the agent CLI** (Claude Code, Codex, opencode, etc.) so it picks up the newly generated skills — without a restart, the new skills won't be available in the running session.
7. After restart, try `talk` or `do` to verify everything works. Tell the user the **exact** invocation syntax for the target(s) you installed for — don't make them guess:
   - **Claude Code** → `/talk <question>` and `/do <task>` (slash commands).
   - **Codex** → `$talk <question>` and `$do <task>` (dollar prefix).
   - **opencode** → invoke `/skills` and pick `talk` or `do` from the list.

   If you installed for multiple targets, list the syntax for each.

ARGUMENTS: $ARGUMENTS
