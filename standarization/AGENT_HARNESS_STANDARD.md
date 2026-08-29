# Long-Running Agent Harness Standard

> Status: required for governed local agent loops
> Last updated: 2026-08-30
> Public scope: lifecycle, verification, privacy, and handoff rules only

## 1. Purpose and boundary

The RZ harness keeps long-running coding work recoverable across CLI restarts,
context compaction, provider changes, and controller crashes. Durable state is
the source of truth; model context and native goal features are accelerators,
not authoritative storage.

This website repository stores only public-safe standards, changelog entries,
and privacy gates. Runtime databases, transcripts, provider session identities,
private context bridges, locks, and worktree state remain machine-local and must
never be tracked. The default private state root follows
`$XDG_STATE_HOME/rzharness` (or the platform-equivalent user state directory).

## 2. Mandatory invariants

1. **Persistent state** — checkpoints survive process and CLI restarts.
2. **Frozen contract** — normalized contract text has an immutable SHA-256
   reference; a changed objective creates a new work item, never a silent edit.
3. **Legal transitions** — project and work-item transitions are explicit and
   validated. `BUILDING` cannot jump directly to `PASSED`.
4. **Independent acceptance** — builder output is not self-accepting. Required
   gates and configured reviewer quorum must pass.
5. **Exact-revision evidence** — candidate and accepted revisions are distinct;
   final acceptance names the revision that was actually verified.
6. **Recoverable progress** — every checkpoint records lifecycle, phase,
   attempt budget, acceptance count, unresolved defects, and exact next action.
7. **Bounded autonomy** — iteration, time, token, process, filesystem, network,
   and permission boundaries are explicit and fail closed.
8. **Baseline integrity** — pre-existing failures are captured before build and
   cannot be misreported as new success.
9. **Private containment** — state is outside the target repository, written
   atomically with private permissions, and protected from traversal/symlinks.
10. **Observable behavior** — browser/CLI workflows and deterministic gates
    outrank plausible-looking code or reviewer prose.

## 3. Lifecycle and checkpoint contract

The normal work-item flow is:

`NOT_STARTED → CONTRACTING → READY → BUILDING → SELF_VERIFYING → EVALUATING → PASSED`

Failure, pause, and blocked states may be entered only through the declared
transition table. A passing checkpoint requires complete acceptance counts, no
blocking condition, no unresolved defects, and an accepted revision.

Every attached CLI displays one compact line based on the same durable object:

```text
RZ-HARNESS · PRJ-… · WI-… · EVALUATING · phase VERIFY · attempt 2/5 · AC 17/18 · candidate … · accepted none · next: …
```

The full handoff and the compact line must be derived from one checkpoint model;
UI, daemon, and provider-specific hooks may not invent separate status.

## 4. Always-on controller

- One user-scoped controller runs continuously under the host service manager.
- A private non-blocking lock enforces a single writer.
- The loop emits a heartbeat at a bounded interval and survives transient tick
  failures; the service manager restarts a crashed process.
- Unenrolled repositories are explicitly `UNENROLLED` and idle. The controller
  never infers authority to edit or start work merely because a shell opened.
- Session attachments use `provider:<opaque-id>` namespaces so providers cannot
  overwrite one another.
- Codex, Claude, and the local chat CLI load the same checkpoint at session
  start. Claude's status line also exposes it continuously.

## 5. Approval and permission policy

Routine, in-scope local actions are automatic: read, edit, non-destructive test,
local service restart, daemon reload, loop monitoring, and the explicitly
authorized local Git action. The controller batches operations and reuses
narrow, previously trusted command prefixes to avoid repeated prompts.

The harness cannot and must not counterfeit or bypass host/platform security
controls. Destructive local actions, credentials, external writes, deployment,
production changes, purchases, secret rotation, deletion of external data, and
material scope expansion remain explicit human boundaries. A platform-enforced
approval may still appear when the host denies an operation; that is distinct
from an internal harness prompt.

## 6. Orchestrator execution rules

- Work happens in an isolated Git worktree.
- Every start freezes one complete execution assignment and SHA-256 digest:
  repository, exact base revision, task, builder/evaluator identities, gates,
  constraints, budgets, executor options, permissions, and setup. Recovery
  re-derives all fields; evaluation binds the same digest.
