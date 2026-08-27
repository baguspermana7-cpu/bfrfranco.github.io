# Ship Gate Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:executing-plans` to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide deterministic quick and full release verification with clear
product-failure versus environment-blocked outcomes.

**Architecture:** Keep `tools/ship-gate.sh` as the canonical registry and wrap
the existing audits without changing their internals. Exercise the real runner
through fake executable boundaries so its selection, aggregation, and exit-code
contract is fast to test.

**Tech Stack:** Bash, Node.js built-in test runner, Taskfile v3.

**Spec:** `docs/superpowers/specs/2026-08-17-ship-gate-automation-design.md`

## Global Constraints

- Do not commit or push; the user requested implementation only.
- Keep every existing audit command and engine invariant intact.
- Full mode must never run Chromium gates concurrently.
- A blocked browser launch must remain non-zero and must not be called a product
  failure.
- Do not change advisory SEO/a11y policy in this work.

---

### Task 1: Lock the runner contract with a failing behavioral test

**Files:**
- Create: `tools/test-ship-gate.mjs`

**Interfaces:**
- Consumes: `bash tools/ship-gate.sh <mode>` and its process exit code/output.
- Produces: regression coverage for quick/full selection, default-full behavior,
  product failure, environment block, and invalid usage.

- [ ] **Step 1: Write the test harness**

  Create isolated fake `python3`, `node`, and `git` executables. Record every
  invocation to a literal log and make failure behavior controllable with
  `RZ_FAKE_FAIL_MATCH` and `RZ_FAKE_FAIL_MESSAGE`.

- [ ] **Step 2: Run the test and verify RED**

  Run: `node --test tools/test-ship-gate.mjs`

  Expected: FAIL because the old runner does not accept `--quick`/`--full`, does
  not default to the full gate set, and cannot emit the specified outcome codes.

### Task 2: Implement the minimal deterministic runner

**Files:**
- Modify: `tools/ship-gate.sh`

**Interfaces:**
- Consumes: `--quick|--full|--probe|--probe-http`, optional
  `RZ_PROBE_BASE`, and existing audit executables.
- Produces: concise per-gate result lines, final summary, retained failure logs,
  and exit codes `0|1|2|64`.

- [ ] **Step 1: Add explicit argument parsing and gate registries**

  Default to full. Keep quick gates in one function and render gates in one
  function so Taskfile never duplicates the list.

- [ ] **Step 2: Add isolated logs and result aggregation**

  Generate numbering from the run counter. Print a concise PASS line; print a
  full log for FAIL/BLOCKED.

- [ ] **Step 3: Add environment classification and browser lock**

  Classify known Chromium launch/sandbox errors as BLOCKED. Use one bounded
  `flock` for full mode.

- [ ] **Step 4: Verify GREEN**

  Run: `node --test tools/test-ship-gate.mjs`

  Expected: all runner-contract tests pass.

### Task 3: Wire human entry points and release documentation

**Files:**
- Modify: `Taskfile.yml`
- Modify: `standarization/VERSIONING_STANDARD.md`
- Modify: `standarization/CONTENT_LINKAGE_PLAYBOOK.md`
- Modify: `CLAUDE.md`
- Modify: `js/rz-version.js`
- Modify: `CHANGELOG.md`
- Generated: `changelog.html`
- Generated: `sw.js` if `tools/sync-sw-version.py` requires it

**Interfaces:**
- Produces: `task check`, `task verify`, and `task test:ship-gate`.

- [ ] **Step 1: Add Taskfile aliases**

  Run the focused runner test first, then map aliases directly to the canonical
  runner; do not duplicate gate commands.

- [ ] **Step 2: Replace stale process instructions**

  Document quick versus full semantics and the meaning of exit code 2.

- [ ] **Step 3: Apply release bookkeeping**

  Bump the feature release to `1.127.0` dated `2026-08-17`, add the changelog
  entry, rebuild `changelog.html`, and synchronize the service-worker version.

- [ ] **Step 4: Run focused verification**

  Run: `task test:ship-gate`

  Run: `task check`

  Expected: both exit 0.

### Task 4: Prove the complete workflow and review the diff

**Files:**
- Modify only if verification exposes a root-cause defect in files already
  listed above.

**Interfaces:**
- Consumes: the completed canonical runner.
- Produces: fresh full-gate evidence and a reviewed, scoped diff.

- [ ] **Step 1: Run full verification with Chromium permission**

  Run: `task verify`

  Expected: every selected gate passes and the runner exits 0.

- [ ] **Step 2: Re-run generated-file safety gates**

  Run: `python3 tools/audit-script-tags.py --strict`

  Run: `python3 tools/audit-js-syntax.py --strict`

  Run: `python3 tools/audit-version-stamp.py --strict`

- [ ] **Step 3: Review scope and repository state**

  Run: `git diff --check`

  Run: `git status --short`

  Inspect every changed file; preserve the user's unrelated untracked files.

- [ ] **Step 4: Update the project bug tracker and memory**

  Record the proven root cause, the new commands, and the no-commit/no-push
  handoff.
