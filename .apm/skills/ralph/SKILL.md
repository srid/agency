---
name: ralph
description: Iterative measurement-driven improvement loop. Measure, profile, mutate, re-measure, commit. Works for performance, bundle size, complexity, test coverage — anything quantifiable. Use when the user wants to systematically improve a metric through repeated cycles of profiling and targeted changes.
---

# Ralph

Iterative measurement-driven improvement loop. Each cycle: measure, profile the breakdown, find the biggest contributor, mutate, re-measure, commit only if the improvement exceeds noise.

Named after the pattern: **R**esearch **A**nd **L**oop **P**rofiling **H**euristics.

## 0. Gather inputs

Use `AskUserQuestion` to collect:

1. **What to improve** — the target metric and direction (e.g., "make `nix develop` faster", "reduce bundle size below 500KB", "improve lighthouse score to 95+")
2. **How to measure** — the command or method. If the user doesn't know, research and propose one.
3. **How many cycles** — default 20
4. **Constraints** — what must NOT change (e.g., "no behavioural changes", "don't remove features")

## 1. Setup

### Branch & PR

Create a feature branch and open a **draft PR** early. The PR is the home for measurements and the report file — open it before doing any work.

Load the `forge-pr` skill before writing the PR title/body. The PR description should include a measurements table (populated with baseline, updated as cycles complete).

### Baseline measurement

Measure the target metric **scientifically**:

- Run the measurement command **at least 5 times**
- Report the **median** (not mean — outliers skew means)
- For time measurements: distinguish **cold** (no cache) from **hot** (cached) where applicable
- Document the methodology (what command, what machine state, how cold/hot is defined)

### Report file

Create `docs/<target>-ralph-report.md` (e.g., `docs/nix-eval-perf-ralph-report.md`) with:

- Baseline measurements
- Methodology section
- Optimization log table (populated as cycles complete)
- Findings section (populated as investigations conclude)

### Task tracking

Seed a `TaskCreate` list with N cycle tasks. Update each to `in_progress` when starting, `completed` when done.

## 2. The loop

For each cycle:

### 2a. Profile

Break down the metric into components. Find where the time/size/cost comes from. Use whatever tools are appropriate:

- **Time**: measure individual phases, components, imports, function calls
- **Size**: analyze dependency tree, find largest contributors
- **Complexity**: count per-module, per-function
- **Coverage**: identify untested paths

**Be scientific.** Measure each component independently with multiple runs. Don't guess — measure.

### 2b. Classify

Categorize the biggest contributor:

- Unnecessary dependency (pulled in but not needed)
- Eager evaluation (computed but not used)
- Redundant work (done twice, or done when cached result exists)
- Wrong abstraction (heavyweight tool for simple job)
- Missing cache (recomputed on every invocation)
- Structural overhead (inherent cost of the architecture)

### 2c. Mutate

Apply a **single, targeted change** that addresses the biggest contributor. Keep changes minimal and reversible.

### 2d. Re-measure

Run the same benchmark as baseline with the same methodology. Compare median values.

**Noise threshold**: if the improvement is within measurement noise (typically <3% for time measurements), the change is **not worth committing** for its performance value. Document the finding in the report but do not commit. If the change is a worthwhile architectural cleanup, commit it separately without performance claims.

### 2e. Commit & push

Only if the improvement exceeds noise:

- `git add` changed files + report file
- Commit with metrics in the message: `perf: <what changed>\n\nMeasurements (median of N runs):\n  <metric>: <before> -> <after> (<delta>)`
- `git push`

### 2f. Update report

Append a row to the optimization log table in the report file. Include:

- Cycle number
- Short commit hash
- What changed
- Before/after metric values
- Delta

For cycles with no improvement, add to the "Investigated but no improvement" section instead.

## 3. Wrap-up

After all cycles (or when diminishing returns are reached):

### Final measurement

Run the full benchmark one last time with the same methodology as baseline. This is the **final number** that goes in the PR.

### Update PR description

Update the PR description with:

- Final before/after measurements table
- Summary of each change and its impact
- Key findings (what was expensive, what didn't help, irreducible floor)

### Update report

Ensure the report file has:

- Complete optimization log
- "Investigated but no improvement" section with all dead ends
- "Key findings" section with insights
- Cost breakdown (where the metric comes from after optimization)

### Run CI

Read the project's instructions to find the CI command. Run it to verify nothing is broken.

## Rules

- **Facts over opinions.** Measure everything. Don't commit changes based on theory alone.
- **One change per cycle.** Isolate variables so you know what helped.
- **Only commit improvements.** Noise-level changes clutter the history.
- **Preserve behaviour.** Unless the user explicitly allows it, all changes must be behaviour-preserving. Run tests after each mutation.
- **Document dead ends.** A finding of "X doesn't help" is valuable — record it so nobody wastes time re-investigating.
- **Stop at diminishing returns.** If 3 consecutive cycles show no improvement, the remaining overhead is likely irreducible. Tell the user and stop early rather than churning.
- **Keep the report.** The `.md` file is a deliverable — it's useful for blog posts, documentation, and future reference.
