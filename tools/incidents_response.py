"""incidents_response — who did what, and who should do what, in each incident.

WHY THIS EXISTS

The owner asked for the FMEA to reach "the level of action: what the first responder
does, what the on-scene commander does, every role visible". A failure mode says what
broke; it does not say who was standing in front of it. This module adds two layers,
kept strictly apart because they make different kinds of claim:

1. RECORDED actions (`response.recorded`) — what a role actually did, as the sources
   tell it. Each one points at a sequence-of-events entry and carries a quote that must
   be a VERBATIM substring of that entry. Nothing here may be inferred: if the record
   does not say who acted, the action is not recorded.
2. PLAYBOOK actions (`fmea.modes[].playbook`) — what each role should do at that
   failure mode, by phase (prevent / detect / contain / recover). These are analyst
   guidance, not history, and the page labels them so. Each one must cite either a
   named practice from BASIS or a pointer into the dossier's own COE, improvements,
   lessons or contributing factors.

The gap between the two is the finding: a role with playbook duties and no recorded
action is shown as such, never filled in.
"""
import html

import incidents_fmea as fm

# One vocabulary for the whole library. `who` in a dossier says who the role was in
# that incident; the definition here says what the role is for.
ROLES = {
    "first-responder": ("First responder",
                        "Meets the first alarm: on-shift technician or security in a facility, on-call engineer in a service."),
    "incident-commander": ("Incident commander",
                           "Owns every decision until formally relieved: site duty manager on scene, or the declared IC of a service incident."),
    "fire-service": ("Fire & rescue commander",
                     "External incident commander for fire, rescue and hazardous materials; works in unified command with the site."),
    "electrical": ("Authorised electrical person",
                   "Switching, isolation and lock-out of power sources, and safe re-energisation."),
    "mechanical": ("Mechanical / cooling engineer",
                   "Chillers, CRAH/CRAC, pumps, cooling towers and the thermal envelope of the white space."),
    "safety": ("Safety officer",
               "Head count, exclusion zones, PPE and the go / no-go for re-entry."),
    "ops-lead": ("Operations lead",
                 "Technical lead who diagnoses and drives the fix; the subject-matter expert at the keyboard or the switchboard."),
    "change-owner": ("Change owner",
                     "Authored or approved the change, deployment or configuration push that started the event."),
    "service-recovery": ("Service recovery lead",
                         "Restores customer service: failover, workload moves, capacity, backlog drain."),
    "comms": ("Communications lead",
              "Status page, customer notices, regulators and press; one voice, timed updates."),
    "crisis": ("Crisis lead",
               "Executive owner of business continuity: invokes plans, commits money, speaks to authorities."),
    "security": ("Security responder",
                 "Attack traffic, intrusion and access control: filtering, containment, forensics."),
    "utility": ("Utility / grid operator",
                "External owner of the supply: switching at the substation, load shedding, restoration."),
    "vendor": ("Vendor / upstream provider",
               "Third party whose product, service or network sits in the failure path."),
    "customer": ("Customer",
                 "The tenant or service user: their own redundancy, backups and continuity plan."),
    "authority": ("Authority / investigator",
                  "Regulator, investigator or court that establishes cause and obligations after the event."),
}

