# RZ Autonomous Agent Harness

> Canonical implementation standard: [[Standards-Hub]] and
> `standarization/AGENT_HARNESS_STANDARD.md`.

## Current contract

- Always-on singleton controller with compact CLI checkpoints.
- Safe local read/edit/test/commit actions run automatically; destructive,
  credential, external-write, deploy, production, paid, secret-rotation, and
  scope-expansion actions remain human boundaries.
- Every run freezes task, revision, identities, permissions, setup, gates, and
  budgets into one digest.
- Exact owner-epoch fencing covers worker, reviewer, heartbeat, recovery, and
  partial-start paths.
- Git candidates use a private filter-free index; repository hooks, filters,
  diff drivers, and signing programs cannot execute.
- Provider processes run in a closed network namespace. The bounded broker
  allows only messages, count-tokens, and Responses endpoints, with an
  eight-connection cap.
- Token, evidence, worktree, and memory paths use component-wise no-follow
  traversal; memory append requires an exclusive lock.

## Operator routes

- Session Manager and structured manual: `http://127.0.0.1:8770`
- Website preview: `http://127.0.0.1:8081`
- Full source specification is embedded as the downloadable manual asset.

## Verification

The 2026-08-24 security completion added adversarial RED-to-GREEN coverage for
Git deputy execution, owner replacement, orphan leases, partial thread startup,
provider concurrency, and ancestor symlinks. UI surfaces remain aligned with
the approved opaque industrial anti–AI-design-slop treatment.
