"""Generate data/pid/cdu-secondary-loop.json (pixel layout -> normalized bbox)."""
import json, sys

W, H = 1060, 620
def bb(cx, cy, w, h):
    return [round((cx - w / 2) / W, 4), round((cy - h / 2) / H, 4), round((cx + w / 2) / W, 4), round((cy + h / 2) / H, 4)]
def bub(cx, cy):
    return bb(cx, cy, 28, 28)

SRC = {
    "types": {"file": "cdu-mini-bms.html", "ref": "cdu-mini-bms.html line 460, TYPES.inrow: cap 300 kW, supply 32 °C, dT 11 °C, flow 1.30 LPM/kW, dP 1.6 bar, sysP 4.0 bar"},
    "tiles": {"file": "cdu-mini-bms.html", "ref": "cdu-mini-bms.html lines 661-675, TILES: tag + normal band per instrument"},
    "pid": {"file": "cdu-mini-bms.html", "ref": "cdu-mini-bms.html lines 578-656, pidSVG(): tags, symbols and pipe topology"},
    "compute": {"file": "cdu-mini-bms.html", "ref": "cdu-mini-bms.html lines 728-734, compute(): return = supply + dT, HX approach 5 °C, level 56 %, filter dP 0.28 bar, flow total = flow x capacity"},
    "note": {"file": "cdu-mini-bms.html", "ref": "cdu-mini-bms.html line 645, setpoint note: 'TCV-01 holds TT-01 = 18 °C (>= dew point +3 °C) · P-01 VFD on ΔP (PDT-02) · N+1 auto-changeover'"},
    "leak": {"file": "cdu-mini-bms.html", "ref": "cdu-mini-bms.html lines 481 and 896: leak switch LSH-01 trips; 'the CDU latches isolation to protect the IT load'"},
    "trend": {"file": "cdu-mini-bms.html", "ref": "cdu-mini-bms.html line 840, TREND_META.flow: OCP cold-plate design point ≈1.5 LPM/kW at a 10 °C rise"},
}

LOW = 0.5  # the reference's own value for an item it had to infer

equipment = [
    {"id": "E-01", "tag": "E-01", "kind": "heat_exchanger", "name": "Plate HX", "bbox": bb(265, 315, 50, 400),
     "attributes": {"src": "types", "capacity": "300 kW (in-row CDU)", "explain": "One plate pack carries both streams: facility water on the primary side, TCS coolant on the secondary side.",
                    # R117 heat balance on the secondary side: Q = V x rho x cp x dT / 60 (js/rz-pid-graph.js balance()).
                    "duty_kw": 300,
                    "balance": {"flow": "FT-01", "t_supply": "TT-01", "t_return": "TT-02", "fluid": "pg25", "fluid_src": "tiles"},
                    "discrepancy": {"what": "heat balance",
                                    "note": "At 390 LPM and an 11 °C rise, PG25 cannot carry the declared 300 kW: the page's flow ratio and its capacity disagree. Both are quoted; neither is chosen.",
                                    "quotes": [{"src": "types", "text": "TYPES.inrow capacity 300 kW"},
                                               {"src": "types", "text": "TYPES.inrow flow 1.30 LPM/kW, so 390 LPM at 300 kW, with dT 11 °C"}]}}},
    {"id": "P-01A", "tag": "P-01A", "kind": "centrifugal_pump", "name": "Duty pump", "bbox": bb(400, 250, 32, 32),
     "attributes": {"src": "note", "driver": "VFD", "duty": "duty", "explain": "P-01A is the duty pump; its speed is set by the VFD."}},
    {"id": "P-01B", "tag": "P-01B", "kind": "centrifugal_pump", "name": "Standby pump (N+1)", "bbox": bb(400, 360, 32, 32),
     "attributes": {"src": "note", "driver": "VFD", "duty": "standby", "explain": "P-01B stands by; N+1 auto-changeover starts it if P-01A fails."}},
    {"id": "F-01", "tag": "F-01", "kind": "filter", "name": "Filter 50 µm", "bbox": bb(565, 250, 30, 40),
     "attributes": {"src": "pid"}},
    {"id": "T-01", "tag": "T-01", "kind": "vessel", "name": "Expansion tank", "bbox": bb(350, 82, 36, 56),
     "attributes": {"src": "pid", "explain": "T-01 holds the loop pressure as the coolant expands; make-up tops it up."}},
]