# Named practice a playbook action may cite. The label is what the page shows; the
# note is the part of that practice the action draws on. No clause numbers: a clause
# reference is a factual claim this library has not verified.
BASIS = {
    "nims-ics": ("NIMS / ICS", "FEMA National Incident Management System — Incident Command System: single command, span of control, unified command with outside agencies"),
    "nfpa-1561": ("NFPA 1561", "Standard on Emergency Services Incident Management System and Command Safety"),
    "nfpa-75": ("NFPA 75", "Standard for the Fire Protection of Information Technology Equipment"),
    "nfpa-76": ("NFPA 76", "Standard for the Fire Protection of Telecommunications Facilities"),
    "nfpa-72": ("NFPA 72", "National Fire Alarm and Signaling Code"),
    "nfpa-855": ("NFPA 855", "Standard for the Installation of Stationary Energy Storage Systems"),
    "nfpa-70e": ("NFPA 70E", "Standard for Electrical Safety in the Workplace — energised work, isolation, lock-out"),
    "nfpa-110": ("NFPA 110", "Standard for Emergency and Standby Power Systems"),
    "en-50110": ("EN 50110-1", "Operation of electrical installations — switching, isolation, safe working"),
    "ashrae-tc99": ("ASHRAE TC 9.9", "Thermal Guidelines for Data Processing Environments — allowable envelopes and excursions"),
    "uptime-os": ("Uptime OS", "Uptime Institute Tier Standard: Operational Sustainability — staffing, procedures, maintenance, drills"),
    "iso-22301": ("ISO 22301", "Business continuity management systems"),
    "iso-27035": ("ISO/IEC 27035", "Information security incident management"),
    "nist-800-61": ("NIST SP 800-61", "Incident response — preparation, detection and analysis, containment, recovery, lessons"),
    "nist-800-34": ("NIST SP 800-34", "Contingency planning for information systems — backup, alternate site, recovery"),
    "sre-incident": ("SRE incident mgmt", "Google SRE: Managing Incidents — incident commander, operations, communications and planning roles; declare early"),
    "itil-incident": ("ITIL 4", "Incident management and major-incident practice"),
    "change-mgmt": ("Change management", "Staged rollout, canary, automated rollback and peer review of changes (ITIL 4 change enablement; SRE release engineering)"),
}

PHASES = ("prevent", "detect", "contain", "recover")
PHASE_LABEL = {"prevent": "Prevent", "detect": "Detect", "contain": "Contain", "recover": "Recover"}
# How a sequence-of-events phase maps onto a response phase.
SOE_TO_PHASE = {"TRIGGER": "detect", "DETECTION": "detect", "MITIGATION": "contain", "IMPACT": "contain",
                "CASCADE": "contain", "RECOVERY": "recover", "RESTORED": "recover"}
EVIDENCE_SOURCES = {"coe", "improvement", "lesson", "factor"}


def esc(s):
    return html.escape(str(s if s is not None else ""), quote=True)


def _phase_of_soe(inc, i):
    soe = inc.get("sequenceOfEvents") or []
    ph = (soe[i].get("phase") or "").upper() if 0 <= i < len(soe) else ""
    return SOE_TO_PHASE.get(ph, "contain")


def validate_response(inc):
    """Every problem with one dossier's response layer, as strings. Empty = valid."""
    errs = []
    r = inc.get("response")
    if r is None:
        return ["no response block"]
    roles = r.get("roles") or {}
    if len(roles) < 3:
        errs.append(f"only {len(roles)} role(s); the floor is 3")
    for k, who in roles.items():
        if k not in ROLES:
            errs.append(f"role '{k}' is not in the vocabulary")
        if not isinstance(who, str) or not who.strip():
            errs.append(f"role '{k}' has no 'who' for this incident")
        elif len(who) > 140:
            errs.append(f"role '{k}': 'who' is {len(who)} chars; keep it under 140")
    soe = inc.get("sequenceOfEvents") or []
    rec = r.get("recorded") or []
    if len(rec) < 3:
        errs.append(f"only {len(rec)} recorded action(s); the floor is 3")
    used = set()
    for n, a in enumerate(rec):
        tag = f"recorded #{n + 1}"
        if a.get("role") not in roles:
            errs.append(f"{tag}: role '{a.get('role')}' is not declared in response.roles")
        i = a.get("soe")
        if not isinstance(i, int) or not 0 <= i < len(soe):
            errs.append(f"{tag}: soe index {i!r} does not exist")
            continue
        q = a.get("quote") or ""
        if not q or q not in (soe[i].get("event") or ""):
            errs.append(f"{tag}: quote not found verbatim in sequence-of-events #{i + 1}")
        did = (a.get("did") or "").strip()
        if not did:
            errs.append(f"{tag}: empty 'did'")
        elif len(did) > 170:
            errs.append(f"{tag}: 'did' is {len(did)} chars; keep it under 170")
        used.add(a.get("role"))
    for m in (inc.get("fmea") or {}).get("modes") or []:
        mid = m.get("id", "?")
        pb = m.get("playbook") or []
        if len(pb) < 4:
            errs.append(f"{mid}: {len(pb)} playbook action(s); the floor is 4")
        if len({p.get("role") for p in pb}) < 3:
            errs.append(f"{mid}: playbook names fewer than 3 roles")
        missing = {"detect", "contain", "recover"} - {p.get("phase") for p in pb}
        if missing:
            errs.append(f"{mid}: playbook has no {', '.join(sorted(missing))} action")
        for p in pb:
            t = f"{mid} playbook '{(p.get('do') or '')[:40]}'"
            if p.get("role") not in roles:
                errs.append(f"{t}: role '{p.get('role')}' is not declared in response.roles")
            if p.get("phase") not in PHASES:
                errs.append(f"{t}: phase '{p.get('phase')}' is not one of {', '.join(PHASES)}")
            do = (p.get("do") or "").strip()
            if not do:
                errs.append(f"{t}: empty 'do'")
            elif len(do) > 200:
                errs.append(f"{t}: 'do' is {len(do)} chars; keep it under 200")
            b, ev = p.get("basis"), p.get("evidence")
            if not b and not ev:
                errs.append(f"{t}: cites neither a basis nor dossier evidence")
            if b and b not in BASIS:
                errs.append(f"{t}: basis '{b}' is not in the BASIS list")
            if ev:
                if ev.get("src") not in EVIDENCE_SOURCES:
                    errs.append(f"{t}: evidence must point at coe / improvement / lesson / factor")
                elif fm.resolve_evidence(inc, ev) is None:
                    errs.append(f"{t}: evidence {ev} does not resolve")
            used.add(p.get("role"))
    for k in roles:
        if k not in used:
            errs.append(f"role '{k}' is declared but neither recorded nor given a playbook action")
    return errs


