# Waved implementation program

Written 2026-11-11 by the homepage/LTC session (Opus 5.5, worktree `~/wt-hub3`). Inputs: the 13 PRDs at commit
`ed815502e`, `../DECISIONS.md` (86 rows), `../STATE.md`, and `../03-architecture/ARCHITECTURE.md` (module specs §1,
conflicts K1–K14 §2, dependency graph §3, cross-cutting rules §4). Citation form as in ARCHITECTURE.md (`Qnn:line`,
`XD:line`, `DEC:line`, `STATE:line`).

Six waves. A wave is a set of release units whose prerequisites are in earlier waves or earlier in the same wave
(intra-wave order is written where it matters). Node names (`Q06-a`, `M-OD`, …) are those of ARCHITECTURE §3.1; the
order of the waves is a topological order of that graph (ARCHITECTURE §3.4: 43 nodes, 54 edges, acyclic).

## 0. Rules that apply to every wave

| Rule | Source |
|---|---|
| Each item: law red on today's tree → green; screenshots at 1440 and 390, both themes, looked at by the session | `STATE:38` |
| Release chain: next free version claimed with the peer; `js/rz-version.js`; `CHANGELOG.md`; `python3 tools/build-changelog-html.py --apply`; `python3 tools/sync-sw-version.py`; peer message before and after each push; `git push origin hub-r3:main` | `STATE:38-44`, `Q17:876` |
| Never two full gates at once; browser work through `rz-lane` | `STATE:45` |
| Gates on every release: `bash tools/ship-gate.sh` (exit 0), `node tools/test-asset-cache-tokens.mjs` (exit 0), `python3 tools/test-generator-freshness.py` (exit 0), `node tools/test-gate-wiring.mjs` (exit 0) | `CLAUDE.md` audit list; `Q06:1529`, `Q10:2019`, `Q11` §20.3 |
| New gate lines go into `tools/ship-gate.sh` by anchor text, never line number; one owner per release | `QA2:409` |
| A token change on an asset that a peer-owned page loads is sent to the peer before the push (ARCHITECTURE §4.4) | `STATE:46` |
| An owner-gated item ships only when its `DECISIONS.md` row is ACCEPTED or DEFAULTED with a request id `^R[0-9]{3,4}$`; otherwise its fallback ships | `DEC:7-17` |
| A law whose precondition (owner, peer) is unmet runs in report mode and joins `--blocking`/`--strict` only in the release that meets it | `Q09:26` (D9), `Q15:26`, `XD:1594-1610` |

Expected output convention in the exit tables: "exit 0" means the command exits 0 and prints no line containing `FAIL`.
The PRDs name law-by-law failure lines (for example `Q12` §20.4, `Q18:688`); they are not repeated here.

---

## Wave 1: foundations, honesty layer, incident state model

**Items**

| Item | Scope | Source |
|---|---|---|
| `M-OD` `tools/owner_decisions.py` | `decide`, `record`, record kinds registry; spec ARCHITECTURE §1.1. First needed by Q09 T-5 and Q15 T-9 in this wave | `Q09:1001`, `Q15:780`, `DEC:17` |
| Q06 without T-13 (`Q06-a`) | T-1…T-12, T-14…T-17; creates `M-PROV` `js/rz-provenance.js` (T-2) | `Q06:1460-1476` |
| Q09 Phase A (`Q09-A`) | T-1…T-7, T-15, T-16; creates `M-IR` `tools/lib/incident_rules.py` in T-2, migrates `sourcing.state` (15 seed, 28 legacy) | `Q09:997-1012`, `:1015` |
| Q17 T-1 (`Q17-T1`) | Explain-DB title fix and regeneration (X13) | `Q17:769`, `XD:40` |
| Q15 Phase A (`Q15-A`) | T-1…T-4, T-6; T-9 decision packet sent at the start | `Q15:772-777`, `:780` |
| X-DEFECTS R1 | T-1, T-2, T-5, T-6a, T-9 (X10 interim labels), T-10, T-12 (link, market copy), T-14, T-15; T-7 read-only probes | `XD:1721` |
| Decision packets to the owner | All PROPOSED rows of `DEC` (86), grouped per PRD, sent once | `Q09:1003`, `Q15:780`, `Q12:639`, `Q03` T-8 (`Q03:853`) |

