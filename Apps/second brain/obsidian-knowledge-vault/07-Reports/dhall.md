---
id: dhall
label: DataHall AI
group: reports
url: datahallAI.html
tags: [bms, scada, dcai, alarms, electrical, fire, gb200, gb300]
last_updated: 2026-08-26
---

# DataHall AI

> AI cockpit. Current project basis remains engine-locked GB200 Scenario A; v1.130.0 adds semantic operator workflows and a non-adopted GB300 reference study.

## Notes

- **Locked basis:** 4 halls × 3.564 MW IT; 27 logical GB200 NVL72 domains and 54 physical rack positions per hall; 14.256 MW facility IT.
- **Alarm workspace:** date/point/system/severity/lifecycle/quality/value/state/event/action/text filters, saved views, first-out evidence and local CSV export. Fixture data is explicitly simulated; ISA-18/IEC 62682 terminology guides lifecycle design.
- **Electrical:** pure topology evaluation drives energized animation and reports rack service/redundancy plus sequence-of-events. Color never determines state.
- **Live basis:** the 4-second refresh may jitter instrument sensors only; IT/facility/PUE and all eight per-unit generator statuses remain engine/scenario-bound after every tick. Transfer preserves N+1 as 7 RUNNING + 1 STANDBY; normal is 0 RUNNING + 8 STANDBY; failed start is 8 FAILED. Any renderer fault invalidates the complete owned KPI set.
- **CDU:** 9 running / 12 installed per hall, 350 kW each; 3,029 kW liquid duty and 4,342 LPM TCS flow. Facility inventory is 48 installed.
- **Fire:** FACP-authoritative, zoned cause-and-effect matrix covers elevators, access/doors, AHU/CRAH, smoke control, agent release, zoned EPO, notification and external response. BMS is monitor-only.
- **Rack/platform:** GB300 NVL72 142 kW is reference-only: 27 integrated racks/hall, 3.834 MW/hall, 15.336 MW/facility, 5.990625 kW/m² gross IT density. It does not mutate the GB200 engine.
- **Design Studio:** defaults to current locked design; study content requires explicit selection and is appended to an engine snapshot with issue provenance.

## Connections

- [[DC-AI-Engineering-Audit]]
- [[Standards-Hub]]
- [[s-epms|EPMS Telemetry]]
- [[sdcv|DC Conventional]]
