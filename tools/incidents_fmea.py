"""incidents_fmea — a retrospective FMEA for each incident dossier.

WHY THIS EXISTS

The owner asked for every incident in the library to carry "a comprehensive FMEA
analysis, with visuals and detailed evidence or supporting data". A dossier already
says WHAT happened (sequence of events, root cause, contributing factors, COE).
An FMEA says something different: for each way the system could fail, how bad the
effect, how likely the cause, how likely it was to be caught first, and what the
published corrective action does to each of those three numbers.

WHAT KEEPS IT HONEST

An FMEA for a real incident is a judgement, so three rules decide whether a row
may ship (enforced by validate_fmea, which tools/test-incidents-fmea.py runs):

1. Every failure mode cites EVIDENCE as pointers into the dossier itself — a
   sequence-of-events entry, a metric, a COE item, an improvement, or a quote. A
   quote must be a verbatim substring of the reference quote or dossier field it
   points at. Nothing in the FMEA may be a fact the dossier does not hold.
2. Every S, O and D score carries a written rationale against the rubric below.
3. A revised score may only be claimed against a published corrective action
   (a COE or improvement pointer). Where the dossier records none, the mode is
   shown as residual risk with no revised score, which is itself a finding.

RPN = S x O x D is computed here, never typed by the author.

The rubric is adapted for data-centre retrospectives from the 1-10 scales of
IEC 60812:2018 and the AIAG-VDA FMEA handbook. It is labelled on the page as an
analyst assessment, not an operator document.
"""
import html
import math

RUBRIC = {
    "S": [
        (10, "Hazard to people, or loss of the facility / several regions"),
        (9, "Region-wide or provider-wide outage of a foundational service, no workaround"),
        (8, "Full outage of a major service for hours"),
        (7, "Major degradation of a major service"),
        (6, "Partial outage confined to one zone or one service"),
        (5, "Customer-visible degradation"),
        (4, "Limited customer impact"),
        (3, "Internal impact only"),
        (2, "Negligible"),
        (1, "No effect"),
    ],
    "O": [
        (10, "Near certain: the cause is present in normal operation"),
        (8, "Frequent: routine work exercises the cause"),
        (6, "Occasional: a foreseeable slip or condition, weakly guarded"),
        (4, "Infrequent: needs an unusual combination"),
        (2, "Remote: guarded by design"),
        (1, "Eliminated by design"),
    ],
    "D": [
        (10, "No control could detect it"),
        (9, "Detected only through customer impact"),
        (8, "Detected after impact by internal monitoring"),
        (6, "Detected at onset, not prevented"),
        (4, "Detected before impact with time to act"),
        (2, "Automated interlock almost certainly stops it"),
        (1, "Certain to be stopped"),
    ],
}

SRC_LABEL = {
    "soe": "Sequence of events",
    "metric": "Metric",
    "coe": "Correction of errors",
    "improvement": "Improvement",
    "ref": "Reference",
    "rootCause": "Root cause",
    "factor": "Contributing factor",
    "tech": "Technical deep-dive",
}
_LIST_FIELD = {
    "soe": "sequenceOfEvents",
    "metric": "metrics",
    "coe": "coe",
    "improvement": "improvements",
    "ref": "references",
    "factor": "contributingFactors",
}
_TEXT_FIELD = {"rootCause": "rootCause", "tech": "technicalDeepDive"}
ACTION_SOURCES = {"coe", "improvement"}


def esc(s):
    return html.escape(str(s if s is not None else ""), quote=True)


def rpn(scores):
    return int(scores["S"]) * int(scores["O"]) * int(scores["D"])


def priority(scores):
    """High / Medium / Low.

    Severity overrides the product, because an RPN of 9 x 2 x 9 = 162 hides a
    region-wide outage that nothing would catch. Rule, stated on the page:
    High   if S >= 9 and (O >= 4 or D >= 7), or RPN >= 300
    Medium if RPN >= 120, or S >= 7
    Low    otherwise
    """
    s, o, d = int(scores["S"]), int(scores["O"]), int(scores["D"])
    r = s * o * d
    if (s >= 9 and (o >= 4 or d >= 7)) or r >= 300:
        return "high"
    if r >= 120 or s >= 7:
        return "medium"
    return "low"