# ── rendering ────────────────────────────────────────────────────────────────

def _basis_chip(inc, p):
    out = []
    b = p.get("basis")
    if b in BASIS:
        lab, note = BASIS[b]
        out.append(f'<span class="rs-basis" title="{esc(note)}">{esc(lab)}</span>')
    ev = p.get("evidence")
    if ev:
        r = fm.resolve_evidence(inc, ev)
        if r:
            out.append(f'<span class="rs-basis rs-basis-ev" title="{esc(r["text"] or r["quote"])}">{esc(r["label"])}</span>')
    return "".join(out)


def _role_label(k):
    return ROLES[k][0]


def _matrix_html(inc):
    r = inc["response"]
    soe = inc.get("sequenceOfEvents") or []
    cells = {}
    for a in r["recorded"]:
        cells.setdefault((a["role"], _phase_of_soe(inc, a["soe"])), []).append(a)
    head = "".join(f'<div class="rs-mh">{PHASE_LABEL[p]}</div>' for p in ("detect", "contain", "recover"))
    rows = []
    acted = {a["role"] for a in r["recorded"]}
    for k, who in r["roles"].items():
        if k not in acted:
            continue
        tds = []
        for p in ("detect", "contain", "recover"):
            items = sorted(cells.get((k, p), []), key=lambda a: a["soe"])
            if items:
                lis = "".join(
                    f'<li><a href="#soe-{a["soe"] + 1}"><time>{esc(soe[a["soe"]].get("t", ""))}</time></a>{esc(a["did"])}</li>'
                    for a in items)
                tds.append(f'<div class="rs-mc" data-phase="{PHASE_LABEL[p]}"><ul>{lis}</ul></div>')
            else:
                tds.append(f'<div class="rs-mc rs-empty" data-phase="{PHASE_LABEL[p]}"><span>no record</span></div>')
        rows.append(f'<div class="rs-mr"><div class="rs-role"><b>{esc(_role_label(k))}</b><small>{esc(who)}</small></div>{"".join(tds)}</div>')
    return (f'<div class="rs-matrix" role="table" aria-label="Recorded actions by role and phase">'
            f'<div class="rs-mr rs-mhead"><div class="rs-mh">Role</div>{head}</div>{"".join(rows)}</div>')


