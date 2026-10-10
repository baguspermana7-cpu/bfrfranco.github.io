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

### Decided by the owner, done in v3.13.6
- **virginia-dc-alley-heatdome-2022 — re-framed** (owner: "Bingkai ulang"). Title, brief,
  category `power`, date 2022-07-29 (Dominion's constraint notice, the first IMPACT entry),
  severity and magnitude rewritten to what the dossier records: a transmission constraint and two
  mass load-loss events that rode through on backup, no customer downtime. Slug kept so the URL
  does not break; it still says "heatdome".
- **durationMin — one definition** (owner: "yang terbaik"): customer-impact onset → substantial
  restoration, from the dossier's own SOE/metrics, with `durationEvidence` pointers whose quotes are
  checked verbatim by `tools/test-incidents-corpus.mjs`. 31 of 43 changed. Where the dossier cannot
  support a number, `durationMin` is null and `durationStatus` says why: `no-outage` (Council Bluffs,
  Virginia) or `not-established` (Azure China North 3, BA Heathrow, DR LA, DR Singapore, NIRS, OVH,
  PSN, Red Sea). Largest corrections: CrowdStrike 78 min → ~10.8 days (78 min was the source-side
  exposure window, not customer impact); AWS EBS 2011 ~90 h → ~36 h (straggler tail excluded); Rogers
  15 h → ~26 h (the figure the dossier itself had withdrawn).

### Still open after the duration change
- `magnitude.durationScore` is a 0–10 judgement made against the OLD durations and was not
  re-scored. Magnitude notes that quote an hour figure may now disagree with the header:
  alibaba-cloud-global-2023, att-nationwide-outage-2024, aws-ebs-ec2-rds-us-east-1-2011, aws-kinesis-thread-limit-outage-2020, aws-us-east-1-dynamodb-dns-2025, aws-us-east-1-thermal-2025, azure-active-directory-2020, azure-front-door-config-change-2025, azure-south-central-us-texas-cooling-2018, cloudflare-bot-management-feature-file-2025, cloudflare-flexential-pdx-power-2023, cyrusone-cme-chicago-cooling-2025, delta-atlanta-switchgear-2016, dyn-mirai-ddos-2016, equinix-ld8-london-ups-2020, facebook-meta-bgp-dns-2021, fastly-global-cdn-2021, kakao-sk-cc-pangyo-fire-2022, optus-australia-nationwide-2023, rogers-canada-nationwide-2022.

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