**Entry criteria**
- None from other PRDs. Q06 needs no owner decision to start; D-Q06-1 gates only the copy sweep T-14 (`DEC:39`).
- Q15 T-4 needs the peer for `id/index.html` (`Q15:775`); until then L4b stays in report mode (`Q15:836`).
- Q06 T-14 messages the peer first for the tracker and OG generator (`Q06` T-14 row).

**Blocked inside this wave**
- Q06 T-14 copy sweep: blocked until D-Q06-1 approved. Fallback: ship T-1…T-13 without the title/meta rewrites; L4
  stays in report mode.
- X-DEFECTS X4/X6 placement: D-Q06-2 (default A: Q06 specifies them, `DEC:40`, `XD:338`). Fallback under B: X-DEFECTS
  v1.1 adds two FR groups (`XD:580`).
- X-DEFECTS X18 interim copy: D-XDEF-6 (default A, change the CTA now, `DEC:103`). Fallback: page unchanged until
  D-Q17-2.

**Exit criteria (laws)**

| Law | Command | Expected |
|---|---|---|
| `M-OD` exists and refuses a bad request id | `python3 tools/owner_decisions.py decide D-Q09-1 --status ACCEPTED --request R12; echo $?` then `git diff --quiet DECISIONS.md; echo $?` | `2`, then `0` (file byte-identical). Red today: `No such file or directory` |
| `M-IR` covers every dossier | `python3 tools/lib/incident_rules.py dump \| python3 -c 'import json,sys;d=json.load(sys.stdin);print(len(d),sum(v["state"]=="seed" for v in d.values()))'` | `43 15` (counts of `Q09:998`; Q09 batches later move seeds) |
| Q06 L1–L8 | `node tools/test-provenance.mjs --law L1` … `--law L8`; `node tools/test-provenance-runtime.mjs` | exit 0 (`Q06:1505-1512`) |
| Q09 Phase A | `node tools/test-incident-verification.mjs --phase A` | exit 0; L2–L4 print REPORT lines and do not fail (`Q09:1012`) |
| Q17 L6 | `node tools/test-learning-paths.mjs --law L6` | exit 0: no explain-DB title contains "((" (`Q17:833`) |
| Q15 Phase A | `node tools/test-i18n.mjs --law L1`, `--law L2`, `--law L6` | exit 0 (`Q15:832-833`, `:838`) |
| X-DEFECTS R1 laws | `node tools/test-x-defects.mjs --law X10.1`; `node tools/test-no-client-secrets.mjs --law X1.2a`; `python3 tools/test-crawler-seo.py` (L-X7.1) | exit 0 (`XD:1571`, `:1574`, `:1578`) |

---

## Wave 2: engine paths, training mode, patterns page, relations phase 1

**Items, in intra-wave order where it matters**

| Item | Scope | Source |
|---|---|---|
| `M-STUB` `tools/lib/rz-supa-stub.mjs` | Spec ARCHITECTURE §1.4; first consumer Q07 L6 (`Q07:1081`), later Q12 and Q17 | `QA2:346`, `Q17:277` |
| Q04 (`Q04`, `Q04-T14`) | T-1…T-8, T-10…T-18 except T-9; engine release serialised with X-DEFECTS R4 (one engine change per release) | `Q04:1592-1609`, `XD:1317` |
| Q06 T-13 (`Q06-T13`) | DCMOC notice and rebuild, after Q04 T-14/T-15; one rebuild if in the same release | `Q06:1472`, `Q04:16`, `Q06:1266` |
| Q04 T-9 (`Q04-T9`) | tier-advisor switch. First on the page after P2 (D11) | `Q04:1600`, `Q17:16` |
| Q07 Phases A and B (`Q07-AB`) | T-1…T-16 (T-9 account save uses `M-STUB`); `relatedIncidents` stays empty (V16) | `Q07:1025-1040`, `Q07:16` |
| Q18 v1 (`Q18-v1`) | T-1…T-7, after Q09 T-2 | `Q18:615-620` |
| Q01 phase 1 (`Q01-p1`) | T-1…T-6, T-8…T-12 (tool and term rows). Its tier-advisor block lands after Q04 T-9 | `Q01:939-950`, `DEC:25` |
| Q15 Phase B (`Q15-B`) | T-5, T-7…T-11, after Q17 T-1 | `Q15:776`, `:778-782`, `Q15:16` |
| X-DEFECTS R2 (X11 tools hub), R3 (X7-B FAQ data), R4 (X15 engine) | T-11; T-6b; T-13 | `XD:1722-1724` |
| Q09 seed batches and legacy fixes (`Q09-BC`) | T-8…T-14, as owner answers arrive | `Q09:1004-1010` |

