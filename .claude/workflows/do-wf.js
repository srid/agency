export const meta = {
  name: 'do-wf',
  description: 'Run the agency /do pipeline (research → implement → hickey+lowy review → quality gates → CI → PR) as a dynamic workflow',
  whenToUse:
    'Autonomous, end-to-end task delivery: implement a change, run structural review (hickey+lowy) and quality gates, pass CI, and open a PR. A workflow port of the /do skill. Args: "<issue-url | prompt> [--review] [--no-git] [--minimal] [--from <step>]".',
  phases: [
    { title: 'Sync', detail: 'fetch origin, fast-forward, detect forge' },
    { title: 'Research', detail: 'understand the task against the codebase' },
    { title: 'Branch', detail: 'create a feature branch (runs concurrently with research)' },
    { title: 'Implement', detail: 'write the change (test-first where applicable)' },
    { title: 'Check', detail: 'static-correctness gate (retries)' },
    { title: 'Docs', detail: 'keep documentation in sync' },
    { title: 'Format', detail: 'run the formatter' },
    { title: 'Commit', detail: 'commit + push the primary feature work' },
    { title: 'Review', detail: 'hickey+lowy review — detection fans out with police+test' },
    { title: 'Police', detail: 'code-police detection (parallel) → serial fixes' },
    { title: 'Test', detail: 'test run (parallel) → serial fixes' },
    { title: 'Revalidate', detail: 're-run check/test after parallel-detected fixes land' },
    { title: 'Create PR', detail: 'open draft PR, post hickey/lowy findings ledger' },
    { title: 'CI', detail: 'run CI against HEAD, fix failures (retries)' },
    { title: 'Evidence', detail: 'opt-in PR evidence capture' },
    { title: 'Done', detail: 'timing table + optimization suggestions + PR comment' },
  ],
}

// ---------------------------------------------------------------------------
// /do as a dynamic workflow
//
// A faithful port of .apm/skills/do/SKILL.md to the workflow runtime. The
// mechanics differ from the skill in ways the runtime model forces:
//
//   1. No mid-run user input. The runtime cannot pause for AskUserQuestion /
//      EnterPlanMode, so --review runs sync+research, then STOPS and returns
//      the plan; re-run with `--from implement` once you approve. (This is the
//      documented "run each stage as its own workflow" pattern.)
//
//   2. No stop hook / .do-results.json `active` field. In the skill a Stop hook
//      keeps the main loop from quitting between steps. Here the runtime runs
//      to completion in the background and is resumable, so that machinery is
//      unnecessary — and a stale `active:working` file would wrongly block the
//      *main* session's Stop hook. Timing lives in script variables and is
//      posted as the final PR comment instead.
//
//   3. No TaskCreate todo UI. The native `/workflows` phase view is the
//      progress display.
//
//   4. Retries are per-step (the script holds the loop, see loopStep) rather
//      than the skill's "retry from done" net — failures are retried in place,
//      which is the same end and matches the workflow idiom. sync/research/
//      implement abort the run on hard failure instead of being retried blindly
//      (re-running an implementer over a half-applied diff is unsafe; resume
//      with `--from implement`).
//
// Everything else — step order, gates, test-first rule, post-implement
// hickey+lowy review with cross-validation, one-commit-per-finding, forge-
// awareness, --no-git, --minimal, --from, completion criteria, and the final
// timing table — is preserved. The script holds control flow; agents do all
// filesystem/git/shell work (the script itself cannot touch disk).
//
// SYNC CONTRACT: each step's agent prompt below mirrors the correspondingly-
// named section of .apm/skills/do/SKILL.md (its only canonical home — there are
// no per-step skills for research/implement/check/etc. to defer to). When that
// skill's step methodology changes, update the matching prompt here in lockstep,
// the same way README.md and the landing page are kept in sync (see CLAUDE.md).
// ---------------------------------------------------------------------------

// ---- Argument parsing -----------------------------------------------------
const raw =
  typeof args === 'string'
    ? args
    : args && typeof args === 'object' && typeof args.task === 'string'
      ? args.task
      : ''

let s = ' ' + raw.trim() + ' '
const review = / --review /.test(s)
const noGit = / --no-git /.test(s)
const minimal = / --minimal /.test(s)
let fromArg = null
const fromMatch = s.match(/ --from\s+(\S+) /)
if (fromMatch) fromArg = fromMatch[1]
s = s
  .replace(/ --review /g, ' ')
  .replace(/ --no-git /g, ' ')
  .replace(/ --minimal /g, ' ')
  .replace(/ --from\s+\S+ /g, ' ')
const task = s.trim()

// Canonical step order. `review` is the hickey+lowy step.
const ORDER = [
  'sync', 'research', 'branch', 'implement', 'check', 'docs', 'fmt',
  'commit', 'review', 'police', 'test', 'create-pr', 'ci', 'evidence', 'done',
]

// --from entry-point aliases (mirrors the skill's Entry Points table).
const ENTRY = {
  default: 'sync',
  followup: 'implement',
  'post-implement': 'fmt',
  polish: 'review',
  'ci-only': 'ci',
}
const startStep = fromArg ? ENTRY[fromArg] || fromArg : 'sync'
const startIdx = ORDER.indexOf(startStep)
const fromIdx = startIdx >= 0 ? startIdx : 0
// sync always runs (a fresh workflow process needs forge/branch context even
// when --from points past it); every other step honors the entry point.
const shouldRun = (name) => name === 'sync' || ORDER.indexOf(name) >= fromIdx

// A task is mandatory unless we are resuming past implement via --from (where
// the existing branch/diff carries the scope).
if (!task && fromIdx <= ORDER.indexOf('implement')) {
  log('No task provided. Usage: /do-wf "<issue-url | prompt> [--review] [--no-git] [--minimal] [--from <step>]"')
  return { ok: false, stage: 'input', error: 'no task provided', results: [] }
}