_PRIO_LABEL = {"high": "High", "medium": "Medium", "low": "Low"}
_PRIO_VAR = {"high": "var(--red)", "medium": "var(--amber)", "low": "var(--green)"}


def _item_text(inc, src, i):
    field = _LIST_FIELD.get(src)
    if field is None:
        return None
    items = inc.get(field) or []
    if not isinstance(i, int) or i < 0 or i >= len(items):
        return None
    it = items[i]
    if isinstance(it, str):
        return it
    if src == "soe":
        return f'{it.get("t", "")} — {it.get("event", "")}'
    if src == "metric":
        return f'{it.get("label", "")}: {it.get("value", "")}'
    if src == "coe":
        return f'{it.get("action", "")} ({it.get("status", "")})'
    if src == "ref":
        return it.get("quote", "")
    return str(it)


def resolve_evidence(inc, ev):
    """Return {label, text, href, quote} for one pointer, or None if it dangles."""
    src = ev.get("src")
    if src in _TEXT_FIELD:
        body = inc.get(_TEXT_FIELD[src]) or ""
        q = ev.get("quote", "")
        if not q or q not in body:
            return None
        return {"label": SRC_LABEL[src], "text": "", "quote": q, "href": None}
    i = ev.get("i")
    base = _item_text(inc, src, i)
    if base is None:
        return None
    q = ev.get("quote")
    if q and q not in base:
        return None
    href = None
    label = f"{SRC_LABEL[src]} #{i + 1}"
    if src == "ref":
        r = inc["references"][i]
        href = r.get("url")
        label = f'{SRC_LABEL[src]} #{i + 1} · {r.get("type", "")}'
    elif src in ("soe", "metric"):
        it = inc[_LIST_FIELD[src]][i]
        href = it.get("source")
        if href and not href.startswith("http"):
            href = "https://" + href
    return {"label": label, "text": "" if q else base, "quote": q or "", "href": href}


def validate_fmea(inc):
    """Every problem with one dossier's FMEA, as plain strings. Empty = valid."""
    errs = []
    f = inc.get("fmea")
    if f is None:
        return ["no fmea block"]
    modes = f.get("modes") or []
    if len(modes) < 4:
        errs.append(f"only {len(modes)} failure mode(s); the floor is 4")
    if not f.get("scope"):
        errs.append("no scope statement (what system boundary the FMEA covers)")
    seen = set()
    for m in modes:
        mid = m.get("id", "?")
        if mid in seen:
            errs.append(f"{mid}: duplicate id")
        seen.add(mid)
        for k in ("item", "function", "failureMode", "effect", "cause"):
            if not (m.get(k) or "").strip():
                errs.append(f"{mid}: empty {k}")
        for k in ("S", "O", "D"):
            v = m.get(k)
            if not isinstance(v, int) or not 1 <= v <= 10:
                errs.append(f"{mid}: {k} must be an integer 1-10, got {v!r}")
            if not ((m.get("rationale") or {}).get(k) or "").strip():
                errs.append(f"{mid}: no written rationale for {k}")
        ev = m.get("evidence") or []
        if len(ev) < 2:
            errs.append(f"{mid}: {len(ev)} evidence pointer(s); the floor is 2")
        for e in ev:
            if resolve_evidence(inc, e) is None:
                errs.append(f"{mid}: evidence {e} does not resolve — a dangling index or a quote not found verbatim in its source")
        acts = m.get("actions") or []
        rev = m.get("revised")
        if rev is not None:
            if not acts:
                errs.append(f"{mid}: revised scores claimed with no action")
            for k in ("S", "O", "D"):
                v = rev.get(k)
                if not isinstance(v, int) or not 1 <= v <= 10:
                    errs.append(f"{mid}: revised {k} must be an integer 1-10")
            if all(isinstance(rev.get(k), int) for k in "SOD") and all(isinstance(m.get(k), int) for k in "SOD"):
                if rpn(rev) > rpn(m):
                    errs.append(f"{mid}: revised RPN {rpn(rev)} is higher than the original {rpn(m)}")
        for a in acts:
            src = (a.get("evidence") or {}).get("src")
            if src not in ACTION_SOURCES:
                errs.append(f"{mid}: action '{a.get('text', '')[:40]}' does not point at a published COE or improvement")
            elif resolve_evidence(inc, a["evidence"]) is None:
                errs.append(f"{mid}: action evidence {a['evidence']} does not resolve")
    return errs


