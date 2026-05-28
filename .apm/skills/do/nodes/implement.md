---
name: implement
description: Implement the planned changes.
---

# Implement

## Requires

- Plan from research

## Ensures

- Code changes in working tree
- Tests covering changed behavior (for bug fixes and new behavior)

## Strategies

The test-first rule depends on what the change is:

- **Bug fix**: write a failing test first (e2e or unit, whichever is appropriate), then fix the bug.
- **New behavior** — anything that fails at runtime if it's wrong: new endpoints or routes, new services or modules, configuration paths, environment variables, secrets wiring, network connectivity, data persistence (migrations, preStart scripts, schema changes), auth/OIDC flows. Write an integration or unit test covering the new behavior **before** implementing. NixOS service modules need a VM test; new HTTP endpoints need an e2e or integration test; new modules with logic need at least a unit test.
- **Otherwise** — documentation, refactors with no behavioral change, purely internal cleanups, dependency bumps that don't change behavior. Just implement the planned changes; no test-first requirement.

If you're not sure which bucket the change falls into, treat it as new behavior. The cost of an unnecessary test is small; the cost of a silent deployment failure is not.

Prefer simplicity. Do the boring obvious thing.

**E2E coverage**: When the change introduces multiple user-facing paths (e.g., a dialog that appears under different conditions), write e2e scenarios for **each distinct path**. Enumerate the user-visible paths, then check that every one has a corresponding test.

**Verify**: Code changes match the planned approach. For bug fixes and new-behavior changes, at least one test exercises the changed behavior; multi-path changes have one test per distinct user-visible path. Refactor/docs/cleanup diffs are exempt.
