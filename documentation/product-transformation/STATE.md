# Program state: read this first after an interruption

Last updated 2026-11-10 by the homepage/LTC session (Opus 5.5, worktree `~/wt-hub3`, branch `hub-r3`).

## Mandate
- **R110:** a comprehensive PRD per idea, then implementation.
- **R111 (MASTER DIRECTIVE):** a 24-section PRD per idea; a quality review (0–5, minimum 4 per dimension); a cross-PRD review;
  a waved program; autonomous implementation; continuous tests; end-to-end validation; an independent final audit; traceability.
- **Approval is still required for:** destructive DB operations, auth or security boundary changes, feature removal, major
  migrations, new infrastructure cost.

## Current phase
**Phase 1: PRD writing.** The Fable quota is exhausted, so PRDs are written by Opus agents at max effort, 2 agents at a time.

## Scope and ownership
See `01-improvement-register/REGISTER.md`. The peer session (`uds:/run/user/1000/cc-socks/13272.sock`) owns P1–P26, the Q
items merged into them, and X2, X3, X5, X9.

## Done
- Assessment addendum, `803253314`
- Baseline: `00-audit-baseline/BASELINE.md`
- Register
- Tracker header

## Running
- Agent A: PRD-Q06 and PRD-Q04
- Agent B: PRD-Q01 and PRD-Q03

## Next actions, in order
1. When A and B report, start the next PRD wave:
   - C: Q07, Q18, Q17
   - D: Q09, Q15, Q12
   - E: Q10, Q11, X-DEFECTS
2. QA review of every PRD against 12 dimensions (minimum 4), written to `02-prds/QA_REVIEW.md`. Revise any PRD that falls below.
3. Cross-PRD review, master dependency graph and target architecture, written to `03-architecture/ARCHITECTURE.md`.
   Exchange the interface list with the peer (P2 scenario link format, P8 Monte Carlo module, P14 palette).
4. Waved program, written to `04-implementation-plan/PROGRAM.md`.
5. Implement wave by wave. Each item: law red → green, the relevant gates, screenshots at 1440 and 390 that I look at myself,
   release chain, peer message before and after each push.
6. End-to-end validation, then the final audit (`09-final-audit/`), then the traceability matrix.

## Rules that bind every step
- Version numbers only go up, claimed with the peer.
- Push from `~/wt-hub3` with `git push origin hub-r3:main`.
- Never two full gates at once. Browser work goes through `rz-lane`.
- Peer-owned files: cx-*, `id/index.html` meta.
- No pkill -f. No bare `git stash`. Never touch credentials. Never reboot.
- Replies to the owner are in caveman Indonesian. Code and docs are in English.

## Blockers
- X1 key rotation: owner only.
- Q10 and Q11 change auth boundaries: they need the owner's explicit approval before implementation (PRDs proceed).
- Push hold: waiting for the peer's v3.35.10 push SHA.

## Interface agreements with the peer (2026-11-11)
- P2 scenario link: hash `#rzs=`, schema `data/scenario-link.schema.json` v1.
  - Optional `origin`: a string of at most 80 characters, pattern `^[A-Za-z0-9_.:/-]+$`. It is never used for navigation and
    never inserted as HTML.
- P2 task T-P02-C loads `js/rz-scenario.js` and the `#rzs=` reader on tia-942-checklist, tier-advisor, spares and rfs. This
  covers Q3 FR-13 (1).
- TIA Tier and DC type: hidden mirror inputs `#tiaTier` and `#tiaDcType`, kept in step by the setters. P2's E2E test asserts
  the round trip. This covers Q3 FR-13 (3).
- Q3 implementation waits for P2 to land on main. P2 currently lives on the peer's local `feat/p-wave1`.
- P25 service-worker module (v3.37.0, not live yet): `<script src="js/rz-sw-register.js?v=<token>" defer></script>`.
  - Get the token with `node tools/test-asset-cache-tokens.mjs --fix js/rz-sw-register.js`. No config. The `__rzSwRegister` guard
    makes a second tag a no-op.
  - My task, after v3.37.0 is live: delete index.html's inline `serviceWorker.register` block (~1534-1538) and add the tag before
    `</body>`.

## QA batch 1 (2026-11-11)
- The independent review failed Q01, Q03, Q04 and Q07, each on one dimension. The revision v1.1 applies coordinator decisions D1–D8.
  The revising agent then self-scored every dimension at 4 or above; a confirming independent re-check is still owed in QA batch 2.
- Carry-over for the next Q06 revision: FR-3 must remove the `demo` state's light-theme `!important` background
  (`js/rz-telemetry-quality.js:79`), because Q07 training runs use the demo state.
- Q01 has 9 laws, above the brief's 3–8. Accepted: D1 required the idempotence law.
- Owner decisions: `DECISIONS.md` (22 so far, all PROPOSED with a recommended default).

## Pending for 2026-11-12 (owner R115)
- Start Postiz (`~/homelab/dockge/stacks/postiz`, images pulled, not started), owner creates first account + connects socials, then `DISABLE_REGISTRATION=true`.
- Tolaria installed at `~/tools/tolaria` (not opened). Owner to delete empty `~/tools/tolaria-dl`.