# ── visuals ──────────────────────────────────────────────────────────────────

def pareto_html(modes):
    """RPN per failure mode, worst first, as HTML rows rather than an SVG.

    The first version was an SVG on a 0-1000 axis: the worst RPN here is 504, so half
    the plot was empty, and the whole drawing scaled down with the column -- its labels
    rendered at 7-8px on desktop and were unreadable at 390px. Rows of real text with
    a percentage-width bar keep every label at body size at any width. Solid bar = as
    the incident found it; thin bar beneath = after the published corrective action."""
    rows = sorted(modes, key=lambda m: -rpn(m))
    top = max(rpn(m) for m in rows)
    scale = max(100, int(math.ceil(top / 100.0)) * 100)
    out = ['<div class="fm-pb" role="list" aria-label="Risk priority number per failure mode, before and after corrective action">']
    for m in rows:
        r0 = rpn(m)
        p = priority(m)
        rev = m.get("revised")
        rev_bar = (f'<i class="fm-pb-rev" style="width:{100 * rpn(rev) / scale:.1f}%"></i>' if rev
                   else '<i class="fm-pb-none">no published action</i>')
        val = f'{r0} → {rpn(rev)}' if rev else f'{r0}'
        out.append(
            f'<div class="fm-pb-row" role="listitem" title="{esc(m["id"])} {esc(m["failureMode"])}">'
            f'<span class="fm-pb-id">{esc(m["id"])}</span>'
            f'<span class="fm-pb-track"><i class="fm-pb-bar" style="width:{100 * r0 / scale:.1f}%;background:{_PRIO_VAR[p]}"></i>{rev_bar}</span>'
            f'<span class="fm-pb-val">{val}</span></div>')
    out.append(f'<div class="fm-pb-axis" aria-hidden="true"><span></span><span class="fm-pb-ticks"><span>0</span>'
               f'<span>{scale // 2}</span><span>{scale}</span></span><span></span></div>')
    out.append('</div>')
    return "".join(out)