**Entry criteria**
- Wave 1 landed: `M-PROV` (Q06 T-2) for Q04 FR-16 and Q07 (`Q04:16`, `Q07:16`); `M-IR` for Q18 T-2 (`Q18:615`);
  Q17 T-1 for Q15 T-7 (`Q15:16`); Q06 before Q07 on `datahall.html` (`QA2:418`).
- Peer: P2 on main for Q04 T-9 and hence for Q01's tier-advisor block (`STATE:62`; conflict K12).

**Blocked inside this wave**
- Q04 visible-number switches: T-3 blocked until D-Q04-9, T-4/T-5 until D-Q04-1, D-Q04-2, D-Q04-4, T-7/T-11 until
  D-Q04-3, T-12 until D-Q04-7, T-13 until D-Q04-5, T-14 until D-Q04-6, T-9 until D-Q04-8 (`Q04:1594-1605`,
  `DEC:30-38`). Fallback per row: the decision's option B (`DEC:30-38`); a rejected switch leaves that page as today and
  its law in report mode.
- Q04 T-9 and Q01's tier-advisor block: blocked until P2 is on main. Fallback: Q04 ships its other pages; Q01 phase 1
  ships with the tier-advisor block deferred (Gap PG5).
- Q07 publication: the four scenario files blocked until D-Q07-4 (`DEC:44`). Fallback: code ships, scenarios stay
  `draft`, the Training button shows no approved scenario.
- Q01 acceptance of edges: method D-Q01-2 (`DEC:24`), then the owner review T-10 (`Q01:948`). Fallback: no accepted
  edge, no rendered block; L1 in report mode.
- Q15 Phase B: blocked until D-Q15-1 and D-Q15-2 (`DEC:66-67`). Fallback: Phase A stays; legacy page unchanged.
- X-DEFECTS R3: blocked until D-XDEF-1 (`DEC:98`). Fallback: L-X7.2 stays in report mode.
- Q09 batches B4/B5: blocked until D-Q09-7, D-Q09-8 (`Q09:1007-1008`); T-14 until D-Q09-16.

**Exit criteria (laws)**

| Law | Command | Expected |
|---|---|---|
| Q04 L1–L8 (L2 only after T-9) | `node tools/test-engine-paths.mjs --law L1` … `--law L8`; `node tools/test-engine-paths-runtime.mjs` | exit 0 (`Q04:1651-1658`) |
| Engine invariants after Q04 and X15 | `node tools/test-rz-engine.mjs`; `node tools/test-value-bindings.mjs`; `node tools/test-reference-parity.mjs` | exit 0 (`Q04:1390-1391`, `XD:1323`) |
| DCMOC trace parity after the one rebuild | `node tools/_dcmoc_trace_parity_probe.mjs` | exit 0 (`Q04:1393`) |
| Q07 L1–L8 | `rz-lane -l 1 -t 900 -- node tools/test-fault-scenarios.mjs --strict` | exit 0 (`Q07:1054`, `:1076-1083`) |
| `M-STUB` is the one stub | `grep -l "rz-supa-stub.mjs" tools/test-fault-scenarios.mjs` | prints the file |
| Q18 L1–L8 | `node tools/test-incident-patterns.mjs --law L1` … `--law L8`; `python3 tools/build-incidents.py --check` | exit 0 (`Q18:668-675`) |
| Q01 L1–L9 (L6 report mode) | `node tools/test-relations.mjs --law L1` … `--law L9`; `python3 tools/build-relations.py --check` | exit 0 (`Q01:990-998`) |
| Q15 Phase B | `node tools/test-i18n.mjs --strict`; `python3 tools/build-glossary.py --check` | exit 0 (`Q15:782`, `:834`) |
| X-DEFECTS R2/R4 | `node tools/test-tools-hub-coverage.mjs`; `node tools/test-x-defects.mjs --law X15.1`, `--law X15.2` | exit 0 (`XD:1579-1580`, `:1583-1584`) |