log(
  `do-wf: task=${task ? JSON.stringify(task.slice(0, 80)) : '(none)'} ` +
    `review=${review} noGit=${noGit} minimal=${minimal} from=${startStep}`,
)

// ---- Schemas --------------------------------------------------------------
// Every agent reports timing by running `date -u +%s` at the start and end of
// its work; the script computes durations (integer arithmetic only — the
// runtime forbids the wall-clock-now API).
const TIMING_PROPS = {
  startedEpoch: { type: 'number', description: 'unix seconds from `date -u +%s` at step start' },
  endedEpoch: { type: 'number', description: 'unix seconds from `date -u +%s` at step end' },
}

const STEP = {
  type: 'object',
  additionalProperties: false,
  properties: {
    status: { type: 'string', enum: ['passed', 'failed', 'skipped'] },
    verification: { type: 'string', description: 'one line: what was verified' },
    reason: { type: 'string', description: 'required when status is skipped' },
    ...TIMING_PROPS,
  },
  required: ['status', 'verification', 'startedEpoch', 'endedEpoch'],
}

const SYNC = {
  type: 'object',
  additionalProperties: false,
  properties: {
    status: { type: 'string', enum: ['passed', 'failed'] },
    verification: { type: 'string' },
    forge: { type: 'string', enum: ['github', 'bitbucket', 'unknown'] },
    branch: { type: 'string' },
    defaultBranch: { type: 'string' },
    ...TIMING_PROPS,
  },
  required: ['status', 'verification', 'forge', 'branch', 'defaultBranch', 'startedEpoch', 'endedEpoch'],
}

const RESEARCH = {
  type: 'object',
  additionalProperties: false,
  properties: {
    status: { type: 'string', enum: ['passed', 'failed'] },
    verification: { type: 'string' },
    summary: { type: 'string', description: 'what needs to change and why' },
    approach: { type: 'string', description: 'the intended implementation approach' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          file: { type: 'string' },
          line: { type: 'string' },
          note: { type: 'string' },
        },
        required: ['file', 'note'],
      },
    },
    plan: { type: 'string', description: 'human-readable plan (used when --review)' },
    ...TIMING_PROPS,
  },
  required: ['status', 'verification', 'summary', 'approach', 'findings', 'startedEpoch', 'endedEpoch'],
}

const FINDINGS = {
  type: 'object',
  additionalProperties: false,
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          lens: { type: 'string', enum: ['hickey', 'lowy'] },
          label: { type: 'string', description: 'short bolded finding label' },
          detail: { type: 'string', description: 'the rationale prose' },
          disposition: { type: 'string', enum: ['fix', 'noop'], description: 'fix = Fix in this PR; noop = No-op. No Defer.' },
        },
        required: ['lens', 'label', 'detail', 'disposition'],
      },
    },
    rationale: { type: 'string', description: 'the full prose review for the PR comment' },
    status: { type: 'string', enum: ['passed', 'failed'], description: 'failed if the reviewer could not complete — distinguishes "no issues" from "review aborted"' },
    ...TIMING_PROPS,
  },
  required: ['findings', 'startedEpoch', 'endedEpoch'],
}

// Detection-only schemas for the parallel gate fan-out: police/test REPORT what
// they find without committing; the serial fix phase applies the changes.
const POLICE_DETECT = {
  type: 'object',
  additionalProperties: false,
  properties: {
    status: { type: 'string', enum: ['passed', 'failed', 'skipped'], description: 'passed = all clear; failed = violations found; skipped = docs-only / n/a' },
    verification: { type: 'string' },
    reason: { type: 'string' },
    violations: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          pass: { type: 'string', enum: ['rules', 'fact-check', 'elegance'] },
          label: { type: 'string' },
          detail: { type: 'string' },
        },
        required: ['pass', 'label'],
      },
    },
    ...TIMING_PROPS,
  },
  required: ['status', 'verification', 'violations', 'startedEpoch', 'endedEpoch'],
}

const TEST_DETECT = {
  type: 'object',
  additionalProperties: false,
  properties: {
    status: { type: 'string', enum: ['passed', 'failed', 'skipped'], description: 'passed = green + covered; failed = failures or coverage gap; skipped = no test command' },
    verification: { type: 'string' },
    reason: { type: 'string' },
    failures: { type: 'array', items: { type: 'string' }, description: 'one line per failing test or coverage gap' },
    ...TIMING_PROPS,
  },
  required: ['status', 'verification', 'failures', 'startedEpoch', 'endedEpoch'],
}

// ---- Result accumulation + timing table -----------------------------------
const results = []

function pushResult(name, r, fallbackDur) {
  const dur =
    r && typeof r.startedEpoch === 'number' && typeof r.endedEpoch === 'number'
      ? Math.max(0, r.endedEpoch - r.startedEpoch)
      : fallbackDur || 0
  results.push({
    name,
    status: (r && r.status) || 'passed',
    verification: (r && r.verification) || '',
    reason: (r && r.reason) || '',
    durationSec: dur,
  })
}

function skipResult(name, reason) {
  results.push({ name, status: 'skipped', verification: `skipped: ${reason}`, reason, durationSec: 0 })
}

function fmtDur(sec) {
  return sec < 60 ? `${sec}s` : `${Math.floor(sec / 60)}m ${sec % 60}s`
}

// A step taking >= this share (percent) of total wall-clock is bolded as a
// dominant step. Mirrors scripts/steps/done (the bash timing summary the /do
// skill uses) — see done:90,96 and its icon set at done:77-79. Keep in sync.
const DOMINANT_THRESHOLD = 30

function buildTimingTable() {
  const total = results.reduce((a, r) => a + r.durationSec, 0)
  const lines = [
    '| Step | Status | Duration | Verification |',
    '|------|--------|----------|--------------|',
  ]
  for (const r of results) {
    const icon = r.status === 'passed' ? '✓' : r.status === 'failed' ? '✗' : '—'
    let d = fmtDur(r.durationSec)
    if (r.status !== 'skipped' && total > 0 && (r.durationSec * 100) / total >= DOMINANT_THRESHOLD) d = `**${d}**`
    const v = (r.verification || '').replace(/\n/g, ' ').replace(/\|/g, '\\|')
    lines.push(`| ${r.name} | ${icon} | ${d} | ${v} |`)
  }
  lines.push(`| **Total** | | **${fmtDur(total)}** | |`)
  return lines.join('\n')
}