def matrix_svg(modes):
    """Severity against occurrence. Each mode sits where the incident found it;
    a hollow mark and a line show where its corrective action moves it."""
    W, H = 360, 330
    L, T, cell = 44, 14, 28
    gx = lambda o: L + (o - 0.5) * cell
    gy = lambda s: T + (10.5 - s) * cell
    out = [f'<svg class="fm-matrix" viewBox="0 0 {W} {H}" role="img" '
           f'aria-label="Criticality matrix, severity against occurrence">']
    for s in range(1, 11):
        for o in range(1, 11):
            c = s * o
            band = "fm-c-hi" if c >= 40 or s >= 9 else ("fm-c-md" if c >= 18 else "fm-c-lo")
            out.append(f'<rect class="{band}" x="{L + (o - 1) * cell}" y="{T + (10 - s) * cell}" '
                       f'width="{cell}" height="{cell}"/>')
    for v in range(1, 11):
        out.append(f'<text class="vz-tick" x="{gx(v):.1f}" y="{T + 10 * cell + 14}" text-anchor="middle">{v}</text>')
        out.append(f'<text class="vz-tick" x="{L - 8}" y="{gy(v) + 4:.1f}" text-anchor="end">{v}</text>')
    out.append(f'<text class="vz-axis" x="{L + 5 * cell}" y="{H - 2}" text-anchor="middle">Occurrence →</text>')
    out.append(f'<text class="vz-axis" transform="translate(11 {T + 5 * cell}) rotate(-90)" text-anchor="middle">Severity →</text>')
    # One marker per occupied cell, carrying every ID in it. The first version fanned
    # co-located modes onto a small ring and drew dashed lines to their after-action
    # positions: in the dense S=9 row the IDs collided ("06 03 02 01") and the lines
    # formed a box that read as a shape rather than as movement. Before-and-after now
    # lives in the RPN bars; this chart answers only "where did each mode sit".
    rank = {"high": 0, "medium": 1, "low": 2}
    cells = {}
    for m in modes:
        cells.setdefault((m["S"], m["O"]), []).append(m)
    # Label placement by search, not by rule. The first rule ("above, unless the left
    # neighbour took it") passed the pilot and failed the third dossier it met: on
    # AWS EBS 2011 a label placed BELOW one row landed on the label placed ABOVE the
    # row beneath. Each label now tries above, below, right, left in turn and takes
    # the first slot that overlaps no marker and no label already placed. Text width
    # is estimated from the mono advance (0.6 em at 10px) -- tools/incidents-visual-qa.mjs
    # measures the real rendered boxes and fails on any overlap this misses.
    CH, LH, R = 6.0, 10.0, 6.0
    markers = []
    for (s, o), ms in sorted(cells.items()):
        markers.append((gx(o), gy(s)))
    placed = [(x - R, y - R, x + R, y + R) for x, y in markers]

    def clash(b):
        return any(b[0] < q[2] and q[0] < b[2] and b[1] < q[3] and q[1] < b[3] for q in placed)

    for (s, o), ms in sorted(cells.items(), key=lambda kv: (-kv[0][0], kv[0][1])):
        worst = min(ms, key=lambda m: rank[priority(m)])
        ids = ", ".join(m["id"].replace("FM-", "") for m in sorted(ms, key=lambda m: m["id"]))
        tip = "; ".join(f'{m["id"]} {m["failureMode"]} (S{m["S"]} O{m["O"]} D{m["D"]})' for m in ms)
        cx, cy = gx(o), gy(s)
        out.append(f'<circle class="fm-pt" cx="{cx:.1f}" cy="{cy:.1f}" r="6" fill="{_PRIO_VAR[priority(worst)]}">'
                   f'<title>{esc(tip)}</title></circle>')
        w = CH * len(ids) + 2
        slots = [
            (cx, cy - 10, "middle", (cx - w / 2, cy - 10 - LH, cx + w / 2, cy - 10 + 2)),
            (cx, cy + 18, "middle", (cx - w / 2, cy + 18 - LH, cx + w / 2, cy + 18 + 2)),
            (cx + 9, cy + 4, "start", (cx + 9, cy + 4 - LH, cx + 9 + w, cy + 4 + 2)),
            (cx - 9, cy + 4, "end", (cx - 9 - w, cy + 4 - LH, cx - 9, cy + 4 + 2)),
        ]
        lx, ly, anchor, box = next((sl for sl in slots if not clash(sl[3])), slots[0])
        placed.append(box)
        out.append(f'<text class="fm-pt-l" x="{lx:.1f}" y="{ly:.1f}" text-anchor="{anchor}">{esc(ids)}</text>')
    out.append("</svg>")
    return "".join(out)


# ── worksheet ────────────────────────────────────────────────────────────────

def _ev_html(inc, ev):
    r = resolve_evidence(inc, ev)
    if r is None:
        return ""
    lab = f'<a href="{esc(r["href"])}" target="_blank" rel="noopener nofollow">{esc(r["label"])}</a>' if r["href"] else esc(r["label"])
    body = f'“{esc(r["quote"])}”' if r["quote"] else esc(r["text"])
    return f'<li><span class="fm-ev-src">{lab}</span><span class="fm-ev-txt">{body}</span></li>'


def _score_cell(k, v, rationale):
    return (f'<div class="fm-sc"><dt>{k} <b>{v}</b></dt><dd>{esc(rationale)}</dd></div>')