---

## Wave 3: reproduce, relations phase 2, terminal sync, X1

**Items**

| Item | Scope | Source |
|---|---|---|
| Q01 phase 2 (`Q01-p2`) | T-7 `auth.js` matcher + `/dc-incident-patterns.html` entry (K4), dossier rows in `build-incidents.py` | `Q01:945`, `DEC:25`, `Q18:516` |
| Q03 (`Q03`) | T-1…T-11; on `build-incidents.py` after Q01 phase 2 when that ships | `Q03:844-855`, `Q18:505` |
| `M-AS` `js/rz-app-state.js` and Q12 T-2/T-3 | Gate with `M-STUB`, module, finance adapter | `Q12:640-641` |
| X-DEFECTS R5 (X1) and R6 (X8) | T-3/T-4; T-8 | `XD:1725-1726` |
| Q12 T-4…T-6 (`Q12-T4`) | Terminal hooks, release, live two-profile check | `Q12:642-644` |
| Q15 Phase C batch 1 (`Q15-C`) | T-12 | `Q15:783` |
| Q18 link lock (`Q18-lock`) | Rides Q01 phase 2 | `Q18:516` |
| Q07 related incidents (`Q07-rel`) | Scenarios with `relatedIncidents`, rendered through Q01's renderer | `Q07:16`, `:887` |

**Entry criteria**
- Wave 2 landed: Q01 phase 1 (`Q03:854`, `DEC:25`), Q18 v1 before Q01 phase 2 on `build-incidents.py` (`Q18:505`),
  Q09 Phase A (`Q03:16`), `M-STUB` for Q12 T-2.
- Peer: P2 Part 2 on main for Q03 T-6/T-9 (`Q03:849`, `:853`).

**Blocked inside this wave**
- Q01 phase 2, Q18 lock, Q07-rel: **blocked until D-Q01-3 approved** (auth boundary, `DEC:25`). Fallback: phase 1
  only; the patterns page keeps its page-level root check and no public page links it; Q07 V16 keeps
  `relatedIncidents` empty (`DEC:25`, `Q18:515`, `Q07:16`).
- Q03: **blocked until D-Q03-1 approved**, then D-Q03-2, D-Q03-3, D-Q03-4 (`DEC:26-29`). Fallback: Q03 not built; Q01
  receives no R2I proposals.
- `M-AS` and Q12: **blocked until D-Q12-1 = A** (`Q12:485`, `DEC:61`). Fallback: option C, tasks T-C1/T-C2
  (`Q12:645-646`); Q17 then ships device-only progress (`Q12:485`).
- Q12 T-4…T-6: **blocked until OA-1** (owner rotates the Finnhub key) and X-DEFECTS R5 (`Q12:642`, `XD:1726`); T-5 also
  needs D-Q12-2, T-6 needs D-Q12-4 (`Q12:643-644`). Fallback: module and gate land; the terminal is not hooked.
- X-DEFECTS R5 blocked until OA-1; T-4 until OA-2, OA-3, D-XDEF-11; R6 until OA-4 and D-XDEF-8 (`XD:1725-1726`).
  Fallback: L-X1.1, L-X1.2b, L-X8.1, L-X8.2 stay in report mode.
- Q15 Phase C: blocked until D-Q15-4 and D-Q15-5 (`Q15:783`).

**Exit criteria (laws)**

| Law | Command | Expected |
|---|---|---|
| Matcher fixed (if D-Q01-3 accepted) | `node tools/test-relations.mjs --law L6`; `node tools/audit-min-twins.mjs --strict` | exit 0 (`Q01:995`, `:945`) |
| Patterns page in the root list | `node tools/test-incident-patterns.mjs --law L6` | exit 0 (`Q18:673`) |
| Q03 L1–L7 | `python3 tools/test-incidents-reproduce.py --law L1`, `L5`, `L7`; `node tools/test-incidents-reproduce.mjs --law L2`…`L4`, `L6` | exit 0 (`Q03:895-901`) |
| `M-AS` contract | `node tools/test-ft-sync.mjs --law L2`, `--law L4`, `--law L6`, `--law L7` | exit 0 (`Q12:641`, `:681-686`) |
| Q12 full (after OA-1) | `node tools/test-ft-sync.mjs --strict --option A` | exit 0 (`Q12:680-687`) |
| X1 closed | `node tools/test-x-defects.mjs --law X1.1`; `node tools/test-no-client-secrets.mjs --law X1.2b` | exit 0 (`XD:1570`, `:1572`) |
| Worker identity | L-X8.1, L-X8.2 in `node tools/test-x-defects.mjs` | exit 0 (`XD:1576-1577`) |