components = [
    {"id": "HV-01", "tag": "HV-01", "kind": "gate_valve", "name": "Facility water isolation", "attributes": {"src": "pid"}},
    {"id": "TCV-01", "tag": "TCV-01", "kind": "three_way_valve", "name": "3-way temperature control valve", "attributes": {"src": "pid"}},
    {"id": "HV-02", "tag": "HV-02", "kind": "gate_valve", "name": "Facility water isolation", "attributes": {"src": "pid"}},
    {"id": "CK-A", "kind": "check_valve", "attributes": {"src": "pid"}},
    {"id": "CK-B", "kind": "check_valve", "attributes": {"src": "pid"}},
    {"id": "HV-03", "tag": "HV-03", "kind": "gate_valve", "name": "Isolation / balancing valve", "confidence": 0.6,
     "notes": "The page draws one valve labelled both 'HV-03' and 'bal BV-01'; read as one item.",
     "attributes": {"src": "pid", "basis": "the page labels this one valve both HV-03 and 'bal BV-01'"}},
    {"id": "HV-04", "tag": "HV-04", "kind": "gate_valve", "name": "Return isolation", "attributes": {"src": "pid"}},
    {"id": "MV-01", "tag": "MV-01", "kind": "manual_valve", "name": "Make-up valve", "confidence": LOW,
     "notes": "Drawn as a plain bow-tie; whether it is automatic on LT-01 is not shown.",
     "attributes": {"src": "pid", "basis": "drawn as a plain valve; make-up control is not shown"}},
    {"id": "PSV-01", "tag": "PSV-01", "kind": "relief_valve", "loop": "PSV-01", "name": "Relief valve", "attributes": {"src": "pid"}},
]

def inst(i, loc, cx, cy, measures=None, **kw):
    d = {"id": i, "tag": i, "location": loc, "bbox": bub(cx, cy)}
    if measures is not None:
        d["measures"] = measures
    attrs = kw.pop("attributes", {})
    d.update(kw)
    d["attributes"] = attrs
    return d

