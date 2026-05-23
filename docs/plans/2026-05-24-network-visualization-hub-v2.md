# Network Visualization Hub — Implementation Plan v2

> **Status**: For owner sign-off · Plan v2 · 2026-05-24
> **Supersedes**: `2026-05-23-network-visualization-hub.md` (v1; REWORK verdict from code-reviewer, APPROVE_WITH_NOTES from uiux-reviewer)
> **Owner**: Bagus Dwi Permana
> **Sponsor section**: Knowledge Labs on `datacenter-solutions.html` (per `KNOWLEDGE_LABS_STANDARD.md` v1, 2026-05-24)
> **Target ship**: next free MINOR after Phase 0 (likely v1.33.0 if no other MINOR lands first)

---

## v2 changes from v1 (review-driven)

### v2.3 (post-v2.2-review tightening — 2026-05-24)

| Change | Trigger |
|--------|---------|
| §5.6 composition order: explicit precedence (defaults < timbre < perRole < perState), `tempoMultiplier` scales animation playback only (not durationMs), top-level + perState tempo multiplied | code-reviewer v2.2 HIGH-1 |
| §5.2 + §5.6: engine reads `timbre` via `init()` return value (instance.timbre property), NOT via global namespace side-channel | code-reviewer v2.2 HIGH-2 |
| §15 anti-monotony gate wording: pairwise-within-lane (any pair), NOT pairwise-against-reference | code-reviewer v2.2 HIGH-3 |
| §5.6: engine clamps computed freq to [400, 3000] Hz, duration to [6, 25] ms post-composition | code-reviewer v2.2 MEDIUM-1 + uiux-reviewer recommendation 3 |
| §5.6: `timbre.handshake.freqSteps: number[]` schema added (unblocks TLS/mTLS/TCP/DHCP/DNS) | code-reviewer v2.2 MEDIUM-3 |
| §5.6: `node.tertiaryIcons: string[]` schema for >2-actor protocols (unblocks OAuth, MCP, DHCP) | code-reviewer v2.2 MEDIUM-4 |
| §5.3: chip-position pixel-snap mandate added; tolerance is element-relative (≤1 px per chip, ≤2% per stroked path) | code-reviewer v2.2 MEDIUM-5 |
| §5.6: tempo envelope tightened to 0.7×–1.7× (was 0.5×–2.0×) — preventative against BPM-range musicality | uiux-reviewer v2.2 recommendation 3 |
| §5.6: chip shape `scroll` renamed `long-rect` — anti-skeuomorph guard | uiux-reviewer v2.2 recommendation 3 |
| §5.6: `perState.error.tempoMultiplier` LOCKED to 1.0× (no slow-on-error — let SFX/bezel-flash do the work; HMI convention, not stage music) | uiux-reviewer v2.2 musicality leak 3 |
| §5.6: dual-tone simultaneous banned — only sequential frequency steps (anti-musical-interval) | uiux-reviewer v2.2 musicality leak 1 |
| §5.6: 5 new timbre fields added: `errorSignature`, `encryption`, `latencyClass`, `completeFreq`, `compareDegrade` | uiux-reviewer v2.2 coverage gaps |
| §5.6: chip color tint exception sanctioned for flow-stage transitions only (amber→cyan for auth-issuance sequences); palette tokens still locked | uiux-reviewer v2.2 recommendation 2 |
| Appendix E row adjustments: OPC-UA, EtherNet/IP, EtherCAT, SNMP, IPv4-v6, DHCP-DNS, IPMI-Redfish, OAuth, GraphQL, MCP — per uiux row-by-row notes | uiux-reviewer v2.2 row notes |
| Appendix E: profinet vs ethernet-ip differentiated (was 3+ shared fields, violated ≤2 anti-monotony rule) | self-audit from cross-row read |

### v2.2 addendum (anti-monotony — owner directive 2026-05-24)

| Change | Trigger |
|--------|---------|
| §5.6 — per-system **timbre profile** added: every topic module exports `timbre` controlling byte waveform, chip shape, wire style, node icons, tempo + per-role + per-state modifiers | Owner: "pastikan effectnya jangan monoton dan bervariasi based on object atau systemnya" |
| Appendix E — per-protocol timbre table covering all 25 topics with distinctive trait per row | Same |
| `audit-network-anim.py` anti-monotony gate: refuses topic modules that share >2 timbre fields with another topic in the same lane | Same |
| Phase 0 DoD adds timbre validation + anti-monotony gate check | Same |