---

## Wave 4: learning paths

**Items**

| Item | Scope | Source |
|---|---|---|
| Q17 core (`Q17-core`) | T-2…T-6, T-9…T-11, T-13 | `Q17:770-779` |
| Q17 account sync (`Q17-T7`) | Registers `learning-paths/v1` with `M-AS` | `Q17:775` |
| Q17 incident lock (`Q17-T8`) | Through Q01's renderer, or the rejected path | `Q17:776` |

**Entry criteria**
- Q04 T-9 shipped (`Q17:774`); Q01 phase 1 with the six required edges accepted (`Q17:16`, `:779`, D-Q17-1); Q15 Phase
  A/B shipped, Q17 T-9 last on `glossary.html`/`articles.html` (`Q15:663`); Q03 shipped, Q17 re-proves L3 last on
  `tier-advisor.html` (`Q17:644`); `M-OD` for `record learning-path` (`Q17:19`).
- T-7 also needs `M-AS` and `M-STUB` (`Q17:775`, `:818`).

**Blocked inside this wave**
- Path publication: **blocked until D-Q17-1** (`DEC:73`). Fallback: files stay `proposed`, the page is not built from
  them (`Q17:642`).
- T-7: blocked until `M-AS` exists (D-Q12-1 = A). Fallback: device-only progress (`Q17:132`).
- T-8: depends on D-Q01-3. Fallback: the stated rejected path of FR-8 (`Q17:26`, `Q17:776`).
- T-12 measurement: D-Q17-4 (default A, no metric, `DEC:76`). Fallback: no events.

**Exit criteria (laws)**

| Law | Command | Expected |
|---|---|---|
| Q17 L1–L8 | `node tools/test-learning-paths.mjs --law L1` … `--law L8` | exit 0 (`Q17:828-835`) |
| No `auth.js` change by Q17 | `git diff --stat <wave-4 base>..HEAD -- auth.js auth.min.js` restricted to Q17 commits | empty (`Q17:775`) |

---

## Wave 5: admin console on real data, server-side flags (auth and privacy boundary)

**Items, in order**

| Item | Scope | Source |
|---|---|---|
| `M-PG` `tools/lib/pg-harness.mjs` + `rzLoadConfig()` | Created by the first of Q10 T-1 / Q11 T-1 | `Q10:1941`, `Q11:995` |
| Q10 | T-1…T-16 | `Q10:1941-1957` |
| Q11 | T-1…T-11, after Q10 because L4 needs Modules 0–11 (K11) | `Q11:995-1005`, `:1031` |

**Entry criteria**
- X-DEFECTS R1 (X10 interim labels) landed; Q10 FR-8 supersedes it (`XD:1313`).
- X-DEFECTS R2 (X11) landed; Q11 FR-6 changes five access sentences in the same release (`XD:1314`).
- Peer: P25 status known for the `sw.js` `NETWORK_FIRST_PATHS` edit (`Q10:241`); peer agreement on the
  `cx-calculator.html` and `id/index.html` GA block and tokens (ARCHITECTURE K10, §4.4).
- Owner actions: Q10 OA-1…OA-5 (`Q10:16`, §22.1); Q11 OA-1 SQL (`Q11:16`).

**Blocked inside this wave**
- Q10: **blocked until D-Q10-1…D-Q10-11 decided** (`Q10:19`, `DEC:79-89`); go-live also needs OA-2 (`Q10:1957`).
  Fallback: X-DEFECTS X10 labels stay on the generated panels; no consent-gated counter; GA unchanged.
- Q11: **blocked until D-Q11-1…D-Q11-8 decided** (`Q11:19`, `DEC:90-97`); T-3 (`auth.js` listener) specifically until
  D-Q11-8 (`Q11:997`); go-live needs OA-1 (`Q11:1005`). Fallback: the shipped matrix stays the only source; the admin
  panel keeps today's behaviour.

