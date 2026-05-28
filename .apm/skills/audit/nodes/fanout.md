# fanout

Run hickey + lowy + code-police in parallel against the diff. Cross-validate parallel findings. Assemble the findings ledger.

## Strategies

### Phase 1 — Parallel first pass

Invoke `hickey`, `lowy`, and `code-police` in **parallel** using the harness's agent tool. On Claude Code this is `Agent` with `subagent_type: "hickey"` / `"lowy"`. On opencode this is `task`. On Codex this is the sub-agent spawning tool.

<use_parallel_tool_calls>
Emit all three sub-agent invocations in a single response — one round-trip, not three.
</use_parallel_tool_calls>

Each sub-agent prompt must be self-contained (sub-agents do not inherit this conversation's context). Brief each one with:

- The full task context — the original prompt (if /audit was invoked with one) and any relevant file paths.
- The scope: the actual diff captured during **sync**.
- **Duplication-audit hint**, when the diff adds new files — check via `/vcs op new-files` and only include the hint if the output is non-empty. The hint tells the reviewer to start with the codebase survey their skill describes (`hickey` Layer 3, `lowy` §1 "Check for prior encapsulation"): find the canonical in-repo pattern for the same *kind* of operation and flag it as the headline finding if the diff reinvents rather than extends it.

The sub-agent already knows to read its skill file and follow that methodology; don't re-state it in the prompt.

**Do not seed structural questions.** The prompt must NOT include pre-formed questions like _"Is module X the right home for function Y?"_ — that framing shopping-lists the answer. Each lens has its own methodology; the reviewer reads the diff cold.

**Fallback, never skip.** If the harness cannot honor the model declared in a reviewer skill's frontmatter, run the reviewer on the available model. If a sub-agent invocation fails for harness/tooling reasons before producing a review, retry once; if it still fails, run that review in the main model by loading the reviewer skill against the same diff.

### Phase 2 — Cross-validation

Hickey and Lowy ran in parallel without seeing each other's output. Each reviewer's local-optimum call can produce a problem the other lens should have caught.

Skip this phase if **both** hickey and lowy returned zero findings. Otherwise, for each reviewer (hickey, lowy) that produced findings, spawn a **second invocation** of that same skill (`subagent_type: "hickey"` or `"lowy"`) with a self-contained prompt containing:

- The actual diff.
- The other reviewer's full findings output (paste it verbatim — the cross-validator must see the recommendations being audited, not a summary).
- The question, phrased neutrally: _"Apply your lens to the diff **and** to the other reviewer's recommendations. Does any recommendation, if applied, create a problem your lens would flag? If yes, surface it as a new finding with the same disposition rules (Fix in this PR / No-op, no Defer)."_

Run the two cross-validation calls in parallel (single message, both `Agent` blocks). If either cross-validator surfaces a new finding, treat it identically to a first-pass finding — record it in the ledger with `source: "hickey-cross"` or `source: "lowy-cross"`.

Code-police findings are not cross-validated (they're rule-based, not lens-based).

### Phase 3 — Assemble the ledger

Collect every finding from every pass into a structured ledger. Each entry has:

```json
{
  "source": "hickey|lowy|hickey-cross|lowy-cross|police-rules|police-fact-check|police-elegance",
  "label": "<short finding label>",
  "disposition": "Fix in this PR|No-op",
  "rationale": "<reviewer prose>",
  "commit_prefix": "refactor(hickey)|refactor(lowy)|refactor(hickey): cross-validate|refactor(lowy): cross-validate|fix(police)|refactor(police)"
}
```

Stash the full ledger as a JSON array via `runbook-driver --workflow=audit set findings '<json-array>'`. The **done** node writes the final `.audit-results.json` including this ledger.

**Verify**: At least one of hickey/lowy/code-police produced output (zero findings is a valid output; failure to produce output is not). Cross-validation ran (or was correctly skipped because both hickey AND lowy returned zero findings). Every finding has `source`, `label`, `disposition`, `rationale`, `commit_prefix`; no deferred dispositions; no orphaned findings.
