# workflow.ncl — /do workflow engine
#
# Three boundaries:
#   Sequence: this file (step order, skip rules, pattern configs)
#   State:    .do-results.json managed by scripts/do-results (bash + jq)
#   Activity: nodes/*.md (what each step does)
#
# Agent interaction (via scripts/nickel-cli wrapper):
#   scripts/nickel-cli cli          → { step, skip, pattern, ... }
#   scripts/nickel-cli cli_seed ""  → [{ name, initial_status }]
#
# Direct invocation (stdin expression):
#   cat <<'NICKEL' | nickel eval --stdin-format nickel --import-path .
#   let workflow = import ".apm/skills/do/workflow.ncl" in
#   let state = workflow.normalize_state (import ".do-results.json") in
#   workflow.cli state
#   NICKEL
{
  # ── Pattern configs (flat, no inheritance) ─────────────────────────────────

  CheckLoopDefault = {
    max_attempts = 3,
    flaky_classification = false,
    flaky_budget = 0,
    loop_artifacts = 'none,
    coverage_check = false,
    rerun_on_new_commit = false,
  },

  PatternConfigs = {
    check = CheckLoopDefault,
    docs = CheckLoopDefault,
    test = {
      max_attempts = 4,
      flaky_classification = false,
      flaky_budget = 0,
      loop_artifacts = 'commit-per-fix,
      coverage_check = true,
      rerun_on_new_commit = false,
    },
    ci = {
      max_attempts = 5,
      flaky_classification = true,
      flaky_budget = 3,
      loop_artifacts = 'commit-per-fix,
      coverage_check = false,
      rerun_on_new_commit = true,
    },
    police = {
      max_attempts = 3,
      flaky_classification = false,
      flaky_budget = 0,
      loop_artifacts = 'commit-per-fix,
      coverage_check = false,
      rerun_on_new_commit = false,
    },
    hickey-lowy = {
      cross_validate = true,
    },
  },

  # ── State contract ──────────────────────────────────────────────────────────
  # Contract for workflow state, accepting both JSON strings and Nickel tags.
  # std.enum.TagOrString converts "github" → 'github at contract application.
  # The contract is open (..) to allow extra fields from bash driver.

  State = fun raw =>
    raw
      | {
        steps | Array { name | String, status | std.enum.TagOrString, .. },
        forge | std.enum.TagOrString,
        noGit | Bool,
        minimal | Bool,
        review | Bool | default = false,
        has_evidence | Bool | default = false,
        task | String | default = "",
        active | String | default = "idle",
        status | std.enum.TagOrString | default = 'idle,
        ..
      },

  # Normalize imported JSON to State contract.
  # Usage: normalize_state (import ".do-results.json")
  normalize_state | not_exported = State,

  # ── Step definitions ───────────────────────────────────────────────────────
  # Each step: { pattern, next, skip_when, requires, instructions }
  #   pattern:      which retry/parallel shape to use
  #   next:         static string or function(state) → next step name
  #   skip_when:    function(state) → Bool
  #   requires:     data this step needs from prior steps (declarative)
  #   instructions: path to node file

  Steps = {
    sync = {
      pattern = 'one-shot,
      next = "research",
      skip_when | not_exported = fun state => false,
      requires = [],
      instructions = "nodes/sync.md",
    },

    research = {
      pattern = 'one-shot,
      next | not_exported = fun state =>
        if state.review then "plan-approval" else "branch",
      skip_when | not_exported = fun state => false,
      requires = ["forge"],
      instructions = "nodes/research.md",
    },

    plan-approval = {
      pattern = 'one-shot,
      next = "branch",
      skip_when | not_exported = fun state => !state.review,
      requires = ["research.plan"],
      instructions = "nodes/plan-approval.md",
    },

    branch = {
      pattern = 'one-shot,
      next = "implement",
      skip_when | not_exported = fun state => state.noGit,
      requires = ["sync.defaultBranch"],
      instructions = "nodes/branch.md",
    },

    implement = {
      pattern = 'one-shot,
      next = "check",
      skip_when | not_exported = fun state => false,
      requires = ["research.plan"],
      instructions = "nodes/implement.md",
    },

    check = {
      pattern = 'check-loop,
      next | not_exported = fun state =>
        if state.minimal then "fmt" else "docs",
      skip_when | not_exported = fun state => false,
      requires = [],
      instructions = "nodes/check.md",
    },

    docs = {
      pattern = 'check-loop,
      next = "fmt",
      skip_when | not_exported = fun state => state.minimal,
      requires = [],
      instructions = "nodes/docs.md",
    },

    fmt = {
      pattern = 'one-shot,
      next | not_exported = fun state =>
        if state.noGit then "hickey-lowy" else "commit",
      skip_when | not_exported = fun state => false,
      requires = [],
      instructions = "nodes/fmt.md",
    },

    commit = {
      pattern = 'one-shot,
      next = "hickey-lowy",
      skip_when | not_exported = fun state => state.noGit,
      requires = [],
      instructions = "nodes/commit.md",
    },

    hickey-lowy = {
      pattern = 'fanout-fix,
      next = "police",
      skip_when | not_exported = fun state => state.minimal,
      requires = ["diff", "research.context"],
      instructions = "nodes/hickey-lowy.md",
    },

    police = {
      pattern = 'check-loop,
      next = "test",
      skip_when | not_exported = fun state => state.minimal,
      requires = ["diff"],
      instructions = "nodes/police.md",
    },

    test = {
      pattern = 'check-loop,
      next = "create-pr",
      skip_when | not_exported = fun state => false,
      requires = [],
      instructions = "nodes/test.md",
    },

    create-pr = {
      pattern = 'one-shot,
      next = "ci",
      skip_when | not_exported = fun state =>
        state.noGit || state.forge != 'github,
      requires = ["forge"],
      instructions = "nodes/create-pr.md",
    },

    ci = {
      pattern = 'check-loop,
      next = "evidence",
      skip_when | not_exported = fun state => false,
      requires = [],
      instructions = "nodes/ci.md",
    },

    evidence = {
      pattern = 'one-shot,
      next = "done",
      skip_when | not_exported = fun state => !state.has_evidence,
      requires = ["forge"],
      instructions = "nodes/evidence.md",
    },

    done = {
      pattern = 'one-shot,
      next = "",
      skip_when | not_exported = fun state => false,
      requires = [],
      instructions = "nodes/done.md",
    },
  },

  # ── Ordered step list (for seeding todo UI) ────────────────────────────────

  StepOrder = [
    "sync",
    "research",
    "plan-approval",
    "branch",
    "implement",
    "check",
    "docs",
    "fmt",
    "commit",
    "hickey-lowy",
    "police",
    "test",
    "create-pr",
    "ci",
    "evidence",
    "done",
  ],

  # ── Entry points ───────────────────────────────────────────────────────────

  EntryPoints = {
    default = "sync",
    followup = "implement",
    post-implement = "fmt",
    polish = "hickey-lowy",
    ci-only = "ci",
  },

  # ── Minimal skips (omitted from todo list entirely) ────────────────────────

  MinimalSkips = ["docs", "hickey-lowy", "police", "evidence"],

  # ── Helper functions ───────────────────────────────────────────────────────

  # Get last element of array, or fallback
  get_last | not_exported = fun arr fallback =>
    if std.array.length arr == 0 then
      fallback
    else
      std.array.last arr,

  # Check if a step should be skipped given current state
  should_skip
    | not_exported
    | doc m%"
    Returns whether a step's `skip_when` predicate fires for the given state.

    ## Examples

    ```nickel
    should_skip "branch" { active = true, status = 'running, steps = [], noGit = true, minimal = false, review = false, forge = 'github, has_evidence = false, task = "test" }
    # => true

    should_skip "docs" { active = true, status = 'running, steps = [], noGit = false, minimal = true, review = false, forge = 'github, has_evidence = false, task = "test" }
    # => true

    should_skip "create-pr" { active = true, status = 'running, steps = [], noGit = false, minimal = false, review = false, forge = 'bitbucket, has_evidence = false, task = "test" }
    # => true

    should_skip "evidence" _test_state
    # => true

    should_skip "ci" { active = true, status = 'running, steps = [], noGit = true, minimal = false, review = false, forge = 'github, has_evidence = false, task = "test" }
    # => false
    ```
  "%
    = fun step_name state =>
      let step_def = Steps."%{step_name}" in
      step_def.skip_when state,

  # Get next step name (resolves function or returns static string)
  get_next
    | not_exported
    | doc m%"
    Returns the next step name after the given step, resolving dynamic transitions.

    ## Examples

    ```nickel
    get_next "check" { active = true, status = 'running, steps = [], noGit = false, minimal = true, review = false, forge = 'github, has_evidence = false, task = "test" }
    # => "fmt"

    get_next "research" { active = true, status = 'running, steps = [], noGit = false, minimal = false, review = true, forge = 'github, has_evidence = false, task = "test" }
    # => "plan-approval"

    get_next "fmt" { active = true, status = 'running, steps = [], noGit = true, minimal = false, review = false, forge = 'github, has_evidence = false, task = "test" }
    # => "hickey-lowy"
    ```
  "%
    = fun step_name state =>
      let step_def = Steps."%{step_name}" in
      if std.is_function step_def.next then
        step_def.next state
      else
        step_def.next,

  # Compute the next step to run given current state
  compute_next | not_exported = fun state =>
    let last_step = get_last state.steps { name = "", status = 'pending } in
    if last_step.status == 'failed then
      "done"
    else if last_step.name == "" then
      "sync"
    else
      get_next last_step.name state,

  # Resolve entry point ID to starting step.
  # Unknown entry points default to EntryPoints.default ("sync").
  # This is intentional: the CLI has a fixed set of entry points documented
  # in SKILL.md's argument-hint, and invalid values start from sync.
  resolve_entry
    | not_exported
    | doc m%"
    Maps an entry point ID to its starting step name.
    Unknown entry points default to 'sync'.

    ## Examples

    ```nickel
    resolve_entry "followup"
    # => "implement"

    resolve_entry "polish"
    # => "hickey-lowy"

    resolve_entry "ci-only"
    # => "ci"

    resolve_entry "invalid"
    # => "sync"
    ```
  "%
    = fun from =>
      if from == "" || from == null then
        EntryPoints.default
      else
        let ep = EntryPoints."%{from}" in
        if ep == null then EntryPoints.default else ep,

  # Seed the step list for todo UI given a --from entry point and state.
  # Returns: [{ name, initial_status }]
  #   initial_status: 'completed for pre-steps, 'pending for the rest
  #   --minimal steps are omitted entirely
  seed_steps | not_exported = fun from state =>
    let start = resolve_entry from in
    (
      std.array.fold_left
        (fun acc step_name =>
          let is_start = step_name == start in
          let is_minimal = std.array.any (fun s => s == step_name) MinimalSkips in
          let now_reached = acc.reached || is_start in
          if is_minimal && !is_start then
            { list = acc.list, reached = now_reached }
          else
            {
              list =
                acc.list
                @ [
                  {
                    name = step_name,
                    initial_status = if !acc.reached && !is_start then 'completed else 'pending,
                  }
                ],
              reached = now_reached,
            }
        )
        { list = [], reached = false }
        StepOrder
    ).list,

  # ── CLI output ─────────────────────────────────────────────────────────────
  # Called by the agent: nickel eval workflow.ncl --field cli --arg "$state_json"
  # Returns: { step, skip, pattern, instructions, requires, pattern_config }
  #   or { done = true } when workflow is complete

  cli
    | not_exported
    | doc m%"
    Returns the next step to execute given current state.

    ## Examples

    ```nickel multiline
    cli _test_state
    # => { step = "sync", skip = false, pattern = 'one-shot, instructions = "nodes/sync.md", requires = [], pattern_config = {} }

    cli { active = true, status = 'running, steps = [{ name = "sync", status = 'passed }], noGit = false, minimal = false, review = false, forge = 'github, has_evidence = false, task = "test" }
    # => { step = "research", skip = false, pattern = 'one-shot, instructions = "nodes/research.md", requires = ["forge"], pattern_config = {} }
    ```
  "%
    = fun state =>
      let next_step = compute_next state in
      if next_step == "" then
        { done = true }
      else
        let step_def = Steps."%{next_step}" in
        let skip_val = step_def.skip_when state in
        let pconfig =
          if step_def.pattern == 'check-loop || step_def.pattern == 'fanout-fix then
            PatternConfigs."%{next_step}"
          else
            {}
        in
        {
          step = next_step,
          skip = skip_val,
          pattern = step_def.pattern,
          instructions = step_def.instructions,
          requires = step_def.requires,
          pattern_config = pconfig,
        },

  # ── Seed CLI: returns the full step list for todo UI initialization ────────

  cli_seed
    | not_exported
    | doc m%"
    Returns the seeded step list for todo UI initialization.

    ## Examples

    ```nickel multiline
    cli_seed "" _test_state
    # => [{ name = "sync", initial_status = 'pending }, { name = "research", initial_status = 'pending }, { name = "plan-approval", initial_status = 'pending }, { name = "branch", initial_status = 'pending }, { name = "implement", initial_status = 'pending }, { name = "check", initial_status = 'pending }, { name = "fmt", initial_status = 'pending }, { name = "commit", initial_status = 'pending }, { name = "test", initial_status = 'pending }, { name = "create-pr", initial_status = 'pending }, { name = "ci", initial_status = 'pending }, { name = "done", initial_status = 'pending }]

    cli_seed "followup" _test_state
    # => [{ name = "sync", initial_status = 'completed }, { name = "research", initial_status = 'completed }, { name = "plan-approval", initial_status = 'completed }, { name = "branch", initial_status = 'completed }, { name = "implement", initial_status = 'pending }, { name = "check", initial_status = 'pending }, { name = "fmt", initial_status = 'pending }, { name = "commit", initial_status = 'pending }, { name = "test", initial_status = 'pending }, { name = "create-pr", initial_status = 'pending }, { name = "ci", initial_status = 'pending }, { name = "done", initial_status = 'pending }]

    cli_seed "polish" _test_state
    # => [{ name = "sync", initial_status = 'completed }, { name = "research", initial_status = 'completed }, { name = "plan-approval", initial_status = 'completed }, { name = "branch", initial_status = 'completed }, { name = "implement", initial_status = 'completed }, { name = "check", initial_status = 'completed }, { name = "fmt", initial_status = 'completed }, { name = "commit", initial_status = 'completed }, { name = "hickey-lowy", initial_status = 'pending }, { name = "test", initial_status = 'pending }, { name = "create-pr", initial_status = 'pending }, { name = "ci", initial_status = 'pending }, { name = "done", initial_status = 'pending }]
    ```
  "%
    = fun from state =>
      seed_steps from state,

  # ── Test fixtures ──────────────────────────────────────────────────────────

  # Default state for doc tests
  _test_state = {
    active = true,
    status = 'running,
    steps = [],
    noGit = false,
    minimal = false,
    review = false,
    forge = 'github,
    has_evidence = false,
    task = "test",
  },
}
