# DC Solutions — Network Visualization Hub

- **Date:** 2026-05-23
- **Mode:** PLAN ONLY (no code until owner approves)
- **Status:** Concept design + technical plan; awaiting owner review (code-reviewer + uiux-reviewer agents will run on this doc before any implementation).
- **Trigger:** Owner request to add a "network stuff" hub to DC Solutions covering CompTIA-aligned communication protocols (Modbus RTU/485, Modbus TCP, BACnet, OPC-UA, etc.) and software topics (MCP, API, OAuth 2.0, JWT, mTLS, GraphQL, etc.) — each topic with an animated visualization, parameter input panels, and a compare/grid mode. SFX + VFX expected. Reference video supplied by owner.

---

## 1. Mission

Make industrial-control + software-engineering communication protocols **viscerally intuitive** through:

1. **Live animations** of bytes/packets/frames moving across the wire (or air), under user-controllable parameters.
2. **Compare mode** — up to four animations running side-by-side on a synchronised timeline (e.g. *Modbus RTU @ 9600 baud* vs *Modbus TCP @ 1 Gbit/s* vs *BACnet/IP* vs *OPC-UA* answering the same conceptual question: "read holding register 40001").
3. **Parameter inputs** — every relevant protocol parameter is a control (slider/select/toggle) that mutates the animation in real time. For Modbus RTU: baud rate, parity, stop bits, slave address, function code, register count, line length, noise level. For TLS: cipher suite, certificate chain depth, OCSP stapling on/off, session resumption.
4. **SFX + VFX** — Web Audio for transmission chirps, ACK ticks, error buzzes; CSS / Canvas for packet trail glow, collision flash, retransmission echo. SFX is opt-in (volume slider + mute by default) per accessibility + courtesy norms.
5. **CompTIA-aligned curriculum** — each topic links to the Network+/Security+/A+ objective it teaches, so the hub doubles as a study tool.

Target audience: data-centre / OT / IT engineers preparing for CompTIA certs, teaching protocols to junior staff, debugging integration problems on real assets.

## 2. Constraints + design system

- **Static GitHub Pages site** — no backend. All animations + audio synth client-side.
- **Brand discipline** (see `documentation/design.md` + `CLAUDE.md`):
  - Instrument-cyan `#00DDFF`, signal-amber `#FFAA00`, oscilloscope-green `#00FF88`, fault-red `#FF3030`. **NO Anthropic-purple, NO neon glow, NO drop-shadow soup.**
  - Thin lines (0.6 – 1.4 px tier-graded).
  - IBM Plex Sans + JetBrains Mono.
  - No dot-grid hero, no rotated floating cards, no cursor-tracking, no glassmorphism / neumorphism / Tailwind-default look.
- **Performance budget**: 60 fps on a mid-range laptop with 4 panels in compare mode. Audio synth ≤ 5 ms per event. Initial page weight ≤ 200 KB (HTML + CSS); animation libs lazy-loaded per topic.
- **Mobile responsive** — compare mode collapses to 1 column < 900 px; SFX off by default on mobile to respect autoplay-gesture policy.
- **A11y** — every animation has a "describe it in plain text" mode that narrates the protocol step-by-step for screen-reader users; SFX has visual equivalents.
- **Lazy budget** — each topic page is independent so users only download the bundle they need.

## 3. Information architecture

```
datacenter-solutions.html
    └─ Network Visualization Hub  (new "Network" card alongside CAPEX/OPEX/AI-Maint)
            │
            ▼
     network-visualization-hub.html   ← LANDING (topic taxonomy + featured animations)
            │
            ├─ network/modbus-rtu.html       Communication / Industrial
            ├─ network/modbus-tcp.html
            ├─ network/bacnet-mstp.html
            ├─ network/bacnet-ip.html
            ├─ network/opc-ua.html
            ├─ network/dnp3.html
            ├─ network/profinet.html
            ├─ network/ethernet-ip.html
            ├─ network/mqtt.html
            ├─ network/snmp.html
            ├─ network/ipmi-redfish.html
            ├─ network/tcp-ip-osi.html        CompTIA Net+ foundations
            ├─ network/dns-dhcp-arp.html
            ├─ network/routing-stp-vlan.html
            ├─ network/tls-handshake.html     CompTIA Sec+
            ├─ network/oauth2-oidc.html       Software auth
            ├─ network/jwt-anatomy.html
            ├─ network/mtls.html
            ├─ network/mcp-protocol.html      AI / agent
            ├─ network/rest-graphql-grpc.html  API styles
            ├─ network/websocket-sse.html
            └─ network/pubsub-kafka-mqtt.html

Plus:  network/compare.html?topics=modbus-rtu,modbus-tcp   ← compare-mode page
```

