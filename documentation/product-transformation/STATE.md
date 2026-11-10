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
