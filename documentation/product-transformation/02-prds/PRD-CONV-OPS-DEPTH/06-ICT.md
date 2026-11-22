# PRD-CONV-OPS-DEPTH · 06 ICT — From a drawn network schematic to an ICT/network operator screen (links, carriers, spine/leaf, rack power, environment)

Status: DRAFT for owner (2026-11-22). Parent: PRD-CONV-OPS-DEPTH/README.md.
Page: `ict.html` (inline script lines 889-2186) + `js/conv/net-modal.js` + `css/conv-live.css` (L5 block) + `js/conv-design-basis.js` (STUDY).
Measured on tree `01c9aa43f` (v3.93.0), conv-engine 2.6.0, 2026-11-22.

---

## 1. Owner request

Verbatim lines that apply (2026-11-22):

- "ini ... masih sangat kurang banyak parameter2 operation belum ada ... implement all, rancang prdnya"
- "dan juga page2 lain selain chiller plant ini, rancang masing2 prd utk perbaikan dan improvement."
- "banyak dah yang belum ada, ini masih kurang komprehensive"

Shared brief meaning: every cockpit must read like a real SCADA/BMS operator screen: every equipment's operating parameters (setpoint vs actual, running count, speed, flows, sensor arrays), the control logic visible (staging, balancing, standby-running), and physical animation proportional to the process.

Scope for this page, as set by the task: the full operator view of DC ICT/network infrastructure as a BMS/DCIM sees it: rack power per PDU (A per phase, kW, breaker headroom), rack inlet temperature, network links (utilisation %, errors, A/B redundancy), meet-me-room and carrier diversity, core/spine/leaf state, UPS feed per rack, environmental sensors, alarms, and link-traffic animation proportional to load.

Out of scope here: the CCTV mosaic, door list and intrusion zones of the Security tab (they stay as they are, except the trunk-utilisation derivation in L5), the Datahall floor (PRD 01 owns rack rows and aisle temperatures) and the UPS/transformer internals (EPMS PRD owns them). This PRD consumes their keys and never re-implements them.

---

## 2. Measured state today

### 2.0 First finding: on this tree the page does not render

`ict.html` line 652 loads `js/conv-engine.js?v=2.5.0`. `RZ_ENGINE_VERSIONS.conv` is `2.6.0`. `ictRuntimeAuthorityAvailable()` (lines 903-923) requires the token to equal the engine version, so it returns false and the page paints UNAVAILABLE.

Proof run (headless Chrome, 1440 px, 2.5 s after load): `data-rz-basis-authority="unavailable"`, `.ict-arch .node` = 0, `.edge` = 0, `tr.linkrow` = 0, `[data-point]` = 2, `#sb-sys-v` = "UNAVAILABLE". Same stale token on `datahall.html:472` and `chiller-plant.html:583`; `EPMS_Telemetry.html:465` is on 2.6.0. This is the known trap "engine version pin blanks all cockpits". Every other number below was measured with the token rewritten to 2.6.0 in the request (no file changed), so it describes what the page shows once it loads.

### 2.1 Inventory the page draws (rendered, token fixed)

| Segment (nav) | Arch nodes | Arch edges | Link rows | Service pills | Capacity cards | `[data-point]` in canvas | Moving flow paths |
|---|---|---|---|---|---|---|---|
| IT / Data Fabric | 17 | 19 | 5 | 4 | 7 | 23 | 15 |
| BMS / OT | 11 | 10 | 6 | 5 | 4 | 32 | 8 |
| Security | 12 | 11 | 9 | 8 | 8 | 47 | 10 |
| Mgmt / OOB | 7 | 7 | 3 | 4 | 4 | 15 | 5 |
| WAN / DCI | 9 | 9 | 4 | 4 | 4 | 19 | 5 |
| Monitoring | 9 | 8 | 0 | 4 | 0 (6 mon cards) | 2 | 8 |
| **Total** | **65** | **64** | **27** | **29** | **27** | **138** | **51** |

Also: 6 simulated scenarios (normal + 5), 3 authored alarms in a static `ALARMS` register, 1 node modal (`RZNetModal`, tabs per class).

### 2.2 Parameters shown per equipment class, and what an operator expects

Link rows (27) show 10 columns: tag, role, capacity, traffic, utilisation bar, latency, loss %, jitter, status, redundancy text (lines 1771-1814). Only utilisation has a band (`ict.util_pct` 60/80, curated limits). Of the 135 per-link points (27 links x 5), 27 are banded and **108 render as Informational** (traffic, latency, loss, jitter have no limits row). Only two `ict.*` rows exist in `data/conv-limits.curated.json`.