// ---- Prompt helpers -------------------------------------------------------
const TIMING_INSTR =
  'TIMING: run `date -u +%s` before you begin (startedEpoch) and again after all work is verified (endedEpoch); return both in your structured result.'

const AUTONOMY =
  'This runs inside an autonomous /do workflow. Do NOT ask the user anything; make sensible default choices and finish the step. Operate in the current working directory (the repository).'

function contextBlock(state) {
  return [
    `TASK: ${task || '(continuing a prior run; infer scope from the existing branch/diff)'}`,
    `forge=${state.forge} branch=${state.branch} defaultBranch=${state.defaultBranch} noGit=${noGit} minimal=${minimal}`,
  ].join('\n')
}

// Generic step runner: the script holds the retry loop. Each attempt is one
// agent that does the step and, on failure, fixes + re-verifies; the script
// loops up to `budget` attempts. Returns the final result (caller pushes it).
async function loopStep(name, phaseTitle, budget, buildPrompt, schema) {
  phase(phaseTitle)
  const sch = schema || STEP
  let attempt = 0
  let r = null
  while (attempt < budget) {
    attempt++
    r = await agent(buildPrompt(attempt, budget), {
      schema: sch,
      phase: phaseTitle,
      label: budget > 1 ? `${name}:try${attempt}` : name,
    })
    if (!r) {
      r = { status: 'failed', verification: 'agent skipped by user' }
      break
    }
    if (r.status === 'passed' || r.status === 'skipped') break
  }
  return r
}

// Run a structural reviewer. Prefer the dedicated subagent (it carries the
// reviewer's own sonnet model + methodology); if that agent type isn't
// registered in this project (e.g. the repo hasn't run `apm install`), fall
// back to a default agent that loads the same-named skill — matching SKILL.md's
// fallback doctrine, so the review still runs in repos that ship the hickey/lowy
// skills but not their agent registrations. Returns null only if both paths fail
// (no skill either), which the caller treats as graceful degradation.
async function reviewer(lens, prompt, label) {
  const viaAgent = await agent(prompt, {
    agentType: lens,
    schema: FINDINGS,
    phase: 'Review',
    label,
  }).catch(() => null)
  if (viaAgent) return viaAgent
  return await agent(
    prompt +
      `\n\nNOTE: the dedicated \`${lens}\` agent type is not installed here — invoke the \`${lens}\` skill via the Skill tool and apply its full methodology.`,
    { schema: FINDINGS, phase: 'Review', label: `${label}:skill` },
  ).catch(() => null)
}

// Run the post-implement structural review's DETECTION phase (read-only): the
// two lenses in parallel, then cross-validation. Returns findings + prose + the
// agent results (for timing). Fix application happens later, serially. Used as
// one thunk in the gate fan-out, so it owns its own nested parallel() rather
// than calling the global phase().
async function detectReview(brief) {
  const [hk, lw] = await parallel([
    () => reviewer('hickey', 'You are the HICKEY reviewer. Apply your skill to the diff below.\n' + brief, 'hickey'),
    () => reviewer('lowy', 'You are the LOWY reviewer. Apply your skill to the diff below.\n' + brief, 'lowy'),
  ])
  const hkOk = hk && hk.status !== 'failed'
  const lwOk = lw && lw.status !== 'failed'
  const hkFindings = (hkOk && hk.findings) || []
  const lwFindings = (lwOk && lw.findings) || []
  const findings = [...hkFindings, ...lwFindings]

  // Cross-validation: each lens audits the other's recommendations. Skip only
  // when both first-pass reviewers returned nothing.
  if (hkFindings.length + lwFindings.length > 0) {
    const crossTasks = []
    if (hkFindings.length) {
      crossTasks.push(() =>
        reviewer(
          'hickey',
          [
            'You are the HICKEY reviewer doing CROSS-VALIDATION.',
            brief,
            "OTHER REVIEWER'S (lowy) FINDINGS TO AUDIT:",
            JSON.stringify(lwFindings, null, 2),
            'Apply your lens to the diff AND to the other reviewer\'s recommendations. Does any recommendation, if applied, create a problem your lens would flag? If yes, surface it as a NEW finding (disposition fix/noop, no defer). Return only new findings.',
          ].join('\n'),
          'hickey:cross',
        ),
      )
    }
    if (lwFindings.length) {
      crossTasks.push(() =>
        reviewer(
          'lowy',
          [
            'You are the LOWY reviewer doing CROSS-VALIDATION.',
            brief,
            "OTHER REVIEWER'S (hickey) FINDINGS TO AUDIT:",
            JSON.stringify(hkFindings, null, 2),
            'Apply your lens to the diff AND to the other reviewer\'s recommendations. Does any recommendation, if applied, create a problem your lens would flag? If yes, surface it as a NEW finding (disposition fix/noop, no defer). Return only new findings.',
          ].join('\n'),
          'lowy:cross',
        ),
      )
    }
    const cross = await parallel(crossTasks)
    for (const c of cross) if (c && c.findings) findings.push(...c.findings)
  }

  return {
    findings,
    hickeyProse: hk ? (hk.status === 'failed' ? '(hickey review did not complete)' : hk.rationale || '') : '(hickey reviewer unavailable)',
    lowyProse: lw ? (lw.status === 'failed' ? '(lowy review did not complete)' : lw.rationale || '') : '(lowy reviewer unavailable)',
    agents: [hk, lw].filter(Boolean),
  }
}