**Exit criteria (laws)**

| Law | Command | Expected |
|---|---|---|
| Q10 L1–L8 | `node tools/test-admin-real-data.mjs --static`; `node tools/test-usage-consent.mjs --static`; `node tools/test-usage-events-sql.mjs`; `node tools/test-mayar-proxy.mjs`; browser runs of the same gates | exit 0 (`Q10:1986-1993`) |
| No analytics before consent | `node tools/test-usage-consent.mjs` (L2) | exit 0: no request to `googletagmanager.com`, `google-analytics.com`, `ipapi.co`, `record_usage_event` before Accept (`Q10:1987`) |
| GA block canonical | `python3 tools/gate-gtag-consent.py --check` | `GA consent: 162/162 canonical, 0 generator literals` (`Q10:546-549`) |
| Q11 L1–L8 | `node tools/test-feature-overrides-sql.mjs`; `--case audit`; `node tools/test-feature-flags-server.mjs --static`; `--browser`; `--design` | exit 0 (`Q11:1028-1035`) |

---

## Wave 6: owner-gated tails, end-to-end validation, final audit

**Items**

| Item | Gate | Source |
|---|---|---|
| Q07 Phase C (`Q07-C`) | **blocked until D-Q07-1** (default C: Phase C stays off) | `Q07:1041`, `DEC:41` |
| Q09 Phase D (`Q09-D`) | **blocked until D-Q09-14** | `Q09:1013`, `DEC:58` |
| Q18 Phase 2 (`Q18-p2`) | **blocked until D-Q18-2** | `Q18:621`, `DEC:78` |
| Q15 Phase C batches 2…n | owner review pace | `Q15:784` |
| `achievements.html` retirement | **blocked until D-Q17-2** (default B: keep, `DEC:74`); L-X18.1 passes as "page retired" if accepted | `XD:1318` |
| X-DEFECTS X12 removals | **blocked until D-XDEF-9, D-XDEF-10**; ride the next release once decided, any wave | `XD:1727`, `DEC:106-107` |
| Git history rewrite | **blocked until D-XDEF-7** (default A: no rewrite) | `DEC:104` |
| End-to-end validation, `09-final-audit/`, traceability matrix | After every shipped item | `STATE:40` |

**Exit criteria**: every law in §7 is green or recorded as blocked with its decision id; the final audit is written by
an agent that did not write the PRDs (`STATE:7-8`, R111).

---

## 7. PRD → wave → laws → blocking decisions (traceability seed)