def _role_panels(inc):
    r = inc["response"]
    soe = inc.get("sequenceOfEvents") or []
    modes = sorted((inc.get("fmea") or {}).get("modes") or [], key=lambda m: -fm.rpn(m))
    tabs, panels = [], []
    for n, (k, who) in enumerate(r["roles"].items()):
        rec = sorted((a for a in r["recorded"] if a["role"] == k), key=lambda a: a["soe"])
        pb = {p: [] for p in PHASES}
        for m in modes:
            for p in m.get("playbook") or []:
                if p["role"] == k:
                    pb[p["phase"]].append((m, p))
        n_pb = sum(len(v) for v in pb.values())
        tabs.append(f'<button type="button" role="tab" id="rs-tab-{k}" aria-controls="rs-p-{k}" '
                    f'aria-selected="{"true" if n == 0 else "false"}" tabindex="{0 if n == 0 else -1}">'
                    f'{esc(_role_label(k))}<span class="rs-tc">{len(rec)}/{n_pb}</span></button>')
        if rec:
            rec_html = "<ol class=\"rs-rec\">" + "".join(
                f'<li><a href="#soe-{a["soe"] + 1}"><time>{esc(soe[a["soe"]].get("t", ""))}</time></a>'
                f'<span>{esc(a["did"])}<q>{esc(a["quote"])}</q></span></li>' for a in rec) + "</ol>"
        else:
            rec_html = '<p class="rs-gap">No action by this role appears in the sources.</p>'
        cols = []
        for ph in PHASES:
            if not pb[ph]:
                continue
            items = "".join(
                f'<li><a class="rs-fm" href="#{esc(m["id"])}">{esc(m["id"])}</a>{esc(p["do"])}{_basis_chip(inc, p)}</li>'
                for m, p in pb[ph])
            cols.append(f'<div class="rs-mp"><span class="rs-mp-ph">{PHASE_LABEL[ph]}</span><ul>{items}</ul></div>')
        panels.append(f"""<section class="rs-panel" role="tabpanel" id="rs-p-{k}" aria-labelledby="rs-tab-{k}"{'' if n == 0 else ' data-rs-hidden'}>
  <p class="rs-who"><b>{esc(who)}</b> — {esc(ROLES[k][1])}</p>
  <h3>On the record</h3>{rec_html}
  <h3>Playbook <small>analyst guidance by failure mode, not a record of what happened</small></h3>
  <div class="rs-modepb rs-rolepb">{"".join(cols)}</div>
</section>""")
    return (f'<div class="rs-roles"><div class="rs-tabs" role="tablist" aria-label="Roles" aria-orientation="vertical">{"".join(tabs)}</div>'
            f'<div class="rs-panels">{"".join(panels)}</div></div>')


def response_section(inc):
    r = inc.get("response")
    if not r:
        return ""
    errs = validate_response(inc)
    if errs:
        import sys
        sys.stderr.write(f"RESPONSE OMITTED for {inc.get('slug')}: " + "; ".join(errs[:6]) + "\n")
        return ""
    modes = (inc.get("fmea") or {}).get("modes") or []
    n_pb = sum(len(m.get("playbook") or []) for m in modes)
    silent = [k for k in r["roles"] if not any(a["role"] == k for a in r["recorded"])]
    silent_txt = ", ".join(_role_label(k) for k in silent) if silent else "none"
    return f"""
        <section class="inc-sec" id="response" aria-labelledby="h-response">
        <h2 id="h-response">Response by role</h2>
        <p class="metabar"><span><b>{len(r["roles"])}</b> roles</span><span class="sep">/</span><span><b>{len(r["recorded"])}</b> recorded actions</span><span class="sep">/</span><span><b>{n_pb}</b> playbook actions across {len(modes)} failure modes</span><span class="sep">/</span><span>no recorded action: <b>{esc(silent_txt)}</b></span></p>
        <h3 class="rs-h">What each role did</h3>
        <p class="rs-cap">Roles the sequence of events shows acting; every entry quotes its source line. Select a time to jump to it.</p>
        {_matrix_html(inc)}
        <h3 class="rs-h">Role by role</h3>
        <p class="rs-cap">Recorded actions / playbook actions per role. A role with 0 recorded actions does not appear in the sources.</p>
        {_role_panels(inc)}
        </section>"""