// ===========================================================================
// SYNC — always runs.
// ===========================================================================
phase('Sync')
const sync = await agent(
  [
    'You are the SYNC step of a /do workflow.',
    AUTONOMY,
    `noGit=${noGit}.`,
    'Do exactly this:',
    '1. git fetch origin && git remote set-head origin --auto.',
    '2. If noGit is false AND the current branch is behind its upstream with 0 commits ahead, run `git pull --ff-only`. Under noGit, fetch but do NOT touch the working tree.',
    '3. If noGit is false AND `git status --porcelain` is non-empty (dirty tree), print this hint to stderr (do NOT pause): "Dirty tree detected. Continuing will create a fresh branch on top of these changes. If you wanted the agent to extend your WIP in place without touching git, re-run with --no-git."',
    '4. Detect the forge from `git remote get-url origin`: a URL containing github.com → "github"; containing "bitbucket." → "bitbucket"; otherwise "unknown".',
    '5. branch = `git rev-parse --abbrev-ref HEAD`. defaultBranch = the short name of origin/HEAD (e.g. master or main), via `git symbolic-ref --short refs/remotes/origin/HEAD` with the `origin/` prefix stripped.',
    'Do NOT create branches, commits, or PRs. Only github has an active PR code path; bitbucket/unknown will skip PR steps later.',
    TIMING_INSTR,
  ].join('\n'),
  { schema: SYNC, phase: 'Sync', label: 'sync' },
)
if (!sync || sync.status !== 'passed') {
  log('sync failed — aborting workflow.')
  pushResult('sync', sync || { status: 'failed', verification: 'sync agent produced no result' })
  return { ok: false, stage: 'sync', results }
}
pushResult('sync', sync)
const state = { forge: sync.forge, branch: sync.branch, defaultBranch: sync.defaultBranch }
log(`sync ok: forge=${state.forge} branch=${state.branch} default=${state.defaultBranch}`)

// ===========================================================================
// RESEARCH ∥ BRANCH — independent, run concurrently: research is read-only;
// branch only creates a git ref (no tracked-content change). Both gate on sync.
// Branch is held back under --review (we stop after research), --no-git, or an
// entry point past it. Inside parallel() each agent sets opts.phase explicitly
// (never the global phase()) so the two don't race the phase pointer.
// ===========================================================================
const needResearch = fromIdx <= ORDER.indexOf('review')
const runBranch = shouldRun('branch') && !noGit && !review
let research = null
let researchBrief = '(no research step for this entry point; infer scope from the existing branch/diff)'

const [researchRes, branchRes] = await parallel([
  () =>
    needResearch
      ? agent(
          [
            'You are the RESEARCH step of a /do workflow. Research the task thoroughly BEFORE any code is written.',
            AUTONOMY,
            contextBlock(state),
            'Rules:',
            `- If the task is a GitHub issue URL and forge==github, fetch it with \`gh issue view\`. On non-github forges treat any URL as opaque context (do not fetch).`,
            '- Never assume how something works — read the code, check the config. Prefer Grep/Glob before Read.',
            '- If external tools/libraries are involved, prefer `git clone` to /tmp at the version the project uses and read the source on disk; fall back to WebSearch/WebFetch only when the source is not clonable.',
            '- Keep the investigation lean and map-based: prefer Grep/Glob, and use Read with offset/limit to confirm specific lines rather than dumping whole files. Return a file:line map, not file contents.',
            'Return: a compact map — `summary` (what changes, where, why), `approach` (the intended implementation), `findings` (file:line citations with notes), and `plan` (a short human-readable plan). These are threaded into the implement and review steps.',
            TIMING_INSTR,
          ].join('\n'),
          { schema: RESEARCH, phase: 'Research', label: 'research' },
        )
      : null,
  () =>
    runBranch
      ? agent(
          [
            'You are the BRANCH step of a /do workflow.',
            AUTONOMY,
            contextBlock(state),
            `Create a descriptive feature branch from origin/${state.defaultBranch} (e.g. \`git switch -c <slug> origin/${state.defaultBranch}\`). Just the local branch — no commit, no push, no PR.`,
            'If you are already on an appropriate feature branch (not the default branch), keep it and report passed.',
            'Verify: HEAD is on a feature branch, not the default branch.',
            TIMING_INSTR,
          ].join('\n'),
          { schema: STEP, phase: 'Branch', label: 'branch' },
        )
      : null,
])

// Record research first (keeps the timing table in canonical order).
if (needResearch) {
  research = researchRes
  if (!research || research.status !== 'passed') {
    log('research failed — aborting workflow.')
    pushResult('research', research || { status: 'failed', verification: 'research agent produced no result' })
    return { ok: false, stage: 'research', results }
  }
  pushResult('research', research)
  researchBrief = [
    `RESEARCH SUMMARY: ${research.summary}`,
    `INTENDED APPROACH: ${research.approach}`,
    'KEY FILES:',
    ...(research.findings || []).map((f) => `  - ${f.file}${f.line ? ':' + f.line : ''} — ${f.note}`),
  ].join('\n')
} else {
  skipResult('research', `entry point ${startStep} has no downstream consumer`)
}

// --review: stop here and hand the plan back (branch was intentionally not
// created — runBranch is false under --review). The runtime cannot pause for
// approval mid-run, so plan-approval is a stage boundary (re-run --from implement).
if (review && research) {
  log('--review: plan ready. Re-run `/do-wf --from implement <task>` after you approve to continue.')
  return {
    ok: true,
    status: 'paused',
    stage: 'research',
    reviewRequested: true,
    plan: research.plan || research.summary,
    summary: research.summary,
    approach: research.approach,
    findings: research.findings,
    nextCommand: `/do-wf --from implement ${task}`,
    results,
  }
}

// Record branch.
if (!shouldRun('branch')) {
  skipResult('branch', 'entry point is past it')
} else if (noGit) {
  skipResult('branch', '--no-git')
} else if (review) {
  skipResult('branch', '--review (deferred to --from implement)')
} else {
  pushResult('branch', branchRes)
}

