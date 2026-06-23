# ULTRAPLAN — CDU Mini-BMS Operator-Interaction Layer

> `/ultraplan` rollout (2026-06-21). Turn the `cdu-mini-bms.html` cockpit from a
> read-only simulation into an operable instrument panel. Each phase = one
> reversible ship, strict-audited + screenshot-verified, no engine/data changes
> to the underlying sim values. Update this tracker on every increment.

## Principles (locked)
- **Presentation/interaction only** — never alter the simulated parameter values
  or the sourced bands. The sim engine (`compute()`) stays the source of truth.
- **Reversible** — every phase is additive CSS/JS; can be reverted cleanly.
- **prefers-reduced-motion** honoured for every new animation.
- **Gated** — each ship passes audit-script-tags / audit-js-syntax / audit-version-stamp
  / audit-mobile-responsive (strict) + headless render (0 console errors) before push.
- **Accessible** — interactive elements get `role`/`tabindex`/`aria`, keyboard
  operable, visible focus.

## Instrument ↔ tile map (the spine of Phase 1)
| P&ID tag | value id | tile key |
|---|---|---|
| FT-01 | pv-flow | flow (+flowtot) |
| TT-01 | pv-sup | supply |
| TT-02 | pv-ret | return |
| PT-01 | pv-sysp | sysP |
| PDT-01 | pv-fdp | filter |
| PDT-02 | pv-dp | dP |
| TI-03 | pv-atd | atd |
| P-01A/B | pv-pump | pump |
| LSH-01 | (leak group) | leak |

## Phases

### Phase 1 — bidirectional P&ID ↔ tile linking  (v1)
- Tag each P&ID instrument group + each tile with `data-link="<tilekey>"`.
- Click (or keyboard-activate) a P&ID instrument → highlight + pulse its tile
  and scroll it into view; click a tile → pulse the P&ID instrument.
- Hover a tile → soft-highlight the linked P&ID instrument (and vice versa).
- Cursor:pointer + `role="button"` + `tabindex="0"` + focus ring on instruments.
- Selection state persists until another is picked or Esc clears it.

### Phase 2 — simulation controls  (v2)
- A control strip: **Pause / Play**, **speed** (0.5× / 1× / 2× / 4×), **Step**
  (single tick when paused). Re-uses the existing `setInterval` — swap to a
  variable-rate timer; pause stops ticks (sparklines/labels freeze).
- "Live / Paused" state pill; respects reduced-motion (no flashing).

### Phase 3 — trend history drawer  (v3)
- Click a tile → open a drawer with a larger sparkline (full 300-sample history),
  min/max/avg, the band, and the standard reference from the checklist. Esc/✕ closes.
- Extend `SPARK_HIST` cap to 300; keep tile sparkline at 30.

### Phase 4 — guided fault walkthrough  (v4)
- A "Walkthrough" toggle: for the active scenario, step through narrated callouts
  ("Leak detected at LSH-01 → level falls on LT-01 → CDU latches isolation") that
  highlight the relevant P&ID tags + tiles in sequence. Prev/Next/Exit.

### Phase 5 — zoom / pan on the SVGs  (v5)
- Pinch/scroll-zoom + drag-pan on the P&ID and datahall layout (pointer events;
  bounded). Reset button. Keyboard +/−/0. Mobile-friendly.

## Out of scope
- Real telemetry / backend. Engine value changes. New CDU types (sim only has 5).

## Rollout log
- [x] **Phase 1 — DONE (v1.43.58).** Bidirectional P&ID ↔ tile linking: click/keyboard-activate
  an instrument (FT-01/PT-01/PDT-01/PDT-02/TT-01/TT-02/TI-03) → highlight + pulse its tile and
  scroll into view; click a tile → pulse the linked instrument; hover cross-highlights; Esc clears;
  single-selection invariant. Hit-rect 32×41 on each instrument; `role=button`+`tabindex`+`aria`.
  **Bug found & fixed during deep-test:** animated flow pipes were painted over the instruments and
  intercepted clicks intermittently (dash-position dependent) → set `#pidBox .pipe-* {pointer-events:none}`.
  Deep-tested with REAL mouse clicks (synthetic banned): all 7 instruments resolve via elementFromPoint,
  both directions + both themes + Esc verified, tap-targets checked, 0 console errors.
- [x] **Phase 2 — DONE (v1.43.59).** Sim controls: Pause/Resume (freezes data + flow/pump animation via body.sim-paused + animation-play-state), Step (one tick when paused), speed 0.5×/1×/2×/4× (variable timer rate + CSS animation-duration scaling), LIVE/PAUSED pill. Real-mouse deep-tested: pause froze value over 1.6s, step advanced exactly one tick, speed set data-sim-speed=4, both themes, 0 errors.
- [x] **Phase 3 — DONE (v1.43.60).** Trend history drawer: click a tile → slide-in drawer with the full 300-sample sparkline (SPARK_HIST cap 30→300; tile shows last 30), current value, min/avg/max, sample count, the band + a checklist reference, and a §01 deep-link. Status tiles (pump/filter/leak/chem) show info without a chart. Live-updates while open; Esc + ✕ + backdrop close. **Bug fixed during deep-test:** `.trend-drawer{display:flex}` overrode the `[hidden]` attribute → drawer always rendered over the tiles, intercepting clicks; added `[hidden]{display:none!important}`. Real-mouse deep-tested, both themes, 0 errors.
- [x] **Phase 4 — DONE (v1.43.61).** Guided fault walkthrough: a Walkthrough toggle opens a bottom bar that steps through narrated callouts for the active scenario (normal/leak/pumpfail/clog/hotfws/lowflow, 4-6 steps each), each step highlighting the relevant P- [ ] Phase 4 — pendingID instrument + tile via Phase-1 selectLink. Prev/Next/Exit, step counter, scenario label; switching scenario mid-walkthrough resets to step 1 of the new scenario. Real-mouse deep-tested (start/next/prev/scenario-reset/exit + highlight + disabled-edges), both themes, 0 errors.
- [ ] Phase 5 — pending