def mode_playbook_html(inc, m):
    """The 'who acts' block inside one FMEA worksheet row."""
    pb = m.get("playbook") or []
    if not pb or not inc.get("response"):
        return ""
    soe = inc.get("sequenceOfEvents") or []
    cited = {e["i"] for e in m.get("evidence", []) if e.get("src") == "soe"}
    at_time = [a for a in inc["response"]["recorded"] if a["soe"] in cited]
    rows = []
    for ph in PHASES:
        items = [p for p in pb if p["phase"] == ph]
        if not items:
            continue
        lis = "".join(f'<li><b>{esc(_role_label(p["role"]))}</b> {esc(p["do"])}{_basis_chip(inc, p)}</li>' for p in items)
        rows.append(f'<div class="rs-mp"><span class="rs-mp-ph">{PHASE_LABEL[ph]}</span><ul>{lis}</ul></div>')
    rec = ""
    if at_time:
        rec = ('<p class="fm-sub">On the record at this failure</p><ul class="rs-at">' + "".join(
            f'<li><a href="#soe-{a["soe"] + 1}"><time>{esc(soe[a["soe"]].get("t", ""))}</time></a>'
            f'<b>{esc(_role_label(a["role"]))}</b> {esc(a["did"])}</li>'
            for a in sorted(at_time, key=lambda a: a["soe"])) + "</ul>")
    return f'<p class="fm-sub">Who acts — playbook</p><div class="rs-modepb">{"".join(rows)}</div>{rec}'


def soe_roles(inc):
    """soe index -> [role labels] for the role tags on the sequence-of-events list."""
    out = {}
    for a in (inc.get("response") or {}).get("recorded") or []:
        out.setdefault(a["soe"], []).append(_role_label(a["role"]))
    return out


SCRIPT = r"""<script>(function(){
var tl=document.querySelector('.rs-tabs');if(!tl)return;
var tabs=[].slice.call(tl.querySelectorAll('[role=tab]'));
function sel(t,focus){tabs.forEach(function(b){var on=b===t;b.setAttribute('aria-selected',on?'true':'false');b.tabIndex=on?0:-1;
var p=document.getElementById(b.getAttribute('aria-controls'));if(p){if(on)p.removeAttribute('hidden');else p.setAttribute('hidden','');}});if(focus)t.focus();}
document.querySelectorAll('.rs-panel[data-rs-hidden]').forEach(function(p){p.setAttribute('hidden','');});
tabs.forEach(function(b,i){b.addEventListener('click',function(){sel(b);});
b.addEventListener('keydown',function(e){var j=null;if(e.key==='ArrowRight'||e.key==='ArrowDown')j=(i+1)%tabs.length;else if(e.key==='ArrowLeft'||e.key==='ArrowUp')j=(i-1+tabs.length)%tabs.length;else if(e.key==='Home')j=0;else if(e.key==='End')j=tabs.length-1;if(j!==null){e.preventDefault();sel(tabs[j],true);}});});
})();</script>"""