// ===========================================================================
// IMPLEMENT — bespoke (aborts on hard failure rather than blind-retrying).
// ===========================================================================
if (!shouldRun('implement')) {
  skipResult('implement', 'entry point is past it')
} else {
  phase('Implement')
  const implement = await agent(
    [
      'You are the IMPLEMENT step of a /do workflow. Implement the planned change.',
      AUTONOMY,
      contextBlock(state),
      researchBrief,
      'TEST-FIRST RULE:',
      '- Bug fix → write a failing test first, then fix.',
      '- New behavior (new endpoint/route/service/module, config path, env var, secrets wiring, network, persistence/migrations, auth flow) → write an integration/unit test covering it BEFORE implementing. If unsure which bucket, treat as new behavior.',
      '- Pure docs / no-behavior refactors / internal cleanups / behavior-neutral dep bumps → no test-first requirement.',
      'When a change introduces multiple user-facing paths, write one e2e scenario per distinct path. Prefer simplicity; do the boring obvious thing.',
      'Verify: code matches the approach; for bug-fix/new-behavior at least one test exercises the change (one per distinct path for multi-path); refactor/docs/cleanup diffs are exempt.',
      TIMING_INSTR,
    ].join('\n'),
    { schema: STEP, phase: 'Implement', label: 'implement' },
  )
  pushResult('implement', implement)
  if (implement && implement.status === 'failed') {
    log('implement failed — aborting (resume with `--from implement`).')
    return { ok: false, stage: 'implement', results }
  }
}

// ===========================================================================
// CHECK — cheapest gate, runs first. Budget 3.
// ===========================================================================
if (!shouldRun('check')) {
  skipResult('check', 'entry point is past it')
} else {
  const check = await loopStep('check', 'Check', 3, (a, b) =>
    [
      `You are the CHECK step of a /do workflow — attempt ${a} of ${b}.`,
      AUTONOMY,
      contextBlock(state),
      'Read `.agency/do.md` for a `## Check command` (a fast static-correctness gate like `tsc --noEmit`, `cargo check`, `cabal build`, `mypy`, `dune build @check`). Run it. This is the cheapest gate, so fail fast here.',
      'If no check command is configured, return status "skipped" with reason "no check command configured".',
      'If it passes, return "passed". If it fails, FIX the errors now (scope the fix to the failure; do NOT redo implement), re-run, and return "passed" only if it is now green, else "failed".',
      TIMING_INSTR,
    ].join('\n'),
  )
  pushResult('check', check)
}

// ===========================================================================
// DOCS — skipped under --minimal. Budget 3.
// ===========================================================================
if (!shouldRun('docs')) {
  skipResult('docs', 'entry point is past it')
} else if (minimal) {
  skipResult('docs', '--minimal')
} else {
  const docs = await loopStep('docs', 'Docs', 3, (a, b) =>
    [
      `You are the DOCS step of a /do workflow — attempt ${a} of ${b}.`,
      AUTONOMY,
      contextBlock(state),
      'Read `.agency/do.md` for a `## Documentation` section listing docs to keep in sync (e.g. README.md). Compare those files against the changes on this branch (`git diff origin/HEAD...HEAD`). If a doc is now out of date, fix it.',
      'If no documentation files are documented, return "skipped" with reason "no documentation configured".',
      'Verify: docs match current code.',
      TIMING_INSTR,
    ].join('\n'),
  )
  pushResult('docs', docs)
}

// ===========================================================================
// FMT — Budget 2.
// ===========================================================================
if (!shouldRun('fmt')) {
  skipResult('fmt', 'entry point is past it')
} else {
  const fmt = await loopStep('fmt', 'Format', 2, () =>
    [
      'You are the FMT step of a /do workflow.',
      AUTONOMY,
      contextBlock(state),
      'Read `.agency/do.md` for a `## Format command` and run it. If none is configured, return "skipped" with reason "no format command configured".',
      'Verify: the format command ran without error.',
      TIMING_INSTR,
    ].join('\n'),
  )
  pushResult('fmt', fmt)
}

// ===========================================================================
// COMMIT — skipped under --no-git. Budget 2.
// ===========================================================================
if (!shouldRun('commit')) {
  skipResult('commit', 'entry point is past it')
} else if (noGit) {
  skipResult('commit', '--no-git')
} else {
  const commit = await loopStep('commit', 'Commit', 2, () =>
    [
      'You are the COMMIT step of a /do workflow.',
      AUTONOMY,
      contextBlock(state),
      'Create a NEW commit (never amend) with a conventional-commit message for the primary implementation. This is the primary feature commit; later review/police steps add their own follow-up commits.',
      'Push to the feature branch with `git push -u origin <branch>` (sets upstream on first push). If there is nothing to commit, return "skipped" with reason "no changes to commit".',
      'Verify: `git log -1` shows a new commit on the feature branch and it is pushed to remote.',
      TIMING_INSTR,
    ].join('\n'),
  )
  pushResult('commit', commit)
}

// ===========================================================================
// QUALITY GATES — parallel detection, serial fixes.
// review (hickey/lowy), police, and test all begin by READING the committed
// diff, so their detection phases fan out concurrently. Every fix mutates git,
// so fixes apply strictly serially after detection, in canonical order. Then,
// if anything changed, the cheap gates re-run once on the post-fix state
// (Revalidate) — restoring the "final state is validated" property the
// all-serial pipeline got for free.
//
// Tradeoff vs. fully-serial: parallel detection means each gate sees the
// post-commit BASE diff, not the others' fixes; the serial apply + Revalidate
// pass reconciles that.
// ===========================================================================
let reviewFindings = []
let hickeyProse = ''
let lowyProse = ''

const runReview = shouldRun('review') && !minimal
const runPolice = shouldRun('police') && !minimal
const runTest = shouldRun('test')