| Class (count on page) | Shown today | Missing for a real ICT operator view | Missing count |
|---|---|---|---|
| Network link (27) | capacity, traffic, util %, latency, loss %, jitter, UP/STBY, redundancy string | in/out octets split (TX vs RX), errors (CRC/FCS, symbol), FEC corrected/uncorrected, discards, optic Rx/Tx power and module temperature (DDM), LAG member state, BFD/LACP state, flap count and last-change, MTU, A/B path tag, shared-risk group | 11 |
| Core switch (2: SW-CORE-A/B) | state text, "DUTY / STANDBY" | CPU, memory, ASIC/chassis temperature, fan state, PSU A/B state and input voltage, power draw kW, port map, MLAG/ECMP role, config-sync state | 10 |
| Spine (1 node for 4 spines) | "4 / 4 UP" authored string | per-spine state, per-trunk traffic and util (ECMP share), per-spine temperature/PSU | 4 per spine |
| Leaf / ToR (4 group nodes for 20 ToR) | "5 / 5 UP" authored string | per-ToR state, uplink count, PSU A/B, inlet temperature, port utilisation, rack it serves | 5 per ToR |
| Edge router (1 node on IT, 2 on WAN) | state | BGP session state, prefixes, uptime, route-table size, CPU | 5 |
| Carrier / ISP / DCI (4 external terminations) | name, "BGP UP", "STANDBY" | carrier, circuit ID, entrance room (MMR), duct/route, hand-off optic, SLA, diversity group, BGP session/prefix count | 8 |
| Meet-me room (MMR) | no node. The string "MMR" appears twice, as a CCTV cell and as door D-05 | entrance rooms A/B, cross-connect count, carrier presence, MMR temperature, MMR UPS feed | all |
| Rack power / PDU | **none** (grep: PDU 0, breaker 0, phase 0) | A and B feed, kW per feed, A per phase, breaker rating and headroom, 2N-intact flag | all |
| UPS feed per rack | none on the engine side. One authored alarm text mentions "UPS-B input bank" | feed A / feed B source (UPS system 1 / 2), UPS load % normal and on failover (engine has both keys, page uses neither) | all |
| Rack inlet temperature | none (grep: inlet 0, temperature 1 = security text) | per-hall rack inlet, hot aisle, margin to ASHRAE band, dew point | all |
| Environment sensors (temperature, humidity, leak, door, smoke) | none. "leak" = 1 mention (gas-leak, security) | sensor array per ICT room, state, last reading age | all |
| Alarm | 3 authored strings; 6 nav badges derived from them | alarms derived from point states, priority, on-delay, ack/shelve, first-out, per-point alarm history | structural |

Total expected-but-missing operating parameters, counted from the table above for the classes the page actually draws: **63 per-class parameters** (11 + 10 + 4 + 5 + 5 + 8, plus 20 for the rack/UPS/environment/MMR classes counted once at 4 + 4 + 4 + 4 + 4).

### 2.3 Defects measured in the existing numbers