CSS = r"""
    .rs-h { font-size:0.95rem; margin:1.4rem 0 0.2rem; color:var(--text-strong); font-family:'IBM Plex Sans',system-ui,sans-serif; font-weight:600; }
    .rs-cap { color:var(--muted); font-size:0.8rem; margin:0 0 0.6rem; }
    .rs-matrix { border:1px solid var(--line); border-radius:4px; font-size:0.84rem; }
    .rs-mr { display:grid; grid-template-columns:minmax(9rem,1.1fr) repeat(3,minmax(0,2fr)); border-top:1px solid var(--line); }
    .rs-mr:first-child { border-top:0; }
    .rs-mhead { background:var(--surface-2); }
    .rs-mh { font-family:'JetBrains Mono',monospace; font-size:0.68rem; letter-spacing:0.08em; text-transform:uppercase; color:var(--muted); padding:0.5rem 0.7rem; }
    .rs-role { padding:0.6rem 0.7rem; border-right:1px solid var(--line); }
    .rs-role b { display:block; color:var(--text-strong); font-weight:600; }
    .rs-role small { display:block; color:var(--muted); font-size:0.74rem; line-height:1.35; margin-top:0.15rem; }
    .rs-mc { padding:0.55rem 0.7rem; border-right:1px solid var(--line); color:var(--text-body); }
    .rs-mc:last-child { border-right:0; }
    .rs-mc ul { list-style:none; margin:0; padding:0; display:grid; gap:0.45rem; }
    .rs-mc li { line-height:1.4; }
    .rs-mc time, .rs-rec time, .rs-at time { font-family:'JetBrains Mono',monospace; font-size:0.7rem; color:var(--muted); margin-right:0.45rem; white-space:nowrap; }
    .rs-mc a, .rs-rec a, .rs-at a { text-decoration:none; }
    .rs-mc a:hover time, .rs-rec a:hover time, .rs-at a:hover time { color:var(--amber); }
    .rs-empty span { font-family:'JetBrains Mono',monospace; font-size:0.68rem; color:var(--muted); opacity:0.7; }
    .rs-roles { display:grid; grid-template-columns:13.5rem minmax(0,1fr); gap:0 1.4rem; border-top:1px solid var(--line); margin-top:0.3rem; }
    .rs-tabs { display:flex; flex-direction:column; border-right:1px solid var(--line); padding:0.4rem 0; }
    .rs-tabs button { display:flex; justify-content:space-between; align-items:center; gap:0.6rem; text-align:left; background:none; border:0; border-left:2px solid transparent; color:var(--muted); font:500 0.84rem 'IBM Plex Sans',system-ui,sans-serif; padding:0.5rem 0.7rem; cursor:pointer; min-height:44px; }
    .rs-tabs button:hover { color:var(--text-strong); }
    .rs-tabs button[aria-selected=true] { color:var(--text-strong); border-left-color:var(--amber); background:var(--surface-2); }
    .rs-tabs button:focus-visible { outline:1px solid var(--amber); outline-offset:-1px; }
    .rs-tc { font-family:'JetBrains Mono',monospace; font-size:0.68rem; color:var(--muted); font-variant-numeric:tabular-nums; white-space:nowrap; }
    .rs-panel { padding:0.9rem 0 0.2rem; }
    .rs-panel h3 { font:600 0.86rem 'IBM Plex Sans',system-ui,sans-serif; color:var(--text-strong); margin:1rem 0 0.4rem; }
    .rs-panel h3 small { font-weight:400; color:var(--muted); font-size:0.76rem; margin-left:0.4rem; }
    .rs-who { color:var(--text-body); font-size:0.88rem; margin:0; }
    .rs-who b { color:var(--text-strong); font-weight:600; }
    .rs-rec { list-style:none; margin:0; padding:0; display:grid; gap:0.5rem; font-size:0.86rem; }
    .rs-rec li { display:grid; grid-template-columns:6.5rem 1fr; gap:0.6rem; color:var(--text-body); }
    .rs-rec q { display:block; color:var(--muted); font-size:0.78rem; margin-top:0.15rem; quotes:'“' '”'; }
    .rs-gap { color:var(--amber); font-size:0.86rem; margin:0; }
    .rs-phases { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); border:1px solid var(--line); border-radius:4px; }
    .rs-ph { padding:0.6rem 0.7rem; border-right:1px solid var(--line); }
    .rs-ph:last-child { border-right:0; }
    .rs-ph h4 { font-family:'JetBrains Mono',monospace; font-size:0.66rem; letter-spacing:0.08em; text-transform:uppercase; color:var(--muted); margin:0 0 0.45rem; font-weight:500; }
    .rs-ph ul, .rs-modepb ul, .rs-at { list-style:none; margin:0; padding:0; display:grid; gap:0.55rem; font-size:0.82rem; color:var(--text-body); line-height:1.42; }
    .rs-fm { font-family:'JetBrains Mono',monospace; font-size:0.68rem; color:var(--muted); margin-right:0.4rem; text-decoration:none; }
    .rs-fm:hover { color:var(--amber); }
    .rs-none { color:var(--muted); }
    .rs-basis { display:inline-block; font-family:'JetBrains Mono',monospace; font-size:0.62rem; color:var(--muted); border:1px solid var(--line); border-radius:2px; padding:0 0.3rem; margin-left:0.35rem; white-space:nowrap; vertical-align:1px; }
    .rs-basis-ev { color:var(--text-body); }
    .rs-modepb { display:grid; gap:0.5rem; }
    .rs-rolepb { gap:0.8rem; }
    .rs-mp { display:grid; grid-template-columns:5.5rem 1fr; gap:0.6rem; }
    .rs-mp-ph { font-family:'JetBrains Mono',monospace; font-size:0.66rem; letter-spacing:0.08em; text-transform:uppercase; color:var(--muted); padding-top:0.15rem; }
    .rs-modepb b, .rs-at b { color:var(--text-strong); font-weight:600; margin-right:0.3rem; }
    .soe .rs-tag { font-family:'JetBrains Mono',monospace; font-size:0.64rem; color:var(--muted); border:1px solid var(--line); border-radius:2px; padding:0 0.3rem; margin-left:0.35rem; white-space:nowrap; }
    @media (max-width: 900px) {
        .rs-phases { grid-template-columns:repeat(2,minmax(0,1fr)); }
        .rs-ph:nth-child(2) { border-right:0; }
        .rs-ph:nth-child(-n+2) { border-bottom:1px solid var(--line); }
    }
    @media (max-width: 720px) {
        .rs-mhead { display:none; }
        .rs-mr { grid-template-columns:1fr; }
        .rs-role { border-right:0; border-bottom:1px solid var(--line); background:var(--surface-2); }
        .rs-mc { border-right:0; }
        .rs-mc::before { content:attr(data-phase); display:block; font-family:'JetBrains Mono',monospace; font-size:0.62rem; letter-spacing:0.08em; text-transform:uppercase; color:var(--muted); margin-bottom:0.25rem; }
        .rs-empty { display:none; }
        .rs-phases { grid-template-columns:1fr; }
        .rs-ph { border-right:0; border-bottom:1px solid var(--line); }
        .rs-ph:last-child { border-bottom:0; }
        .rs-rec li { grid-template-columns:1fr; gap:0.1rem; }
        .rs-mp { grid-template-columns:1fr; gap:0.2rem; }
        .rs-roles { grid-template-columns:1fr; }
        .rs-tabs { flex-direction:row; overflow-x:auto; border-right:0; border-bottom:1px solid var(--line); padding:0; scrollbar-width:thin; }
        .rs-tabs button { white-space:nowrap; border-left:0; border-bottom:2px solid transparent; }
        .rs-tabs button[aria-selected=true] { border-bottom-color:var(--amber); }
    }
"""