const reviewerBrief = [
  contextBlock(state),
  researchBrief,
  'SCOPE: review the actual diff `git diff origin/HEAD...HEAD`.',
  'If `git diff --diff-filter=A --name-only origin/HEAD...HEAD` is non-empty (the diff adds new files), FIRST run the duplication audit your skill describes: find the canonical in-repo pattern for the same KIND of operation and make it the headline finding if the diff reinvents rather than extends it. If there are no new files, skip the audit and review unprimed.',
  'Dispositions are "fix" (Fix in this PR) or "noop" (No-op: the diff already deletes the offending code, or the finding is subsumed verbatim by another). There is NO defer — anything resembling defer/out-of-scope/follow-up is a "fix".',
  'Return your findings array and the full rationale prose. If you cannot complete the review (tooling/skill error), return status:"failed" so the workflow does not mistake an aborted review for "no issues found".',
  TIMING_INSTR,
].join('\n')

// ---- Detection fan-out (read-only; nothing here commits) ------------------
const [reviewDetect, policeDetect, testDetect] = await parallel([
  () => (runReview ? detectReview(reviewerBrief) : null),
  () =>
    runPolice
      ? agent(
          [
            'You are the POLICE DETECTION pass of a /do workflow (report-only — make NO edits and NO commits here).',
            AUTONOMY,
            contextBlock(state),
            'If `git diff origin/HEAD...HEAD --name-only` shows only documentation files (.md/.txt/README/docs/), return status "skipped" with reason "docs-only diff".',
            'Otherwise invoke the `code-police` skill (Skill tool) scoped to "changes in the current branch/PR only" and run its three passes (rules, fact-check, elegance), REPORTING every violation. If the skill is unavailable, perform the three passes manually. Do not fix or commit — the serial fix phase runs next.',
            'Return status "passed" if all three passes are clean, else "failed", with one `violations` entry per issue (pass = rules|fact-check|elegance).',
            TIMING_INSTR,
          ].join('\n'),
          { schema: POLICE_DETECT, phase: 'Police', label: 'police:detect' },
        )
      : null,
  () =>
    runTest
      ? agent(
          [
            'You are the TEST RUN pass of a /do workflow (report-only — make NO edits and NO commits here).',
            AUTONOMY,
            contextBlock(state),
            'Read `.agency/do.md` for a `## Test command`. Run ONLY the tests relevant to the code paths changed on this branch (use `git diff origin/HEAD...HEAD --name-only`). If no test command is configured, return status "skipped" with reason "no test command configured".',
            'COVERAGE-GAP CHECK: a green run that never exercised the new behavior is a gap, not a pass.',
            'Return status "passed" if tests pass AND the new behavior is covered (or the diff is exempt / no relevant tests); else "failed", with one `failures` entry per failing test or coverage gap.',
            TIMING_INSTR,
          ].join('\n'),
          { schema: TEST_DETECT, phase: 'Test', label: 'test:run' },
        )
      : null,
])

// ---- Serial fix application (git-mutating → strictly sequential) ----------
let anyFix = false

// REVIEW: apply "fix" findings, one narrow commit each.
if (runReview) {
  reviewFindings = (reviewDetect && reviewDetect.findings) || []
  hickeyProse = reviewDetect ? reviewDetect.hickeyProse : '(review did not run)'
  lowyProse = reviewDetect ? reviewDetect.lowyProse : '(review did not run)'
  const fixes = reviewFindings.filter((f) => f.disposition === 'fix')
  let apply = null
  if (fixes.length) {
    anyFix = true
    apply = await loopStep('apply-findings', 'Review', 2, () =>
      [
        'You are applying hickey/lowy review findings to a /do workflow branch.',
        AUTONOMY,
        contextBlock(state),
        'Apply each finding below as its OWN narrow commit (do not batch). For each in turn: apply the fix scoped to only the lines it touches; run the project format command (`## Format command` in .agency/do.md) on changed files if configured; `git add` only those files; commit with `refactor(hickey): <label>` or `refactor(lowy): <label>` (a one-line body restating the finding); then `git push`.',
        noGit
          ? 'NOTE: --no-git is set. Apply all fixes to the working tree but do NOT commit or push. Report what you changed.'
          : 'Push after each commit so the draft PR accumulates commits in real time.',
        'FINDINGS TO FIX:',
        JSON.stringify(fixes, null, 2),
        'Verify: every finding has a corresponding narrow commit on the feature branch (or, under --no-git, is reflected in the working tree).',
        TIMING_INSTR,
      ].join('\n'),
    )
  }
  // Span the review step: earliest detection start to latest apply end.
  const rAgents = [...((reviewDetect && reviewDetect.agents) || []), apply].filter(Boolean)
  const rStarts = rAgents.map((a) => a.startedEpoch).filter((n) => typeof n === 'number')
  const rEnds = rAgents.map((a) => a.endedEpoch).filter((n) => typeof n === 'number')
  pushResult('review', {
    status: apply ? apply.status : 'passed',
    verification: `hickey+lowy: ${reviewFindings.length} findings, ${fixes.length} fixed${noGit ? ' (working tree, --no-git)' : ''}`,
    startedEpoch: rStarts.length ? Math.min(...rStarts) : 0,
    endedEpoch: rEnds.length ? Math.max(...rEnds) : 0,
  })
  log(`review: ${reviewFindings.length} findings (${fixes.length} fixed).`)
} else if (!shouldRun('review')) {
  skipResult('review', 'entry point is past it')
} else {
  skipResult('review', '--minimal')
}