def worksheet_html(inc):
    f = inc["fmea"]
    modes = sorted(f["modes"], key=lambda m: -rpn(m))
    rows = []
    for m in modes:
        p = priority(m)
        r0 = rpn(m)
        rev = m.get("revised")
        rev_txt = f'{rpn(rev)}' if rev else "—"
        acts = "".join(
            f'<li>{esc(a["text"])} <span class="fm-ev-src">{esc(resolve_evidence(inc, a["evidence"])["label"])}</span></li>'
            for a in (m.get("actions") or [])
        ) or '<li class="fm-residual">No corrective action is recorded in the published sources. This mode is residual risk.</li>'
        rev_line = (f'<p class="fm-revline">After action: S{rev["S"]} · O{rev["O"]} · D{rev["D"]} → RPN {rpn(rev)}. '
                    f'{esc(m.get("revisedRationale", ""))}</p>') if rev else ""
        ev = "".join(_ev_html(inc, e) for e in m.get("evidence", []))
        rows.append(f"""<details class="fm-row">
  <summary>
    <span class="fm-id-cell">{esc(m["id"])}</span>
    <span class="fm-mode">{esc(m["failureMode"])}<span class="fm-item">{esc(m["item"])}</span></span>
    <span class="fm-sod" aria-label="Severity {m['S']}, occurrence {m['O']}, detection {m['D']}">{m['S']}·{m['O']}·{m['D']}</span>
    <span class="fm-rpn"><i class="fm-dot" style="background:{_PRIO_VAR[p]}"></i>{r0}</span>
    <span class="fm-rpn-rev">{rev_txt}</span>
  </summary>
  <div class="fm-body">
    <dl class="fm-kv">
      <dt>Function</dt><dd>{esc(m["function"])}</dd>
      <dt>Effect</dt><dd>{esc(m["effect"])}</dd>
      <dt>Cause</dt><dd>{esc(m["cause"])}</dd>
      <dt>Prevention in place</dt><dd>{esc(m.get("prevention", "None recorded"))}</dd>
      <dt>Detection in place</dt><dd>{esc(m.get("detection", "None recorded"))}</dd>
    </dl>
    <dl class="fm-scores">
      {_score_cell("S", m["S"], m["rationale"]["S"])}
      {_score_cell("O", m["O"], m["rationale"]["O"])}
      {_score_cell("D", m["D"], m["rationale"]["D"])}
    </dl>
    <p class="fm-sub">Priority: <b>{_PRIO_LABEL[p]}</b> · RPN {r0}</p>
    <p class="fm-sub">Corrective action</p>
    <ul class="fm-acts">{acts}</ul>
    {rev_line}
    <p class="fm-sub">Evidence</p>
    <ul class="fm-ev">{ev}</ul>
  </div>
</details>""")
    return "".join(rows)


def _rubric_html():
    def table(k, title):
        rows = "".join(f"<tr><td>{v}</td><td>{esc(t)}</td></tr>" for v, t in RUBRIC[k])
        return f'<div><p class="fm-sub">{title}</p><table class="fm-rubric"><tbody>{rows}</tbody></table></div>'
    return (f'<details class="fm-method"><summary>Scoring rubric and method</summary>'
            f'<div class="fm-method-body">'
            f'<p>A retrospective FMEA: each row asks how this system could fail, how bad the effect was, how likely the '
            f'cause was given the controls in place at the time, and how likely those controls were to catch it before '
            f'customers did. Scales are adapted for data-centre operations from the 1–10 scales of IEC 60812:2018 and the '
            f'AIAG-VDA FMEA handbook. RPN = S × O × D. Priority is High when S ≥ 9 with O ≥ 4 or D ≥ 7, or when RPN ≥ 300; '
            f'Medium when RPN ≥ 120 or S ≥ 7; Low otherwise. Severity overrides the product because a large S multiplied by '
            f'small O and D can hide a region-wide outage nothing would catch.</p>'
            f'<p>Every row cites evidence from this dossier, and every quote is checked verbatim against its source by '
            f'<code>tools/test-incidents-fmea.py</code>. A revised score is only shown against a published corrective action. '
            f'This is an RZ analyst assessment, not an operator document.</p>'
            f'<div class="fm-rubrics">{table("S", "Severity")}{table("O", "Occurrence")}{table("D", "Detection")}</div>'
            f'</div></details>')