# ── library-wide view (hub) ──────────────────────────────────────────────────

def corpus_section(incidents):
    """What the role layer says across the library. Every number is counted from the
    dossiers; nothing is scored here."""
    done = [x for x in incidents if x.get("response") and not validate_response(x)]
    if not done:
        return ""
    stats = {k: {"dossiers": 0, "rec": 0, "pb": 0, "silent": []} for k in ROLES}
    first_detect = {}
    basis = {}
    for x in done:
        r = x["response"]
        modes = (x.get("fmea") or {}).get("modes") or []
        for k in r["roles"]:
            st = stats[k]
            st["dossiers"] += 1
            n = sum(1 for a in r["recorded"] if a["role"] == k)
            st["rec"] += n
            st["pb"] += sum(1 for m in modes for p in m.get("playbook") or [] if p["role"] == k)
            if n == 0:
                st["silent"].append(x)
        det = sorted((a for a in r["recorded"] if _phase_of_soe(x, a["soe"]) == "detect"), key=lambda a: a["soe"])
        key = det[0]["role"] if det else "_none"
        first_detect.setdefault(key, []).append(x)
        for m in modes:
            for p in m.get("playbook") or []:
                if p.get("basis"):
                    basis[p["basis"]] = basis.get(p["basis"], 0) + 1
    rows = []
    for k, st in sorted(stats.items(), key=lambda kv: (-kv[1]["dossiers"], kv[0])):
        if not st["dossiers"]:
            continue
        sil = len(st["silent"])
        share = round(100 * (st["dossiers"] - sil) / st["dossiers"])
        names = ", ".join(f'<a href="incident-{esc(x["slug"])}.html#response">{esc(x.get("operatorShort") or x.get("operator",""))} {esc(str(x.get("date",""))[:4])}</a>' for x in st["silent"])
        rows.append(f'<tr><th scope="row">{esc(ROLES[k][0])}</th><td>{st["dossiers"]}</td>'
                    f'<td><span class="rc-bar"><i style="width:{share}%"></i></span>{st["dossiers"] - sil} of {st["dossiers"]}</td>'
                    f'<td>{st["rec"]}</td><td>{st["pb"]}</td>'
                    f'<td class="rc-sil">{f"<details><summary>{sil}</summary><p>{names}</p></details>" if sil else "0"}</td></tr>')
    fd = []
    for k, xs in sorted(first_detect.items(), key=lambda kv: -len(kv[1])):
        lab = "No detection by a person or team on the record" if k == "_none" else ROLES[k][0]
        links = ", ".join(f'<a href="incident-{esc(x["slug"])}.html#timeline">{esc(x.get("operatorShort") or x.get("operator",""))} {esc(str(x.get("date",""))[:4])}</a>' for x in xs)
        fd.append(f'<li><details><summary><span>{esc(lab)}</span><b>{len(xs)}</b></summary><p>{links}</p></details></li>')
    bs = "".join(f'<li><span title="{esc(BASIS[k][1])}">{esc(BASIS[k][0])}</span><b>{n}</b></li>'
                 for k, n in sorted(basis.items(), key=lambda kv: -kv[1]))
    n_rec = sum(len(x["response"]["recorded"]) for x in done)
    n_pb = sum(len(m.get("playbook") or []) for x in done for m in (x.get("fmea") or {}).get("modes") or [])
    return f"""
        <section id="roles-corpus" class="rc">
        <h2>Response by role across the library</h2>
        <p class="metabar"><span><b>{len(done)}</b> dossiers</span><span class="sep">/</span><span><b>{n_rec}</b> recorded actions, each quoting its source line</span><span class="sep">/</span><span><b>{n_pb}</b> playbook actions</span></p>
        <p class="rc-cap">Recorded = what the sources show a role doing. A role is "silent" when the dossier declares it but no source line shows it acting — a gap in the record, sometimes in the response.</p>
        <div class="table-wrap"><table class="rc-t"><thead><tr><th>Role</th><th>Dossiers</th><th>Seen acting</th><th>Recorded</th><th>Playbook</th><th>Silent</th></tr></thead><tbody>{"".join(rows)}</tbody></table></div>
        <div class="rc-two">
            <div><h3>Who is first on the record at detection</h3><ul class="rc-list">{"".join(fd)}</ul></div>
            <div><h3>Practice the playbook cites</h3><ul class="rc-list rc-basis">{bs}</ul></div>
        </div>
        </section>"""


