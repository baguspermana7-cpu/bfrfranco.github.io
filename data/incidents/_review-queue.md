# Incident dossiers — owner review queue

Found while authoring the v3.13.0 FMEAs: each FMEA agent read its dossier end to end and
reported where the dossier contradicts ITSELF. Nothing below was changed, because each
item is a decision about definition or framing, not a slip with one right answer.
(Files starting with `_` are ignored by `tools/build-incidents.py`.)

## Already corrected in v3.13.0 (the dossier's own sequence of events decided it)

| dossier | field | was | now | evidence in the dossier |
|---|---|---|---|---|
| azure-west-us2-thermal-2026 | date | 2026-05-01 | 2026-05-29 | every SOE entry; metric "04:24 UTC 29 May" |
| azure-west-us2-thermal-2026 | durationMin | 480 | 1326 | metric "~22 hours (04:24 UTC 29 May to 02:30 UTC 30 May)" |
| cyrusone-cme-chicago-cooling-2025 | date | 2025-11-01 | 2025-11-27 | SOE trigger "2025-11-27 evening (CT)" |
| digital-realty-singapore-liion-fire-2024 | date | 2024-09-01 | 2024-09-10 | SOE trigger "2024-09-10 morning SGT" |
| x-twitter-oregon-fire-2025 | date | 2025-05-24 | 2025-05-22 | SOE trigger and detection, 22 May |

Three were first-of-the-month seed dates never corrected after research; one was simply
wrong. `tools/test-incidents-corpus.mjs` now fails both classes.

## Needs a decision

### Framing
- **virginia-dc-alley-heatdome-2022** — title, brief, category `cooling`, `servicesDown`
  ("cooling-constrained load shedding across 45+ facilities"), date 2022-07-24 and
  durationMin 360 describe a heat-dome cooling event. The dossier's own rootCause and SOE
  say there was NO cooling failure: July 2022 was a transmission-capacity disclosure, the
  SOE has no 24 July entry, and the physical events are 2024 and 2026 load-loss episodes.
  The FMEA scores no cooling mode and says so. Either re-frame the dossier (grid capacity
  / large-load ride-through) or retire it.

### What does `durationMin` mean? (rendered as "Xh core impact")
The header carries one number; the dossiers measure different things. Pick a definition
(e.g. customer-impact onset → substantial restoration) and apply it to all.

| dossier | header | the dossier's own figures |
|---|---|---|
| rogers-canada-nationwide-2022 | 900 ("roughly 15 hours") | CRTC window 04:58 EDT 8 Jul → 07:00 EDT 9 Jul ≈ 26 h; the dossier's analysis says the 15–19 h figure was **removed as unsupported** — the header still uses it |
| x-twitter-oregon-fire-2025 | 2880 (48 h); brief "multi-day" | metric and SOE ≈ 24 h (11:00 PT Thu → 10:35 PT Fri) |
| london-heatwave-cooling-2022 | 1440 | ≈ 14 h 10 m to resolution, or ≈ 38 h 47 m official window |
| gcp-global-service-control-2025 | 447 | analysis: global impact "roughly three hours"; us-central1 recovered ≈ 2 h 40 m |
| fastly-global-cdn-2021 | 60 | 95% back at 49 min; most services ≈ 73 min; mitigated 2 h 48 m |
| digital-realty-singapore-liion-fire-2024 | 600 | alarm morning 10 Sep → EPO ≈ 18 h later → stable 12 Sep |
| nirs-daejeon-battery-fire-2025 | 600 (fire knock-down) | government services out for weeks |
| optus-australia-nationwide-2023 | 840 (top media figure) | metrics ≈ 12–13 h |
| psn-outage-2025 | 1440, stated as fact | own SOE and metrics call it disputed, ≈ 18 → 24+ h |
| dyn-mirai-ddos-2016 | 660 (11:10–22:10 UTC) | includes a third wave reported as having no customer impact |
| google-council-bluffs-arcflash-2022 | 180 | nothing in SOE or metrics supports a 3-hour figure |
| gcp-stt-gdc-delhi-fire-2026 | 28673 (≈ 19.9 d) | metric ≈ 21.5 d; brief says resolved 29 Jun, SOE and metric say 26 Jun |

### Internal contradictions between fields or sources
- **nirs-daejeon-battery-fire-2025** — first report ~20:15 (SOE 3) before ~20:20 ignition
  (SOE 4); "extinguished" 06:30 (ref 11) vs ~18:30 (SOE 11); "96" used for systems destroyed
  and for services interrupted; 5 charged (SOE 16) vs "Lee and three other officials"
  (ref 13); G-Drive users 191,000 (brief) vs ~125,000 (metric 8).
- **kakao-sk-cc-pangyo-fire-2022** — ignition ~15:30 (rootCause) vs spark 15:19 (SOE 1);
  services normalised ~19:00 (SOE 14) vs 23:00 (rootCause; matches durationMin 7650);
  national disruption from ~15:20 (SOE 17) vs whole-building cut at 16:52.
- **equinix-ld8-london-ups-2020** — customers lost power ~04:23–04:24, SOE puts the
  static-switch failure at 04:33, rootCause cites Equinix onset 04:40; rootCause says
  21:49 "could not be verified" while SOE and metrics cite it from LINX.
- **unisuper-gcp-account-deletion-2024** — comprehensiveAnalysis says member count and
  FUM "could not be verified … omitted", but severity and metrics carry 647,000+ and
  A$135B; joint statement dated ~9 May (SOE 13) vs 8 May (ref 5).
- **red-sea-subsea-cables-2024** — metric 7 says the exact UTC time was not published,
  ref 6 (Kentik) gives 09:46 UTC; brief "TGN-EA" vs SOE "TGN-Eurasia"; durationMin implies
  a mid-July end the SOE gives only as "July 2024".
- **facebook-meta-bgp-dns-2021** — BGP back ~21:50 / DNS 22:05 (Wikipedia) vs DNS 21:20 /
  full reconnection 21:28 (Cloudflare). Two sources, not one error — state both.
- **x-twitter-oregon-fire-2025** — `severity.impactUsd` ~$260k (flagged unverified) vs the
  official ~$250k.
- **psn-outage-2025** — `location` San Mateo, while rootCause says no source ties the
  outage to San Mateo.
- **sourcing.referenceCount** is stale on kakao (9 vs 22), ovhcloud (4 vs 8) and red-sea
  (4 vs 8). It is derivable; consider computing it in the builder instead of storing it.
- **google-council-bluffs-arcflash-2022** — `officialPostmortem: true` rests on the OSHA
  record (regulatory), not an operator post-mortem. Correct under the corpus gate's
  definition; worth stating on the page.
