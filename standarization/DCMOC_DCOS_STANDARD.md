# DCMOC → DC-OS Standard (Data Center Intelligence Platform)

> Living standard for the DCMOC "DC-OS" program. Read BEFORE changing DCMOC
> engine-sourcing, IA, provenance, orchestration, decision, PDF, or backend
> patterns; update it (+ `CHANGELOG.md`) WHEN a phase lands. Aligns with
> `CLAUDE.md` (engine + provenance discipline) and the plan file
> `~/.claude/plans/cheerful-cuddling-mitten.md`.

## 1. Principle — DCMOC is an INTEGRATOR, not an engine
Every module's numbers must come FROM the shared engines (`rz-engine.js` /
`fin-engine.js`), never re-implemented as hardcoded DCMOC constants. Edit the
engine once → DCMOC + `capex-calculator.html` + `dc-market-tracker.html` all
reflect it. Increase detail; keep in sync; never fork the math.

## 2. Engine consumption — the bridge (`dcmoc/src/lib/rz-engine.ts`)
Single bridge for the whole app (built in commit `f7a12cc7`; REUSE, never
duplicate):
- `getRZ()` → `window.RZEngine` in the browser (injected by `layout.tsx`
  `<script src="/rz-engine.min.js" defer>`), or a Node `eval('require')` of
  repo-root `rz-engine.js` during `next build` prerender.
- `rzData()` → `RZEngine.data` or `{}`; `rzModels()` → `RZEngine.models` or `{}`.
- **Discipline:** every consumer keeps a LOCAL fallback — if the engine is
  absent, results are identical and the build/app never break.
- FINEngine is NOT yet loaded in `layout.tsx`; Investment/valueGate wiring must
  add `/fin-engine.min.js` (a layout change → rebuild).

## 3. Module → engine mapping + status
Provenance lives in ONE map: `dcmoc/src/lib/provenance/moduleSources.ts`
(`MODULE_SOURCES`), rendered as the per-menu tooltip (see §6). `status`:
- `engine` — fully engine-sourced. **Financial** (`models.roi.irr/npv`, parity
  0-diff verified). 
- `partial` — engine core + finer DCMOC-local detail. **CAPEX**
  (`data.capexDetail`), **Carbon** (`data.refrigerants`/`offsetPrice`) — owned
  by a parallel session (do not edit here).
- `local` — not yet wired (scheduled): OPEX/TCO/Workforce/Market/Investment/
  MonteCarlo (Group-1, wire to existing fns) and Compliance/Tax/Risk-geo/
  Maintenance/Capacity/Asset/Grid/Fuel (Group-2, PROMOTE into `rz-engine.js`
  as `models.<x>` + `DATA.<x>` + `DATA.sources` + a `test-rz-engine.mjs`
  worked example, then consume).

**Golden rule for a wire:** verify parity (engine fn output === former local
output) BEFORE deleting local math; keep the local as fallback. Financial's
proof: `node`-level check, IRR diff 0.000000pp, NPV diff $0.00.

## 4. IA — the 13-engine DC-OS tree
Sidebar = **Dashboard** + **PLATFORM** (Projects/Scenarios/Templates/Data
Library/Knowledge Base) + **ENGINES 1–13** + **SUPPORT**. The current 23 modules
are REGROUPED under the 13 engines (never deleted). Layers 1/2/3/6/7/9/10/13 +
the Knowledge Engine are NEW and developed additively. `activeTab` (in
`store/simulation.ts`) gains `'dashboard'` (the landing). Mapping table: see the
plan file §"Mapping".

## 5. Layer 0 · Master Orchestrator (`dcmoc/src/lib/orchestrator/`)
`dependencyGraph.ts` — a declarative `DIGITAL_THREAD` DAG (input→engines +
engine→engine). `affectedEngines(changed)` returns the transitive closure in
deterministic topological (Kahn) order; `isAcyclic()` guards the DAG. A change
to `itLoad` cascades to capacity/architecture/capex/…/financial/decision in
dependency order (capex before financial before decision). Verified 5/5 in Node.