def fmea_section(inc):
    f = inc.get("fmea")
    if not f:
        return ""
    errs = validate_fmea(inc)
    if errs:
        # Never ship a half-valid FMEA, and never hide that one was dropped:
        # an invalid block is omitted from the page AND reported loudly here,
        # and tools/test-incidents-fmea.py fails on the same errors.
        import sys
        sys.stderr.write(f"FMEA OMITTED for {inc.get('slug')}: " + "; ".join(errs) + "\n")
        return ""
    modes = f["modes"]
    high = sum(1 for m in modes if priority(m) == "high")
    acted = sum(1 for m in modes if m.get("revised"))
    total0 = sum(rpn(m) for m in modes)
    total1 = sum(rpn(m["revised"]) if m.get("revised") else rpn(m) for m in modes)
    cut = round(100 * (total0 - total1) / total0) if total0 else 0
    return f"""
        <h2 id="fmea">Failure mode &amp; effects analysis (FMEA)</h2>
        <p class="fm-scope">{esc(f["scope"])}</p>
        <p class="metabar fm-meta"><span><b>{len(modes)}</b> failure modes</span><span class="sep">/</span><span><b>{high}</b> high priority</span><span class="sep">/</span><span><b>{acted} of {len(modes)}</b> with a published action</span><span class="sep">/</span><span>total RPN <b>{total0} → {total1}</b> (−{cut}%)</span></p>
        <div class="fm-viz">
            <figure class="fm-fig"><figcaption>Risk priority number (S × O × D), worst first — thin bar: after the published action</figcaption>{pareto_html(modes)}</figure>
            <figure class="fm-fig fm-fig-m"><figcaption>Criticality: severity × occurrence</figcaption>{matrix_svg(modes)}</figure>
        </div>
        <div class="fm-sheet">
            <div class="fm-head" aria-hidden="true"><span>ID</span><span>Failure mode</span><span>S·O·D</span><span>RPN</span><span>After</span></div>
            {worksheet_html(inc)}
        </div>
        {_rubric_html()}
"""