### v2 / v2.1 changes (from review cycle)

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
    _timbre: { /* see §5.6 */ },

    /**
     * @param {HTMLCanvasElement} canvas
     * @param {Object} params       — current parameter values (baud, parity, etc.)
     * @param {Object} signals      — { onSFX, onError, onComplete } callbacks the topic invokes
     * @returns {{
     *   play: () => void,
     *   pause: () => void,
     *   seek: (frame: number) => void,   // DETERMINISTIC — see §5.3
     *   setParams: (next: Object) => void,
     *   getNormalized: () => NormalizedMetrics,  // for compare-mode diff (§6)
     *   destroy: () => void,
     *   timbre: TimbreProfile           // v2.3: engine reads timbre off the returned instance
     * }}
     */
    init: function (canvas, params, signals) {
      // … implementation …
      return {
        play, pause, seek, setParams, getNormalized, destroy,
        timbre: window.RZNetAnim.modbusRtu._timbre   // exposed on returned instance
      };
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

**Pixel-snap mandate**: `renderer.js` MUST snap to half-pixel grid:
- **Strokes** (wires, arcs, ACK rings): `Math.round(x) + 0.5` for every endpoint
- **Chip positions** (v2.3: NEW): `Math.round(originX)` / `Math.round(originY)` for every chip blit, regardless of chip size

Without this, anti-aliased edges produce sub-pixel luminance variation
between two `seek(N)` calls; with variable chip sizes (6×6 to 12×12 px),
the relative impact of a half-pixel jitter on a small chip dwarfs the
canvas-global tolerance.

The module contract test (`tools/test-network-anim-determinism.py`) asserts:
- `seek(N)` after `play()` to frame N == `seek(N)` after `reset() + seek(N)`
- Pixel-diff tolerance is **element-relative** (v2.3):
  - Chip positions: ≤1 px absolute deviation per chip
  - Stroked-path regions: ≤2% of the stroked element's bounding box
  - Solid-fill chip interiors: 0% deviation expected
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

**Canonical events are templates, not fixed sounds.** Each topic module
customises the canonical event through its **timbre profile** (§5.6 + Appendix E)
so Modbus RTU's `byte` event sounds and looks different from gRPC's `byte`
event, even though both call the same `emit('byte', ...)` engine API.
Variation is REQUIRED — monotony across 25 topics is a fail-state.

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

## §5.6 — Per-system timbre profile (v2.3 — anti-monotony layer)

The 8 canonical SFX events and 8 VFX entries in §5.4 + §5.5 are **abstract
templates**. If every topic emitted them identically, 25 topic pages would
sound and look the same, which would fail-state the hub. Each topic module
declares a **timbre profile** that the engine reads to shape canonical
events into protocol-specific character.

### The timbre object

Every topic module returns its `timbre` as a property on the instance it
creates from `init()` — NOT via a side-channel on the global namespace.
This makes the data-flow explicit and lets the engine validate timbre
existence before calling `emit()`:

```js
window.RZNetAnim.modbusRtu = {
  init: function (canvas, params, signals) {
    // … render setup …
    return {
      play, pause, seek, setParams, getNormalized, destroy,
      timbre: window.RZNetAnim.modbusRtu._timbre  // exposed on the instance
    };
  },
  _timbre: { /* see below */ }  // module-internal definition
};
```

The `_timbre` definition:

```js
window.RZNetAnim.modbusRtu._timbre = {
  // ─── AUDIO personality ────────────────────────────────
  byte: { waveform: 'square-sweep', freqStart: 1200, freqEnd: 1600, durationMs: 12 },
  ack:  { waveform: 'sine',          freq: 1800,     durationMs: 60 },
  tick: { waveform: 'square',        freq: 800,      durationMs: 6 },
  // OPTIONAL: include only if relevant to this protocol; engine falls back
  // to canonical §5.4 default if undefined.
  handshake:    { freqSteps: [800, 1000, 1200], stepDurationMs: 40 },  // multi-stage
  streamChunk:  { freqStart: 50, durationMs: 30, pulseRateHz: 50 },     // click train
  tokenIssue:   { waveform: 'sine', freq: 2400, durationMs: 100 },
  errorSfx:     { waveform: 'sawtooth', freq: 220, durationMs: 80 },
  completeSfx:  { waveform: 'sine', freq: 1500, durationMs: 80 },
  tempoMultiplier: 1.0,            // nominal; bounded [0.7, 1.7]
  registerCharacter: 'modem-v21',  // documentation tag only; not consumed by engine

  // ─── VISUAL personality ───────────────────────────────
  byteChip: {
    shape: 'square',               // square | rect | hex | triangle | layered | token | envelope | long-rect
                                   //   (NOTE v2.3: `scroll` removed; use `long-rect` to avoid skeuomorph drift)
    sizePx: [8, 8],                // [w, h] — bounded [6,12] × [4,12]
    color: 'instrument-cyan'       // palette token; never a hex; see "Color tint exception" below
  },
  wire: {
    style: 'serial-thin',          // serial-thin | ethernet | http2-multiplex | crypto-shroud | mesh-tunnel | bus-trunk | sideband-dashed
                                   //   (NOTE v2.3: `sideband-dashed` added for OOB management plane)
    widthPx: 0.7                   // must match design.md tier (0.6/0.7/1.0/1.4)
  },
  node: {
    masterIcon: 'plc-rectangle',   // plc-rectangle | server-rack | client-circle | tower-mesh | broker-diamond
    slaveIcon: 'sensor-circle',
    tertiaryIcons: []              // for >2-actor protocols (OAuth, MCP, DHCP); 0-2 additional icons
  },

  // ─── ERROR SIGNATURE (NEW v2.3 — per-protocol error look) ─────────────
  errorSignature: 'crc-fail-bytes-corrupt',
  // enum: 'crc-fail-bytes-corrupt' (Modbus) | 'cert-mismatch-shroud-breaks' (TLS) |
  //       'token-rejected-amber-flash' (OAuth) | 'timeout-grey-fade' (REST) |
  //       'frame-loss-trail-cut' (gRPC) | 'collision-stop' (Ethernet)

  // ─── ENCRYPTION VISUALISATION (NEW v2.3) ──────────────────────────────
  encryption: 'none',              // 'none' | 'always' | 'progressive' | 'bilateral'

  // ─── LATENCY CLASS (NEW v2.3 — feeds compare-mode without overloading tempo) ─
  latencyClass: 'interactive',     // 'realtime' (<1 ms cycle) | 'interactive' (1-50 ms) |
                                   //   'batch' (50ms-1s) | 'human-paced' (>1s, e.g. OAuth redirect)

  // ─── COMPARE-MODE DEGRADATION (NEW v2.3) ──────────────────────────────
  compareDegrade: ['drop-shroud', 'drop-trail', 'drop-pulse'],
  // explicit priority order of effects to drop when in compare mode (§7 minimal flag)

  // ─── PER-ROLE MODIFIERS (within a single topic) ───────────────────────
  // Different roles in the same protocol get different flavor.
  // Reads as DATA (data direction, channel-coded), not as PERSONALITY.
  perRole: {
    master: { byteFreqShift: 0,    waveform: 'square-sweep' },
    slave:  { byteFreqShift: -200, waveform: 'square-sweep' }   // slave bytes pitched lower
  },

  // ─── PER-STATE MODIFIERS ──────────────────────────────────────────────
  // Same event sounds slightly different during handshake vs steady-state.
  perState: {
    handshake: { tempoMultiplier: 0.7, ackToneShift: +200 },
    steady:    { tempoMultiplier: 1.0 },
    error:     { tempoMultiplier: 1.0 }      // v2.3: LOCKED to 1.0 — NO slow-on-error.
                                              // Error is communicated by SFX (sawtooth 220 Hz)
                                              // + 2 px red bezel flash; doubling via tempo
                                              // would read as stage-music dramatic timing.
  }
};
```

### Composition order (precise — code-reviewer v2.2 HIGH-1 fix)

`engine.emit('byte', {role, state})` composes parameters in this exact order:

1. **Base** — canonical §5.4 default for the event
2. **Topic timbre** — override with `instance.timbre.byte` if defined
3. **Per-role** — override with `instance.timbre.perRole[role]` if defined
4. **Per-state** — override with `instance.timbre.perState[state]` if defined
5. **Tempo composition** — final `tempoMultiplier = topLevel × perState[state].tempoMultiplier`
   (multiplicative, NOT override). Both clamped to [0.7, 1.7] envelope.
6. **Tempo scope** — `tempoMultiplier` scales **animation frame playback rate** only;
   it does NOT scale `durationMs` of individual SFX events (SFX duration is locked
   by the timbre + §5.4 hard 250 ms decay cap).
7. **Clamp** — engine clamps the composed result to bounds:
   - `freq` ∈ [400, 3000] Hz (v2.3: floor raised from 200 to avoid laptop-speaker rolloff + sub-bass musicality)
   - `durationMs` ∈ [6, 25] ms
   - Out-of-bounds values are silently clamped; `audit-network-anim.py` warns on any timbre that *requests* an out-of-bounds value (catches authoring errors before runtime clamping hides them).
8. **Synth** — `audio.js` plays the result.

**Banned: simultaneous dual-tone.** A topic may emit multiple frequencies
*sequentially* (e.g. handshake step 1 = 800 Hz then step 2 = 1000 Hz) but
NEVER two tones at the same instant. Two simultaneous tones at musical
intervals (perfect-fifth 3:2, perfect-fourth 4:3, octave 2:1) produce
musicality that contradicts the instrumentation register.

VFX composition order (analogous): `renderer.drawChip()` reads
`instance.timbre.byteChip` overlaid with per-role / per-state modifiers,
applies `Math.round(x) + 0.5` snap to position (chips) and stroke
coordinates (wires/arcs), draws.

### Variation budget (what's variable, what's locked) — v2.3 tightened bounds

**VARIABLE per-topic** (encourage variety here):

- **Byte waveform** — enum: `square | sine | sawtooth | triangle | square-sweep | sine-sweep`
- **Byte freq range** — within **[400, 3000] Hz** (v2.3: raised from 200 Hz to avoid laptop-speaker rolloff + bass-musicality)
- **Byte duration** — within [6, 25] ms; must still decay by 250 ms hard cap
- **Tempo multiplier** — within **[0.7×, 1.7×]** (v2.3: tightened from 0.5–2.0 to stay out of BPM-range territory)
- **Byte chip shape** — enum: `square | rect | hex | triangle | layered | token | envelope | long-rect` (v2.3: `scroll` removed)
- **Byte chip size** — within [6,12] × [4,12] px
- **Byte chip color** — `instrument-cyan` default; **flow-stage tint exception** (v2.3): `signal-amber` permitted for transient pre-issuance stages in auth-flow sequences (OAuth auth-code chip, IPMI OOB chip) provided the protocol's terminal/steady chip returns to `instrument-cyan`. No new tokens; no per-topic palette extension.
- **Wire style** — enum: `serial-thin | ethernet | http2-multiplex | crypto-shroud | mesh-tunnel | bus-trunk | sideband-dashed` (v2.3: `sideband-dashed` added for OOB management plane)
- **Wire width** — must match design.md tier: 0.6 / 0.7 / 1.0 / 1.4 px
- **Node icons** — declared set in `renderer.js`; up to 2 tertiary icons via `node.tertiaryIcons[]`
- **Per-role frequency shift** — ±400 Hz (post-shift result still clamped to [400, 3000] Hz)
- **Per-state tempo** — within [0.7×, 1.7×] envelope (but `error` state is LOCKED to 1.0× — see below)
- **Error signature** — enum: `crc-fail-bytes-corrupt | cert-mismatch-shroud-breaks | token-rejected-amber-flash | timeout-grey-fade | frame-loss-trail-cut | collision-stop`
- **Encryption visualization** — enum: `none | always | progressive | bilateral`
- **Latency class** — enum: `realtime | interactive | batch | human-paced`
- **Complete event freq** — within [800, 2500] Hz; duration ≤120 ms
- **Compare-degrade priority** — ordered list of effects to drop first when in compare mode

**LOCKED everywhere** (do not vary):

- Palette tokens (`instrument-cyan` `#00DDFF` / `signal-amber` `#FFAA00` /
  `oscilloscope-green` `#00FF88` / `fault-red` `#FF3030`). NO topic
  introduces a new colour token. Flow-stage tint exception above is the
  ONLY sanctioned deviation from cyan-default, and it must use amber from
  the locked set.
- 250 ms decay-to-silence on every SFX
- Mute-by-default
- Pixel-snap rule (§5.3 — applies to chip position AND stroked paths)
- drawCalls ≤200 per frame per panel
- Particle/segment caps (§5.5)
- Banned CSS properties (§5.5)
- Reduced-motion media query disables ALL VFX
- A11y glyph pairing (§11)
- **`perState.error.tempoMultiplier` = 1.0** (v2.3: LOCKED — no slow-on-error)
- **Simultaneous multi-tone banned** — frequencies emitted at the same instant produce musical intervals; only sequential steps allowed
- **A11y focus indicator** = 2 px signal-amber + 2 px offset
- **Glyph pairing** = ✓ × ↓ ⚠ for ACK / error / drop / warning

### Why this is enforced

Without timbre profiles, 25 topic authors will emit `byte` with whatever
default they remembered, producing 25 identical-feeling pages. The user
will rightly complain that the hub is monotonous.

`tools/audit-network-anim.py` (Phase 0) checks that every topic module:
- Declares a `timbre` object
- Differs from `modbus-rtu`'s timbre on at least 3 fields (the reference)
- Uses only declared shape / wire / icon enum values
- Keeps all variations inside the variation budget above

A topic page that ships with the reference Modbus RTU timbre unchanged fails
the audit. This is the anti-monotony gate.

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
- [ ] **Modbus RTU `timbre` profile populated** per Appendix E reference row; engine reads it; `emit('byte')` produces audibly + visibly distinct character vs the engine default.
- [ ] **`audit-network-anim.py` anti-monotony gate operational** — refuses any topic module that shares >2 timbre fields (waveform, chip shape, wire style, master icon, tempo-bin) with **any other** topic in the same lane (pairwise-within-lane, not just against the reference). Tempo is binned: ≤0.8 = "slow", 0.9–1.3 = "medium", ≥1.4 = "fast" for the equality check.
- [ ] uiux-reviewer agent runs on live Modbus RTU page and confirms brand discipline + timbre character matches Appendix E
- [ ] code-reviewer agent runs on engine + topic-module contract and confirms IIFE pattern + timbre composition logic

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

## Appendix E — Per-protocol timbre table (NEW v2.1 — anti-monotony spec)

Each row defines that protocol's personality within the §5.6 variation
budget. Phase 0 only needs Modbus RTU populated (reference); each subsequent
phase populates rows for its topics. Authors MUST consult this table before
writing a new topic timbre, to avoid clustering near similar protocols.

| Topic | Register character | Byte waveform | Byte chip | Wire | Node icons | Tempo | Distinctive trait |
|-------|-------------------|---------------|-----------|------|------------|-------|-------------------|
| **Lane B — Industrial OT** ||||||||
| modbus-rtu | modem-v21, slow-serial | square-sweep 1200→1600 Hz, 12 ms | square 8×8 cyan | serial-thin 0.7 px | plc-rectangle master + sensor-circle slave | 1.0× | master/slave byte freq differ by 200 Hz; ground-loop warning amber |
| modbus-tcp | modem-v21 over Ethernet | square-sweep 1200→1600 Hz, 8 ms (faster) | rect 12×6 cyan | ethernet 1.0 px | server-rack master + sensor-circle slave | 1.5× | MBAP header chip visibly larger (frame overhead) |
| bacnet-mstp | building-automation analog | rounded sine 900→1100 Hz, 14 ms | hex 8×8 cyan | bus-trunk 0.7 px (RS-485) | controller-square + sensor-circle | 0.8× | hex chip = bacnet trademark; HVAC-friendly slower tempo |
| bacnet-ip | building-automation over IP | rounded sine 900→1100 Hz, 10 ms | hex 8×8 cyan | ethernet 1.0 px | controller-square + server-rack | 1.4× | BVLC tunnel = scan-line-shroud short segment at packet head |
| opc-ua | industrial PLC structured | sine 1.4 kHz, 10 ms (NO additional pulse — chip layering is the distinctive trait) | layered 10×8 cyan | ethernet 1.0 px | server-rack + sensor-circle + broker-diamond | 1.2× | layered chip = binary protocol structure (one signal only — pulse dropped per uiux v2.2) |
| dnp3 | telemetry SCADA, deliberate | sine-sweep 600→900 Hz, 16 ms | rect 10×6 cyan | serial-thin 0.7 px or ethernet 1.0 px | rtu-square + master-rectangle | 0.9× | unsolicited responses = chip emits without master poll first |
| profinet | real-time industrial Ethernet | square 2.0 kHz, 8 ms | square 8×8 cyan | ethernet 1.0 px + sync overlay | controller-square + io-device-circle | 1.6× | sync line above wire shows cyclic deterministic timing |
| ethernet-ip | CIP over Ethernet | sawtooth 1.5 kHz, 9 ms (v2.3: differentiated from profinet square) | rect 10×8 cyan with marker-stripe head (v2.3: text-on-chip replaced) | ethernet 1.0 px | scanner-rectangle + adapter-circle | 1.4× (v2.3: dropped from 1.5× to break profinet-tempo overlap) | CIP layer indicated by colored marker stripe on chip head (NOT inline text — readability cap on 8 px chips) |
| ethercat | distributed clocks, ultra-fast | square 2.5 kHz, 6 ms | rect 6×6 cyan | bus-trunk 1.0 px daisy-chain | master-rectangle + slave-square chain | 1.7× (v2.3: trimmed from 2.0× to honor tightened envelope) | telegram passes through nodes on-the-fly (visual: chip doesn't stop) |
| **Lane A — Foundations** ||||||||
| osi-tcp-ip-models | conceptual layering | sine 1.0 kHz, 15 ms (slower, didactic) | layered 12×10 cyan | layered 1.0 px (4 stacked) | layer-rectangles | 0.7× | byte chip ascends layer-stack visually |
| ipv4-vs-ipv6 | addressing comparison | SEQUENTIAL two-stage: 800 Hz 8 ms → 1200 Hz 8 ms (v2.3: simultaneous dual-tone banned — sequence reads as "stage progression," chord reads as music) | rect 10×6 with hex address tag | ethernet 1.0 px | router-diamond + endpoint-circle | 1.0× | side-by-side mode shows v4 32-bit chip vs v6 128-bit chip (visibly larger) |
| subnetting-cidr | block partition | square 1.0 kHz, 8 ms | square 8×8 with subnet-mask overlay | ethernet 1.0 px branched | router-diamond | 1.0× | subnet boundary line visualises CIDR prefix |
| tcp-handshake | three-way ceremony | handshake event: 800→1000→1200 Hz, 40 ms each step | triangle 10×10 (handshake arrow) | ethernet 1.0 px | client-circle + server-rack | 1.2× | SYN/SYN-ACK/ACK render as 3 distinct chip shapes |
| dhcp-dns | discovery + resolution | DORA monotonic ascending (v2.3 — was non-monotonic descend-then-ascend which read as a tune): DISCOVER = sine 600 Hz / OFFER = sine 900 Hz / REQUEST = sine 1200 Hz / ACK = sine 1500 Hz | envelope 10×8 (broadcast) | ethernet 1.0 px branched | client-circle + server-rack + tertiary: broadcast-fan | 1.0× | 4-stage DORA shown as 4 distinct sound + visual signatures; ascending pitch reads as "stages completing" |
| **Lane C — DC Management** ||||||||
| snmp | polled monitoring, repetitive | tick 700 Hz every 0.5 s + sine 1.2 kHz response 12 ms | small square 6×6 cyan | ethernet 1.0 px | manager-rectangle + agent-circle | 0.7× (v2.3: lifted from 0.6× to honor tightened floor) | polling cadence visible as metronome on wire |
| ipmi-redfish | management plane, slow | sine 1.0 kHz, 20 ms (slow + deliberate) | rect 12×6 cyan (v2.3: amber-tint dropped — palette discipline) | sideband-dashed 1.0 px (v2.3: OOB encoded in wire style, not chip color) | bmc-square + management-server | 0.7× | OOB wire styled distinct from in-band data wire — sideband-dashed pattern is the trait |
| syslog | append-only stream | soft click train 50 Hz pulse, 30 ms (printer-progress) | rect 14×4 (long line of text) | ethernet 1.0 px one-way | source-rectangle + collector-rectangle | 1.1× | chip elongated to suggest text line; one-way arrow |
| **Lane D — Security** ||||||||
| tls-handshake | cryptographic ceremony | handshake event: 800→1000→1200→1400 Hz sweep, 35 ms steps | triangle 10×10 (handshake) → token 12×8 (cert) | crypto-shroud overlay applied progressively | client-circle + server-rack + ca-diamond | 0.9× | scan-line shroud builds up across the handshake; final chip = encrypted "tunnel" |
| oauth-jwt | redirect + token | redirect = sine 900 Hz, 80 ms / token-issue = sine 2.4 kHz, 100 ms | token 14×8 signal-amber (auth-code, transient pre-issuance — invokes §5.6 flow-stage tint exception) → token 16×10 instrument-cyan (JWT, steady) | crypto-shroud on final hop | user-circle + client-rack + tertiary: as-diamond + rs-rectangle | 1.0× | 4-actor dance distinctly choreographed; amber→cyan tint transition formally permitted under flow-stage exception |
| mtls | bilateral TLS | tls handshake personality + mirrored handshake-from-server | triangle 10×10 (both directions) | crypto-shroud full | client-circle + server-rack (both certified) | 0.9× | both nodes render cert badge; handshake echoes both ways |
| wireguard | minimalist modern crypto | single sine 1.5 kHz, 30 ms (terse) | square 6×6 cyan w/ crypto-shroud always-on | crypto-shroud mesh-tunnel | tower-mesh peers (no master) | 1.4× | no separate handshake animation — peers are pre-keyed; minimal chrome |
| **Lane E — APIs + Agents** ||||||||
| rest-api | HTTP request/response | request = sawtooth 800 Hz 20 ms / response = sine 1.4 kHz 25 ms | envelope 12×8 (request) → envelope 14×10 (response with body) | ethernet 1.0 px | client-circle + server-rack | 1.0× | request/response timing visible as gap; header chip + body chip distinct |
| graphql | single declarative query | sine 1.2 kHz, 30 ms (single deliberate chirp) | long-rect 16×6 (long query) → up to 3 distinct field-chip shapes back (v2.3: capped from "assorted" — `square` for scalars, `rect` for objects, `hex` for enums; renderer rejects a 4th shape per response) | ethernet 1.0 px | client-circle + server-rack + tertiary: resolver-diamonds | 1.0× | one outbound long-rect, multiple inbound chips of up to 3 shape classes |
| grpc | HTTP/2 multiplexed | stream-chunk = soft click train 50 Hz, 30 ms continuous | small rect 8×6 cyan, multiple streams overlapping | http2-multiplex 1.0 px (4 lanes) | client-circle + server-rack | 1.7× | multiple chip streams flow simultaneously on adjacent wires |
| mcp-tool-call | RPC over MCP transport (v2.3: NOT "agentic + soft + warm" — RPC is RPC; industrial register holds) | call = sine 1.2 kHz, 60 ms / result = sine 1.6 kHz, 80 ms | rect 14×6 instrument-cyan (tool-name; v2.3: amber removed) → rect 12×8 instrument-cyan (result JSON) | mesh-tunnel 1.0 px (peer-to-peer transport) | agent-circle + tool-rectangle + tertiary: resource-diamond | 0.9× | three-actor RPC dance (caller, tool, resource); transport is mesh-tunnel because MCP supports stdio/HTTP/peer — wire style is the distinctive trait, NOT tempo or timbre softness |

**Reading the table**:
- **Register character** is documentation only (not consumed by code); it's
  there so the audit can sanity-check that timbres don't drift away from
  the stated character.
- **Distinctive trait** column is the "one thing that makes this protocol
  stand out" — every topic page must visibly honor it.

**Anti-monotony rule** (enforced by `audit-network-anim.py`):
- No two topics in the same lane may share more than 2 fields (out of:
  byte waveform, byte chip shape, wire style, node master icon, tempo).
- Phase 0 ships Modbus RTU as the reference; Phase 1 ships 3 more topics
  in Lane B that MUST visibly differ from Modbus RTU on the audit table.

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