CORPUS_CSS = r"""
    .rc { margin-top:2.4rem; }
    .rc-cap { color:var(--muted); font-size:0.82rem; margin:0 0 0.6rem; max-width:80ch; }
    table.rc-t { width:100%; border-collapse:collapse; font-size:0.86rem; font-variant-numeric:tabular-nums; }
    table.rc-t th, table.rc-t td { padding:0.5rem 0.7rem; border-bottom:1px solid var(--line); text-align:left; vertical-align:top; }
    table.rc-t thead th { font-family:'JetBrains Mono',monospace; font-size:0.66rem; letter-spacing:0.08em; text-transform:uppercase; color:var(--muted); font-weight:500; }
    table.rc-t tbody th { color:var(--text-strong); font-weight:600; }
    table.rc-t td { color:var(--text-body); font-family:'JetBrains Mono',monospace; font-size:0.8rem; }
    .rc-bar { display:inline-block; width:64px; height:6px; background:var(--surface-2); margin-right:0.55rem; vertical-align:1px; }
    .rc-bar i { display:block; height:100%; background:var(--amber); }
    .rc-sil details summary { cursor:pointer; color:var(--text-strong); list-style:none; }
    .rc-sil details summary::-webkit-details-marker { display:none; }
    .rc-sil details p, .rc-list details p { font-family:'IBM Plex Sans',system-ui,sans-serif; font-size:0.78rem; color:var(--muted); margin:0.3rem 0 0; line-height:1.5; }
    .rc-sil a, .rc-list a { color:var(--text-body); }
    .rc-two { display:grid; grid-template-columns:1fr 1fr; gap:1.6rem; margin-top:1.4rem; }
    .rc-two h3 { font:600 0.9rem 'IBM Plex Sans',system-ui,sans-serif; color:var(--text-strong); margin:0 0 0.5rem; }
    .rc-list { list-style:none; margin:0; padding:0; border-top:1px solid var(--line); }
    .rc-list > li { border-bottom:1px solid var(--line); font-size:0.84rem; color:var(--text-body); }
    .rc-list summary { display:flex; justify-content:space-between; gap:1rem; padding:0.5rem 0; cursor:pointer; list-style:none; min-height:44px; box-sizing:border-box; align-items:center; }
    .rc-list summary::-webkit-details-marker { display:none; }
    .rc-list details p { padding-bottom:0.6rem; }
    .rc-basis li { display:flex; justify-content:space-between; padding:0.45rem 0; }
    .rc-list b { font-family:'JetBrains Mono',monospace; font-weight:500; color:var(--text-strong); }
    @media (max-width: 720px) { .rc-two { grid-template-columns:1fr; } table.rc-t th:nth-child(5), table.rc-t td:nth-child(5) { display:none; } }
"""
