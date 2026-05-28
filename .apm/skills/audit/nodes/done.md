# done (audit)

Write the final findings ledger; emit timing table; print the ledger.

## Strategies

1. Set workflow status: `.../skills/runbook/runbook-driver --workflow=audit set status completed`.
2. The `findings` field is already in `.audit-results.json` (stashed by the **fanout** node). Read it back to compose the printed ledger.
3. Compose the human-readable ledger markdown and print it. The format mirrors what /do's create-pr node posts as a PR comment:

   ```md
   ## [Hickey/Lowy](https://kolu.dev/blog/hickey-lowy/) Analysis

   | # | Lens   | Finding                                  | Disposition         |
   |---|--------|------------------------------------------|---------------------|
   | 1 | Hickey | <label>                                  | Fixed in this PR    |
   | 2 | Lowy   | <label>                                  | Fixed in this PR    |
   | 3 | Lowy   | <label>                                  | ⚠️ **No-op**        |

   ### Hickey rationale
   <prose>

   ### Lowy rationale
   <prose>

   ### Police findings
   <prose>
   ```

   - Map disposition `Fix in this PR` → render as `Fixed in this PR` in the table.
   - Map disposition `No-op` → render as `⚠️ **No-op**` (warning emoji + bold) so the reviewer's eye lands on it.
   - If both hickey and lowy returned zero findings, write a one-line "No findings — analysis below" instead of an empty table.

4. Emit the timing table: `.../skills/runbook/done --workflow=audit`.

The printed ledger and the JSON file `.audit-results.json` are the deliverables. Standalone callers read the printed ledger; sub-skill callers (`/do`'s audit node) read `.audit-results.json`.

**Verify**: `.audit-results.json` exists and contains the `findings` array; ledger printed to stdout; timing table emitted.
