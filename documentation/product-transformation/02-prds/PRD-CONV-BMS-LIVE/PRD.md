# PRD-CONV-BMS-LIVE — the plant is seen running (owner R184)

Status: BUILT v3.86.1 (gate tools/test-conv-live.mjs 41/41; 7 of 9 laws red on v3.84.0)
Owner comment (2026-11-21, after v3.84.0): "saya masih tidak belum melihat perubahan signifikan. Masih abu2 semua tidak
ada animasi yg immersive dll".

## 1. Measured state (live v3.84.0, 1440 × 900, 3 s after load, first screen)

| page | animations running in view | coloured pixels (sat > 25 %) |
|---|---|---|
| dc-conventional | 0 (behind sign-in) | 1.7 % |
| datahall | 0 | 27.8 % (green racks) |
| chiller-plant | 0 (118 flow lines exist, all `paused`) | 5.2 % |
| fuel-system | 0 in view (4 running elsewhere) | 2.9 % |
| water-system | 3 | 2.3 % |
| fire-system | 0 | 3.8 % |
| ict | 0 (no motion code at all) | 6.6 % |
| EPMS_Telemetry | 10 | 3.2 % |

Causes, each found in code:
1. `chiller-plant.html` pauses every flow and rotor in CSS and steps them with a 3 Hz `chwMotionClock` (a perf
   workaround, v3.81.0): the plant reads as frozen.
2. The flow mark (`css/rz-hmi.css` `.hmi-flow`) is a 1.4 px dot every 16 px: at 1:1 it is barely visible on a 2 px line.
3. The default view paints pipes by STATE (green run / grey standby): every pipe of every medium is the same green or
   grey. The medium colours (`--hmi-m-*`) exist but only in the "Medium" tab.
4. `datahall.html` and `ict.html` have no motion at all: nothing says air or traffic is moving.

v3.84.0 (R183) gave state changes and inputs motion; it did not make the running process visible. That is what the
owner is asking for.

## 2. Principle

Motion and colour come from the process, never from decoration (owner slop tells 2026-10-15: no glow, no neon, no
aurora, no particles that mean nothing). Everything that moves is a running thing whose speed comes from an engine
value; everything coloured is a medium or a state. Stopped stays still. Off screen stays still (B7 P4).

## 3. Design

L1 · Flow you can see (sheets: chiller, fuel, water, fire, EPMS).
- A running line carries medium-coloured slugs: 1.8 px, dash 5 × 11, round caps, the medium mixed 45 % toward the ink,
  inside a 2.8–3.6 px running tube (L2); alarm lines keep their red, standby/stopped carry no slugs. Electrical current:
  ink dots on the green energised conductor. Insulated CHW: the aluminium jacket takes the CHW tone while running.
- Speed bound to the line: unchanged `RZConvVfx.dashSeconds(flow / design)` (already process-bound).
- Smooth: the chiller's flow moves on its own layer. v3.86.0 raised the sheet stepper from 3 Hz to 24 Hz; the release gate
  then measured each step repainting the whole 10-train drawing (~60 ms): 24 Hz pinned the main thread (2.3 s CPU per
  5 s idle, over the 1.5 s law; alarm-to-mark 319 ms, over 250). v3.86.1: a thin SVG layer over the sheet carries a
  copy of every flow line (same path, computed stroke and dash, speed from vfx.js); a 24 Hz clock writes the dash
  offset of the copies in view; the sheet's lines are hidden; rotors back on the 3 Hz sheet clock. Measured idle CPU
  ~1.25 s per 5 s (v3.84.0 ~0.8 s, v3.86.0 ~2.4 s). In-view gating stays (`.is-offscreen` + B7 P4).

L2 · Medium colour by default. The pipe body takes its medium colour at reduced chroma in the State view too (CHW
supply/return, condenser, fuel, water, agent, power feeds A/B); the state is carried by the slugs (running), the dash
pattern (stopped/standby) and red (alarm). Points keep green/amber/red (R-owner BMS rule).

L3 · Rotating equipment turns. Pumps, fans, cooling-tower fans and generators that run spin smoothly (existing
`.vfx-rotor[data-spin]`, unpaused), period from speed; stopped equipment is still.

L4 · Data hall air moves (Plan view). Cold supply slugs leave each CRAH gallery and run along the cold aisles toward the
rows; hot exhaust runs along the hot-aisle caps back to the galleries (return). Colour: supply in the CHW-supply cool
tone, return in the temperature ramp of the row's hot aisle. Speed from the hall's airflow per CRAH; a CRAH that is off
sends nothing from its bay.

L5 · ICT traffic moves. Every UP link carries slugs at a speed from its load (Gbps / capacity); standby links are
dashed and still; a degraded/fault link carries amber/red slugs at its load.

L6 · Reduced motion: no slugs move and no rotor turns; colour stays (the plant is still readable as running by colour).

## 4. Laws (gate `tools/test-conv-live.mjs`)

- LV1 marks inside the viewport advance (stroke-dashoffset sampled 400 ms apart): chiller, water, EPMS, ict ≥ 6;
  datahall ≥ 25.
- LV2 a running slug is ≥ 1.8 px inside a wider (≥ 2.8 px) running tube (red on v3.84.0: 1.6 in 3).
- LV3 slug and running tube chroma ≥ 0.04; running CHW jacket tinted (C ≥ 0.03), stopped bare; EPMS current dots lighter
  than the conductor.
- LV4 speed binding: the line with the higher flow share runs the shorter cycle; a stopped line runs none.
- LV5 datahall Plan: ≥ 25 cold-aisle and ≥ 25 hot-aisle air paths animate; an off CRAH bay has none.
- LV6 ict: every UP link animates, no STANDBY link animates.
- LV7 reduced motion: 0 running slug/rotor animations, colours unchanged.
- LV2 also: the chiller flow layer sits exactly over the sheet (rect, viewBox), one copy per flow line, same path and stroke.
- LV8 static: chiller flow-layer step ≤ 50 ms; 8 pages link `conv-live.css` after `conv-motion.css`; no glow/filter/shadow.
- LV9 (reported, not gated) coloured share at the first sheet: chiller 3.9 → 5.7 %, ict 5.9 → 6.1 %, datahall 28 %.
  Fuel and fire stay grey at utility-normal because nothing in them runs; colour there would be decoration.

## 5. Out of scope

Surface palette (graphite stays), page layout, sign-in gate of dc-conventional, number roll animations.
