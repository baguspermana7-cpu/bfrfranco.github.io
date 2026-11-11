"""Generate data/pid/fuel-day-tank.json from fuel-system.html (R120 second plant).

Every item, pipe and setpoint is read from the page's own P&ID (fuel-system.html lines 783-874) or its logic text; each
source names a line and a quote, and this script stops if the quote is not on that line. Placement reuses the page's own
SVG coordinates (viewBox 1180 x 452). What the page does not give is marked, never filled in: no level, flow or pressure
value is a page constant (they come from the engine snapshot at run time), so no instrument carries a value.
Usage: python3 tools/gen-pid-fuel.py data/pid/fuel-day-tank.json
"""
import json, os, sys

PAGE = "fuel-system.html"
W, H = 1180, 452
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def bb(x0, y0, x1, y1):
    return [round(x0 / W, 4), round(y0 / H, 4), round(x1 / W, 4), round(y1 / H, 4)]
def bub(cx, cy):
    return bb(cx - 14, cy - 14, cx + 14, cy + 14)

SRC = {
    "fill":   (788, 'data-id="fs-fill" data-from="XV-101 fill coupling" data-to="UST-01"', "fill line DN80, XV-101 fill coupling to UST-01"),
    "suct":   (789, 'data-id="fs-suction" data-from="UST-01" data-to="P-101 / P-102 suction manifold"', "suction DN50, UST-01 to the P-101 / P-102 suction manifold"),
    "p101":   (790, 'data-from="P-101" data-to="transfer header"', "P-101 discharge DN50 to the transfer header, data-redundancy duty"),
    "p101d":  (790, 'data-redundancy="duty" data-sensor="PT-101"', "P-101 is the duty pump"),
    "p102d":  (791, 'data-redundancy="standby" data-sensor="PT-101"', "P-102 is the standby pump"),
    "hdr":    (792, 'data-id="fs-transfer-header" data-from="transfer header" data-to="day-tank feed header"', "transfer header DN50 to the day-tank feed header"),
    "dta":    (793, 'data-id="fs-dt-a-feed" data-from="XV-A" data-to="DT-GEN-A"', "day-tank A feed DN25 through XV-A"),
    "dtb":    (794, 'data-id="fs-dt-b-feed" data-from="XV-B" data-to="DT-GEN-B"', "day-tank B feed DN25 through XV-B"),
    "dtc":    (795, 'data-id="fs-dt-c-feed" data-from="XV-C" data-to="DT-GEN-C"', "day-tank C feed DN25 through XV-C"),
    "gen":    (796, 'data-id="fs-gen-a-supply" data-from="DT-GEN-A" data-to="GEN-A"', "genset supply DN20 from each day tank"),
    "pol":    (799, 'data-id="fs-polish-side" data-from="transfer header" data-to="FPU-01 prefilter"', "conditioning side stream DN25 from the transfer header"),
    "polr":   (800, 'data-id="fs-polish-return" data-from="FPU-01 fine filter" data-to="UST-01 return"', "conditioned fuel back to UST-01"),
    "ovf":    (801, 'data-id="fs-dt-return" data-from="DT-GEN-C overflow" data-to="UST-01 return header"', "DT-GEN-C overflow to the return header"),
    "xv101":  (832, 'FILL XV-101', "fill valve box at the fill coupling"),
    "ust":    (842, 'UST-01 &middot; BULK STORAGE', "bulk storage tank inside its bund"),
    "bubs":   (843, 'class="lbl bubtxt">TIT</text>', "TIT and LIT bubbles on UST-01"),
    "lit":    (904, 'Level (LIT-101)', "UST-01 level is LIT-101"),
    "lds":    (848, 'LDS-101 interstitial', "interstitial leak point on the double-wall tank"),
    "bund":   (849, 'LS-102 bund sump', "bund sump level switch"),
    "suctsym": (852, 'translate(372,317)', "an unlabelled symbol on the suction line"),
    "iso":    (853, 'translate(440,290)', "valves with a handwheel on each pump suction"),
    "pumps":  (854, 'id="pid-p101" class="pid-pump"', "P-101 and P-102 pump bodies"),
    "ck":     (855, 'translate(512,290)', "a circle with a flow arrow on each discharge, then a handwheel valve"),
    "duty":   (856, 'P-101 &middot; DUTY', "P-101 duty"),
    "stby":   (857, 'P-102 &middot; STANDBY', "P-102 standby"),
    "ptft":   (858, 'class="lbl bubtxt">FT</text>', "PT and FT bubbles on the transfer header"),
    "fpu":    (862, 'FPU-01 &middot; CONDITIONING SIDE-STREAM', "conditioning package"),
    "fpu3":   (863, 'id="pid-fpu-ff"', "prefilter, coalescer, fine filter inside FPU-01"),
    "dpt":    (864, 'class="lbl bubtxt">DPT</text>', "DPT and WIF bubbles after FPU-01"),
    "dtA":    (869, 'data-eq="DT-GEN-A"', "day tank A with XV-A, an LS bubble and a valve on the genset supply"),
    "dtB":    (870, 'data-eq="DT-GEN-B"', "day tank B"),
    "dtC":    (871, 'data-eq="DT-GEN-C"', "day tank C"),
    "genA":   (872, 'data-eq="GEN-A"', "genset A"),
    "genB":   (873, 'data-eq="GEN-B"', "genset B"),
    "genC":   (874, 'data-eq="GEN-C"', "genset C"),
    "dtlogic": (981, 'Low-low (&lt;25%) raises a critical interlock alarm and forces lead pump to RUN', "day-tank low-low forces the lead pump to run"),
    "bundtrip": (1330, "msg: 'Bund sump high — transfer and fill inhibited'", "LS-102 high stops transfer and inhibits fill"),
    "wif":    (1331, "msg: 'Water-in-fuel above limit — continuous polishing requested'", "water-in-fuel high requests polishing"),
}
lines_src = open(os.path.join(ROOT, PAGE), encoding="utf-8").read().split("\n")
sources = {}
for k, (ln, quote, what) in SRC.items():
    if quote not in lines_src[ln - 1]:
        sys.exit("source %s: quote not on %s line %d: %r" % (k, PAGE, ln, quote))
    sources[k] = {"file": PAGE, "line": ln, "quote": quote, "ref": "%s line %d: %s" % (PAGE, ln, what)}