- The builder may commit only literal paths introduced by its current iteration
  and only when the frozen policy includes `local_git_commit`. A private
  temporary index hashes raw blobs without repository filters; diff drivers,
  hooks, signing programs, blanket staging, and inherited pre-staged files are
  excluded.
- `.git`, private runtime roots, traversal, and symlink escapes are rejected.
- Timeouts and cancellation terminate the whole spawned process group.
- Configured reviewer quorum never shrinks when a provider is unavailable.
- Every worker atomically claims a database-backed liveness lease with a unique
  owner epoch. A heartbeat renews liveness only while a separate monotonic
  progress deadline remains valid; observable loop progress resets that
  deadline. An explicit pause suspends progress expiry without dropping
  liveness, and each setup, builder, gate, and reviewer deadline exceeds that
  operation's enforced timeout. Every worker, reviewer child, monitor write,
  and external memory drain is fenced to the exact live epoch. Deadline/expiry
  transitions use an atomic compare-and-swap. Restart recovery waits for an
  unexpired orphan lease instead of halting it. A missed progress deadline
  requests cancellation and withholds the service watchdog so the host restarts
  a silently stalled worker.
- Controller IPC becomes available before persisted-run recovery begins. Slow
  Git inspection cannot exceed the service startup deadline or hide CLI status.
  A recovery mutation barrier rejects start/control writes until classification
  finishes, with bounded retry and fail-closed status on repeated failure.
  Expected pending/running recovery keeps the service watchdog live while IPC,
  writer, and executor health remain responsive, even though the mutation
  barrier stays closed. Failed recovery or an actual writer, executor, or IPC
  stall withholds the watchdog and emits an error.
- Repository commands receive a scrubbed environment, disabled Git hooks and
  replacement objects, no network, no sibling paths, and read-only Git metadata.
- Provider workers and reviewers receive no host credentials, user config,
  plugins, rules, or controller state. Reviewers see the candidate worktree as
  read-only. Provider traffic crosses a private Unix broker from a closed
  network namespace; the broker permits one bounded `POST /v1/messages`,
  `POST /v1/messages/count_tokens`, or `POST /v1/responses` request, caps
  concurrent connections at eight, and denies all memory/settings paths.
- Alternate builder paths such as Cascade/RDCST remain disabled until they meet
  the same OS confinement, frozen-assignment, evidence, and cancellation rules.
- Dependency setup binds every relevant root input (for example lockfile plus
  package manifest), revalidates the set immediately before execution, and
  overlays existing inputs read-only inside the repository sandbox.
- Persisted events, turns, diffs, gate output, verdicts, memory, and terminal
  errors redact common credential formats and sensitive fields before prompts
  or UI/SSE exposure. The raw candidate diff remains bound by exact SHA-256.
- Code retrieval and evidence verification skip symlinks and read files through
  component-wise no-follow, beneath-root descriptors. Private access tokens use
  owner-checked no-follow handles. Memory append is also no-follow and requires
  an exclusive lock. Memory sync never imports or forwards ambient browser
  cookies, and retrieved text is explicitly untrusted data.
- UI hard purge is fail closed without durable action-specific destructive
  authorization, refuses live workers, and preserves metadata if cleanup fails.
- Comprehensive production-readiness audit uses capable Codex and Claude
  reviewers against the same full Nielsen, WCAG 2.2 AA, responsive, runtime,
  and frontend-architecture baseline; both must approve.

## 7. Session Manager manual and UI contract

The owner-supplied long-running harness specification is embedded as a
byte-verified, SHA-pinned manual inside Session Manager. It is presented as
structured Quick Start, invariants, lifecycle, evidence/recovery, FAQ, and
specification-map sections with search and deep links.

Manual rendering must use safe DOM text APIs, remain keyboard accessible, retain
the existing industrial Session Manager shell, and pass the 375 px readability
check. Same-origin mutations use the shared CSRF request wrapper. Legacy and
current UIs must remain compatible with namespaced session keys.

## 8. Machine-checkable gates

Run these whenever the harness standard or its public linkage changes. The
first two commands run from the private Session Manager checkout; the final
command runs from the public RZ website checkout:

```bash
python3 -m unittest discover -s tests -q
node tools/manual_harness_test.mjs
task verify
```