instruments = [
    inst("FT-01", "field", 630, 210, attributes={"src": "tiles", "value": "1.30", "unit": "LPM/kW", "band": "1.0–1.5",
         "total": "390 LPM (1.30 × 300 kW)", "flow_lpm": 390, "standalone": "flow indication and band alarm on the BMS tile; the page draws no flow controller"}),
    inst("PT-01", "field", 690, 200, {"line": "L-SUP", "after": "FT-01"},
         attributes={"src": "tiles", "value": "4.0", "unit": "bar", "band": "2–6", "standalone": "system pressure indication; held by expansion + make-up"}),
    inst("TT-01", "field", 790, 72, {"line": "L-SUP", "after": "FT-01"},
         attributes={"src": "types", "value": "32", "unit": "°C", "band": "17–45"}),
    inst("TIC-01", "dcs", 700, 72, confidence=LOW, name="Supply temperature controller",
         attributes={"src": "note", "setpoint": "18 °C per the page note, but the in-row type runs 32 °C supply — the page disagrees with itself",
                     "basis": "implied by the page note 'TCV-01 holds TT-01'; no controller bubble is drawn",
                     "explain": "The page states the loop as 'TCV-01 holds TT-01'. It does not draw the controller, so TIC-01 is inferred and drawn dashed."}),
    inst("TT-02", "field", 700, 548, {"line": "L-RET", "after": "HV-04"},
         attributes={"src": "compute", "value": "43", "unit": "°C", "standalone": "return indication (= supply + ΔT on the page)"}),
    inst("AT-01", "field", 620, 548, {"line": "L-RET", "after": "HV-04"}, confidence=LOW,
         attributes={"src": "tiles", "value": "PG25 in-spec", "standalone": "coolant chemistry status tile",
                     "basis": "a status tile on the page; where the analyser sits is not drawn"}),
    inst("TI-03", "field", 265, 558, {"item": "E-01"},
         attributes={"src": "compute", "value": "5", "unit": "°C approach", "band": "3–7", "standalone": "HX approach indication; a rising approach means fouling"}),
    inst("PDT-01", "field", 565, 196, {"item": "F-01"}, loop="PD-01",
         attributes={"src": "compute", "value": "0.28", "unit": "bar", "standalone": "filter dP; replace the element at the vendor threshold"}),
    inst("PDT-02", "field", 875, 305, {"line": "L-SUP", "after": "HV-03"}, loop="PD-02",
         attributes={"src": "types", "value": "1.6", "unit": "bar", "band": "0.5–3.0",
                     "explain": "PDT-02 reads the loop dP the racks see."}),
    inst("PDIC-02", "dcs", 470, 305, loop="PD-02", confidence=LOW, name="Loop dP controller",
         attributes={"src": "note", "basis": "implied by the page note 'P-01 VFD on ΔP (PDT-02)'; no controller bubble is drawn",
                     "explain": "The page states 'P-01 VFD on ΔP (PDT-02)'. The controller and the VFD tags are inferred and drawn dashed."}),
    inst("SY-01A", "field", 400, 184, loop="PD-02", confidence=LOW, name="VFD for P-01A",
         attributes={"src": "note", "basis": "the page names a VFD on P-01 but gives it no tag"}),
    inst("SY-01B", "field", 400, 426, loop="PD-02", confidence=LOW, name="VFD for P-01B",
         attributes={"src": "note", "basis": "the page names a VFD on P-01 but gives it no tag"}),
    inst("LT-01", "field", 405, 112, {"item": "T-01"},
         attributes={"src": "compute", "value": "56", "unit": "%", "band": "45–70", "standalone": "reservoir level; a falling trend with make-up running is a slow leak"}),
    inst("LSH-01", "field", 330, 566, {"item": "B-FLOOR"}, loop="LS-01", name="Leak rope",
         attributes={"src": "leak", "explain": "A leak on the skid trips the pumps through their VFDs; the page says the CDU 'latches isolation'."}),
]

boundaries = [
    {"id": "B-FWS", "name": "FACILITY WATER SUPPLY", "direction": "source", "bbox": bb(62, 130, 112, 22)},
    {"id": "B-FWR", "name": "FACILITY WATER RETURN", "direction": "sink", "bbox": bb(62, 500, 112, 22)},
    {"id": "B-RS", "name": "TO RACK MANIFOLD M-01", "direction": "sink", "bbox": bb(990, 130, 128, 22)},
    {"id": "B-RR", "name": "FROM RACK MANIFOLD M-01", "direction": "source", "bbox": bb(990, 500, 138, 22)},
    {"id": "B-MU", "name": "MAKE-UP WATER", "direction": "source", "bbox": bb(520, 40, 84, 22), "confidence": 0.6,
     "attributes": {"basis": "the page draws the make-up line dashed with no source"}},
    {"id": "B-REL", "name": "RELIEF DISCHARGE", "direction": "sink", "bbox": bb(240, 24, 98, 22), "confidence": LOW,
     "attributes": {"basis": "the page draws PSV-01 with an open outlet; the discharge point is not shown"}},
    {"id": "B-FLOOR", "name": "CDU SKID FLOOR · LEAK ROPE", "direction": "area", "bbox": bb(650, 596, 660, 8)},
]