LOW = 0.5

equipment = [
    {"id": "UST-01", "tag": "UST-01", "kind": "tank", "name": "Bulk storage (double-wall, bunded)", "bbox": bb(100, 262, 340, 372),
     "attributes": {"src": "ust", "explain": "UST-01 holds the bulk diesel; the transfer pumps lift from it and the conditioning loop and DT-GEN-C's overflow return to it."}},
    {"id": "P-101", "tag": "P-101", "kind": "centrifugal_pump", "name": "Transfer pump (duty)", "bbox": bb(454, 274, 486, 306),
     "attributes": {"src": "p101d", "duty": "duty", "explain": "P-101 is the duty transfer pump."}},
    {"id": "P-102", "tag": "P-102", "kind": "centrifugal_pump", "name": "Transfer pump (standby)", "bbox": bb(454, 328, 486, 360),
     "attributes": {"src": "p102d", "duty": "standby", "explain": "P-102 stands by on the same suction and discharge."}},
    {"id": "FPU-01", "tag": "FPU-01", "kind": "package_unit", "name": "Conditioning: prefilter, coalescer, fine filter", "bbox": bb(695, 360, 865, 400),
     "attributes": {"src": "fpu3"}},
] + [
    {"id": "DT-GEN-" + s, "tag": "DT-GEN-" + s, "kind": "tank", "name": "Day tank " + s, "bbox": bb(x - 22, 96, x + 22, 166), "attributes": {"src": "dt" + s}}
    for s, x in (("A", 782), ("B", 922), ("C", 1062))
] + [
    {"id": "GEN-" + s, "tag": "GEN-" + s, "kind": "generator", "name": "Genset " + s, "bbox": bb(x - 18, 204, x + 18, 240), "attributes": {"src": "gen" + s}}
    for s, x in (("A", 782), ("B", 922), ("C", 1062))
]

def valve(i, kind, src, **kw):
    d = {"id": i, "kind": kind, "attributes": {"src": src}}
    d.update(kw)
    return d

components = [
    valve("XV-101", "on_off_valve", "xv101", tag="XV-101", name="Bulk-fill valve"),
    valve("SF-1", "other", "suctsym", name="suction symbol (not identified)", confidence=LOW,
          notes="The page draws a bar, a V and a dashed stem on the suction line with no label.",
          attributes={"src": "suctsym", "basis": "an unlabelled symbol on the suction line; its type is not given"}),
    valve("V-S1", "manual_valve", "iso"), valve("V-S2", "manual_valve", "iso"),
    valve("CK-1", "check_valve", "ck", notes="Read as a check valve: a circle with a flow arrow, the page's own symbol on each discharge."),
    valve("CK-2", "check_valve", "ck", notes="As CK-1."),
    valve("V-D1", "manual_valve", "ck"), valve("V-D2", "manual_valve", "ck"),
] + [valve("XV-" + s, "on_off_valve", "dt" + s, tag="XV-" + s, name="Day-tank " + s + " fill valve") for s in "ABC"] \
  + [valve("V-G" + s, "manual_valve", "dt" + s) for s in "ABC"]

