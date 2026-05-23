# Network Visualization Hub — Implementation Plan v2

> **Status**: For owner sign-off · Plan v2 · 2026-05-24
> **Supersedes**: `2026-05-23-network-visualization-hub.md` (v1; REWORK verdict from code-reviewer, APPROVE_WITH_NOTES from uiux-reviewer)
> **Owner**: Bagus Dwi Permana
> **Sponsor section**: Knowledge Labs on `datacenter-solutions.html` (per `KNOWLEDGE_LABS_STANDARD.md` v1, 2026-05-24)
> **Target ship**: next free MINOR after Phase 0 (likely v1.33.0 if no other MINOR lands first)

---

## v2 changes from v1 (review-driven)

| Change | Trigger |
|--------|---------|
| Module-loading pattern: IIFE/namespace (`window.RZNetAnim.<topic>`), NOT ES `export` | code-reviewer CRITICAL — site is zero-build, no bundler |
| Topic count: **25** (REST/GraphQL/gRPC split into 3 files + EtherCAT added; v2.1 reconciled from a transitional "24" count) | code-reviewer MEDIUM 5 + v2 HIGH 2 |
| EtherCAT added to IA tree | code-reviewer MEDIUM 4 |
| Performance budget restated: engine ≤60 KB, per-topic ≤15 KB lazy | code-reviewer HIGH 2 |
| `seek(frame)` requires deterministic frame-derivable state | code-reviewer HIGH 3 |
| Compare-mode cross-protocol semantic mapping (Appendix B added) | code-reviewer HIGH 1 |
| `rz-feature-flags.js` registration in Phase 0 DoD | code-reviewer HIGH 4 |
| CONTENT_LINKAGE_PLAYBOOK as per-phase deliverable (sitemap + search-index + llms + OG) | code-reviewer HIGH 5 |
| `error` SFX: 2 px red bezel flash, NOT screen shake | uiux-reviewer HIGH |
| `complete` SFX: single sine 1.5 kHz / 80 ms, NOT perfect-fifth two-tone | uiux-reviewer HIGH |
| VFX rename: "Byte glow" → "Byte chip" (no box-shadow attractor) | uiux-reviewer HIGH |
| Packet trail capped at 2 segments + alpha ramp specified | uiux-reviewer HIGH |
| ACK ring shortened from 1 s to 600 ms total | uiux-reviewer HIGH |
| Section placement: new Knowledge Labs section, NOT 7th Cost Calculator card | uiux-reviewer HIGH |
| A11y: focus indicators (2 px amber + 2 px offset), glyph pairing (✓ × ↓ ⚠), ARIA live region on scrubber | uiux-reviewer HIGH |
| SFX taxonomy expanded: handshake / stream-chunk / token-issue (Appendix C) | code-reviewer MEDIUM 3 |
| VFX vocabulary constrained (Appendix D) — hex literals banned in topic modules, palette.js sole source | uiux-reviewer MEDIUM |
| Compare-mode visual-diff overlay = 4-row instrument chip strip | uiux-reviewer MEDIUM |
| Parameter density rule: 5 essentials + `<details>` for rest; sliders have numeric twin | uiux-reviewer MEDIUM |
| Hub-landing rotating sample animation: paused + muted by default | uiux-reviewer MEDIUM |
| SFX/VFX controls adjacent to canvas (not separate scroll section) | uiux-reviewer MEDIUM |
| Dark-mode coverage for DOM controls | code-reviewer MEDIUM 6 |
| Version target = "next free MINOR" not hardcoded | code-reviewer MEDIUM 1 |

---

## §1 — Mission

Build a public, free-tier, zero-build hub on `resistancezero.com` that lets
engineers learn industrial communication protocols and software-side network
fundamentals through animated, parameter-driven visualisations.

Audience: data-center operators, controls engineers, building automation
specialists, network engineers, and CompTIA Network+ / Security+ candidates.

Differentiation from generic explainers: every visualisation is
parameter-driven (change baud rate → animation responds), every topic ships
with engineering pitfalls (termination resistors, ground loops, certificate
pinning), and the entire hub is industrial-instrumentation grade — no
consumer-techno-music-video aesthetics.

Tier: free / demo / pro / root all pass (public-tier).

---

## §2 — Brand and anti-pattern guardrails (HARD constraints)

These are not aspirations. They are blocking gates on every topic page.

| Constraint | Source | Enforcement |
|------------|--------|-------------|
| Palette: instrument-cyan `#00DDFF`, signal-amber `#FFAA00`, oscilloscope-green `#00FF88`, fault-red `#FF3030` | design.md §5 | `palette.js` is the sole color source; topic modules MUST import from it; lint rule blocks hex literals in `network-anim/topics/*.js` |
| Line widths: tier-graded 0.6–1.4 px | design.md §2 | renderer.drawWire(layer) takes a discrete tier enum, never a free-float |
| Typography: IBM Plex Sans labels, JetBrains Mono numerics, `tabular-nums` on all numeric columns | design.md §4 | inline in topic HTML; not overridable per-topic |
| NO Anthropic-purple `#8B5CF6` anywhere | CLAUDE.md rejected-patterns §3 | grep gate in audit-network-anim.py |
| NO glassmorphism (backdrop-filter blur on opaque cards) | design.md §3 anti-pattern 17 | grep gate |
| NO neon-glow (multi-layer drop-shadow on light text) | design.md §3 anti-pattern 18 | renderer.drawByte() does NOT accept a shadowBlur param |
| NO box-shadow, NO filter:blur, NO mix-blend-mode:screen | uiux-reviewer §5.4 | lint rule in `vfx.js` source |
| Particle/segment caps: packet trail ≤2 segments, ACK ring ≤1 active per node, total drawCalls ≤200/frame/panel | uiux-reviewer + perf | runtime guard in engine.js |
| NO cursor-tracking 3D tilt, NO bouncy-spring text, NO Material ripple | CLAUDE.md rejected-patterns §4 | not implementable in Canvas 2D + Web Audio stack, but explicitly excluded |

