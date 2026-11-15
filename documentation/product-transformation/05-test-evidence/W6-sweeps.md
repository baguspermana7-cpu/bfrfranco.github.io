# Wave 6 sweeps — evidence (2026-11-14, branch rel359, local tree)

| Item | Gate | Result | Red proof |
|---|---|---|---|
| W6-1 journey | `tools/test-journey-w6.mjs` | 19/19: project created on capex (4000 kW, PUE 1.35, capex_total published), roi consumes it ($M, tagged), two compare cases computed and case 1 equals the capex page, pack has capex + roi and names the project without touching the store, the roi share link reproduces inputs and results in a fresh context, roi reloads offline from the service worker, names the project and recomputes | registry `consumes` pointed at a missing result → J2 red (2 checks) |
| W6-2 responsive | `tools/test-responsive-sweep-p.mjs` | 38 pages that load a P-series module (derived) × 2 themes × 360/390/768/1280/1440: 760 checks pass | a 2000 px element on compare.html → R1 red at every width under 2000 |
| W6-3 console | `tools/test-console-sweep-p.mjs` | 157 pages (derived; the command palette alone qualifies a page) open with 0 page errors | a planted throw on compare.html → W2 red |

Finding outside the P surfaces (recorded, not counted by R1): `EPMS_Telemetry.html` at 1280 px has 82 px of overflow
(the scaled `g#scene` inside `svg#viewport` reaches x = 1362). The page sets `body { overflow: hidden }`, so wheel and
touch cannot scroll it; a programmatic scroll (`scrollTo`) or a focus jump can still shift the page by 82 px. Measured
the same on a fresh 1280 load (scrollWidth 1359), so it is not a resize artefact. Owner: the EPMS cockpit.
