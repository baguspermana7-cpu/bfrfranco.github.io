# Inspector standard — v1.43.0+ (payload mode v1.45.0)

Companion to [`LINE_MODEL.md`](LINE_MODEL.md) + [`BREAKER_SYMBOLS.md`](BREAKER_SYMBOLS.md). Responds to team review docs:

- `Documents/screenshot bms rz/dc ai/review/27-deep-rereview-2026-05-24-uiux-engineering.md` §3.2
- `Documents/screenshot bms rz/conv/review/17-deep-rereview-2026-05-24-uiux-engineering.md` §3.2

> "Equipment popup masih MODAL CENTER, menutup topology. Jadikan click
> equipment membuka right-side inspector, bukan modal tengah. Inspector
> harus sticky dan tidak menutup line topology. Inspector perlu tab ringkas:
> Live / Capacity / Dependencies / Alarms / Trend / Maintenance."

`js/rz-inspector.js` exposes `window.RZInspector` — a self-attaching right-side panel that opens when an operator clicks any tagged line or breaker.

## What it does

- Listens for click on `[data-rz-line="1"]` and `[data-rz-breaker="1"]` (delegated, so dynamically-rendered elements work automatically).
- Slides in from the right (360px desktop, full-width on ≤640px viewport).
- Renders 6 tabs from the element's `data-*` metadata.
- ESC key + outside-click close.
- Dependency cards (Deps tab) are clickable — navigates to the linked equipment ID if it exists.
- **Visual identical for everything else** — pure overlay, never modifies the SVG.

## Tabs

| Tab | Content |
|---|---|
| **Live** | `data-state`, `data-current`, `data-direction`, `data-medium` (lines) / `data-voltage` + `data-interlock` (breakers). Pulsing dot when state = energized. |
| **Capacity** | `data-capacity`, `data-rating-a`, `data-rating-ka`, `data-ct`, `data-current` loading, `data-redundancy`. |
| **Deps** | `data-from` / `data-to` (lines) or `data-upstream` / `data-downstream` (breakers). Clickable cards navigate to the connected element if its `data-id` exists. Plus `data-tag` (failure-domain) + `data-redundancy`. |
| **Alarms** | State-derived alarm summary + state. For breakers: ANSI device functions + arc-flash PPE. |
| **Trend** | Placeholder. Sparkline arrives with the data-quality service ship (v1.43.x). |
| **Maint** | `data-sensor`, ANSI device functions, AF PPE category, CT ratio, interlock, last update. |

## Public API

```js
window.RZInspector.open(element);       /* manually open inspector for an element */
window.RZInspector.openBasis(target);   /* v1.44.0 — basis mode: target is a [data-basis-param] element (or an ancestor of one) or a registry id string */
window.RZInspector.basisIdOf(element);  /* the registry id an element resolves to, or null */
window.RZInspector.openPayload(payload, {trigger, onOpenHmi, onNavigate, tab, keepFocus}); /* v1.45.0 — payload mode (a DOM-free equipment payload, see below) */
window.RZInspector.refreshPayload(payload); /* re-render the open payload in place (tickers); keeps tab, scroll and the action button */
window.RZInspector.currentPayloadId();      /* "<classId>:<id>" of the open payload, or null */
window.RZInspector.close();             /* close */
window.RZInspector.isOpen();            /* boolean */
```

## Basis mode (v1.44.0, Track A §A3)

A traceability mark drawn inside an SVG mimic (`RZSvgBasis.tag()`, `js/rz-svg-basis.js`) opens
this panel — not the centre basis modal — because a scrim over the topology is the doc-27 §3.2 P0
this standard closed. The shared basis drawer (`js/rz-basis-drawer.js`) routes every click that
originates inside an `<svg>` to `RZInspector.openBasis()`; clicks on HTML cells keep the modal.
In basis mode the tab strip is hidden, the header reads `BASIS · <registry id>`, and the body is
`RZBasisDrawer.renderRecord(id)` — the record has ONE renderer. Dependency links inside the record
navigate within the panel. Outside-click treats `[data-basis-param]` elements as inside, so a second
mark re-renders instead of closing. A pan on the zoom wrapper sets `window.__rzSvgPanMoved` and is
never treated as a click.

## Payload mode (v1.45.0, Track A §A5)

A page that owns equipment classes builds a **payload** with no DOM in it and hands it to
`openPayload()`. The renderer is page-agnostic; nothing DC-AI-specific lives in `js/rz-inspector.js`.