def inst(i, cx, cy, measures=None, **kw):
    d = {"id": i, "location": "field", "bbox": bub(cx, cy)}
    if measures is not None:
        d["measures"] = measures
    d.update(kw)
    return d

HDR = {"line": "L-D1", "after": "V-D1"}
instruments = [
    inst("PT-101", 590, 290, HDR, tag="PT-101", attributes={"src": "ptft", "standalone": "transfer-header pressure indication"}),
    inst("FT-101", 630, 290, HDR, tag="FT-101", attributes={"src": "ptft", "standalone": "transfer flow indication"}),
    inst("LIT-101", 300, 244, {"item": "UST-01"}, tag="LIT-101",
         attributes={"src": "lit", "standalone": "bulk level indication; the page reads the value from the engine snapshot, not a constant"}),
    inst("TIT", 140, 244, {"item": "UST-01"}, function="TIT", attributes={"src": "bubs", "standalone": "bulk temperature indication (bubble drawn without a tag number)"}),
    inst("PDT", 905, 356, {"item": "FPU-01"}, function="PDT", confidence=LOW,
         attributes={"src": "dpt", "standalone": "conditioning filter dP",
                     "basis": "the page draws 'DPT'; ISA-5.1 writes differential pressure as PD, so it is read as PDT"}),
    inst("AT", 950, 356, {"line": "L-POLR"}, function="AT", confidence=LOW,
         attributes={"src": "wif", "standalone": "water-in-fuel; high requests polishing (alarm only)",
                     "basis": "the page draws 'WIF' (water-in-fuel), not an ISA-5.1 letter set; read as an analyser"}),
    inst("LS-102", 330, 382, {"item": "B-BUND"}, tag="LS-102", name="Bund sump level", attributes={"src": "bundtrip"}),
] + [
    inst("LS-" + s, x + 42, 150, {"item": "DT-GEN-" + s}, function="LS", loop="LS-DT", name="Day tank " + s + " low-low",
         attributes={"src": "dtlogic", "setpoint": "< 25 % (low-low)"}) for s, x in (("A", 782), ("B", 922), ("C", 1062))
]

boundaries = [
    {"id": "B-FILL", "name": "TANKER FILL", "direction": "source", "bbox": bb(0, 302, 74, 324), "confidence": 0.6,
     "attributes": {"basis": "the page starts the fill line at the XV-101 box; the tanker connection itself is not drawn"}},
    {"id": "B-BUND", "name": "UST-01 BUND SUMP", "direction": "area", "bbox": bb(96, 406, 250, 414)},
]

lines = [
    {"id": "L-FILL", "service": "fill", "size": "DN80", "from": "B-FILL", "to": "UST-01", "path": ["XV-101"]},
    {"id": "L-SUC", "service": "suction", "size": "DN50", "from": "UST-01", "to": "P-101", "path": ["SF-1", "V-S1"]},
    {"id": "L-SUC2", "service": "suction", "size": "DN50", "from": {"line": "L-SUC", "after": "SF-1"}, "to": "P-102", "path": ["V-S2"]},
    {"id": "L-D1", "service": "transfer", "size": "DN50", "from": "P-101", "to": "DT-GEN-C", "path": ["CK-1", "V-D1", "XV-C"]},
    {"id": "L-D2", "service": "transfer", "size": "DN50", "from": "P-102", "to": HDR, "path": ["CK-2", "V-D2"]},
    {"id": "L-DTA", "service": "day-tank feed", "size": "DN25", "from": HDR, "to": "DT-GEN-A", "path": ["XV-A"]},
    {"id": "L-DTB", "service": "day-tank feed", "size": "DN25", "from": HDR, "to": "DT-GEN-B", "path": ["XV-B"]},
] + [
    {"id": "L-G" + s, "service": "genset supply", "size": "DN20", "from": "DT-GEN-" + s, "to": "GEN-" + s, "path": ["V-G" + s]} for s in "ABC"
] + [
    {"id": "L-POL", "service": "conditioning", "size": "DN25", "from": HDR, "to": "FPU-01"},
    {"id": "L-POLR", "service": "conditioning return", "size": "DN25", "from": "FPU-01", "to": "UST-01"},
    {"id": "L-OVF", "service": "overflow return", "size": "DN25", "from": "DT-GEN-C", "to": {"line": "L-POLR"}},
]

U = "unknown"
signals = [
    {"from": "LS-" + s, "to": "P-101", "type": U, "purpose": "control", "confidence": LOW,
     "notes": "Not drawn; the page's day-tank logic says low-low forces the lead pump to RUN."} for s in "ABC"
] + [
    {"from": "LS-102", "to": t, "type": U, "purpose": "trip", "confidence": LOW,
     "notes": "Not drawn; the page's alarm logic says bund sump high stops transfer and inhibits fill."} for t in ("P-101", "P-102", "XV-101")
]

