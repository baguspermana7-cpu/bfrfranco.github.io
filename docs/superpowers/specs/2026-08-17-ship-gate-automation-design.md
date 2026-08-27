# Ship Gate Automation Design

## Goal

Make release verification deterministic and one-command while preserving the
existing audits. A product defect, a browser-environment block, and a clean run
must produce different, actionable outcomes.

## Evidence and root cause

- Every current strict product gate passes when Chromium is allowed to launch.
- Chromium launched from the restricted execution sandbox exits before page
  evaluation with `setsockopt: Operation not permitted` from crashpad.
- Adding Chromium crash-reporter flags does not change that result.
- `tools/ship-gate.sh` predates seven current strict gates and therefore can
  print "safe to push" without running responsive-layout, dark-coverage,
  accessibility, interaction, chart-provenance, page-gate, or hero-image
  verification.
- The runner also has a hard-coded duplicate gate number and a shared
  `/tmp/_probe.log`, both of which make concurrent runs ambiguous.

## Accepted behavior

1. `task check` validates the runner contract, then runs the fast static and
   engine gates.
2. `task verify` validates the runner contract, then runs every fast gate plus
   all four Chromium render gates.
3. `bash tools/ship-gate.sh` defaults to the full verification so the command
   named "ship gate" can never silently omit a required gate.
4. `--quick`, `--full`, `--probe`, and `--probe-http` have explicit semantics;
   legacy probe modes remain supported and add the accuracy probe to a full run.
5. Full runs serialize through one Chromium lock to avoid known concurrent
   headless-browser false failures.
6. Each gate writes to an isolated temporary log. Passing output stays concise;
   failing output is printed in full and the retained log directory is reported.
7. Exit codes distinguish outcomes:
   - `0`: every selected gate passed.
   - `1`: at least one product gate failed.
   - `2`: no product failure was seen, but at least one gate was blocked by the
     execution environment.
   - `64`: invalid command-line usage.
8. Browser-launch messages such as `Failed to launch the browser process` plus
   permission/sandbox errors are labelled `BLOCKED`, never misreported as a
   product regression or a pass.
9. The existing engine acceptance suites and engine byte-diff guard remain part
   of both modes.
10. A real behavioral regression test executes the real runner with fake
    `python3`, `node`, and `git` boundaries; it verifies selected commands,
    summaries, exit codes, and environment classification without launching the
    expensive audits.

## Gate sets

### Quick

- `audit-script-tags.py --strict`
- `audit-js-syntax.py --strict`
- `audit-version-stamp.py --strict`
- `audit-mobile-responsive.py --strict`
- `audit-article-charts.mjs --strict`
- `audit-page-gates.mjs --strict`
- `audit-hero-images.mjs --strict`
- Datahall, conventional, CDU, and fire engine acceptance suites
- Engine byte-identical guard

### Full additions

- `audit-responsive-layout.mjs --strict`
- `audit-dark-coverage.mjs --strict`
- `audit-a11y.mjs --strict`
- `audit-interactions.mjs --strict`

The non-strict SEO recommendations and non-gating accessibility advisories stay
visible in their dedicated audits but are not converted into release failures.

## Components

- `tools/ship-gate.sh`: the only gate registry and outcome aggregator.
- `tools/test-ship-gate.mjs`: behavioral regression tests around the runner.
- `Taskfile.yml`: human-friendly `check`, `verify`, and `test:ship-gate` entry
  points; no duplicated command registry.
- Project process documentation: points contributors to the canonical commands
  instead of maintaining another stale list.

## Error handling and concurrency

The runner does not use `set -e`, because all selected gates should be reported
in one run. It does use unset-variable and pipe-failure protection. Full mode
acquires a bounded `flock` before starting Chromium gates. A lock timeout is a
product-independent environment block. Temporary paths come from `mktemp -d`;
successful runs remove them, while failed or blocked runs retain them.

## Non-goals

- No automatic commit, push, deployment, or Git hook installation.
- No GitHub Actions workflow in this change.
- No diff-based skipping; implicit dependency detection could miss a gate.
- No edits to the individual audit algorithms.
- No mass rewrite of existing SEO or accessibility advisories.

## Verification

1. Observe the new regression test fail against the old runner.
2. Implement the minimal runner behavior and observe the test pass.
3. Run `task check` inside the normal workspace.
4. Run `task verify` with permission for Chromium and confirm all selected gates
   pass.
5. Re-run the repository strict static gates after generated release files are
   updated.