The Session Manager suite covers private-state containment, path/symlink
defences, redaction, authorization, lifecycle, bridge, and manual parity. The
website ship gate checks the public standard, generated changelog, version,
accessibility, responsive behavior, and existing site contracts. Runtime
databases, context bridges, credentials, provider identities, and private
checkpoints must remain untracked by the public website repository.

## 9. Change synchronization

Every harness behavior change must update, in the same work batch:

1. implementation tests and security/operational evidence;
2. this standard and `standarization/CONTENT_LINKAGE_PLAYBOOK.md` when the
   durable pattern changes;
3. the embedded manual manifest when the source specification changes;
4. `CHANGELOG.md`, generated changelog HTML, site version, and service-worker
   cache version for a shipped RZ change;
5. the supported private memory update channel and current durable checkpoint.

Historical Claude transcripts and imported memory archives are read-only. New
knowledge is synchronized through project documentation, checkpoints, and the
supported memory bridge rather than rewriting historical sessions.

## 10. Required change and lesson ledger

A work item is not complete while its documentation trails its behavior. Every
change must preserve a concise, auditable record of:

- the reported symptom or requested improvement;
- the reproduced failure and root cause;
- the implementation decision and authorization boundary;
- the regression test or browser/CLI evidence that prevents recurrence;
- lessons learned, known limitations, and any deferred follow-up;
- the exact affected version and changelog entry.

Record durable engineering rules in the closest `standarization/` document and
owner-visible effects in `CHANGELOG.md`; update the Session Manager manual and
Claude/Codex handoff when their behavior or operating instructions change. A
machine-checkable synchronization gate should reject a release when a changed
harness/manual contract has no matching standard or changelog record. Do not
hide rejected reviews or temporarily regressed acceptance counts: they are part
of the evidence history and must remain distinguishable from the final PASS.

### 2026-08-24 hardening ledger