CSS = r"""
    /* ── FMEA (v3.12.3) — one hairline panel of rows, like the rest of the dossier.
       No cards, no stripes: a row is a disclosure, state is a 7px dot. ── */
    .fm-scope { color:var(--text-body); max-width:70ch; }
    .fm-meta { flex-wrap:wrap; row-gap:0.25rem; }
    .fm-viz { display:grid; grid-template-columns:minmax(0,1fr) 340px; gap:1.6rem; align-items:start; margin:1.2rem 0; }
    @media (max-width:820px){ .fm-viz { grid-template-columns:1fr; } }
    .fm-pb-row, .fm-pb-axis { display:grid; grid-template-columns:3.6rem minmax(0,1fr) 6.6rem; gap:0.6rem; align-items:center; }
    .fm-pb-row { padding:0.32rem 0; }
    .fm-pb-id, .fm-pb-val { font-family:'JetBrains Mono',monospace; font-variant-numeric:tabular-nums; font-size:0.8rem; }
    .fm-pb-id { color:var(--muted); }
    .fm-pb-val { color:var(--text-strong); white-space:nowrap; }
    .fm-pb-track { display:flex; flex-direction:column; gap:3px; }
    .fm-pb-bar { display:block; height:12px; }
    .fm-pb-rev { display:block; height:4px; background:var(--text-body); opacity:0.55; }
    .fm-pb-none { font-style:italic; font-size:0.72rem; color:var(--muted); line-height:1; }
    .fm-pb-axis { margin-top:0.3rem; border-top:1px solid var(--line); padding-top:0.25rem; font-family:'JetBrains Mono',monospace; font-size:0.68rem; color:var(--muted); }
    .fm-pb-ticks { display:flex; justify-content:space-between; }
    .fm-fig { margin:0; }
    .fm-fig figcaption { font-size:0.8rem; color:var(--muted); margin-bottom:0.35rem; }
    .fm-fig svg { width:100%; height:auto; display:block; }
    .fm-fig-m svg { max-width:340px; }
    .fm-matrix .fm-c-lo { fill:var(--surface); stroke:var(--line); stroke-width:0.5; }
    .fm-matrix .fm-c-md { fill:color-mix(in srgb, var(--amber) 9%, var(--surface)); stroke:var(--line); stroke-width:0.5; }
    .fm-matrix .fm-c-hi { fill:color-mix(in srgb, var(--red) 10%, var(--surface)); stroke:var(--line); stroke-width:0.5; }
    .fm-matrix .vz-axis { font-size:10px; fill:var(--muted); font-family:'IBM Plex Sans',sans-serif; }
    .fm-matrix .fm-pt { stroke:var(--surface); stroke-width:1.5; }
    .fm-matrix .fm-pt-l { font-family:'JetBrains Mono',monospace; font-size:10px; font-weight:600; fill:var(--text-strong);
      paint-order:stroke; stroke:var(--surface); stroke-width:3px; stroke-linejoin:round; }
    .fm-sheet { border:1px solid var(--line); border-radius:4px; margin-top:0.8rem; }
    .fm-head, .fm-row > summary { display:grid; grid-template-columns:4.2rem minmax(0,1fr) 4.4rem 4.6rem 3.4rem; gap:0.6rem; align-items:baseline; padding:0.6rem 0.9rem; }
    .fm-head { font-size:0.74rem; color:var(--muted); border-bottom:1px solid var(--line); }
    .fm-row { border-top:1px solid var(--line); }
    .fm-row:first-of-type { border-top:0; }
    .fm-row > summary { cursor:pointer; list-style:none; }
    .fm-row > summary::-webkit-details-marker { display:none; }
    .fm-row > summary:hover { background:var(--surface-2); }
    .fm-row > summary:focus-visible { outline:2px solid var(--cyan); outline-offset:-2px; }
    .fm-id-cell, .fm-sod, .fm-rpn, .fm-rpn-rev { font-family:'JetBrains Mono',monospace; font-variant-numeric:tabular-nums; font-size:0.84rem; }
    .fm-id-cell { color:var(--muted); }
    .fm-mode { color:var(--text-strong); font-size:0.92rem; line-height:1.4; }
    .fm-item { display:block; color:var(--muted); font-size:0.8rem; }
    .fm-sod { color:var(--text-body); }
    .fm-rpn { color:var(--text-strong); }
    .fm-rpn-rev { color:var(--muted); }
    .fm-dot { display:inline-block; width:7px; height:7px; border-radius:50%; margin-right:0.45rem; vertical-align:0.1em; }
    .fm-body { padding:0.2rem 0.9rem 1rem 5.7rem; }
    @media (max-width:640px){
      .fm-head { display:none; }
      .fm-row > summary { grid-template-columns:3.2rem minmax(0,1fr) auto; }
      .fm-sod, .fm-rpn-rev { display:none; }
      .fm-body { padding:0.2rem 0.9rem 1rem; }
    }
    .fm-kv { display:grid; grid-template-columns:9.5rem minmax(0,1fr); gap:0.3rem 0.9rem; margin:0.4rem 0 0.8rem; font-size:0.88rem; }
    .fm-kv dt { color:var(--muted); }
    .fm-kv dd { margin:0; color:var(--text-body); }
    @media (max-width:640px){ .fm-kv { grid-template-columns:1fr; } .fm-kv dd { margin-bottom:0.4rem; } }
    .fm-scores { margin:0 0 0.6rem; border-top:1px solid var(--line); }
    .fm-sc { display:grid; grid-template-columns:3.2rem minmax(0,1fr); gap:0.6rem; padding:0.45rem 0; border-bottom:1px solid var(--line); font-size:0.86rem; }
    .fm-sc dt { font-family:'JetBrains Mono',monospace; color:var(--muted); }
    .fm-sc dt b { color:var(--text-strong); }
    .fm-sc dd { margin:0; color:var(--text-body); }
    .fm-sub { font-size:0.8rem; color:var(--muted); margin:0.7rem 0 0.25rem; }
    .fm-sub b { color:var(--text-strong); }
    .fm-acts, .fm-ev { margin:0; padding-left:1.1rem; font-size:0.88rem; color:var(--text-body); }
    .fm-acts li, .fm-ev li { margin:0.25rem 0; }
    .fm-residual { color:var(--red); }
    .fm-revline { font-size:0.86rem; color:var(--text-body); margin:0.4rem 0 0; }
    .fm-ev-src { display:block; font-family:'JetBrains Mono',monospace; font-size:0.72rem; color:var(--muted); }
    .fm-ev-src a { color:var(--cyan); }
    .fm-ev-txt { display:block; }
    .fm-method { margin-top:1rem; border:1px solid var(--line); border-radius:4px; }
    .fm-method > summary { padding:0.6rem 0.9rem; cursor:pointer; font-size:0.9rem; color:var(--text-strong); }
    .fm-method-body { padding:0 0.9rem 0.9rem; font-size:0.88rem; color:var(--text-body); }
    .fm-rubrics { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:1rem; }
    @media (max-width:760px){ .fm-rubrics { grid-template-columns:1fr; } }
    .fm-rubric { width:100%; border-collapse:collapse; font-size:0.8rem; }
    .fm-rubric td { padding:0.25rem 0.4rem; border-top:1px solid var(--line); vertical-align:top; }
    .fm-rubric td:first-child { font-family:'JetBrains Mono',monospace; width:2rem; color:var(--text-strong); }
"""