lines = [
    {"id": "L-FWS", "service": "FW supply", "from": "B-FWS", "to": "E-01", "path": ["HV-01", "TCV-01"]},
    {"id": "L-FWR", "service": "FW return", "from": "E-01", "to": "B-FWR", "path": ["HV-02"]},
    {"id": "L-BYP", "service": "FW bypass", "from": "TCV-01", "to": {"line": "L-FWR"}, "flow_direction": "inferred", "confidence": LOW,
     "notes": "TCV-01 is a 3-way valve; its third port must return somewhere. The bypass pipe is not drawn on the page."},
    {"id": "L-SUC", "service": "TCS supply", "from": "E-01", "to": "P-01A"},
    {"id": "L-SUC2", "service": "TCS supply", "from": {"line": "L-SUC"}, "to": "P-01B"},
    {"id": "L-EXP", "service": "expansion", "from": "T-01", "to": {"line": "L-SUC"}, "flow_direction": "inferred", "confidence": LOW,
     "notes": "The page does not connect T-01 to the loop; the pump-suction tie-in is the usual practice and is inferred."},
    {"id": "L-D1", "service": "TCS supply", "from": "P-01A", "to": "F-01", "path": ["CK-A"]},
    {"id": "L-D2", "service": "TCS supply", "from": "P-01B", "to": {"line": "L-D1", "after": "CK-A"}, "path": ["CK-B"]},
    {"id": "L-SUP", "service": "TCS supply", "from": "F-01", "to": "B-RS", "path": ["FT-01", "HV-03"]},
    {"id": "L-RET", "service": "TCS return", "from": "B-RR", "to": "E-01", "path": ["HV-04"]},
    {"id": "L-MU", "service": "make-up", "from": "B-MU", "to": "T-01", "path": ["MV-01"], "confidence": 0.6, "notes": "The page draws the make-up line dashed and gives no source."},
    {"id": "L-PSV", "service": "relief", "from": "T-01", "to": "B-REL", "path": ["PSV-01"], "confidence": LOW, "flow_direction": "inferred", "notes": "PSV-01 is drawn with an open outlet; where it discharges is not shown."},
]

E = "electrical"
signals = [
    {"from": "TT-01", "to": "TIC-01", "type": E, "purpose": "measurement", "confidence": LOW},
    {"from": "TIC-01", "to": "TCV-01", "type": E, "purpose": "control", "confidence": LOW},
    {"from": "PDT-02", "to": "PDIC-02", "type": E, "purpose": "measurement", "confidence": LOW},
    {"from": "PDIC-02", "to": "SY-01A", "type": E, "purpose": "control", "confidence": LOW},
    {"from": "PDIC-02", "to": "SY-01B", "type": E, "purpose": "control", "confidence": LOW},
    {"from": "SY-01A", "to": "P-01A", "type": E, "purpose": "control", "confidence": LOW},
    {"from": "SY-01B", "to": "P-01B", "type": E, "purpose": "control", "confidence": LOW},
    {"from": "LSH-01", "to": "SY-01A", "type": E, "purpose": "trip", "confidence": LOW},
    {"from": "LSH-01", "to": "SY-01B", "type": E, "purpose": "trip", "confidence": LOW},
]

page = {
    "schema_version": "1.0", "page": 1,
    "sheet": {"drawing_number": "RZ-CDU-01", "title": "CDU secondary (TCS) loop — in-row CDU", "drawing_type": "pid",
              "legend_notes": [
                  "Read from cdu-mini-bms.html (pidSVG, TILES, TYPES.inrow, compute, setpoint note). Values are the in-row type.",
                  "The page note says TCV-01 holds TT-01 = 18 °C while TYPES.inrow runs a 32 °C supply; both are quoted, neither is chosen.",
                  "Every bubble on the page carries a horizontal line, which ISA-5.1 reads as a main-panel device; transmitters are read here as field mounted.",
                  "Not drawn on the page and therefore marked low confidence: TIC-01, PDIC-02, the VFD tags, the TCV-01 bypass, the T-01 tie-in, the relief destination, the trip path."]},
    "equipment": equipment, "components": components, "instruments": instruments,
    "lines": lines, "signals": signals, "off_page_connectors": [], "boundaries": boundaries,
    "tiles_reviewed": ["whole page"], "unreadable": [],
}