| Finding / symptom | Root cause | Decision and prevention evidence | Reusable lesson |
|---|---|---|---|
| A run could remain marked active while its worker was silently wedged. | Lease columns existed in persistence but executor ownership never claimed or renewed them. | Claim with compare-and-swap, renew only from the exact owner on observable progress, cancel on expiry, and fail the systemd watchdog health check. Store, authority, and daemon tests cover wrong-owner and stale-lease behavior. | A timer thread that renews itself proves only that the timer is alive; leases must follow useful worker progress. |
| Daemon startup could exceed the service deadline during Git recovery. | Persisted-run classification ran synchronously before the IPC socket and readiness notification. | Start authenticated IPC first and classify recovery in a bounded background thread; a test blocks recovery and proves READY appears first. | Recovery is important, but status/control availability is the first recovery primitive. |
| `npm ci` froze only the lockfile while `package.json` could change lifecycle scripts. | Setup policy modeled one selected manifest instead of the full command input set. | Hash deterministic input sets including missing companions, revalidate immediately before setup, and mount existing inputs read-only in the no-network sandbox. | Freeze what the tool actually consumes, not merely the file used to choose the command. |
| Reviewers and repository subprocesses could inherit ambient provider or Git behavior. | Process isolation initially focused on worktree writes, not credentials, user config, hooks, replacement objects, or reviewer mutation. | Remove credential/config mounts and secret env, force loopback broker identities, disable Git hooks/global config/replacements, validate worktree metadata, and make reviewer worktrees read-only. | Read-only review and capability-minimal process environments are separate controls and both are required. |
| Model/gate output and code indexing could expose credentials or follow a file symlink outside the worktree. | Persistence and retrieval trusted output/path shape after execution. | Redact sensitive values at the store boundary; use component-wise no-follow file reads; remove ambient cookie forwarding from memory sync. Dedicated regression tests prove raw secrets and symlink targets are absent. | Treat logs, retrieval, and local memory as data-exfiltration surfaces, even when the service binds only to loopback. |
| A run could start with only a partial daemon assignment, then recover under changed gates, identities, budgets, or setup. | The original run receipt froze selected policy fields but not the complete executor input set. | Persist one canonical execution assignment digest, validate it before launch, re-derive it during recovery, and require the evaluator manifest to carry the same digest. | Exact revision is insufficient when execution policy can drift; freeze the whole decision surface. |
| A new mutation could race the daemon while persisted runs were still being classified. | IPC readiness and recovery readiness were treated as one state. | Keep status/doctor available immediately, but install a recovery mutation barrier with bounded retry and fail-closed readiness. | Availability for observation must not imply authority for mutation. |
| Every normal daemon restart emitted a false stall alert before fast recovery completed. | The watchdog path treated the intentional recovery mutation barrier as an unhealthy writer. | Keep the watchdog live during bounded pending/running recovery when writer, executor, and authenticated IPC health are responsive, while the mutation barrier remains closed. Failed recovery and real health stalls still withhold it. A focused daemon regression test asserts no startup error. | Observation liveness and mutation readiness are separate signals; lifecycle context belongs in health classification. |
| A heartbeat could renew a wedged worker forever, while an initial fixed deadline could incorrectly abort a deliberate pause or a valid 600-second gate. | Durable lease liveness and observable executor progress shared one renewal signal, then the first split used one 180-second budget for every phase. | Use phase-aware monotonic deadlines that exceed setup, builder, gate, and reviewer timeouts; refresh before every gate; suspend expiry during explicit pause and reset it on resume. Heartbeat and health checks atomically stall only the exact owner. | A live timer proves liveness, not progress, but a progress deadline must still understand intentional waits and enforced operation budgets. |
| A stale worker could begin a memory drain, lose ownership, then write RZMemory or OmniRoute after takeover. | The database owner check did not span the non-transactional external side effect and its ledger/status update. | Hold an exact-owner immediate transaction across each bounded external write, ledger entry, and intent transition; filter drains by run and reject stale epochs. The takeover regression proves zero stale external writes. | Fence authority before and through an external side effect, not only around local evidence writes. |
| A lease-thread startup failure could leak the run registry and owner lease until restart. | Cleanup attempted to join a never-started thread and raised before the already-running worker could finalize. | Join only threads that are actually alive, retain the control record while a late worker exits, then release the exact lease once. A partial-start regression exercises the delayed exit. | Partial startup is a normal failure mode; cleanup must be idempotent and aware of never-started resources. |
| An expired worker or reviewer child could continue writing evidence after a replacement claimed the run. | Thread-local lease authority did not cross reviewer/monitor thread boundaries, and a stale monitor updated state unconditionally. | Propagate the exact owner epoch into child threads; transition expiry atomically; wait for live orphan leases during restart; keep partially started threads registered until joined. Wrong-owner, orphan-recovery, and partial-start tests must fail before the fix and pass after it. | Cancellation is cooperative; durable fencing at every thread boundary is the actual split-brain boundary. |
| Provider isolation still exposed every HTTP path on the shared OmniRoute port. | The first broker constrained host/port but relayed arbitrary bytes; Codex also needs the Responses wire API. | Parse exactly one bounded HTTP/1.1 request, allow only Anthropic messages/count-tokens plus OpenAI Responses, cap concurrency at eight, force connection close, and reject chunked, duplicate-length, absolute-form, and pipelined requests. | Network namespaces need application-layer allowlists and resource bounds when multiple capabilities share one loopback port. |
| Cascade/RDCST could bypass the hardened builder adapter. | An alternate import path executed outside the frozen provider contract. | Disable Cascade in runtime and UI; keep a fail-closed compatibility shim until equal confinement is implemented. | A disabled unsafe feature is preferable to a nominal multi-provider feature with unequal boundaries. |
| Git hooks, filters, diff drivers, signing programs, replacement objects, fsmonitor, credential prompts, or linked-worktree metadata could change command meaning. | Ambient and repository Git configuration remained an implicit executable input. | Centralize Git execution, neutralize repository filters, disable external diff/signing/hooks/global config/replacements, build commits through a private index from no-follow raw blobs, preserve unrelated staging, and validate exact worktree identity. | Repository Git configuration is executable policy and belongs outside the worker's authority. |
| Raw diffs and federated memory could leak credentials or inject instructions into later prompts. | Redaction and trust labels were applied after some persistence/retrieval paths. | Redact at store/envelope/network boundaries, retain a separate raw diff digest, bound memory fields, and label all retrieved text untrusted data-only. | Preserve integrity hashes separately from the safe representation shown to agents and humans. |
| Token and evidence validation could be redirected by a symlink swap between check and read. | Path-based validation reopened a mutable pathname after inspection. | Open each path component with no-follow descriptors, validate ownership/type/link count on the pinned descriptor, and hash/read that descriptor only. | Security checks and data use must operate on the same file handle. |