**Register**: oscilloscope + Industrial DCS HMI. Not consumer techno music video.

---

## §3 — Information architecture

### Knowledge Labs section on `datacenter-solutions.html`

Per `KNOWLEDGE_LABS_STANDARD.md` (2026-05-24), the hub lands as a card in
the **Knowledge Labs — Standards, Networks, Protocols** section, NOT as a
7th card in Cost Calculators. The section sits between Cost Calculators
and Simulations.

Three cards in this section at Phase 0 ship:

1. AI Engineering Maintenance (already shipped v1.32.0)
2. LTC Labs / Standards Hub (already shipped)
3. **Network Visualization Hub** (this plan) — instrument-cyan accent

### Hub landing page

`network-visualization-hub.html` — public-tier, free/demo/pro/root all pass.

Layout:
- Hero with rotating sample animation in a small frame (**paused + muted by default**, plays on hover/focus only — uiux-reviewer fix)
- Search-as-you-type filter
- Lane navigation (5 lanes)
- Card grid (25 topics)
- "Compare any 2-4 protocols" CTA → `network-compare.html`
- Footer

### Lanes and topics (25)

```
network/
├── foundations/           # Lane A — networking fundamentals (Net+ candidates)
│   ├── osi-tcp-ip-models.html
│   ├── ipv4-vs-ipv6.html
│   ├── subnetting-cidr.html
│   ├── tcp-handshake.html
│   └── dhcp-dns.html
├── industrial-ot/         # Lane B — operational-technology protocols
│   ├── modbus-rtu.html
│   ├── modbus-tcp.html
│   ├── bacnet-mstp.html
│   ├── bacnet-ip.html
│   ├── opc-ua.html
│   ├── dnp3.html
│   ├── profinet.html
│   ├── ethernet-ip.html
│   └── ethercat.html              # added in v2 (was missing in v1 §3 tree)
├── dc-management/         # Lane C — DC operations protocols
│   ├── snmp.html
│   ├── ipmi-redfish.html
│   └── syslog.html
├── security/              # Lane D — Sec+ candidates
│   ├── tls-handshake.html
│   ├── oauth-jwt.html
│   ├── mtls.html
│   └── wireguard.html
└── apis-agents/           # Lane E — software protocols
    ├── rest-api.html              # split from rest-graphql-grpc.html
    ├── graphql.html               # split
    ├── grpc.html                  # split
    └── mcp-tool-call.html
```

**Total: 25 topic pages.** Each has a unique slug; compare-mode routes by slug.

### Compare page

`network-compare.html` — accepts `?topics=modbus-rtu,modbus-tcp,bacnet-ip,opc-ua` query parameter, up to 4 slugs.

---

## §4 — Topic page anatomy

Every topic page has 12 sections in this order:

1. **Hero** — IBM Plex Sans H1, JetBrains Mono CompTIA-objective chip (e.g. `Net+ N10-009 §2.1`), version stamp via `RZ.injectVersionStamp()`
2. **Conceptual model** — plain-language explanation, 1 inline SVG diagram in industrial-instrumentation style (thin lines, palette-locked)
3. **Animation canvas** with SFX/VFX controls **chip strip directly above the canvas** (uiux-reviewer fix — not a separate scroll section)
4. **Parameter panel** — 5 essentials visible by default; remainder in `<details>` collapse (uiux-reviewer fix)
   - Every slider has a numeric input twin for precision
   - Every parameter has a keyboard-step value in the schema
   - Live-update, no submit button
5. **Timeline scrubber** — RAF-driven, frame-derivable state, with ARIA live region announcing frame position AND semantic protocol-state transitions (e.g. "Handshake complete, frame 28") not just bare frame numerics (uiux-reviewer a11y fix + v2 LOW recommendation)
6. **Frame-by-frame walkthrough** — `<details>` accordion explaining key moments
7. **Compare with…** — quick-launch to compare page pre-populated with this topic + 1-3 picks
8. **Engineering pitfalls** — `<details>` accordions covering real-world traps. **Text + inline SVG only** — no hero photos, no stock imagery, no people-pointing-at-laptops (lifestyle aesthetics are out of register). Editorial bar examples:
   - **PASS**: "Modbus RTU silent interval violation — if your master polls faster than 3.5 character times, slaves misframe the response. At 9600 baud: 3.5 × (1/960) = 3.65 ms. Many PLCs default to 1 ms polling interval and silently miss responses."
   - **FAIL**: "Make sure your slave address is unique on the bus." (Generic developer trivia — any Modbus tutorial says this; not industrial-grade insight.)
   - **PASS**: "TLS handshake without certificate pinning is vulnerable to coffee-shop interception. Add a SHA-256 pin of the leaf cert public key; rotate on expiry."
   - **FAIL**: "Always use HTTPS." (Surface-level; not a pitfall.)