# ---- layout (pixels) ----
anchors = {
    "HV-01": [140, 130], "TCV-01": [190, 130], "HV-02": [150, 500], "CK-A": [455, 250], "CK-B": [455, 360],
    "FT-01": [630, 250], "HV-03": [850, 130], "HV-04": [820, 500], "MV-01": [420, 40], "PSV-01": [350, 24],
}
routes = {
    "L-FWS": [[118, 130], [140, 130], [190, 130], [248, 130]],
    "L-FWR": [[248, 500], [190, 500], [150, 500], [118, 500]],
    "L-BYP": [[190, 130], [190, 500]],
    "L-SUC": [[282, 150], [350, 150], [350, 250], [400, 250]],
    "L-SUC2": [[350, 250], [350, 360], [400, 360]],
    "L-EXP": [[350, 100], [350, 150]],
    "L-D1": [[400, 250], [455, 250], [510, 250], [565, 250]],
    "L-D2": [[400, 360], [455, 360], [510, 360], [510, 250]],
    "L-SUP": [[565, 250], [630, 250], [740, 250], [740, 130], [850, 130], [926, 130]],
    "L-RET": [[921, 500], [820, 500], [282, 500]],
    "L-MU": [[478, 40], [420, 40], [350, 40], [350, 60]],
    "L-PSV": [[350, 60], [350, 24], [289, 24]],
}
signals_l = {
    "TT-01>TIC-01": [[745, 72]],
    "TIC-01>TCV-01": [[700, 100], [190, 100]],
    "PDT-02>PDIC-02": [[600, 305]],
    "PDIC-02>SY-01A": [[470, 184]],
    "PDIC-02>SY-01B": [[470, 426]],
    "SY-01A>P-01A": [[400, 210]],
    "SY-01B>P-01B": [[400, 400]],
    "LSH-01>SY-01A": [[330, 520], [312, 520], [312, 184]],
    "LSH-01>SY-01B": [[330, 426]],
}
labels = {
    "TCV-01": [-8, 46, "end"], "HV-01": [0, 0, "middle"], "P-01A": [22, 8, "start"], "P-01B": [22, 8, "start"],
    "HV-03": [0, 0, "middle"], "PSV-01": [-12, 0, "end"], "CK-A": [0, 0, "middle"],
}
# R120: where a live value label sits, relative to its bubble centre [dx, dy, anchor]
values = {"FT-01": [0, -20, "middle"], "TT-01": [0, -20, "middle"], "TT-02": [0, 28, "middle"]}
flag_tip = {"B-FWS": "right", "B-FWR": "left", "B-RS": "right", "B-RR": "left", "B-MU": "left", "B-REL": "left"}

doc = {
    "about": "One CDU secondary loop in the PID-to-Knowledge-Graph extraction schema v1.0 (pages[0] validates against "
             "tools/fixtures/pid-mini-plant/extraction.schema.json). Placement is explicit: bbox on each item (the schema's own field), "
             "route waypoints per line id under layout. Every value names its source in attributes.src -> sources.",
    "plant": {"id": "cdu-secondary-loop", "name": "CDU secondary loop (in-row CDU)"},
    "sources": SRC,
    "pages": [page],
    "layout": {"viewBox": [W, H], "anchors": anchors, "routes": routes, "signals": signals_l, "labels": labels, "values": values, "flagTip": flag_tip},
}
json.dump(doc, open(sys.argv[1], "w"), indent=1, ensure_ascii=False)
print("ok")