### 2026-08-26 integration ledger

| Finding / symptom | Root cause | Decision and prevention evidence | Reusable lesson |
|---|---|---|---|
| Cross-CLI review required manually moving task files between Claude and Codex. | The handoff format existed, but no continuously watched, idempotent inbox contract owned delivery and acknowledgement. | Use automatic `for claude/` and `for codex/` inboxes with stable envelope IDs, atomic writes, lease/fencing, acknowledgements, and exact repository path plus revision SHA references. Bridge tests cover replay and duplicate delivery. | Human drag-and-drop is not a control plane; durable envelopes and acknowledgements are. |
| A missing or quota-limited reviewer could consume an iteration or silently reduce review strength. | Provider availability was conflated with a negative technical verdict. | Record `provider_unavailable` separately, preserve configured quorum, and do not consume rejection or implementation iteration budget until an eligible reviewer returns a verdict. | Infrastructure absence is evidence about capacity, not evidence that a candidate is wrong. |
| A trusted localhost CLI request was rejected after central middleware accepted it. | Framework-synthesized forwarding headers were evaluated before the middleware's signed direct-peer locality verdict. | Strip client locality claims, bind trust to the raw socket peer, stamp a signed internal verdict, and prefer that trusted locality before forwarded markers. Focused authorization tests and a live forged-locality probe require remote-shaped requests to remain unauthorized. | Reverse-proxy metadata cannot override a cryptographically bound direct-peer decision. |
| Node 24 CLI/server packaging could produce an empty machine identifier, and the server still hashed it into a usable token. | CJS/ESM export-shape drift was silently caught, while token derivation treated an empty identifier as valid entropy. | Reject blank identifiers before derivation, read the Linux machine ID without package interop, accept the package default-export shape on other platforms, and prefer a validated random `OMNIROUTE_CLI_TOKEN`; when the explicit token exists, disable machine-derived legacy acceptance. Unit/authz tests and a live predictable-token rejection probe cover the boundary. | A caught identity-source failure must remove authority; hashing an empty fallback converts failure into a shared default credential. |
| A packaged server rejected the current explicit CLI token even though its child process received the environment variable. | Turbopack statically eliminated or inlined direct property reads of the runtime-only secret during the production build. | Resolve the fixed environment key through a runtime-dynamic lookup, keep validation fail-closed, and require the installed-package probe to accept the current token while rejecting empty-ID, machine-derived, and forged-proxy variants. A source regression test forbids direct property reads. | Source tests do not prove runtime-secret availability after bundling; validate the installed artifact across the real process boundary. |
| An npm artifact passed its pack policy but crashed because a temporary Next.js `distDir` was baked into `server.js`, then pruned by the canonical artifact allowlist. | Structural pack validation checked allowed files but did not boot the assembled server, and the diagnostic build path differed from the published runtime path. | Publish only from a clean canonical `.build/next` build, keep temporary outputs outside the trace scope, and require a packaged boot plus `/healthz` probe after installation. | An archive can be structurally valid yet operationally incomplete; pack validation and installed boot verification are distinct gates. |
| A fresh third-party CLI credential database existed but had no schema, so the first adapter write failed. | The adapter treated file presence as proof that the CLI had completed its own storage lifecycle. | Bootstrap the CLI through its official local initialization path before adapter writes, then verify only provider/count/health metadata and never print credential values. | File existence is not schema readiness; external tools own their migrations and should initialize themselves. |
| A postinstall repair emitted a missing-native-module warning even though the module loaded normally. | The check assumed a legacy unsuffixed binary name while current packages publish libc- or toolchain-suffixed filenames. | Resolve the package's GNU, musl, MSVC, and legacy filename variants, attempt only exact platform/architecture candidates, and regression-test the candidate list on every supported family. | Native-module health must be proven by loading a published candidate, not inferred from one historical filename. |
| A fully tested candidate was easy to describe as accepted before an independent evaluator had pinned it. | Candidate evidence and terminal acceptance were treated as one milestone in status prose. | Keep candidate and accepted revisions separate in every CLI/UI checkpoint. A terminal `PASSED` state requires the evaluator manifest, reviewer quorum, gates, and the exact accepted revision; the current completion checkpoint therefore remains `EVALUATING` until that record exists. | Honest incomplete state is safer than a synthetic green status. |
