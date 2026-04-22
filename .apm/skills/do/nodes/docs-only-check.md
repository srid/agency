---
name: nodes/docs-only-check
kind: predicate
output_schema:
  docs_only: bool
  changed_files: "string[]"
  non_docs_files: "string[]"
---

# Docs-only check (predicate)

Not a workflow step — a **predicate** invoked by [[code-police]]'s `skip_when`.

Run `git diff origin/HEAD...HEAD --name-only` to list changed files. Classify each as docs-only or not:

- **Docs-only patterns**: `*.md`, `*.txt`, `*.rst`, `README*`, `CHANGELOG*`, `LICENSE*`, files under `docs/`, files under `notes/`.
- **Anything else** counts as non-docs (source, config, tests, build files, etc.).

Return JSON:

```yaml
docs_only: true | false   # true iff every changed file is docs-only
changed_files: [...]
non_docs_files: [...]     # empty iff docs_only is true
```

The caller ([[code-police]]) reads `docs_only`. When `true`, the code-police node is skipped with `reason: "docs-only changes"`.