page = {
    "schema_version": "1.0", "page": 1,
    "sheet": {"drawing_number": "RZ-FUEL-01", "title": "Diesel transfer: bulk storage to day tanks", "drawing_type": "pid",
              "legend_notes": [
                  "Read from fuel-system.html (the fuel P&ID at lines 783-874 and its day-tank and alarm logic). Coordinates are the page's own.",
                  "No level, flow or pressure value is a page constant: the page reads them from the engine snapshot, so no instrument here carries one.",
                  "Not drawn on the page and therefore marked low confidence: every signal line, the tanker connection, the suction symbol's type.",
                  "LDS-101 (interstitial leak point, line 848) is drawn without a process connection or an ISA-5.1 letter set; it is listed here, not modelled."]},
    "equipment": equipment, "components": components, "instruments": instruments,
    "lines": lines, "signals": signals, "off_page_connectors": [], "boundaries": boundaries,
    "tiles_reviewed": ["whole page"], "unreadable": [],
}

anchors = {
    "XV-101": [92, 313], "SF-1": [372, 317], "V-S1": [440, 290], "V-S2": [440, 344], "CK-1": [512, 290], "CK-2": [512, 344],
    "V-D1": [540, 290], "V-D2": [540, 344], "XV-A": [782, 74], "XV-B": [922, 74], "XV-C": [1062, 74],
    "V-GA": [782, 186], "V-GB": [922, 186], "V-GC": [1062, 186],
}
routes = {
    "L-FILL": [[74, 313], [92, 313], [110, 313], [110, 262]],
    "L-SUC": [[340, 317], [372, 317], [400, 317], [400, 290], [440, 290], [454, 290]],
    "L-SUC2": [[400, 317], [400, 344], [440, 344], [454, 344]],
    "L-D1": [[486, 290], [512, 290], [540, 290], [560, 290], [560, 317], [700, 317], [700, 52], [1062, 52], [1062, 74], [1062, 96]],
    "L-D2": [[486, 344], [512, 344], [540, 344], [560, 344], [560, 317]],
    "L-DTA": [[782, 52], [782, 74], [782, 96]],
    "L-DTB": [[922, 52], [922, 74], [922, 96]],
    "L-GA": [[782, 166], [782, 186], [782, 204]],
    "L-GB": [[922, 166], [922, 186], [922, 204]],
    "L-GC": [[1062, 166], [1062, 186], [1062, 204]],
    "L-POL": [[660, 317], [660, 380], [695, 380]],
    "L-POLR": [[865, 380], [980, 380], [980, 428], [120, 428], [120, 372]],
    "L-OVF": [[1084, 128], [1104, 128], [1104, 428], [980, 428]],
}
signals_l = {
    "P01.LS-A>P-101": [[824, 24], [470, 24]],
    "P01.LS-B>P-101": [[964, 24], [470, 24]],
    "P01.LS-C>P-101": [[1104, 24], [470, 24]],
    "LS-102>P-102": [[470, 382]],
    "LS-102>P-101": [[425, 382], [425, 262], [470, 262]],
    "LS-102>XV-101": [[92, 382]],
}
labels = {
    "UST-01": [-126, -66, "middle"],
    "DT-GEN-A": [-56, -24, "end"], "DT-GEN-B": [-56, -24, "end"], "DT-GEN-C": [-56, -24, "end"],
    "XV-A": [26, 31, "start"], "XV-B": [26, 31, "start"], "XV-C": [26, 31, "start"], "XV-101": [6, 0, "end"],
}
rotate = {"XV-A": 90, "XV-B": 90, "XV-C": 90, "V-GA": 90, "V-GB": 90, "V-GC": 90}

doc = {
    "about": "Diesel transfer from bulk storage to three genset day tanks, read from " + PAGE + " in the PID-to-Knowledge-Graph extraction "
             "schema v1.0 (pages[0] validates against tools/fixtures/pid-mini-plant/extraction.schema.json). Every source is a line of the page "
             "and a quote found on it (gated).",
    "source_page": PAGE,
    "plant": {"id": "fuel-day-tank", "name": "Diesel day-tank transfer"},
    "sources": sources,
    "pages": [page],
    "layout": {"viewBox": [W, H], "anchors": anchors, "routes": routes, "signals": signals_l, "labels": labels, "rotate": rotate,
               "flagTip": {"B-FILL": "right"}},
}
json.dump(doc, open(sys.argv[1], "w"), indent=1, ensure_ascii=False)
print("ok")