// POLICE: apply violation fixes, one commit each.
if (runPolice) {
  if (!policeDetect) {
    pushResult('police', { status: 'failed', verification: 'police detection produced no result' })
  } else if (policeDetect.status === 'skipped') {
    skipResult('police', policeDetect.reason || 'docs-only diff')
  } else {
    const violations = (policeDetect.violations || []).filter(Boolean)
    let papply = null
    if (violations.length) {
      anyFix = true
      papply = await loopStep('police-fix', 'Police', 3, (a, b) =>
        [
          `You are applying code-police violation fixes to a /do workflow branch — attempt ${a} of ${b}.`,
          AUTONOMY,
          contextBlock(state),
          noGit
            ? 'Fix each violation below in the working tree; do NOT commit (--no-git).'
            : 'Fix each violation below and commit it individually with a conventional prefix — rules: `fix(police): <rule-id> — <desc>`; fact-check: `fix(police): fact-check — <desc>`; elegance: `refactor(police): elegance — <desc>` — `git push` after each.',
          'VIOLATIONS TO FIX:',
          JSON.stringify(violations, null, 2),
          'Re-run the relevant code-police pass to confirm. Return "passed" only when all are resolved; else "failed".',
          TIMING_INSTR,
        ].join('\n'),
      )
    }
    const pAgents = [policeDetect, papply].filter(Boolean)
    const pStarts = pAgents.map((a) => a.startedEpoch).filter((n) => typeof n === 'number')
    const pEnds = pAgents.map((a) => a.endedEpoch).filter((n) => typeof n === 'number')
    pushResult('police', {
      status: papply ? papply.status : 'passed',
      verification: violations.length
        ? `code-police: ${violations.length} violation(s), ${papply && papply.status === 'passed' ? 'fixed' : 'fix attempted'}${noGit ? ' (working tree, --no-git)' : ''}`
        : 'code-police: all clear (rules, fact-check, elegance)',
      startedEpoch: pStarts.length ? Math.min(...pStarts) : 0,
      endedEpoch: pEnds.length ? Math.max(...pEnds) : 0,
    })
    log(`police: ${violations.length} violation(s).`)
  }
} else if (!shouldRun('police')) {
  skipResult('police', 'entry point is past it')
} else {
  skipResult('police', '--minimal')
}

// TEST: if detection found failures, fix until green (or the budget exhausts).
if (runTest) {
  if (!testDetect) {
    pushResult('test', { status: 'failed', verification: 'test run produced no result' })
  } else if (testDetect.status === 'skipped') {
    skipResult('test', testDetect.reason || 'no test command configured')
  } else if (testDetect.status === 'passed') {
    pushResult('test', testDetect)
  } else {
    anyFix = true
    const tfix = await loopStep('test-fix', 'Test', 4, (a, b) =>
      [
        `You are fixing failing tests on a /do workflow branch — attempt ${a} of ${b}.`,
        AUTONOMY,
        contextBlock(state),
        'A test is flaky only if it passes on retry; consistent failure = real bug. Fix the failures/coverage gaps below, run the format command, ' +
          (noGit ? 'and re-run the tests (no commit under --no-git).' : 'commit the fix, push, and re-run the tests.'),
        'FAILURES / GAPS:',
        JSON.stringify(testDetect.failures || [], null, 2),
        'Return "passed" only when the relevant tests pass AND the new behavior is covered; else "failed".',
        TIMING_INSTR,
      ].join('\n'),
    )
    const tAgents = [testDetect, tfix].filter(Boolean)
    const tStarts = tAgents.map((a) => a.startedEpoch).filter((n) => typeof n === 'number')
    const tEnds = tAgents.map((a) => a.endedEpoch).filter((n) => typeof n === 'number')
    pushResult('test', {
      status: tfix ? tfix.status : 'failed',
      verification: `tests: ${(testDetect.failures || []).length} failure(s), ${tfix && tfix.status === 'passed' ? 'fixed' : 'fix attempted'}`,
      startedEpoch: tStarts.length ? Math.min(...tStarts) : 0,
      endedEpoch: tEnds.length ? Math.max(...tEnds) : 0,
    })
  }
} else {
  skipResult('test', 'entry point is past it')
}

// ---- Revalidate: parallel detection saw the pre-fix base diff, so if any gate
// applied fixes, re-run the cheap gates once on the final HEAD. --------------
if (anyFix) {
  const revalidate = await loopStep('revalidate', 'Revalidate', 2, (a, b) =>
    [
      `You are the REVALIDATE step of a /do workflow — attempt ${a} of ${b}. Gate fixes were applied after the parallel detection pass; confirm the final state is still green.`,
      AUTONOMY,
      contextBlock(state),
      'Re-run the `## Check command` and `## Test command` from .agency/do.md (whichever are configured) against the current HEAD. If neither is configured, return status "skipped" with reason "no check/test command configured".',
      'If a command fails, fix it, ' + (noGit ? 'and retry.' : 'commit the fix, push, and retry.'),
      'Return "passed" only when all configured gates are green on HEAD; else "failed".',
      TIMING_INSTR,
    ].join('\n'),
  )
  pushResult('revalidate', revalidate)
}

// ===========================================================================
// CREATE-PR — draft PR + hickey/lowy findings ledger. github only; skipped
// under --no-git or non-github forge. Budget 2.
// ===========================================================================
if (!shouldRun('create-pr')) {
  skipResult('create-pr', 'entry point is past it')
} else if (noGit) {
  skipResult('create-pr', '--no-git')
} else if (state.forge !== 'github') {
  skipResult('create-pr', `non-${state.forge} forge: ${state.forge}`)
} else {
  const ledger = reviewFindings.map((f, i) => ({
    n: i + 1,
    lens: f.lens,
    finding: f.label,
    disposition: f.disposition === 'fix' ? 'Fixed in this PR' : '⚠️ **No-op**',
  }))
  const createPr = await loopStep('create-pr', 'Create PR', 2, () =>
    [
      'You are the CREATE-PR step of a /do workflow (forge=github).',
      AUTONOMY,
      contextBlock(state),
      'If a PR already exists for this branch (`gh pr view`), re-check its title/body against current scope and update via `gh pr edit` if needed. Otherwise create a draft PR with `gh pr create --draft`.',
      'MANDATORY: load the `forge-pr` skill (Skill tool) BEFORE writing the PR title/body. Pass the body via a single-quoted heredoc so backticks/$ survive.',
      !minimal
        ? [
            'Post the hickey/lowy analysis as a PR comment (`gh pr comment`) under a `## [Hickey/Lowy](https://kolu.dev/blog/hickey-lowy/) Analysis` header, with a leading findings ledger table (one row per finding) then each lens\'s rationale prose. Render every No-op row as `⚠️ **No-op**` (warning emoji + bold). If there were zero findings, write a one-line "No findings — analysis below" instead of an empty table.',
            'LEDGER (compose the table from this):',
            JSON.stringify(ledger, null, 2),
            'HICKEY RATIONALE:',
            hickeyProse || '(none)',
            'LOWY RATIONALE:',
            lowyProse || '(none)',
          ].join('\n')
        : 'No hickey/lowy analysis to post (--minimal).',
      'Verify: draft PR exists (`gh pr view` succeeds), title/body match the delivered scope, hickey/lowy findings posted if any.',
      TIMING_INSTR,
    ].join('\n'),
  )
  pushResult('create-pr', createPr)
}