| PRD | Wave(s) | Laws | Blocking decisions and owner actions | Shared modules |
|---|---|---|---|---|
| Q01 | 2 (phase 1), 3 (phase 2) | L1–L9 (`Q01:990-998`) | D-Q01-1, D-Q01-2 (phase 1 acceptance); **D-Q01-3** (phase 2, auth) | reads `M-OD` per K2 (open) |
| Q03 | 3 | L1–L7 (`Q03:895-901`) | **D-Q03-1**, D-Q03-2, D-Q03-3, D-Q03-4; peer P2 | `M-IR` |
| Q04 | 2 | L1–L8 (`Q04:1651-1658`) | D-Q04-1…D-Q04-9 per switch; peer P2 for T-9 | `M-PROV` |
| Q06 | 1 (T-13 in 2) | L1–L8 (`Q06:1505-1512`) | D-Q06-1 (copy), D-Q06-2 | owns `M-PROV` |
| Q07 | 2 (A/B), 3 (`relatedIncidents`), 6 (Phase C) | L1–L8 (`Q07:1076-1083`) | D-Q07-4 (publish), D-Q07-1 (Phase C), D-Q07-2, D-Q07-3; D-Q01-3 for V16 | `M-PROV`, `M-STUB` |
| Q09 | 1 (Phase A), 2–3 (batches), 6 (Phase D) | L1–L8 (`Q09:1068-1075`) | D-Q09-1…D-Q09-16 (D-Q09-7, -8, -16 gate tasks; D-Q09-14 gates Phase D) | owns `M-IR`; `M-OD` |
| Q10 | 5 | L1–L8 (`Q10:1986-1993`) | **D-Q10-1…D-Q10-11**; OA-1…OA-5 | `M-PG` |
| Q11 | 5 | L1–L8 (`Q11:1028-1035`) | **D-Q11-1…D-Q11-8** (D-Q11-8 for `auth.js`); OA-1 | `M-PG` |
| Q12 | 3 | L1–L8 (`Q12:680-687`); option C LR1–LR3 (`Q12:693-695`) | **D-Q12-1**, D-Q12-2, D-Q12-4, D-Q12-5; D-Q12-3 (destructive if B); **OA-1** via X-DEFECTS X1 | owns `M-AS`; `M-STUB` |
| Q15 | 1 (A), 2 (B), 3 and 6 (C) | L1–L8, L4b (`Q15:832-840`) | D-Q15-1, D-Q15-2 (Phase B); D-Q15-4, D-Q15-5 (Phase C); D-Q15-3, -6, -7 shape scope; peer for `id/index.html` | `M-OD` |
| Q17 | 1 (T-1), 4 | L1–L8 (`Q17:828-835`) | **D-Q17-1** (publish); D-Q17-2 (retirement), D-Q17-3, D-Q17-4; D-Q01-3 (T-8); D-Q12-1 (T-7) | `M-AS`, `M-STUB`, `M-OD` |
| Q18 | 2 (v1), 3 (lock), 6 (Phase 2) | L1–L8 (`Q18:668-675`) | D-Q18-1 (access), D-Q18-2 (Phase 2); D-Q01-3 (lock) | `M-IR`; `M-OD` |
| X-DEFECTS | 1 (R1), 2 (R2–R4), 3 (R5, R6), 6 (X12, history) | L-X1.1, X1.2a, X1.2b, X1.3, X7.1, X7.2, X8.1, X8.2, X10.1, X11.1, X11.2, X12.1a, X12.1b, X15.1, X15.2, X18.1, X19.1 (`XD:1570-1586`) | D-XDEF-1 (R3), D-XDEF-2…6 (defaults), **D-XDEF-7…11**; OA-1…OA-4 | — |
| Shared modules | `M-OD` 1, `M-IR` 1 (Q09 T-2), `M-PROV` 1 (Q06 T-2), `M-STUB` 2, `M-AS` 3, `M-PG` 5 | module laws in the wave tables | `M-AS` needs D-Q12-1 = A | ARCHITECTURE §1 |

Bold = the item cannot ship at all without the decision (auth boundary, feature removal, or feature yes/no).

---

## 8. Gaps

| Id | Gap | Evidence |
|---|---|---|
| PG1 | P2 lives on the peer's branch `feat/p-wave1`; no landing date. It blocks Q04 T-9, Q01's tier-advisor block, Q03 and (by order) Q17 | `STATE:62`, `Q03:16` |
| PG2 | P25 (v3.37.0) is not live; the `index.html` SW-tag task and Q10's `sw.js` edit wait on it, and Q15 edits `index.html` in Wave 1 | `STATE:64-68`, `Q10:241`, `QA2` C6 `index.html` row |
| PG3 | Owner review pace is unknown (Q15 Phase C, Q09 batches, Q01 T-10); wave durations cannot be dated | `QA2` re-score row "Q15 · Implementation readiness" |
| PG4 | No version numbers are assigned; each release claims the next free version with the peer | `STATE:43` |
| PG5 | Q01 L8 coverage counts 32 tool pages including `tier-advisor.html`; no PRD says whether Q01 phase 1 may ship with that page exempt while P2 is pending | `Q01:997`, `Q01:284` (`exempt`) |
| PG6 | Q17 account sync depends on D-Q12-1 = A; Q12 under option C leaves Q17 device-only with no later trigger named | `Q12:485`, `Q17:132` |
| PG7 | The order Q04 / X-DEFECTS X15 on `rz-engine.js` is not fixed; Wave 2 needs one chosen per release | `XD:1317` |
| PG8 | Conflicts K1–K14 (ARCHITECTURE §2) must be resolved before the waves that build the affected code: K1, K2, K5 before Wave 1–2 modules; K3 before Q18 v1; K4 before Q01 phase 2; K7–K11 before Wave 5; K12 before Q04 T-9 | ARCHITECTURE §2 |
| PG9 | No per-wave elapsed time can be stated beyond the PRD estimates (for example Q09 ≈ 38 working days, Q12 option A ≈ 6.5 days after X1) | `Q09:1015`, `Q12:648` |