The hub landing groups topics into **5 lanes** mirroring CompTIA + DC-engineering reality:

| Lane | Topics | CompTIA objective |
|---|---|---|
| **A. Foundations** | TCP/IP + OSI, IPv4/IPv6, subnetting, ARP/DHCP/DNS, NAT, routing/STP/VLAN | Network+ N10-009 §1, §2 |
| **B. Industrial / OT** | Modbus RTU/485, Modbus ASCII, Modbus TCP, BACnet MS/TP + IP, OPC-UA, DNP3, PROFINET, EtherNet/IP, EtherCAT | ISA-95, BICSI, DC-specific |
| **C. DC Management** | SNMP v2c/v3, IPMI, Redfish, syslog, NetFlow | Net+ + Uptime + OCP |
| **D. Security** | TLS 1.3 handshake, mTLS, PKI / certificate chain, OAuth 2.0 (auth-code + PKCE + client-credentials + device-code), OIDC, JWT, SAML, Kerberos, IPSec / WireGuard, SSH key exchange | Security+ SY0-701 §1, §2, §3 |
| **E. APIs + Agents** | REST + GraphQL + gRPC, WebSocket, SSE, long-poll, MQTT, Kafka/NATS pub-sub, MCP (Anthropic Model Context Protocol), webhook + idempotency, rate-limiting + circuit-breaker | Industry + LLM agent ops |

22 topic pages in v1; further topics added without re-architecture.

## 4. Topic page anatomy (template)

Each topic page is a **standalone HTML file** with the following sections (top-to-bottom):

1. **Hero** — topic name + 1-line description + CompTIA tag + difficulty (★/★★/★★★).
2. **Conceptual model card** — 2–3 paragraphs of plain-English explanation: what problem this protocol solves, where it sits on the OSI stack (or off-stack for software topics), notable history.
3. **Animation canvas (the centerpiece)** — Canvas/SVG region 16:9 aspect, ≥ 600 px tall. Plays the protocol live with the current parameters.
4. **Parameter panel** (right side on desktop, below on mobile) — every relevant protocol parameter as an input. Edits update the animation immediately (no submit button needed). Includes a "preset" dropdown (e.g. *factory floor noisy*, *clean lab*, *MV substation*).
5. **Timeline scrubber** — under the canvas, lets the user scrub through one full protocol cycle frame-by-frame. SFX disabled while scrubbing.
6. **SFX + VFX controls** — master volume slider, SFX on/off, VFX intensity (off / minimal / full).
7. **Compare button** — opens compare mode with this topic + 1–3 user-picked siblings.
8. **Frame-by-frame explanation accordion** — `<details>` block with what's happening in each animation phase (paragraph each).
9. **Common pitfalls / failure modes** — bulleted list (e.g. for Modbus RTU: termination resistors, ground loops, baud-rate mismatch, slave-ID collision).
10. **Related topics** — small grid of links to siblings (e.g. Modbus RTU links to Modbus TCP, RS-485 layer, DNP3).
11. **References** — IEC / IEEE / RFC / NIST spec links (the same discipline the AI Maintenance page uses).
12. **Footer** — version stamp, breadcrumb, page-access gate.

## 5. Animation engine architecture

### 5.1 Rendering choice

**Canvas 2D** for byte/packet/bit motion (high frame rate, low memory, exact pixel control). **SVG** for one-time diagrams (state machines, layered stacks). **DOM** for parameter forms + accordions.

We **do NOT** introduce Three.js, Pixi.js, or GSAP — they're over-engineered for our 2D needs and add 100 + KB. We do introduce a small in-house engine:

```
js/network-anim/
    ├─ engine.js          Animation loop, RAF, frame state, timeline scrubber
    ├─ renderer.js        Canvas primitives (drawByte, drawFrame, drawArrow, drawWire)
    ├─ audio.js           Web Audio API wrappers — synth-only, no asset loading
    ├─ vfx.js             Particle/trail/glow effects (Canvas-only, no shaders)
    ├─ palette.js         Brand-locked colour tokens
    └─ topics/
         ├─ modbus-rtu.js
         ├─ modbus-tcp.js
         ├─ bacnet-mstp.js
         ├─ tls-handshake.js
         ├─ oauth2-pkce.js
         ├─ jwt-anatomy.js
         └─ ...           One file per topic; exports init(canvas, params, signals)
```

### 5.2 Topic module contract

```js
export function init(canvas, params, signals) {
  // canvas: HTMLCanvasElement
  // params: reactive object — { baudRate: 9600, parity: 'none', stopBits: 1, ... }
  // signals: { onTick, onByte, onError, onAck, onComplete }
  //          — emitted by the topic; the page wires them to audio.js + vfx.js

  return {
    play(),
    pause(),
    seek(frame),
    setParams(newParams),
    destroy()
  };
}
```

Topic authors only think about **protocol semantics**, not rendering primitives. The engine provides:
- `renderer.drawWire(x1, y1, x2, y2, opts)` — the line where bits travel
- `renderer.drawByte(x, y, value, label, opts)` — a glowing rectangle moving along a path
- `renderer.drawFrame(x, y, w, h, label, opts)` — a packet container
- `renderer.drawArrow(from, to, opts)` — directional arrow
- `renderer.drawNode(x, y, label, opts)` — a device circle/rect

All drawing uses the locked palette (`palette.js`); topic code never picks colours directly.

### 5.3 Audio synth (SFX)

Web Audio API, oscillator + envelope. No samples. Five canonical event types:

| Event | Synth | Default volume | Visual companion |
|---|---|---|---|
| `tick` (clock pulse) | Square wave 800 Hz, 6 ms, very low | -24 dB | small white dot pulse |
| `byte` (data byte transmitted) | Triangle 1.2 kHz → 1.6 kHz sweep, 12 ms | -18 dB | byte glow |
| `ack` (ACK received) | Sine 2 kHz, 60 ms, decay | -12 dB | green ring expand |
| `error` (NAK / CRC fail / timeout) | Sawtooth 220 Hz, 200 ms | -8 dB | red flash + screen shake (subtle) |
| `complete` (transaction done) | Two sine tones C5 + G5, 150 ms | -10 dB | green tick |

Master volume + mute. Mute is the default state for first load; consent-gated unlock on first user interaction. Mobile: SFX off until explicit toggle (autoplay-gesture compliance).

### 5.4 VFX taxonomy

Vocabulary used consistently across all topics:

- **Byte glow** — small rounded rectangle, instrument-cyan fill, signal-amber border, no glow shadow (we don't do drop-shadow).
- **Packet trail** — 4-segment afterimage trailing a moving byte, alpha-graded.
- **Wire highlight** — a brief instrument-cyan pulse along the wire when a bit traverses it.
- **Collision marker** — fault-red `×` glyph that fades out over 800 ms.
- **ACK ring** — oscilloscope-green expanding ring at receiver, 1 s.
- **Drop marker** — small fault-red `↓` arrow at the moment of packet loss.
- **Encrypted shroud** — vertical line-screen pattern overlaid on payload region (so user sees "this is encrypted" without flashy nonsense).

**No** parallax, **no** drop-shadow, **no** purple, **no** gradient sweeps. Aesthetic target: oscilloscope + Industrial DCS HMI; **not** consumer-techno music video.

## 6. Compare mode

`network/compare.html?topics=modbus-rtu,modbus-tcp,bacnet-ip,opc-ua`

- CSS Grid: 2 × 2 on desktop, 1 column on mobile.
- Each cell is an instance of the topic module with its own canvas + parameter panel (collapsed to "essential parameters" by default; expandable).
- **Synchronised timeline scrubber** at top — moving it scrubs all 4 animations together.
- **Independent parameters** — each panel keeps its own params; "Sync params" toggle (off by default) tries to align comparable parameters (e.g. effective bandwidth) when on.
- **Visual diff overlay** — when on, draws a coloured wire underneath each panel showing **total latency**, **total bytes on the wire**, **% encrypted**, and **packet count** — comparable across protocols.
- **Export view as PNG** — captures all 4 panels at the current frame for sharing.

Compare-mode topic limit = 4 (UI sanity + performance budget). Two-panel compare also supported and is the most common use case.

## 7. Per-topic parameter taxonomy

For each topic in v1, we define the parameter schema as a small JSON in the topic module. Examples:

### Modbus RTU (RS-485)
| Parameter | Type | Default | Notes |
|---|---|---|---|
| Baud rate | select | 9600 | 1200 / 2400 / 4800 / 9600 / 19200 / 38400 / 57600 / 115200 |
| Parity | select | none | none / even / odd |
| Stop bits | select | 1 | 1 / 2 |
| Slave address | int 1-247 | 1 | |
| Function code | select | 03 read-holding | 01/02/03/04/05/06/15/16 |
| Register start | hex int | 40001 | |
| Register count | int 1-125 | 10 | |
| Line length | int m | 100 | affects max baud + noise |
| Termination resistor | bool | true | demonstrates reflection if off |
| Line noise | slider 0-100% | 5 | demonstrates CRC errors |
| Inter-frame gap | int chars | 3.5 | T35 timing |

### Modbus TCP
| Baud rate (drop) | TCP MSS | MTU | TCP window | Latency | Packet loss % | TLS on/off | Multi-master |

### TLS 1.3 handshake
| Cipher suite | TLS_AES_256_GCM_SHA384 default; alt TLS_CHACHA20_POLY1305_SHA256, TLS_AES_128_GCM_SHA256 |
| Cert chain depth | 1-4 |
| OCSP stapling | on/off |
| 0-RTT resumption | on/off |
| Server-name indication | string |

### OAuth 2.0 + PKCE
| Grant type | authorization_code / client_credentials / device_code |
| PKCE | on/off |
| Token format | JWT / opaque |
| Audience claim | string |
| Scope set | multi-select |

### MCP (Model Context Protocol)
| Transport | stdio / SSE / HTTP |
| Tool count | 1-20 |
| Resource count | 0-50 |
| Prompt-set | minimal / full |
| Roots advertised | bool |

### JWT
| Algorithm | RS256 / HS256 / EdDSA / none(!) |
| Claims | iss / sub / aud / exp / nbf / iat / jti — toggles |
| Signature shown | bool |
| Tamper demo | bool — re-encode payload and watch verification fail |

Each topic's schema lives next to its animation module so parameter ↔ animation stay in lock-step.

## 8. CompTIA mapping (so the hub doubles as a study tool)

Each topic page carries a **CompTIA badge** + objective references. Sample mapping (will be exhaustive in spec):

| Topic | CompTIA badge | Objective(s) |
|---|---|---|
| TCP/IP + OSI | Net+ N10-009 | §1.1 OSI model, §1.2 protocols |
| Routing / STP / VLAN | Net+ N10-009 | §2.1, §2.2 |
| TLS 1.3 handshake | Sec+ SY0-701 | §1.2, §3.5 |
| OAuth 2.0 + PKCE | Sec+ SY0-701 | §3.6, §4.1 |
| JWT anatomy | Sec+ SY0-701 | §3.6 |
| mTLS | Sec+ SY0-701 | §3.5 |
| SNMP | Net+ N10-009 | §3.3 |
| IPv4/IPv6 + subnetting | Net+ N10-009 | §1.4 |
| BACnet | (industry — no CompTIA direct) | BICSI DCDC §6 |
| Modbus | (industry — no CompTIA direct) | ISA-95 |

A future *"Take the cert"* button can pull each user's progress per objective.

## 9. Site integration

### 9.1 DC Solutions card
Add a 7th card to the **Cost Calculators** section (or — better — create a NEW section called **"Standards, Networks & Knowledge Labs"** that absorbs the LTC labs cards + this Network Hub). Slug: `network-visualization-hub.html`. Tone: instrument-cyan `#00DDFF`. Icon `fa-network-wired` or `fa-diagram-project`.

### 9.2 Hub landing page (`network-visualization-hub.html`)
- Hero with rotating sample animation (one of the topic canvases playing on loop in a smaller frame).
- 5 lanes × topic-card grid. Card = topic name + 1-line synopsis + CompTIA badge + ★/★★/★★★ difficulty.
- "Open compare mode" CTA — opens compare with a sensible default 2-topic set.
- Search-as-you-type filter (client-side over the static topic list).
- Footer breadcrumb + sitemap.

### 9.3 sitemap / search-index / llms.txt
Every new HTML page added. (Per CONTENT_LINKAGE_PLAYBOOK §1-§4.)

### 9.4 Page gate
Per the educator-tier matrix discipline. Default: `page-access { free:true, demo:true, pro:true, root:true }` — i.e. **the hub + topic pages are PUBLIC** (educational, no Pro-gating). Compare mode and any advanced parameters can be Pro-gated if owner decides later.

## 10. Phased build roadmap

| Phase | Scope | Deliverables | Complexity |
|---|---|---|---|
| **0 — Foundation** | Engine + landing | `js/network-anim/{engine,renderer,audio,vfx,palette}.js` · `network-visualization-hub.html` landing · DC Solutions card · sitemap entries | Medium (~3-5 days subagent-equivalent) |
| **1 — Industrial seed** | 4 industrial topics + compare | Modbus RTU/485, Modbus TCP, BACnet/IP, OPC-UA · `network/compare.html` working with these 4 | High (each topic is a small engine in itself) |
| **2 — CompTIA Net+** | 6 foundations topics | TCP/IP + OSI, routing/STP/VLAN, DNS/DHCP/ARP, IPv4/IPv6 subnetting, NAT, SNMP | High |
| **3 — Security topics** | 5 security topics | TLS 1.3, mTLS, OAuth 2.0 + PKCE, JWT, SAML (or Kerberos — owner picks) | High |
| **4 — APIs + agents** | 5 API/software topics | REST/GraphQL/gRPC, WebSocket/SSE, MQTT/Kafka, MCP, webhook patterns | Medium-High |
| **5 — Industrial extras + polish** | 4-6 more industrial | DNP3, PROFINET, EtherNet/IP, IPMI/Redfish, KNX, LonWorks | Medium |
| **6 — Cert-prep mode** | Quiz + objective tracking | Quiz layer over the existing animations; per-user progress in localStorage; certificate badge | Medium |

After Phase 1 (industrial seed) the value already lands: 4 working animations + compare. Ship as **v1.33.0** behind the Pro gate or public — owner choice.

## 11. Engineering risk + mitigation

| Risk | Mitigation |
|---|---|
| 22 topic pages = a lot of code to write & maintain | Strict topic-module contract (§5.2). Shared engine handles ≥ 80 % of the work. Each topic = ~150-400 LOC max. |
| Performance with 4 panels in compare | Each panel uses RAF + visibility-observer pause when off-screen. Profile early on a mid-range laptop; budget 60 fps, alert at 50 fps. |
| Audio autoplay blocked on mobile | Default-mute, gesture-gated unlock. Tested explicitly. |
| Brand drift toward AI-slop | uiux-reviewer agent (see §13) runs on every topic page before merge. Palette locked in `palette.js`; topic code can't override. |
| Accessibility regression | Each topic has "Describe in plain text" mode (screen-reader friendly). Keyboard navigation tested. Reduced-motion media query disables all VFX. |
| 30+ HTML pages = SEO/duplication concern | Strong unique meta + JSON-LD per topic. Topics share CSS via shared stylesheet. Sitemap covers all. |
| Parameter combinations create combinatorial bugs | Each parameter has documented valid ranges enforced by the form; engine validates before applying. |
| Owner concept drift mid-build | Phase-by-phase delivery + owner approval gate between phases. |

## 12. Open questions for the owner

Before we begin Phase 0, the owner needs to decide:

1. **Public or Pro-gated?** Educational content suggests *public*; user-tracking suggests *Pro*. Default in this plan = **public**.
2. **Topic prioritisation** — confirm the 5-lane / 22-topic taxonomy in §3, or amend (add/remove/reorder).
3. **Phase ordering** — is the Industrial-seed → CompTIA-Net+ → Security → APIs → Industrial-extras → Cert-prep order right, or should Security come first (broader audience)?
4. **Audio default** — mute-by-default with explicit-opt-in confirmed? (Recommended.)
5. **Cert-prep mode** — is the Phase-6 quiz/progress layer in-scope, or out-of-scope for v1?
6. **Hub card placement on DC Solutions** — add to existing Cost Calculators section, or new "Standards, Networks & Knowledge Labs" section?
7. **SFX tone palette** — synth-only (this plan), or also include curated short audio samples (adds 100-300 KB per topic + licensing)? (Recommended: synth-only.)
8. **Compare mode topic limit** — is 4 the right cap, or do we go to 6?

## 13. Multi-agent review (mandate)

Per owner request — code-reviewer + uiux-reviewer agents will run on this plan before any code lands:

- **code-reviewer agent** — reviews the *plan's technical architecture* (§4-§7), engine module contract, performance assumptions, accessibility approach, code-layout. Flags any place where the plan over-engineers or under-specs.
- **uiux-reviewer agent** — reviews the *plan's design intent* (§2, §5.4, §6, §9) for brand alignment (no AI-slop, no Anthropic-purple, no glassmorphism), accessibility, and consistency with the Industrial-instrumentation register already established by the brand.

Both run *before* Phase 0 implementation. Their findings get folded into a v2 of this plan if substantive; otherwise we proceed to Phase 0 build.

## 14. Reference set (paper / standards / inspiration)

| Source | Use |
|---|---|
| ISO/IEC 7498-1 — OSI model | Foundations lane |
| RFC 793, RFC 1122 — TCP/IP | Foundations lane |
| RFC 8446 — TLS 1.3 | Security lane |
| RFC 6749 — OAuth 2.0 | Security lane |
| RFC 7519 — JWT | Security lane |
| RFC 9325 — TLS recommendations 2023 | Security lane |
| IEEE 802.1Q — VLAN | Foundations lane |
| Modbus Application Protocol V1.1b3 | Industrial lane |
| Modbus Serial Line PI V1.02 | Industrial lane |
| ASHRAE 135 — BACnet | Industrial lane |
| OPC-UA Part 6 — Mappings | Industrial lane |
| IEC 61850 — Substation comms | Industrial lane (Phase 5+) |
| Model Context Protocol — modelcontextprotocol.io | Software lane |
| CompTIA Network+ N10-009 objectives | Foundations + DC Mgmt |
| CompTIA Security+ SY0-701 objectives | Security lane |
| BICSI DCDC, Uptime Institute | DC Mgmt lane |

Plus the owner's reference video (motion-design example) — referenced for visual *register* (calm, instrument-style; not for direct visual copy).

## 15. Definition of done — Phase 0

- `js/network-anim/{engine,renderer,audio,vfx,palette}.js` shipped with working API + unit tests for `renderer.drawByte/drawWire/drawArrow`.
- `network-visualization-hub.html` landing live with: topic-card grid (placeholder cards OK for Phase 1+ topics), DC Solutions card wired, search filter working, version stamp + page-gate.
- 1 reference topic page implemented to prove the engine works end-to-end (recommendation: **Modbus RTU** — owner-relevant + visually clear).
- audit-js-syntax / audit-script-tags / audit-mobile-responsive — all `--strict` CLEAN.
- code-reviewer + uiux-reviewer agents both APPROVED (no CRITICAL findings).
- Owner has signed off on the visual register by reviewing the live Modbus RTU page.
- sitemap, search-index, llms.txt all updated.
- Ship as **v1.33.0** (next free MINOR; coordinate against parallel session if any).

## Appendix A — Why we don't use a framework

This plan deliberately uses **vanilla ES + Canvas + Web Audio**. Reasons:

1. **Static-site discipline** — the rest of the site is zero-build vanilla; introducing Pixi.js / Three.js / GSAP per topic adds 100 KB + asynchronous-load complexity.
2. **Performance** — for 2-D byte-and-arrow animations, hand-written Canvas 2D outperforms any framework wrapper (less abstraction overhead).
3. **Maintenance** — one engine to maintain, not a Pixi-major-version-upgrade tax every 18 months.
4. **A11y** — full control over the alternative "describe in plain text" mode.
5. **Brand discipline** — frameworks come with opinionated defaults (gradients, glow, scaling) that we'd then have to override case-by-case.

If a future topic *genuinely* needs 3-D (e.g. a 3-D substation visualization) we'd lazy-load Three.js ONLY for that topic; the rest of the hub stays vanilla.