| # | Defect | Evidence |
|---|---|---|
| D1 | Trunk utilisation cards are typed constants that disagree with their own link rows | Security: card 34 %, link rows sum 5.081 Gbps on a 10 G trunk = **50.8 %**. BMS: card 4.2 %, rows sum 0.063 Gbps on 1 G = **6.3 %**. Mgmt: card 2.1 %, rows sum 0.070 Gbps on 1 G = **7.0 %** (lines 1059, 1089, 1157 vs 1134-1142, 1063-1068, 1161-1163) |
| D2 | Two traffic constants are dead | `TRAFFIC_SCENARIO.eastWestGbps` (25.6) and `customerEdgeGbps` (7.8) are never read (grep: 1 definition each). The fabric link instead uses `CORE_OFFERED * 1.8` = 25.56; the customer edge uses `* 0.55` = 7.81 |
| D3 | The drawing ignores the point band | Link SW-CORE-A to Cust-Edge: 7.81 / 10 = **78.1 %**, inside the 60-80 warn band. The table bar turns warn, the arch edge stays `up` (edge state is authored, line 1374) and the service strip says all ok |
| D4 | Scenarios change the drawing only | `ARCH_SCENARIOS` rewrite node/edge states. The link table, link points, flows and capacity cards stay on the normal numbers (the page's own note, line 1590, says so). In "Core A fail" the table still shows 14.2 Gbps on the failed link |
| D5 | Spine/leaf is one drawn node and one table row | 4 spines and 20 ToR are strings. The authored fabric basis is "4 x 100G trunks" (`NETWORK_CAPACITY_BASIS.fabric`) but one row ("SW-CORE-A to Spine-1") carries the whole 25.56 Gbps, so ECMP is a label |
| D6 | Single points of failure are drawn and not named | On the IT arch every path from ISP-1/ISP-2 passes through one DDoS node and one RTR-BKS01 node, while the design contract says network "dual-path" (`STUDY_INPUT.resilience.subsystems.network`). The WAN tab draws RTR-A and RTR-B, the IT tab one router: the two tabs disagree |
| D7 | Access layer is 20 ToR for 2000 racks | The page itself says "42 groups/hall, physical switch topology pending" (line 1031): 20 ToR versus 168 groups at 12 racks/group |
| D8 | Flow animation: floor and constants | Speed = `0.6 / max(load, 0.25)` s per period, so every link under 25 % load turns at the same 2.4 s; 30 of 51 moving paths are not bound to a link and turn at a constant 1.6 s (monitoring: 8 of 8, polling edges, not traffic). The selected-edge `ictPacket` animation is a fixed 1 s and ignores load |
| D9 | Decorative motion | 16 CCTV `cc-rec` dots blink forever with a `box-shadow` glow (line 393) and no reduced-motion gate. Edge colours are literals `#4a6a8a` / `#3b5570`, not `--rz-pt-*` tokens |
| D10 | Point coverage | 138 points, 108 link points without limits (see 2.2). Latency, loss and jitter read "info" at any value |

---

## 3. Reference design

How a modern ICT/network plant is built and what its BMS/DCIM shows. Each claim names its source.

| Topic | Practice | Source |
|---|---|---|
| Telecom spaces | Entrance room / meet-me room (MMR), main distribution, horizontal distribution areas; rated 3 and 4 need two entrance rooms and diverse pathways | ANSI/TIA-942-B (2017) telecom spaces and rated levels; ISO/IEC 11801-5; EN 50600-2-4 |
| Carrier diversity | Two or more carriers, each on its own entrance room and duct bank; two paths are diverse only when they share no entrance, duct, carrier or building riser (shared-risk link group). Separation distance values are copied from the TIA text at implementation, not typed from memory here | TIA-942-B; RFC 4202 (SRLG) |
| Leaf-spine fabric | Every leaf connects to every spine; traffic is spread by equal-cost multipath, so all spines carry traffic at the same time and a spine loss moves its share onto the others | RFC 2992 (ECMP hashing); Clos 1953 |
| Core redundancy | Modern pairs run active-active (MLAG/ECMP), each carrying a share and each sized so the survivor takes all. A hot standby carrying zero traffic is the older pattern. This is the network twin of the owner's "standby running" remark for chillers | IEEE 802.1AX (LAG); vendor MLAG practice; owner request item 2 |
| Link health | Operators watch utilisation, errors, discards, optic Rx/Tx power and temperature, flaps. Counters come from the interface MIB; optics from the module diagnostics | RFC 2863 (IF-MIB ifInErrors, ifOutDiscards, ifHCInOctets); SFF-8472 / SFF-8636 (DDM); IEEE 802.3 clauses for each PHY (receive power range) |
| FEC | A link can look clean while pre-FEC errors rise; "corrected" is an early warning, "uncorrected" is loss | IEEE 802.3bj / 802.3bs (RS-FEC); the pre-FEC threshold is transcribed from the clause at implementation |
| Fast failure detection | Link-state plus BFD detect a path loss in under a second; the BMS shows session state and last-change | RFC 5880 (BFD); RFC 4271 (BGP-4) |
| Loss/latency classes | WAN service classes bound delay, loss, jitter | ITU-T Y.1541 |
| Rack power chain | UPS A and UPS B feed PDU A and PDU B; every dual-PSU device draws from both. Each side must carry the whole rack alone, so at normal load each side is at most half of its derated capacity ("2N intact") | Uptime Tier III intent (`STUDY` resilience 2N); IEC 62040-3 (UPS); IEC 60947-2 (breakers) |
| Breaker headroom | Continuous load is held to 80 % of the breaker rating | NEC 210.20(A) / IEC 60364-5-52 derating practice |
| 3-phase current | I = P / (sqrt(3) x V_LL x PF) | definition of 3-phase real power |
| Inlet temperature | Measure at the rack inlet (bottom, middle, top); recommended 18-27 C, allowable per class; dew point and RH limits | ASHRAE TC9.9 Thermal Guidelines (2021) |
| Dew point | Magnus relation from dry bulb and RH | ASHRAE Fundamentals 2021, ch. 1 |
| Alarms | Priority, on-delay, deadband, first-out, shelving, rationalised count | ANSI/ISA-18.2; EEMUA 191 |
| Monitoring protocols | SNMP v3 for network, Redfish PowerDistribution for PDUs, Modbus/BACnet for facility sensors | RFC 3411-3418; DMTF DSP2046; BACnet ASHRAE 135 |

---

## 4. Goals / non-goals

Goals
1. The page loads on every engine bump and says so when it cannot (L1, L2).
2. One solver (`ictSolve`) feeds the table, the drawing, the points, the flow speeds and the scenarios, so a scenario moves every number (L3-L7).
3. Spine/leaf, core, edge and carrier become named devices with their own state, traffic and A/B feed.
4. A Racks & Power view per hall: per-rack current per phase, kW per feed, breaker headroom, 2N-intact, UPS feed load, inlet temperature, dew point (all from the engine).
5. Link health beyond utilisation: errors, FEC, optics, LAG/BGP/BFD state, flaps, each labelled SIMULATED and driven only by scenario defects (L10).
6. Environment sensors per ICT room, alarms derived from point states.
7. Animation proportional to load, with no floor, bound on every moving path, still under reduced motion (L12-L14).

Non-goals
- No live polling, SNMP, Redfish or real device telemetry. This is a simulated BMS; every value is the engine, a named SIM function, an authored design attribute (labelled), or "not modelled".
- No per-rack distribution across 2000 racks (the engine has hall average and design peak only). Rack rows belong to PRD 01.
- No random values (existing law; `tools/test-network-anim-determinism.py`).
- No invented IT load to bandwidth conversion (existing rule, line 945: IT kW is never converted to bandwidth).

---

## 5. Parameter catalogue

Source codes: ENG = existing engine key; ENG+ = new engine key with formula; SIM = named function in `js/conv/ict-model.js`; AUTH = authored design attribute of this page's basis (labelled "authored", editable by the owner, not a measurement); NM = "not modelled" text.

### 5.1 Network link (every row of every segment)

| Parameter | Unit | Source | Shown where | Limits (warn / alarm basis) |
|---|---|---|---|---|
| Capacity | Gbps | AUTH (`NETWORK_CAPACITY_BASIS`, link rows) | table, tag | const |
| Traffic out / in | Gbps | SIM `ictSolve` (offered traffic from `TRAFFIC_SCENARIO`, split by ECMP/active path) | tag on the line, table | none (derived) |
| Utilisation (max of in, out) | % | SIM = max(out, in) / capacity | bar, line colour | existing `ict.util_pct` 60/80 |
| State (UP, STANDBY, DEGRADED, DOWN) | enum | SIM from scenario | line style, table | state colour |
| Latency | ms | AUTH baseline per link + SIM scenario delta (failover path adds its authored extra latency) | tooltip, inspector | new row `ict.link.lat_ms`, basis ITU-T Y.1541 for WAN links; intra-DC band AUTH/ASSUMED, labelled |
| Packet loss | % | SIM: 0 in healthy state; non-zero only from a scenario defect parameter | tooltip, inspector | new row `ict.link.loss_pct`, alarm anchored on Y.1541 IPLR; warn one decade lower (authored) |
| Jitter | ms | as latency | tooltip, inspector | new row `ict.link.jitter_ms` |
| Input / output errors (CRC, FCS) | per min | SIM: scenario defect rate, else 0 | inspector, modal tab Links | new row `ict.link.err_per_min`; any sustained non-zero = warn (RFC 2863 counter semantic) |
| FEC corrected / uncorrected | per min | SIM defect only; NM when the PHY has no FEC | inspector | uncorrected > 0 = alarm; corrected warn threshold transcribed from the IEEE 802.3 clause at implementation |
| Discards | per min | SIM: congestion discard only when util > 100 % after failover (conservation, L4) | inspector | > 0 = warn |
| Optic Rx / Tx power, module temperature | dBm, C | AUTH nominal per optic type (standard range) + SIM scenario "optic degrading" | modal tab Optics | module alarm/warn thresholds per SFF-8472; transcribed |
| LAG members up / total | count | AUTH members + SIM | tooltip, modal | members < total = warn (IEEE 802.1AX) |
| BFD / BGP session | enum, prefixes | SIM state; prefix count AUTH | modal tab Routing | session down = alarm; RFC 4271 / 5880 |
| Flap count, last change | count, age | SIM from scenario transitions | inspector | 3 flaps / 10 min = warn (authored, labelled) |
| Path tag (A / B / SRG id) | text | AUTH | inspector, line label | n/a |

### 5.2 Core, spine, leaf, edge devices (per device, not per group)

| Parameter | Unit | Source | Shown where | Limits |
|---|---|---|---|---|
| Role and state (DUTY, ACTIVE, STANDBY, FAULT) | enum | SIM | node chip | state colour |
| Forwarded traffic and util of its uplinks | Gbps, % | SIM | node mini-bar, modal | `ict.util_pct` |
| ECMP share of each of 4 spine trunks | Gbps, % | SIM = fabric_offered / live trunks (RFC 2992) | per trunk row, edge label | `ict.util_pct` |
| PSU A / PSU B state | enum | SIM from the feed state (section 5.4) and AUTH `psuCount` (1 or 2) per device | node A/B chips, modal tab Power | PSU lost = warn; both lost = device DOWN |
| Power draw | kW | NM until the owner supplies nameplate values (open question Q1) | modal tab Power | none |
| Inlet temperature | C | ENG `cooling.rack_inlet_target_c` of the hall it sits in; ICT rooms NM | modal tab Environment | existing `datahall.rack.inlet_c` 18/27 warn, 15/30 alarm (ASHRAE TC9.9) |
| CPU, memory, fan rpm, ASIC temperature | % / rpm / C | NM (net-modal already says so, line 13) | modal, written as NM once | none |
| Fault domain, upstream, downstream | list | existing `archDownstream` | inspector | n/a |
| Single point of failure flag | bool | SIM `spof(model)` (articulation points of the live graph) | node ring, readout "SPOF: n" | any SPOF on a path declared dual = warn |

### 5.3 Carrier diversity and meet-me rooms

| Parameter | Unit | Source | Shown where | Limits |
|---|---|---|---|---|
| Carrier path (4: ISP-1, ISP-2, DCI SBY01, DCI MKS) with entrance room (MMR-A / MMR-B), duct bank (1 / 2), carrier, circuit ID, hand-off speed | text | AUTH, new `CARRIER_PATHS` table | WAN tab, modal tab Carriers | n/a |
| Diverse pair? | yes / no + shared item | SIM `diversity(a, b)` = no shared entrance, duct or carrier | WAN tab readout, tooltip | "no" on a pair declared redundant = warn (TIA-942-B rated 3/4 intent) |
| Live paths / declared paths | count | SIM | WAN tab chip | below declared = warn; 1 = alarm |
| BGP session state, received prefixes | enum, count | SIM state; prefixes AUTH | modal | session down = alarm |
| Cross-connects in MMR | count | NM | modal | none |
| MMR temperature, MMR UPS feed | C | NM until an MMR room is a drawn load | modal | none |

### 5.4 Rack power, PDU, UPS feed (new view, per hall A-D)

Inputs are existing: `hall.it_load_kw` / `hall.racks` = `rack_actual_avg_kw` (15.0 kW today), `rack_design_avg_kw` 20, `rack_selected_peak_kw` 30; `electrical.lv_voltage_v` 400; `electrical.power_factor_design` 0.95; `electrical.ups_system_count` 2; `ups_load_pct_normal` 37.5; `ups_load_pct_on_failover` 75.

| Parameter | Unit | Source / formula | Shown where | Limits |
|---|---|---|---|---|
| Rack power (actual average / design average / selected peak) | kW | ENG `hall.rack_actual_avg_kw` / `rack_design_avg_kw` / `rack_selected_peak_kw` | tile, trend | existing `datahall.rack.load_pct` 85/95 |
| Rack current, 3-phase balanced | A per phase | ENG+ `electrical.rack_current_a` = P x 1000 / (sqrt(3) x `lv_voltage_v` x `power_factor_design`). Hand values: 15 kW = 22.8 A; 20 kW = 30.4 A; 30 kW = 45.6 A | tile | see headroom |
| Feed share per side | kW | ENG+ `electrical.rack_feed_kw_normal` = P / `ups_system_count` (2N, both sides live) | feed bars A and B | n/a |
| Feed current per side, normal / on failover | A per phase | ENG+ = rack_current_a / 2 and rack_current_a | feed bars | see headroom |
| PDU feed breaker rating | A | ENG+ `electrical.rack_pdu_breaker_a` = 63 (3P, IEC 60309 inlet), evidence class ASSUMED, owner approves (Q1) | breaker glyph, tooltip | n/a |
| Continuous design factor | - | ENG+ `electrical.rack_breaker_continuous_factor` = 0.8 (NEC 210.20(A)), ASSUMED | tooltip | n/a |
| Breaker headroom on failover | % | ENG+ `electrical.rack_feed_headroom_pct_failover` = (k x In - I_total) / (k x In) x 100. Hand values at 63 A: 54.8 % (15 kW), 39.7 % (20 kW), **9.6 % (30 kW peak)** | tile bar, trend | new row `electrical.rack_headroom_pct`: warn < 15, alarm < 5 (authored; the point is "one more kW and 2N is gone") |
| 2N intact | bool | ENG+ `electrical.rack_2n_intact` = I_total <= k x In | tile state chip | false = alarm (the rack cannot ride through the loss of one feed) |
| UPS feeding side A / side B | text | AUTH: A = UPS system 1, B = UPS system 2 (2N subsystem of `STUDY`); physical hall-to-UPS allocation NM | tile | n/a |
| UPS load normal / on failover | % | ENG `electrical.ups_load_pct_normal` / `ups_load_pct_on_failover` | tile chip | normal > 50 = 2N lost (survivor would overload), alarm; basis IEC 62040-3 / 2N rule |
| Per-phase imbalance | % | NM (engine has no phase model; balanced assumption stated in the tooltip) | tooltip | none |
| Per-rack distribution inside a hall | - | NM; PRD 01 owns rows | link to Datahall | none |
| Rack inlet (hall design target) | C | ENG `cooling.rack_inlet_target_c` 25.4 | tile | `datahall.rack.inlet_c` 18/27, 15/30 |
| Hot aisle / CRAH return | C | ENG `cooling.hot_aisle_c` / `crah_return_air_c` | tooltip | n/a |
| Rack inlet dew point | C | ENG+ `environment.rack_inlet_dewpoint_c` = Magnus(T = inlet, RH = `STUDY.airReference.relativeHumidityPct` 50). Hand value 14.2 C | tile | upper recommended 15 C (ASHRAE TC9.9): warn at 13, alarm 15 (new row; margin today 0.8 K) |

### 5.5 Environment sensors (per ICT room: MMR, core room, NOC)

| Parameter | Source | Shown where | Limits |
|---|---|---|---|
| Temperature, humidity | NM today (no ICT-room thermal model). Hall values come from 5.4 | sensor array tile reads "not modelled" once, in the tile tooltip, not per cell | n/a |
| Leak, door contact, smoke | AUTH state (normal) with scenario overrides; labelled authored | dry-contact row, 3 glyphs per room | binary alarm; smoke is life-safety and links to the Fire page, never duplicated |
| Sensor poll age | existing `ict.poll_freshness_s` | strip | existing 60 s warn |
| Sensors warn / down / stale | ties to the 6 monitoring cards | Monitoring tab | existing |

### 5.6 Alarms

Alarms are generated from point states, not typed. Required alarm kinds (each has a priority per ISA-18.2): link util warn/alarm, link down, flap, error rate, FEC uncorrected, optic Rx low, BGP/BFD down, redundancy lost (SPOF on a dual path), carrier diversity lost, core single, spine N-1, leaf lost, feed A or B lost, PSU lost, breaker headroom low, 2N not intact, UPS load above 50 %, inlet out of band, dew point high, leak, poll stale. The three authored alarms stay as seed content under their own "authored" label until each has a derived equivalent (L21).

---

## 6. Control logic to model (steady-state relations, no fake dynamics)

All in `js/conv/ict-model.js` (UMD, zero-import, same pattern as `net-modal.js`), pure functions, no clock, no random.

1. `ictSolve(scenario)` returns per link: state, out/in Gbps, util %, and per node: state. Rules:
   - Demand: `aggregateOfferedGbps` (14.2) at the core, `eastWestGbps` (25.6) on the fabric, `customerEdgeGbps` (7.8) on the customer edge, `wanEgressGbps` (8.5) on transit. The two dead constants become the sources of the fabric and customer-edge rows (fixes D2).
   - Active path set: today's authored duty/standby (A duty, B hot standby) or active-active (Q2). Traffic splits equally across live members of an ECMP/LAG set (RFC 2992 equal-cost).
   - Conservation: sum of traffic leaving a node = sum entering, per scenario. If a surviving link would exceed capacity, the excess is reported as discards, never silently dropped (L4).
2. Spine ECMP: fabric_offered / live_trunks per trunk. 4 live: 6.4 Gbps each (6.4 % of 100 G). 3 live: 8.53 Gbps each (8.5 %).
3. Redundancy functions: `spof(model)` = articulation points on the live graph between layer 0 and layer 3; `diversity(a, b)` from the AUTH attributes of 5.3; `redundancy(chain)` = N+1 / 2N / none derived from live path count. The page prints the result (one chip: "SPOF 2"), never a typed string like "N+1 redundant".
4. Power chain: `feedState(side)` from the scenario (UPS-A lost, UPS-B lost, breaker trip). A device with `psuCount` 2 stays UP on one lost feed (PSU chip warn); `psuCount` 1 attached to the lost side goes DOWN, and its links go DOWN, which `ictSolve` then re-routes. Rack tile: when one side is lost, the surviving side current = rack_current_a, headroom per 5.4.
5. Defect model for errors, FEC and optics: a scenario carries an authored `defect` (for example "optic degrading on SW-CORE-A uplink: Rx -9.0 dBm"). Counters accrue as rate x elapsed simulated time using the page clock, rate taken from the defect; in every non-defect state they are exactly 0. No random.
6. Alarm generator: for each point, state from `RZPointStatus.classify`; transitions create alarm rows; priority from the limits row; ack and first-out per ISA-18.2.

Scenario buttons (existing select grows from 6 to 13). Each must change the table, the points, the flows and the alarm list, not only node colours:

| Scenario | Effect |
|---|---|
| Normal | baseline |
| Core A fail (existing) | A DOWN, B takes duty, traffic and util move to B links (14.2 Gbps on B), cust-edge re-homes |
| WAN primary loss (existing) | ISP-1 DOWN, ISP-2 active, transit single path (10 G) |
| BMS gateway offline, Camera VLAN degraded, Historian unreachable (existing) | as today, plus table and points now follow |
| Spine 3 fail (new) | 3 live trunks, per-trunk 8.5 %, ECMP N-1 alarm |
| ToR 07 fail (new) | local failure domain: rack group down, survivable 19 / 20 |
| MMR-A loss (new) | every carrier path with entrance MMR-A goes down; diversity readout shows which pair was not diverse |
| UPS-A loss (new) | feed A lost on every rack tile, PSU-A chips lost, single-PSU devices on side A go DOWN, rack current doubles on side B, headroom per 5.4, 2N-intact flag |
| Rack at peak (new) | selected peak 30 kW rack: headroom 9.6 %, warn |
| Optic degrading (new) | one uplink: Rx falls, FEC corrected then uncorrected, errors rise, link flaps, util unchanged |
| Dew point high (new) | RH above reference, dew point crosses 15 C, alarm |

---

## 7. Drawing and animation changes

State colours only (`--rz-pt-*`): running green, warning amber, alarm red, standby grey dashed. Edge literals `#4a6a8a` / `#3b5570` are replaced by those tokens. No glow, no decorative motion. Phone 390 px: every new tile is one column; link table collapses to 4 visible columns (tag, util bar, state, redundancy chip), the rest open from row tap into the inspector sheet (`RZSheet`).

| Symbol | Added | Animation rule | Phone |
|---|---|---|---|
| Link line (27 bound + 37 unbound edges) | direction-less dots, label "cap . out Gbps", errors chip when non-zero | period = T_full x 100 / util, T_full = 0.6 s per 12 px period at 100 %; no 25 % floor; clamp at 6 s for util under 10 %; util = 0 on an UP link = one still dot row (still, not dashed). STANDBY = grey dashed still; DOWN = red dashed still. Every moving path is bound to a link (the 30 unbound ones get a link row or are drawn as conduits) | tag only, label on tap |
| Spine block | 4 separate nodes with 4 trunk lines | each trunk's period from its own ECMP share; a lost spine goes dashed red and the three others speed up by 4/3 | nodes stack in 2 x 2 |
| Core A/B | two nodes, both forwarding under active-active (Q2) or A duty / B standby grey | as links | one column |
| Leaf / ToR | 20 ToR as a 4 x 5 grid of small squares inside the hall group, state-coloured | none (state only); the failed square pulses nothing, it is red | grid collapses to count chip + sheet |
| Edge router + DDoS | RTR-A / RTR-B pair on both tabs (fixes D6); SPOF ring on any single node of a dual path | none | n/a |
| Carrier / MMR | MMR-A and MMR-B boxes as the entrance layer, each carrier path through its box and duct label; diversity chip on each pair | path dots as links | boxes stack |
| Device A/B chips | two small squares on every dual-PSU device: both filled = both feeds live; one outline amber = feed lost | none | kept (2 x 8 px) |
| Rack power tile (per hall) | rack kW, A per phase, feed A and feed B bars, breaker glyph with stem position = I_total / (k x In) on a 0-100 % scale, 2N chip, UPS A/B load chips, inlet and dew point tags | feed lines carry dots at period from I / (k x In); a lost feed stops (dashed red). Breaker stem: translate by headroom, instant on change, no easing | 4 tiles in a column, bars full width |
| Environment strip | 3 dry-contact glyphs per ICT room + poll age | none | one row |
| Selected-edge `ictPacket` | removed; selection = 3 px line + label, no motion (D8) | none | n/a |
| CCTV `cc-rec` dots | static red dot, no blink, no `box-shadow` (D9) | none | unchanged |

Reduced motion: no moving element anywhere; flow dots become a still row at 12 px spacing, values and labels unchanged. Less visible text: capacity notes, scenario notes, formulas and limits live in tooltips and the modal, not on the sheet; the sheet keeps value tags only.

Node modal (`RZNetModal`) gains tabs: Power (PSU A/B, feed), Environment (inlet, dew point), Optics (per port), Routing (BGP/BFD), Carriers (MMR diversity). Each tab shows NM lines once.

New nav segment: **Racks and Power** (7th item, with its own alarm count badge) containing the four hall tiles, the UPS feed block and the environment strip.

---

## 8. Engine changes

Version bump: conv-engine 2.6.0 to the next minor (number assigned by the README; PRD 01 and EPMS also add keys, so one key, one formula, defined once. If either defines a key below first, this page reads theirs).

New keys, all derived from existing inputs by the stated relation:

| Key | Formula | Source / standard | Evidence class |
|---|---|---|---|
| `electrical.rack_current_a` (per hall: actual avg, design avg, peak) | P x 1000 / (sqrt(3) x `lv_voltage_v` x `power_factor_design`) | 3-phase power definition | derived |
| `electrical.rack_feed_kw_normal` | P / `ups_system_count` | 2N rule, IEC 62040-3 | derived |
| `electrical.rack_pdu_breaker_a` | authored 63 | IEC 60947-2, IEC 60309 | ASSUMED (Q1) |
| `electrical.rack_breaker_continuous_factor` | authored 0.8 | NEC 210.20(A) | ASSUMED (Q1) |
| `electrical.rack_feed_headroom_pct_failover` | (k x In - I) / (k x In) x 100 | breaker derating | derived |
| `electrical.rack_2n_intact` | I <= k x In | Tier III 2N intent | derived |
| `environment.rack_inlet_dewpoint_c` | Magnus: g = ln(RH/100) + 17.62 T / (243.12 + T); Td = 243.12 g / (17.62 - g) | ASHRAE Fundamentals 2021 ch. 1 | derived (RH is the project air reference, "not live weather") |

New authored page basis (in `js/conv/ict-model.js`, each row labelled "authored design basis", no engine key): `CARRIER_PATHS` (4 rows), `DEVICE_PSU` (psuCount per device), `PATH_TAG` (A/B/SRG), `OPTIC_TYPE` per link (standard range cited by clause).
New limits rows in `data/conv-limits.curated.json`: `ict.link.lat_ms`, `ict.link.loss_pct`, `ict.link.jitter_ms`, `ict.link.err_per_min`, `electrical.rack_headroom_pct`, `environment.rack_inlet_dewpoint_c`, `ict.spine.util_pct` (alias of `ict.util_pct`), each with a `basis` string and nominal; then `node tools/build-conv-parameter-registry.mjs` and `node tools/build-conv-points-seed.mjs`.
Parameter registry: add the `electrical.rack_*` and `environment.*` keys to `data/conv-parameters.curated.json` with formula text. Page tokens: `ict.html` stops carrying a hardcoded engine token separately from `RZ_ENGINE_VERSIONS` (token fixed by `node tools/test-asset-cache-tokens.mjs --fix js/conv-engine.js` and gated, L2).

---

## 9. Laws table

Red-on-today is what the proof shows on tree `01c9aa43f`. Proof tools: `tools/test-conv-ict-depth-core.mjs` (node, pure model, no browser) and `tools/test-conv-ict-depth-render.mjs` (puppeteer, 390 and 1440, both motion preferences, inside an rz-lane). Existing gates stay in the release set: `test-conv-live.mjs` LV4/LV6, `test-conv-ict-modal.mjs`, `test-conv-net-modal.mjs`, `test-ict-operator-architecture.mjs`, `test-conv-point-coverage.mjs`, `test-network-anim-determinism.py`.

| ID | Claim | Proof (what it asserts) | Red on today? | Mutation that must turn it red |
|---|---|---|---|---|
| L1 | The page renders with the current engine authority | render: `body[data-rz-basis-authority]` = `current`, `#sb-sys-v` is not UNAVAILABLE, nodes >= 65 across the 6 segments (+ Racks and Power tile count 4) | **Red** (authority `unavailable`, 0 nodes, 0 rows) | set the token to `?v=2.5.0` |
| L2 | No cockpit pins a stale engine token | node: every page that loads `conv-engine.js` carries `?v=` equal to `RZ_ENGINE_VERSIONS.conv` | **Red** (ict, datahall, chiller-plant = 2.5.0) | bump `rz-engine-versions.js` without the pages |
| L3 | A scenario moves the table, the points and the flows, not only the drawing | node: `ictSolve('core-a-fail')` row RTR to CORE-A state DOWN and traffic 0; RTR to CORE-B >= 14.2 Gbps; render: the table row and `.edge-lbl` read the same value | **Red** (table keeps 14.2 on the failed link, D4) | make the table read `SEGMENTS.links` directly |
| L4 | Conservation: traffic in = traffic out at every node; excess over capacity is printed as discards | node: for all 13 scenarios, per node sum(in) = sum(out) + discards, within 0.01 Gbps | **Red** (no solver) | drop the discard term in the solver |
| L5 | Trunk utilisation cards are derived from their link rows | node + render: Security card = 50.8 %, BMS = 6.3 %, Mgmt = 7.0 % (= sum of UP link traffic / trunk capacity, +-0.1) | **Red** (34 / 4.2 / 2.1, D1) | edit one link traffic and not the card |
| L6 | `eastWestGbps` and `customerEdgeGbps` are the fabric and customer-edge demand; no unused traffic constant | node: grep-level + solver: fabric rows sum = 25.6, cust-edge row = 7.8 | **Red** (D2: 25.56 and 7.81) | restore `CORE_OFFERED * 1.8` |
| L7 | ECMP over 4 live spine trunks, N-1 on loss | node: 4 rows at 6.4 Gbps (6.4 %); spine 3 failed: 3 rows at 8.53 Gbps (8.5 %), ratio 4/3 | **Red** (1 row) | solver splits unevenly |
| L8 | SPOF and redundancy are computed and printed | node: `spof(IT normal)` contains DDoS and RTR-BKS01 on today's drawing; after the RTR-A/B split the list is empty for layers 0-1; render: chip "SPOF n" equals the function | **Red** (no readout; IT draws one router, WAN two) | remove RTR-B from the IT graph |
| L9 | Carrier diversity from shared attributes | node: `diversity(ISP-1, ISP-2)` true only when entrance and duct differ; scenario MMR-A loss kills exactly the paths with entrance MMR-A; render shows the shared item by name | **Red** (no MMR node) | set both carriers to MMR-A |
| L10 | Counters are SIM, deterministic, 0 when healthy | node: two runs of every scenario are byte-equal; in non-defect scenarios errors, FEC, discards, flaps = 0; each counter cell carries a SIMULATED source label | Green for determinism (`test-network-anim-determinism.py`), **Red** for existence | call `Math.random` in the defect model |
| L11 | Every point is banded or an explicit constant | node: for every `[data-point]` id on every segment, `RZPointStatus.limits(id)` is non-null or the point is `data-const`; ratchet in `test-conv-point-coverage.mjs` | **Red** (108 of 135 link points are info) | delete `ict.link.loss_pct` |
| L12 | Flow speed is proportional to utilisation with no floor | render: for UP links with util 5 %, 20 %, 40 %, 80 % the computed `animation-duration` falls strictly with each step (ratio within 5 % of util ratio down to the 6 s clamp) | **Red** (5 % and 20 % both 2.4 s, D8) | restore `Math.max(ld, 0.25)` |
| L13 | Every moving path is bound to a link; STANDBY and DOWN are still | render: 0 `.edge-flow` without `data-load`; `LV6` still passes (no STANDBY link carries traffic) | **Red** (30 unbound moving paths) | add an unbound flow |
| L14 | Reduced motion is totally still; no decorative motion | render under `prefers-reduced-motion: reduce`: `document.getAnimations().length` = 0 and values still present; under no-preference: no `cc-rec` and no `ictPacket` animation | **Red** (`cc-rec` x16 blink in reduce; `ictPacket` fixed 1 s) | re-add the `cc-rec` keyframes |
| L15 | Drawing follows the point band | render: the edge for SW-CORE-A to Cust-Edge carries the warn class when its util is in the warn band; a link at 78.1 % never draws `up` | **Red** (D3) | hard-code the edge state |
| L16 | Rack current per phase equals the formula | node: hall A actual avg 15 kW gives 22.8 A (+-0.05); 20 kW gives 30.4 A; 30 kW gives 45.6 A (independent re-computation with `lv_voltage_v` 400, PF 0.95) | **Red** (no key) | use PF 1.0 |
| L17 | Feed split and 2N-intact | node: rack_feed_kw_normal = P / 2; 15 and 20 kW rack: 2N intact true; 30 kW peak: headroom 9.6 %, intact true; with `rack_pdu_breaker_a` = 32 the 20 kW rack is NOT intact | **Red** (no key) | ignore the 0.8 factor |
| L18 | Rack tile shows the engine values and nothing typed | render: tile text and `[data-point]` values equal `CONV_CALC.snapshot` hall values and the new keys to the displayed digit; perturb `power_factor_design` and the tile moves | **Red** | hard-code 22.8 |
| L19 | UPS feed block reads the engine | render: A and B chips show `ups_load_pct_normal` (37.5 %) and `ups_load_pct_on_failover` (75 %); a perturbed `ups_system_count` = 3 moves them | **Red** (keys unused) | type 37.5 in the page |
| L20 | UPS-A loss scenario changes power and network together | node: feed A lost on every tile; side-B current = rack_current_a; every `psuCount` 1 device on side A is DOWN and its links DOWN; dual-PSU devices stay UP with the PSU-A chip warn | **Red** (no scenario) | make all devices dual-PSU |
| L21 | Alarms derive from point states | node: alarm list for each of the 13 scenarios equals the set of points in warn/alarm plus structural alarms (SPOF, diversity, 2N); the 3 authored alarms are labelled "authored" until superseded | **Red** (3 typed strings) | set a point to alarm and see no alarm row |
| L22 | Inlet and dew point are consistent with the engine | node: `rack_inlet_dewpoint_c` = 14.2 C (+-0.1, matches an independent psychrometric reference); render shows warn margin text only in the tooltip; "Dew point high" scenario crosses 15 C and alarms | **Red** (no key) | use RH 60 % in the formula but 50 % in the label |
| L23 | Layout holds at 390 and 1440 | render: `scrollWidth` = `innerWidth`; no text node clipped outside its drawing frame; no `<line>` crossing a `<text>` bounding box in the arch SVG and tiles; tap target >= 44 px | Green today for scroll (1440 / 390 measured); **Red** for the new tiles | add a fixed-width tile |
| L24 | Existing gates stay green | `tools/run-conv-release-gates.sh` in a browser lane: LV4, LV6, modal, point coverage ratchet, asset tokens | Green on a token-fixed tree; Red as-is (L1) | n/a |

---

## 10. Phases, risks, open questions

Each phase ships alone (about one release of work) and is gated by its own laws.

| Phase | Content | Laws |
|---|---|---|
| P0 hotfix | Token to 2.6.0 on ict, datahall, chiller-plant; gate that a cockpit never paints UNAVAILABLE on a version bump; drop `cc-rec` blink and `ictPacket` | L1, L2, L14 (partial) |
| P1 model and honesty | `js/conv/ict-model.js` with `ictSolve`, table, drawing, points and scenarios on one source; derive trunk cards; use the two dead constants; edge state from the band; flow speed with no floor and every path bound; 7 new scenarios | L3-L7, L12, L13, L15 |
| P2 core, spine, leaf, carriers | decompose SPINE to 4, ToR grid, RTR-A/B on both tabs, MMR-A/B, `CARRIER_PATHS`, `spof`, `diversity`; per-link counters, FEC, optics as SIM; new limits rows | L8-L11 |
| P3 racks and power | engine keys 5.4, Racks and Power segment, hall tiles, A/B chips, UPS-A loss scenario, feed animation, breaker glyph | L16-L20, L23 |
| P4 environment and alarms | dew point key, ICT-room sensor strip, derived alarm generator, node-modal tabs, alarm history, 13-scenario alarm proof | L21, L22, L24 |

Risks
- Three PRDs may define the same engine key (rack current, UPS feed): the README must assign one owner per key; this PRD's keys follow the rule above.
- Spreading 4 spines and 20 ToR enlarges the IT drawing: the 1180-wide arch viewBox needs a second drawing level (zoom into the fabric) or the page overflows at 390 px. Design the fabric as a drill-down sheet, not a wider canvas.
- Counters from a scenario can look like real telemetry. Every counter carries "SIMULATED, scenario" in its tooltip, and the Data Quality chip stays on `ASSUMED`.
- Any new breaker or PSU value is ASSUMED until the owner confirms (Q1). A wrong value would change the 2N verdict, so the tooltip shows the evidence class.
- Concurrent sessions edit `ict.html` (170 kB): land P0 first, then keep the new code in `js/conv/ict-model.js` so the inline script shrinks instead of growing.

Open questions for the owner (taste and scope only)
1. Rack/network power basis: may we add authored ASSUMED values (63 A feed per side, 0.8 continuous factor, 1 or 2 PSU per device, nameplate watts per device class) so the rack tiles and A/B chips work now, or do you supply your real PDU and switch values first? Without them, switch power stays "not modelled".
2. Core pair: keep today's duty plus hot standby (A carries 14.2 Gbps, B carries 0), or switch to active-active where both cores carry a share, the network version of your "standby still running" rule for chillers?
3. Access layer: keep one ToR per rack group (20 ToR, a single ToR loss is a local failure domain, survivable 19) or draw a leaf pair per group (A/B ToR, no loss on a single ToR failure), which changes `NETWORK_CAPACITY_BASIS.access` and matches the "dual-path" design contract?