## 6. Provenance tooltips
Owner decision: integrate the site-wide **RZExplain** engine
(`js/rz-explain.js`, `data-explain="key"`) rather than a DCMOC-local tooltip, so
there is ONE tooltip engine site-wide. Plan: load `rz-explain.js` +
`rz-explain-db.js` in `layout.tsx`; add `MODULE_SOURCES` entries into the explain
DB (`tools/explain-extra.json`, keys `src-<id>`); tag nav items
`data-explain="src-<id>"`. Deferred until RZExplain (parallel-session, in
progress) stabilises + build resumes.

## 7. Layer 13 · AI Decision Engine (`dcmoc/src/lib/decision/`)
Deterministic NOW, AI-pluggable LATER via one interface `DecisionProvider`:
- `types.ts` — `DecisionRequest{context,constraints,objectives}` →
  `DecisionResult{summary,recommendations,rationale,metrics,provider,disclaimer}`.
- `deterministicProvider.ts` — pure rule algorithm (budget→tier feasibility,
  density→cooling, PUE/availability/schedule constraints, ROI read); every rule
  appends an explainable `RationaleStep`. No LLM.
- `remoteApiProvider.ts` — SAME interface, stubbed (`REMOTE_DECISION_ENDPOINT =
  null`); later POSTs the identical `DecisionRequest` to a server AI endpoint.
- `index.ts` — `getDecisionProvider()` factory + `decide()` with deterministic
  fallback. Consumers never know which ran → the "container/wadah" for AI.
- Honesty: `DECISION_DISCLAIMER` on every result (engineering guidance, not
  investment/professional advice).

## 8. Per-engine + dashboard PDF
Reuse `dcmoc/src/modules/reporting/PdfUtils.ts` (~34 primitives) + the
store→generator(props)+html2canvas pattern. Every one of the 13 engines AND the
dashboard each generate a super-complete PDF (cover → exec summary → params →
input→model→output → provenance → disclaimer). Fill the gap generators
(Compliance/Benchmark/CBM/MonteCarlo/Portfolio/FuelGen + standalone
Tax/Grid/Talent/Disaster) + new-engine generators + a master dashboard PDF.

## 9. Backend secure calc (FINAL phase)
Move the engine math server-side so it can't be stolen from the public static
site (repo-private does NOT hide served JS). Extend `cf-worker/` with a
`/calc/*` namespace importing the pure engine models (CommonJS); JWT-gate
(Supabase JWKS), origin-locked CORS, rate-limit, KV cache, log every calc to
`audit_log` via `log_event()`. The bridge (§2) then swaps transport
(window-global → `fetch('/calc/*')`) with callers unchanged. Do LAST, after all
engines + dashboard + PDFs + orchestrator + AI are done and green.

## 10. Ship discipline (no bug, no error, no mistake)
Per phase: parity/unit verify (Node + `test-rz-engine.mjs` for engine changes) →
`tsc --noEmit` green → coordinated `npm run build` in `dcmoc/` (two sessions must
not build the shared static export concurrently) → commit `dcmoc/` (stage only
own files) → update THIS doc + `CHANGELOG.md` + `js/rz-version.js`. Never delete
local math before its engine parity passes.

## Status (2026-07-17)
- Bridge (§2): DONE (parallel session, f7a12cc7). REUSED.
- Financial wiring (§3): DONE — IRR+NPV engine-sourced, parity 0-diff, fallback kept.
- Provenance map (§6): DATA done; RZExplain rendering deferred.
- Orchestrator (§5): DONE + Node-verified 5/5.
- Decision engine (§7): DONE (4 files, tsc green).
- IA `'dashboard'` tab (§4): store union + default added.
- Held pending parallel-session coordination + build resume: `next build`,
  commit, nav restructure UI, dashboard UI, RZExplain wiring, FINEngine load,
  Group-2 promotions, CAPEX (parallel-owned), backend.