// ===========================================================================
// CI — run CI (forge-independent), verify it covers HEAD. Budget 5.
// On real failure: fix → fmt → commit → retry.
// ===========================================================================
if (!shouldRun('ci')) {
  skipResult('ci', 'entry point is past it')
} else {
  const ci = await loopStep('ci', 'CI', 5, (a, b) =>
    [
      `You are the CI step of a /do workflow — attempt ${a} of ${b}.`,
      AUTONOMY,
      contextBlock(state),
      'Read `.agency/do.md` for a `## CI command` and its verification method. Run CI in the background if it takes more than a few seconds. NEVER pipe CI to tail/head and never append `2>&1` (background mode captures both streams). CI commands are forge-independent — run regardless of forge. If no CI command is configured, return "skipped" with reason "no CI command configured".',
      'VERIFY COVERS HEAD: the CI result must cover the current HEAD. Compare the SHA CI ran against with `git rev-parse HEAD`; if they differ (a fix was pushed after CI started), re-run CI against HEAD. A pass on a stale commit does not count.',
      'A test is flaky only if it passes on retry; consistent failure = real bug. On a real failure: fix it, run the format command, ' +
        (noGit ? 'and retry (no commit under --no-git).' : 'commit the fix, push, and retry — the draft PR updates automatically.'),
      'Return "passed" only when CI is green on HEAD; else "failed".',
      TIMING_INSTR,
    ].join('\n'),
  )
  pushResult('ci', ci)
}

// ===========================================================================
// EVIDENCE — opt-in. Skipped under --minimal/--no-git/non-github, or when
// .agency/do.md has no `## PR evidence` section (the default). Budget 2.
// ===========================================================================
if (!shouldRun('evidence')) {
  skipResult('evidence', 'entry point is past it')
} else if (minimal) {
  skipResult('evidence', '--minimal')
} else if (noGit) {
  skipResult('evidence', '--no-git')
} else if (state.forge !== 'github') {
  skipResult('evidence', `non-${state.forge} forge: ${state.forge}`)
} else {
  const evidence = await loopStep('evidence', 'Evidence', 2, () =>
    [
      'You are the EVIDENCE step of a /do workflow (opt-in; most projects skip it).',
      AUTONOMY,
      contextBlock(state),
      'Read `.agency/do.md` for a `## PR evidence` section. If the file is missing, or the section is missing/empty, return "skipped" with reason "no PR evidence section in .agency/do.md".',
      'If the section is present, follow it (it is free-form: inline prose, a pointer to a file, or a script reference). Capture the evidence it describes, then post it as ONE PR comment under a `## Evidence` heading using `gh pr comment` with a single-quoted heredoc. Embed any image/asset URLs inline (gh pr comment cannot attach files).',
      'Verify: either skipped per the rule, or a `## Evidence` PR comment now exists.',
      TIMING_INSTR,
    ].join('\n'),
  )
  pushResult('evidence', evidence)
}

// ===========================================================================
// DONE — timing table, optimization suggestions, final PR comment.
// ===========================================================================
phase('Done')
const table = buildTimingTable()
const failed = results.filter((r) => r.status === 'failed').map((r) => r.name)
// "completed" requires all steps passed, except skips for non-forge / --no-git /
// no-evidence-section / --minimal / entry-point — all of which count toward
// completion. A failed step blocks completion.
const workflowStatus = failed.length === 0 ? 'completed' : 'failed'

const done = await agent(
  [
    'You are the DONE step of a /do workflow. Produce the final report.',
    AUTONOMY,
    contextBlock(state),
    `Workflow status: ${workflowStatus}.${failed.length ? ' Failed steps: ' + failed.join(', ') + '.' : ''}`,
    'Below is the finished step timing table (use it verbatim). Generate 2–4 concrete, data-specific optimization suggestions for future runs (e.g. if CI dominated → suggest `--from ci-only` re-runs; if research was slow → suggest pre-reading; if test/ci retried → name the flaky test; if police iterated → name which pass caught issues).',
    'POSTING:',
    `- If forge==github and a PR exists: post the table + suggestions as a PR comment via \`gh pr comment\` (single-quoted heredoc) under a "## [\`/do-wf\`](https://github.com/srid/agency) results" header.`,
    '- If --no-git: do NOT post; print the table + suggestions, list the modified files (`git status --porcelain`), and remind the user the changes are uncommitted.',
    '- If non-github forge: do NOT post; print the table + suggestions and report the branch name (and `git remote get-url origin`).',
    'TIMING TABLE:',
    table,
    'RAW STEP DATA (exact per-step durations in seconds — use these for precise optimization suggestions, not the bolded table):',
    JSON.stringify(
      results.map((r) => ({ name: r.name, status: r.status, durationSec: r.durationSec })),
      null,
      2,
    ),
    'Return status "passed" once the report is delivered.',
    TIMING_INSTR,
  ].join('\n'),
  { schema: STEP, phase: 'Done', label: 'done' },
)
pushResult('done', done)

log(`do-wf ${workflowStatus}.`)
return {
  ok: workflowStatus === 'completed',
  status: workflowStatus,
  forge: state.forge,
  branch: state.branch,
  failedSteps: failed,
  reviewFindings,
  table,
  results,
}