9. **Related topics** — 3-6 internal links to adjacent topics and calculators
10. **References** — `<details>` listing 5-15 primary sources (standards, RFCs, vendor docs)
11. **Standardization** cross-reference — `<a href="../standarization/KNOWLEDGE_LABS_STANDARD.md">` and any topic-specific standard
12. **Footer** — standard site footer + version stamp

---

## §5 — Animation engine architecture

### §5.1 — File layout

```
js/network-anim/
├── engine.js          # ≤25 KB — RAF loop, lifecycle, visibility-observer
├── renderer.js        # ≤15 KB — Canvas 2D primitives (drawWire, drawByte, drawNode)
├── audio.js           # ≤8 KB — Web Audio synth + 8 canonical events
├── vfx.js             # ≤8 KB — packet-trail, ACK-ring, etc.
├── palette.js         # ≤2 KB — color tokens (sole color source)
└── topics/
    ├── modbus-rtu.js  # ≤15 KB per topic, lazy-loaded
    ├── modbus-tcp.js
    └── ... (25 files)
```

**Engine total: ≤60 KB minified** (revised from v1's confusing 200 KB number).
**Per-topic JS: ≤15 KB minified, lazy-loaded** on topic page navigation.

### §5.2 — Module contract (REVISED: IIFE/namespace, not ES modules)

**CRITICAL fix from code-reviewer**: the site is zero-build. No bundler, no
`type="module"` precedent. Topic modules use the IIFE/namespace pattern that
matches `rz-engine.js`, `auth.js`, `script.js`.

```js
// js/network-anim/topics/modbus-rtu.js
(function () {
  'use strict';
  window.RZNetAnim = window.RZNetAnim || {};

  window.RZNetAnim.modbusRtu = {
    /**
     * @param {HTMLCanvasElement} canvas
     * @param {Object} params       — current parameter values (baud, parity, etc.)
     * @param {Object} signals      — { onSFX, onError, onComplete } callbacks
     * @returns {{
     *   play: () => void,
     *   pause: () => void,
     *   seek: (frame: number) => void,   // DETERMINISTIC — see below
     *   setParams: (next: Object) => void,
     *   getNormalized: () => NormalizedMetrics,  // for compare-mode diff (see §6)
     *   destroy: () => void
     * }}
     */
    init: function (canvas, params, signals) {
      // … implementation …
      return { play, pause, seek, setParams, getNormalized, destroy };
    }
  };
})();
```

**Loaded by the topic HTML as plain script tags placed BEFORE `</body>`** (matching the site's existing pattern for `auth.js`, `rz-engine.js`, etc.). **DO NOT use `defer`** — the inline bootstrap script that calls `init()` is not deferrable, and an inline script executes during parser flow, which would beat any deferred topic module to the punch and produce `undefined` references.

```html
<!-- placed immediately before </body> -->
<script src="../../js/network-anim/palette.js?v=2026-05-24"></script>
<script src="../../js/network-anim/renderer.js?v=2026-05-24"></script>
<script src="../../js/network-anim/audio.js?v=2026-05-24"></script>
<script src="../../js/network-anim/vfx.js?v=2026-05-24"></script>
<script src="../../js/network-anim/engine.js?v=2026-05-24"></script>
<script src="../../js/network-anim/topics/modbus-rtu.js?v=2026-05-24"></script>
<script>
  (function () {
    var canvas = document.getElementById('animCanvas');
    var instance = window.RZNetAnim.modbusRtu.init(canvas, currentParams, signals);
    // … wire up buttons …
  })();
</script>
```

**Loading order** matters: `palette` → `renderer` → `audio` → `vfx` → `engine` → topic module → inline bootstrap. The engine consumes palette + renderer + audio + vfx; the topic module consumes the engine; the inline bootstrap consumes the topic module. By the time the parser reaches the inline bootstrap, every dependency is on `window`.

(If for any reason a topic page must load scripts in `<head>` with `defer`, the inline bootstrap MUST be wrapped in `document.addEventListener('DOMContentLoaded', function () { ... })` — but the canonical pattern is end-of-`<body>` plain scripts.)

### §5.3 — Determinism rule for `seek(frame)`

**HIGH fix from code-reviewer**: `seek(N)` must always produce the same
visual state regardless of how the animation arrived at frame N.

Two acceptable implementation strategies for each topic module:

**Strategy A (preferred)** — purely derivable state:
```js
function render(frame) {
  // Position of byte i at frame f = pure function of (i, f, baud, frameRate)
  // No accumulated velocity, no random jitter from prior frames
}
```

**Strategy B (escape hatch)** — `reset() + fast-forward`:
```js
function seek(targetFrame) {
  resetState();
  for (var f = 0; f < targetFrame; f++) tick(f);
}
```

**Pixel-snap mandate (NEW per v2 code-review)**: `renderer.js` MUST snap all
stroke coordinates to the nearest half-pixel (`Math.round(x) + 0.5`) before
drawing wires, arcs, or ACK rings. Without this, anti-aliased edges produce
sub-pixel luminance variation between two `seek(N)` calls that fails the
determinism test on continuous-color canvases. Solid-fill geometry
(`Byte chip` 8×8 squares) is unaffected, but every stroke / arc path goes
through the snap helper.

The module contract test (`tools/test-network-anim-determinism.py`) asserts:
- `seek(N)` after `play()` to frame N == `seek(N)` after `reset() + seek(N)`
- Pixel-diff tolerance: solid-fill regions ≤0%, stroked-path regions ≤2%
- Topic modules failing this test are quarantined.

### §5.4 — Audio system (REVISED)

8 canonical events (was 5; expanded per code-reviewer MEDIUM 3 for software-protocol coverage):

| Event | Sound | When |
|-------|-------|------|
| `tick` | 800 Hz square, 6 ms | Clock edge, frame boundary |
| `byte` | sweep 1.2→1.6 kHz, 12 ms (V.21 modem-character band) | Per-byte transmission |
| `ack` | 1.8 kHz sine, 60 ms, soft decay | ACK received |
| `error` | sawtooth 220 Hz, 80 ms + **2 px red bezel flash on canvas frame, 120 ms** (HMI alarm citation — NOT screen shake) | NACK / timeout / CRC fail |
| `complete` | **single sine 1.5 kHz, 80 ms, soft decay** (PLC heartbeat — NOT perfect-fifth two-tone) | Transaction complete |
| `handshake` (new) | three-stage frequency step: 800 → 1000 → 1200 Hz, 40 ms each (rendered as a sweep, NOT a musical arpeggio — internal code comments must avoid the word "arpeggio" to prevent musicality drift; fallback if live test renders chimey is single 1.0 kHz sine, 120 ms, with two-bump amplitude envelope at 40/80 ms) | Multi-step auth (TLS, OAuth, mTLS) |
| `stream-chunk` (new) | soft click train, 50 Hz pulse, 30 ms | gRPC / SSE / WebSocket chunk |
| `token-issue` (new) | 2.4 kHz sine, 100 ms, distinct decay envelope | OAuth/JWT issuance complete |

**Hard rule**: every SFX MUST decay to silence by 250 ms. No reverb tails, no sustained tones.

**Default state**: muted. User opts in via the chip strip above the canvas.

Mobile audio: gesture-gated (Web Audio context resumes only after first user interaction per browser policy).

### §5.5 — VFX vocabulary (CONSTRAINED — uiux-reviewer)

| VFX | Spec |
|-----|------|
| **Byte chip** (was "Byte glow" — uiux-reviewer fix) | Solid-fill 8×8 px square, palette-locked colour, NO box-shadow, NO blur. The chip moves; that's the animation. |
| **Packet trail** | **Capped at 2 segments** (was 4). Alpha ramp: lead segment 0.35, trail segment 0.12, then 0. Trail length scales with packet speed. |
| **Wire pulse** | 1 px wire stroke briefly thickens to 1.4 px (one design.md line tier up) for 200 ms when bytes traverse |
| **Collision marker** | `×` glyph at collision point, fault-red, 16 px, fades in 300 ms / out 300 ms |
| **ACK ring** | Expanding circle from receiver node. **Expand 400 ms + fade 200 ms = 600 ms total** (was 1 s — uiux-reviewer fix). Stroke 1 px oscilloscope-green. Centred `✓` glyph during the expand. |
| **Drop marker** | `↓` glyph at drop point, fault-red, 16 px, 400 ms fade-out |
| **Retransmission echo** (new — uiux-reviewer LOW) | Amber dashed-arrow re-trace at 0.6 px, 50% opacity, 200 ms, same path as the original byte |
| **Encrypted shroud** | CRT-style scan-line pattern (1 px horizontal lines, 2 px gap, 30% opacity) drawn over the wire segment when traffic is encrypted |

**Banned in `vfx.js` source code** (lint rule):
- `box-shadow`
- `filter: blur(...)`
- `filter: drop-shadow(...)` with >1 layer
- `mix-blend-mode: screen` / `mix-blend-mode: overlay`
- Hex literals — colours come from `palette.js` only

---

## §6 — Compare mode (REVISED)

### §6.1 — Layout

- Desktop ≥1024 px: 2×2 grid
- Tablet 768–1023 px: 2×1 grid
- Mobile <768 px: 1-column stack
- Hard cap: 4 panels

### §6.2 — Synced timeline scrubber

One global scrubber drives `seek(frame)` on all 4 panels simultaneously.
Frame counter at top; per-panel state below.

### §6.3 — Cross-protocol semantic mapping (NEW — code-reviewer HIGH 1)

**Every topic module exposes a `getNormalized()` method** that returns:

```js
{
  effectiveThroughputBps: number,    // bytes/sec actually moving useful payload
  endToEndLatencyMs: number,         // time from first byte sent to ACK received
  frameOverheadBytes: number,        // bytes of header/framing per logical frame
  pendingInFlight: number,           // packets/messages currently un-acked
  isEncrypted: boolean,
  isAuthenticated: boolean,
  errorCount: number                 // CRC/checksum failures observed this session
}
```

This is the **only contract** the compare page uses to populate the visual
diff overlay. Topic modules can have arbitrary internal state; the
normalised view is the cross-protocol lingua franca.

Full mapping table per protocol is in **Appendix B**.

### §6.4 — Visual diff overlay (REVISED — uiux-reviewer)

Below each canvas, a **4-row instrument chip strip** (not a "coloured wire"
— that ambiguity is what the uiux-reviewer flagged):

```
┌──────────────────────────────┐
│ THROUGHPUT  9.6 kbps         │  mono 11px tabular-nums
│ LATENCY     12.4 ms          │  mono 11px tabular-nums
│ OVERHEAD    8 B / frame      │  mono 11px tabular-nums
│ STATUS      ▲ encrypted ✓    │  glyph + label (color-blind safe)
└──────────────────────────────┘
```

Each chip is borderless except for a thin (0.8 px) horizontal divider above
the next chip. JetBrains Mono, 11 px, tabular-nums.

### §6.5 — Sync params toggle

A "Sync params" toggle attempts to synchronise *comparable* parameters across
panels. Comparable = same normalised field name (e.g. dropping payload bytes
on Modbus RTU lowers `effectiveThroughputBps`; dropping HTTP body size on
REST lowers the same field). The mapping table in Appendix B defines what
each protocol's parameters mean in normalised terms.

When toggle is OFF (default), each panel's params are independent.

### §6.6 — Export

PNG of all visible canvases concatenated. Uses `canvas.toBlob()` (not
`html2canvas` — vanilla discipline).

---

## §7 — Performance budget (RESTATED)

**Was** in v1: "≤200 KB initial weight (HTML + CSS)". This conflated the
shared site CSS (already-sunk per-page) with the animation code itself.

**v2 statement**:

| Asset | Budget | Loading |
|-------|--------|---------|
| Shared `styles.css` / `styles-index.css` | already-sunk, ~130–150 KB | cached after first page on the site |
| `js/network-anim/engine.js` + `renderer.js` + `audio.js` + `vfx.js` + `palette.js` | **≤60 KB minified total** | loaded on hub landing + every topic page; cached |
| Per-topic JS (`topics/<slug>.js`) | **≤15 KB minified each** | lazy-loaded only on the topic page that uses it |
| Topic-page HTML | ≤30 KB | per-page |
| Total per topic-page load (cold cache) | ≤105 KB excluding shared CSS | |

**Frame budget**:

- Single panel: 60 fps target, 16 ms / frame budget
- Compare mode 4 panels: 16 ms / 4 = 4 ms per panel per frame
- **drawCalls cap per panel per frame: 200**
- **In compare mode, VFX intensity flag = "minimal"** — topic modules must check this flag and degrade gracefully (no particle trails when in compare mode, ACK ring only on the most recent ACK, etc.)

---

## §8 — Per-protocol parameter schemas

Each topic module ships a schema declaring its parameters. UI is generated
from the schema. Example for Modbus RTU:

```js
window.RZNetAnim.modbusRtu.schema = {
  essentials: [
    { key: 'baudRate', label: 'Baud rate', type: 'select', options: [9600, 19200, 38400, 57600, 115200], default: 9600 },
    { key: 'parity', label: 'Parity', type: 'select', options: ['none', 'even', 'odd'], default: 'even' },
    { key: 'stopBits', label: 'Stop bits', type: 'select', options: [1, 2], default: 1 },
    { key: 'slaveAddr', label: 'Slave address', type: 'number', min: 1, max: 247, default: 1, step: 1 },
    { key: 'fcCode', label: 'Function code', type: 'select', options: [1, 2, 3, 4, 5, 6, 15, 16], default: 3 }
  ],
  advanced: [
    { key: 'turnaroundMs', label: 'Turnaround (ms)', type: 'slider', min: 0, max: 100, default: 5, step: 1 },
    { key: 'silentInterval', label: 'Silent interval (char times)', type: 'slider', min: 1, max: 10, default: 3.5, step: 0.5 },
    { key: 'lineNoise', label: 'Line noise %', type: 'slider', min: 0, max: 30, default: 0, step: 1 },
    { key: 'terminationOhms', label: 'Termination (Ω)', type: 'select', options: [120, 'open', 'short'], default: 120 },
    { key: 'cableLengthM', label: 'Cable length (m)', type: 'slider', min: 1, max: 1200, default: 100, step: 10 },
    { key: 'driverFanout', label: 'Driver fanout (devices)', type: 'slider', min: 1, max: 32, default: 4, step: 1 }
  ]
};
```

Per uiux-reviewer: **5 essentials visible by default**, the rest collapsed in
`<details>`. Every slider has a numeric input twin. Every parameter has a
`step` for keyboard navigation.

Schemas for the other 23 topics follow the same shape. The full list is too
long for the plan; Phase 1 ships Modbus RTU + Modbus TCP + BACnet/IP first
to validate the pattern.

---

## §9 — Site integration

### §9.1 — Knowledge Labs section card on `datacenter-solutions.html`

Per `KNOWLEDGE_LABS_STANDARD.md`:

```html
<div class="kl-card" data-tone="instrument-cyan">
  <h3>Network Visualization Hub</h3>
  <p>Animated, parameter-driven visualisations of 25 communication
     protocols and software-network topics. Modbus, BACnet, OPC-UA,
     TLS, OAuth, MCP — compare any 2–4 side-by-side.</p>
  <span class="tier-badge tier-free">FREE</span>
  <span class="kl-meta">25 topics · 5 lanes · CompTIA Net+ + Sec+ aligned</span>
  <a href="network-visualization-hub.html">Open hub →</a>
</div>
```

### §9.2 — Feature-flag registration (Phase 0 DoD)

Every page registered in `js/rz-feature-flags.js`:

```js
'network-visualization-hub': { 'page-access': { free: true, demo: true, pro: true, root: true } },
'network-compare':           { 'page-access': { free: true, demo: true, pro: true, root: true } },
'network-modbus-rtu':        { 'page-access': { free: true, demo: true, pro: true, root: true } },
// … 23 more entries, registered in their respective phases
```

### §9.3 — Per-phase CONTENT_LINKAGE_PLAYBOOK deliverables (NEW)

For every topic page shipped in each phase:

- [ ] Sitemap entry (`priority="0.7"`)
- [ ] `search-index.json` entry with curated description
- [ ] `llms.txt` entry
- [ ] OG image at `assets/og/network-<slug>.webp` (1200×630, generated via `tools/build-og-images.py`)
- [ ] `rz-feature-flags.js` entry
- [ ] Post-draft folder per `POST_DRAFT_STANDARD.md` (minimum: linkedin.md, x-post-1.md, mastodon-1.md)
- [ ] CHANGELOG entry
- [ ] `sw.js` cache name bump

This is now a **per-phase row in the roadmap**, not a footnote.

### §9.4 — Page gate

```js
(function () {
  if (window._rzAuth && typeof window._rzAuth.enforceTierFeatureAccess === 'function') {
    window._rzAuth.enforceTierFeatureAccess('network-modbus-rtu');
  }
})();
```

Public-tier means everyone passes, but the page still goes through the gate
so the feature-flags audit knows about the page.

---

## §10 — Build roadmap (6 phases)

| Phase | Scope | Topics shipped | Effort | Ship as |
|-------|-------|----------------|--------|---------|
| **Phase 0 — Foundation** | Engine + renderer + audio + vfx + palette; hub landing; compare page scaffold; Knowledge Labs card on DC Solutions; flag registration | 0 | 2-3 weeks | next free MINOR |
| **Phase 1 — Industrial seed** | Modbus RTU, Modbus TCP, BACnet/IP, OPC-UA | 4 | 3-4 weeks | +1 MINOR |
| **Phase 2 — OT depth** | BACnet MS/TP, DNP3, PROFINET, EtherNet/IP, EtherCAT | 5 (total 9) | 4 weeks | +1 MINOR |
| **Phase 3 — Foundations** | OSI model, IPv4/IPv6, subnetting/CIDR, TCP handshake, DHCP/DNS | 5 (total 14) | 3 weeks | +1 MINOR |
| **Phase 4 — Security** | TLS handshake, OAuth/JWT, mTLS, WireGuard | 4 (total 18) | 3 weeks | +1 MINOR |
| **Phase 5 — APIs + Agents** | REST API, GraphQL, gRPC, MCP tool-call | 4 (total 22) | 3 weeks | +1 MINOR |
| **Phase 6 — DC management + Cert prep** | SNMP, IPMI/Redfish, syslog + CompTIA cert-prep cross-references | 3 (total 25) | 2-3 weeks | +1 MINOR |

Phase totals reconcile: Phase 1 = 4 → Phase 2 = 9 → Phase 3 = 14 → Phase 4 = 18 → Phase 5 = 22 → Phase 6 = 25. Matches the §3 IA tree (Lane A 5 + Lane B 9 + Lane C 3 + Lane D 4 + Lane E 4 = 25).

Each phase has explicit owner sign-off before the next phase begins.

### Per-phase Definition of Done

For every phase:

- [ ] All topic modules pass `tools/test-network-anim-determinism.py`
- [ ] All topic pages pass `tools/audit-script-tags.py --strict`
- [ ] All topic pages pass `tools/audit-js-syntax.py --strict`
- [ ] All topic pages pass `tools/audit-version-stamp.py --strict`
- [ ] All topic pages pass `tools/audit-mobile-responsive.py --strict` (≥7/10)
- [ ] `tools/audit-network-anim.py` (NEW) passes — checks palette discipline, banned CSS properties, segment caps
- [ ] CONTENT_LINKAGE_PLAYBOOK deliverables (§9.3) complete for every topic
- [ ] Appendix B row added for every topic shipped this phase
- [ ] **sw.js cache name bumped** (each phase ships its own SW bump)
- [ ] uiux-reviewer agent re-runs on at least 1 representative live page from the phase
- [ ] CHANGELOG entry written
- [ ] Memory updated

---

## §11 — Accessibility (REVISED)

| Requirement | Source | Implementation |
|-------------|--------|----------------|
| "Describe in plain text" mode per topic | v1 + uiux-reviewer | Every topic page has a `<details>` accordion with a plain-text walkthrough that does not require the animation |
| Reduced-motion media query | v1 | `@media (prefers-reduced-motion: reduce)` disables all VFX (no trails, no rings); animation still runs at 1 fps step rate; user can scrub through frames |
| SFX off by default | v1 | yes |
| Keyboard navigation | v1 | Tab order: parameter panel → controls → scrubber → canvas (where canvas is focusable with arrow-key frame nudging) |
| **Focus indicator** (NEW — uiux-reviewer) | uiux | All interactive elements: **2 px signal-amber outline + 2 px offset** when `:focus-visible` (per UI_FEATURES_STANDARD.md) |
| **Glyph-paired colours** (NEW — uiux-reviewer) | uiux | Every coloured marker has a glyph companion: ACK = green ring + centred `✓`; error = red `×`; drop = red `↓`; warning = amber `⚠` |
| **ARIA live region on scrubber** (NEW — uiux-reviewer) | uiux | `aria-live="polite"` region announces "Frame 42 of 120" on scrubber change |
| Color-contrast | design.md | All on-canvas labels meet WCAG AA 4.5:1 against canvas background |

---

## §12 — Multi-agent review mandate

Per owner request, every plan revision and every Phase 0 implementation
goes through:

- `code-reviewer` agent — architecture + contracts + audit gates
- `uiux-reviewer` agent — design system + brand discipline + a11y

Plan v2 (this document) goes through both before Phase 0 implementation
begins. Implementation goes through both at the end of each phase.

---

## §13 — Open questions for the owner (REDUCED from 8 to 4)

The 4 unresolved questions for sign-off:

| # | Question | v2 default |
|---|----------|-----------|
| Q1 | Confirm IIFE/namespace module pattern (D-1 from review) | **IIFE** — accept the v2 default |
| Q2 | Confirm public-tier access (free/demo/pro/root all pass) | **Public** — accept |
| Q3 | Confirm topic split: 25 pages with REST/GraphQL/gRPC separate + EtherCAT added | **25 pages** — accept |
| Q4 | Confirm Phase 1 industrial seed includes Modbus RTU + Modbus TCP + BACnet/IP + OPC-UA (vs alternative starting set) | **As listed** — accept |

Resolved by v2 (no longer questions):

- ~~D-3 placement: Knowledge Labs section confirmed (KNOWLEDGE_LABS_STANDARD.md)~~
- ~~D-4 SFX register fixes: applied (no screen-shake, no perfect-fifth)~~
- ~~D-5 file split: applied (REST/GraphQL/gRPC separate)~~
- ~~D-6 SFX taxonomy: expanded to 8 events~~

---

## §14 — References

- design.md (brand tokens + anti-patterns)
- CLAUDE.md (rejected-patterns ledger)
- KNOWLEDGE_LABS_STANDARD.md (section integration)
- POST_DRAFT_STANDARD.md (per-topic post-draft mandate)
- CONTENT_LINKAGE_PLAYBOOK.md (sitemap + search-index + llms + OG)
- UI_FEATURES_STANDARD.md (focus indicators, share-buttons)
- RESPONSIVE_STANDARD.md (mobile checkpoints)
- VERSIONING_STANDARD.md (semver scheme)
- AUTH_STANDARD.md (tier matrix)
- CompTIA Network+ N10-009 exam objectives (current as of 2024)
- CompTIA Security+ SY0-701 exam objectives (current as of 2023)

Topic-specific references in each topic page's §10.

---

## §15 — Phase 0 Definition of Done (final gate)

Phase 0 is complete when:

- [ ] `js/network-anim/{engine,renderer,audio,vfx,palette}.js` shipped, all ≤budget
- [ ] `network-visualization-hub.html` shipped — landing + filter + lane nav + card grid (cards link to placeholder "Coming in Phase 1" for unbuilt topics)
- [ ] `network-compare.html` shipped — scaffold with empty panels (works with any topic from Phase 1+)
- [ ] One reference topic page (`network/industrial-ot/modbus-rtu.html`) shipped end-to-end as the canonical example
- [ ] Knowledge Labs section added to `datacenter-solutions.html` per §9.1
- [ ] 4 new entries in `js/rz-feature-flags.js` (hub, compare, modbus-rtu, + 1 placeholder for Phase 1 next ship)
- [ ] Sitemap / search-index / llms.txt / OG images for all 4 new pages
- [ ] Post-draft folder for "Network Hub" + "Modbus RTU" topic per POST_DRAFT_STANDARD
- [ ] `tools/audit-network-anim.py` (NEW) written and passing
- [ ] `tools/test-network-anim-determinism.py` (NEW) written and Modbus RTU passes
- [ ] CHANGELOG entry
- [ ] sw.js cache name bumped
- [ ] **Reference Modbus RTU module measured post-minification** — result logged in docs. If >15 KB, budget revised or module refactored before Phase 1 begins.
- [ ] **Reference Modbus RTU page ARIA milestones validated** — scrubber announces semantic phase transitions (e.g. "Handshake complete, frame 28"), not just frame numerics. Screen-reader walkthrough recorded.
- [ ] uiux-reviewer agent runs on live Modbus RTU page and confirms brand discipline
- [ ] code-reviewer agent runs on engine + topic-module contract and confirms IIFE pattern

---

## Appendix A — Why no Pixi.js / Three.js / GSAP

(carried forward from v1 — verdict: KEEP as v2)

Both reviewers confirmed: Canvas 2D + Web Audio API is the right choice.

- Pixi.js: 100+ KB, overkill for 2D byte/packet animation, brings WebGL
  context-loss complexity, vendor lock to the Pixi rendering model.
- Three.js: 600+ KB, 3D-first, irrelevant for 2D protocol visualisation.
- GSAP: licensing constraints for commercial use, adds animation
  framework for what `requestAnimationFrame` + small easing functions
  already do at zero cost.

Escape hatch: a single specific topic (e.g. WireGuard packet-flow if it
becomes 3D-needed) can adopt Three.js per-page. Not for the whole hub.

---

## Appendix B — Cross-protocol semantic mapping (NEW)

This is the contract that lets compare-mode work. Every topic module's
`getNormalized()` must return values populated from the topic's own
parameters using this mapping.

**Scope note**: The table below covers Phase 1 protocols (Modbus RTU, Modbus
TCP, BACnet/IP, OPC-UA) plus representative entries from other lanes for
illustration. The remaining 14+ protocols add rows in their respective
phases. Each phase's DoD includes "Appendix B row added for every topic
shipped this phase."

**Display rules for null / n/a fields** (renders in compare-mode chip strip §6.4):
- `effectiveThroughputBps = null` → chip displays `THROUGHPUT  —` (em-dash, no units)
- `endToEndLatencyMs = null` → chip displays `LATENCY  —`
- `frameOverheadBytes = null` → chip displays `OVERHEAD  —`
- `errorCount = null` → chip displays `STATUS  —`

The chip strip is always 4 rows; null fields show em-dash, never `0`, never hidden — keeps the panel grid visually stable across protocols with different semantics.

**Parameter completeness**: For each Phase 1 topic, every variable appearing in the formula MUST be present in the schema (essentials or advanced). Specifically the Modbus RTU schema in §8 must add `payloadBytes` (advanced, slider, 1-253, default 8) since the throughput formula depends on it.

| Protocol | `effectiveThroughputBps` | `endToEndLatencyMs` | `frameOverheadBytes` |
|----------|--------------------------|---------------------|----------------------|
| Modbus RTU | `(baudRate / 10) * (1 - lineNoise/100) * (payloadBytes / (payloadBytes + 5))` | `(payloadBytes * 8 + 80) / baudRate * 1000 + turnaroundMs` | 5 (1 addr + 1 fc + 2 crc + 1 stop) |
| Modbus TCP | `tcpThroughput * (payloadBytes / (payloadBytes + 7))` | `tcpRtt + 1` | 7 (MBAP header) |
| BACnet/IP | `udpThroughput * (payloadBytes / (payloadBytes + 8))` | `udpRtt + processingMs` | 8 (BVLC) |
| OPC-UA | `tcpThroughput * compressionRatio * (payloadBytes / (payloadBytes + 16))` | `tcpRtt + serializationMs` | 16 (OPC binary message header) |
| DNP3 | `(baudRate / 10) * (1 - lineNoise/100) * (payloadBytes / (payloadBytes + 10))` | varies; see topic | 10 |
| TLS handshake | during handshake = 0; after handshake = `tcpThroughput * (recordPayloadBytes / (recordPayloadBytes + 5 + macBytes))` (where macBytes = 32 for AES-256-GCM) | `rtt * handshakeRoundTrips` (1 for TLS 1.3, 2 for TLS 1.2) | 5 (record header) + 16-32 (AEAD tag) |
| OAuth/JWT | `null` (auth event, not stream — chip strip renders `—`) | `redirectMs + tokenExchangeMs` (sum of authorization-code redirect + token exchange POST) | `null` (chip renders `—`) |
| REST API | `(linkThroughputBps / 8) * (bodyBytes / (bodyBytes + headerBytes))` where `linkThroughputBps` is the underlying TCP link's effective rate (schema parameter; default 100 Mbps for "office LAN" preset) | `requestMs + responseMs` (round-trip + server processing) | `headerBytes` (sum of HTTP/1.1 status line + headers; typically 200-800; exposed as schema parameter) |
| gRPC | `http2Throughput * (payloadBytes / (payloadBytes + 9))` | `http2RoundTripMs` | 9 (gRPC frame header) |
| MCP tool-call | `null` (call/response, not stream — chip renders `—`) | `transportRtt + toolExecMs` (transport round-trip + server-side tool execution) | varies by transport (stdio = `null`; HTTP = same as REST headers) |

Each topic-module author owns translating their UI parameters → these
normalised values. Spec is concrete enough to write a unit test against.

---

## Appendix C — SFX taxonomy (EXPANDED)

(Spec table in §5.4 above. This appendix carries the rationale.)

Five events covered serial/layer-2 well in v1. Software protocols (OAuth,
TLS, gRPC, MCP) needed conceptually different events. Adding:

- `handshake` — for multi-step auth flows (TLS, mTLS, OAuth, WireGuard handshake). A rising tri-tone arpeggio captures "things are being agreed". Semantically distinct from a single-byte `byte`.
- `stream-chunk` — for gRPC / SSE / WebSocket / chunked HTTP / MCP streaming. A soft click train (50 Hz pulse) — like a printer making progress. Avoids using `byte` for what's conceptually a higher-level chunk.
- `token-issue` — for OAuth/JWT issuance, certificate issuance. A distinct sine tone separates "token minted" from generic `complete`.

All synth-only, no samples. Decay to silence by 250 ms. Default muted.

---

## Appendix D — VFX vocabulary (CONSTRAINED)

(Spec table in §5.5 above. This appendix carries the rationale.)

The biggest review pushback was the temptation toward consumer-techno
aesthetics. To prevent drift across 25 topic authors:

1. `palette.js` is the sole color source. Topic modules import `colors` from it; hex literals in `topics/*.js` are blocked by a lint rule (`audit-network-anim.py`).
2. Banned CSS properties in `vfx.js`: `box-shadow`, `filter: blur`, `filter: drop-shadow` with >1 layer, `mix-blend-mode: screen` / `overlay`. Lint rule blocks them at audit time.
3. Particle / segment caps are numeric, not aspirational: packet trail ≤2 segments; ACK ring ≤1 active per node; drawCalls ≤200 per frame per panel.
4. Word choice matters. "Byte glow" tempts implementers toward shadow softness; "Byte chip" matches the solid-fill discipline. v2 uses "chip" everywhere.

These are hard rules, not preferences. A topic page that violates any of
them fails `audit-network-anim.py` and cannot ship.

---

## Sign-off

Owner approval required on Q1–Q4 in §13 before Phase 0 begins.

Reviewer chains: code-reviewer + uiux-reviewer on this v2 doc → owner
sign-off → Phase 0 begins.

Plan v2 supersedes v1 (`2026-05-23-network-visualization-hub.md`); v1 is
kept as a historical reference and is NOT a working specification.