```
payload = { classId, id, hall, title, label, kind, statusChip:{label,state},
            tabs:{ live:[Point], capacity:[Point], deps:{upstream,downstream,edges}, alarms:[…], trend:{series}, maint:[Point] },
            actions:{ openHmi:{opener,args}|null, related:[…] }, provenance:{engineVersion,scenarioId,coolingScenarioId,tick,counts} }
Point   = { point, label, value, text, unit, quality: published|derived|simulated|state|label|authored,
            basis:'<registry id>'  XOR  declared:'<reason ≥ 40 chars>' }
```

Every value cell carries exactly ONE of `data-basis-param` (a hooked cell — click opens basis mode in
the same panel with a "← back" link) or `data-rz-authored-basis` (a declared cell with a violet
SIMULATED dot). Never both, never neither: the coverage walker counts a cell with neither as
untraced. The header offers `Open equipment HMI` only when `actions.openHmi` is set — that is the
explicit second tier; the panel itself never opens a modal on its own. ESC closes the inspector only
while no `DHModal` panel is open; outside-click treats `[data-rz-equipment]` and
`[data-rz-inspector-keep]` as inside. `close()` returns focus to the trigger.

**Responsive ladder (owner ledger 2026-08-26).** ≥ 1440 px: docked — the page opts in with
`<body data-rz-inspector-dock="1">` and the content gets `padding-right`, so the inspector never covers
the topology; 1024–1439: overlay drawer; 768–1023: bottom sheet 55 vh; < 768: full sheet with a 44 px
close target. Pages that do not opt in keep the overlay everywhere (the Conventional adopters are
untouched).

The DC-AI page's producer is `js/datahall-ai/hmi-payloads.js` (classes, points, cooling scenarios) with
`js/datahall-ai/equipment-inspector.js` as the click resolver and `js/datahall-ai/sim-telemetry.js`
as the seeded simulator; DATAHALL_AI_STANDARD.md "Two-tier equipment inspection" is the page-side rule.

## Authoring guidelines

1. **Just add the script tag.** `<script src="js/rz-inspector.js?v=1.43.0" defer></script>` after `js/rz-line-model.js` + `js/rz-breaker-symbols.js`. The inspector auto-initialises on `DOMContentLoaded`.
2. **No HTML changes required.** Every tagged line/breaker becomes clickable for inspection.
3. **Don't put inspector-aware elements inside `<a>` or `<button>`.** The delegated handler skips those to preserve native semantics.
4. **The inspector is page-scoped.** If a page renders inside an iframe, mount the script in the iframe document, not the host page.
5. **Dependency navigation works only if `data-id` matches another tagged element on the same page.** Cross-page navigation is a future enhancement.

## Adoption status

| Ship | Page | Status |
|---|---|---|
| v1.43.0 | `datahallAI.html` | Loaded. Verified via probe — clicks open inspector. |
| **v1.43.1** | `chiller-plant.html`, `water-system.html`, `fire-system.html` | **Loaded.** Each verified via probe (27/27 pass — 4 inspector assertions). |
| v1.43.2 (planned) | `datahall.html`, `ict.html` | Pending — datahall standalone + ict on standard track. EPMS still deferred per owner mandate. |
| **v2.2.0** | `datahallAI.html` | **Payload mode live on every diagram.** ~210 equipment blocks across 13 diagrams + 2 floor views open here on a single click (six tabs, engine-hooked or declared cells); 11 deep mimics are the second tier. Gated by `tools/test-datahall-ai-inspector-runtime.mjs` (click → inspector, no scrim; Open HMI → focus trap, ESC, timers {}, focus return; 3 reloads identical at a pinned tick; ladder at 1440/1200/900/390) and `tools/test-dcai-coverage.mjs --modals`. |
| **v2.1.0** | `datahallAI.html` | **Basis mode live.** 2,281 hooked numerals across 13 diagrams open the record here; `tools/test-dcai-basis-hooks.mjs` clicks one mark per diagram and asserts the panel, not the modal, opens with the registry value. |

## Visual

- Width: 360px desktop, full viewport on ≤640px.
- Background: rgba(15,23,42,0.97) + 8px backdrop blur (preserves topology readability behind it).
- Tabs: cyan accent on active. State pills colour-coded: green (energized), red (fault/tripped), amber (standby/open), purple (maintenance/isolated).
- No external CSS — styles injected into `<head>` on first init, scoped to `.rz-inspector*`.

## Out of scope this standard

- Trend sparklines (v1.43.x data-quality service ship).
- Edit / command-out actions (require operator-auth gate).
- Multi-select compare (review doc-27 §4.2 — separate ship).
- Mobile gesture customisation (defaults to tap-to-open, ESC equivalent = back gesture pending).
