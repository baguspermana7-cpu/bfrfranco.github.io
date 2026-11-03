"""Page configs of the explorer refit (release R1): cdu-hub, the two compare pages, the Sumatra grid monitor and the
network hub. ai-engineering-maintenance lives in aiem.py (it is a long concept brief with its own figures).

Each main() reads the ORIGINAL page and carries its copy over: cards become rows of a plain table, accordions become
open sections, hero badges and decision cards go. Edits to the copy are listed in COPY (filler words, puffery) so a
reader of this file sees every sentence that changed.
"""
import re

from . import explorer as ex

CRUMB = '<a href="datacenter-solutions.html">DC Solutions</a> → '


def copy(s, pairs):
    for old, new in pairs:
        assert old in s, 'copy anchor missing: ' + old[:70]
        s = s.replace(old, new)
    return s


def lnk(href, label):
    return '<a href="%s">%s</a>' % (href, label)


# ---------------------------------------------------------------- C.07 cdu-hub

def cdu_main(src):
    cards = re.findall(r'<a class="hub-card" href="([^"]+)"[^>]*>.*?<span class="num">(\d+) · ([^<]+)</span>\s*<h2>(.*?)</h2>\s*<p>(.*?)</p>', src, flags=re.S)
    assert len(cards) == 7, len(cards)
    rows = sorted(cards, key=lambda c: int(c[1]))
    kit = [('%s' % c[1], c[2], lnk(c[0], c[3]), c[4]) for c in rows if int(c[1]) <= 5]
    mnt = [('%s' % c[1], c[2], lnk(c[0], c[3]), c[4]) for c in rows if int(c[1]) > 5]
    note = re.search(r'<div class="hub-note">\s*(.*?)\s*</div>', src, flags=re.S).group(1)
    note = copy(note, [('This toolkit is an independent, educational reference built from published vendor datasheets and standards (ASHRAE TC 9.9, OCP, DMTF Redfish) — every figure is source-tagged, and links are validated. Not procurement, safety, or engineering advice.', '')]).strip()
    body = '\n'.join([
        ex.section(1, 'toolkit', 'The toolkit', ex.table(['No.', 'Step', 'Tool', 'What it covers'], kit),
                   lead='Five linked resources, in the order a CDU project uses them.'),
        ex.section(2, 'maintenance', 'Maintenance links', ex.table(['No.', 'Step', 'Tool', 'What it covers'], mnt),
                   lead='Two tools outside the toolkit that share its fault modes (F11.1 to F11.5) and its spares register.'),
        ex.section(3, 'what-is', 'What a CDU does', '  <p class="ck-callout">%s</p>' % note.replace('<b>What is a CDU?</b> ', '')),
    ])
    return '<main id="main-content">\n' + ex.tool_head(
        'Liquid cooling · <b>CDU toolkit</b> · C.07',
        'Coolant distribution unit toolkit <span class="muted">select, operate, visualise, size, compare</span>',
        'Selection, deployment, operation, comparison and sizing of liquid-cooling CDUs for AI/HPC halls, as five linked pages.',
        'basis ASHRAE TC 9.9 · OCP · DMTF Redfish · published vendor datasheets · independent reference, not procurement or engineering advice',
        CRUMB + 'CDU toolkit') + '\n<div class="wrap ck-body">' + body + '\n</div>\n' + ex.reference(
        4, [(ex.manual_href(src), 'Technical manual and methodology'), ('cdu-selection-guide.html', 'CDU selection guide'),
            ('compare-air-vs-liquid-cooling.html', 'Air vs liquid cooling')]) + '\n</main>'


def cdu_scripts(src):
    return ex.keep_scripts(src, r'src="auth\.js')


# ---------------------------------------------------------------- C.08 compare-air-vs-liquid-cooling

AIR_COPY = [
    ('with best-in-class reaching 1.2', 'and the best reach 1.2'),
    ('as liquid-cooled systems are significantly heavier', 'as liquid-cooled systems are heavier'),
    ('The physics are unambiguous: above', 'Above'),
    ('Noise reduction</strong> is an underappreciated benefit of liquid cooling.', 'Noise</strong> falls with liquid cooling.'),
]


def air_main(src):
    src = copy(src, AIR_COPY)
    rows = re.findall(r'<tr><td>([^<]+)</td><td>([^<]+)</td><td>([^<]+)</td><td><span class="winner-icon (a|b)">', src)
    assert len(rows) == 7
    side = ex.table(['Category', 'Air cooling', 'Liquid cooling', 'Edge'], [(a, b, c, 'Air' if w == 'a' else 'Liquid') for a, b, c, w in rows])
    acc = re.findall(r'<div class="accordion-header"><span>(.*?)</span>.*?<div class="accordion-content">\s*(.*?)\s*</div></div>', src, flags=re.S)
    assert len(acc) == 6
    analysis = '\n'.join('  <div class="ex-prose"><h3>%s</h3>\n%s\n  </div>' % (t, ex.clean(b)) for t, b in acc)
    cards = re.findall(r'<div class="decision-card [ab]">\s*<h4>(.*?)</h4>\s*<ul>(.*?)</ul>', src, flags=re.S)
    fit = ex.table(['Stay with air when', 'Move to liquid when'], list(zip(
        re.findall(r'<li>(.*?)</li>', cards[0][1]), re.findall(r'<li>(.*?)</li>', cards[1][1]))))
    faq = re.findall(r'<div class="faq-item"><h3>(.*?)</h3><p>(.*?)</p></div>', src)
    faq_html = '\n'.join('  <div class="ex-prose"><h3>%s</h3>\n    <p>%s</p>\n  </div>' % q for q in faq)
    rel = re.findall(r'<a href="([^"]+)" class="related-card"><h4>(.*?)</h4><p>(.*?)</p></a>', src)
    body = '\n'.join([
        ex.section(1, 'side-by-side', 'Side by side', side, lead='Typical ranges from published vendor and operator figures; a design still needs site numbers.'),
        ex.section(2, 'analysis', 'Analysis', analysis),
        ex.section(3, 'which', 'Which one fits', fit, lead='Match the cooling to the rack density and the remaining life of the building.'),
        ex.section(4, 'faq', 'Questions', faq_html),
        ex.section(5, 'related', 'Related tools', ex.table(['Tool', 'What it does'], [(lnk(h, t), d) for h, t, d in rel])),
    ])
    return '<main id="main-content">\n' + ex.tool_head(
        'Cooling · <b>Compare</b> · C.08',
        'Air cooling vs liquid cooling <span class="muted">CRAH/CRAC against direct-to-chip and immersion</span>',
        'Above about 30 kW per rack, heat removal sets the cooling architecture. Air and liquid compared on density, PUE, cost, operations and water.',
        'basis published vendor and operator ranges · ASHRAE TC 9.9 · OCP · no engine runs on this page',
        CRUMB + 'Air vs liquid cooling') + '\n<div class="wrap ck-body">' + body + '\n</div>\n' + ex.reference(
        6, [(ex.manual_href(src), 'Technical manual and methodology'), ('cdu-hub.html', 'CDU toolkit'),
            ('compare-raised-floor-vs-slab.html', 'Raised floor vs slab')],
        notice='Independent personal research from public sources; it does not represent any current or former employer. '
               '<a href="terms.html">Terms and disclaimer</a>.') + '\n</main>'


# ---------------------------------------------------------------- C.09 compare-raised-floor-vs-slab

FLOOR_COPY = [
    ('Why AI/GPU rack density is driving the slab revolution', 'Why AI/GPU rack density favours the slab'),
    ('For the AI/HPC revolution driving rack densities', 'With rack densities rising'),
    ('Raised floor simply cannot handle', 'Raised floor cannot carry'),
    ('Slab-on-grade construction skips all of these steps.', 'Slab-on-grade skips these steps.'),
]


def floor_main(src):
    src = copy(src, FLOOR_COPY)
    rows = re.findall(r'<tr><td><strong>(.*?)</strong></td><td( class="cmp-winner-cell")?>(.*?)</td><td( class="cmp-winner-cell")?>(.*?)</td></tr>', src)
    assert len(rows) == 7
    quick = ex.table(['Category', 'Raised floor', 'Slab-on-grade', 'Edge'], [(c, a, b, 'Raised floor' if wa else 'Slab') for c, wa, a, wb, b in rows])
    verdict = re.search(r'<div class="cmp-verdict">\s*<h3>.*?Verdict: (.*?)</h3>\s*<p>(.*?)</p>', src, flags=re.S)
    secs = re.findall(r'<h2><span class="cmp-num">(\d+)</span>(.*?)</h2>\s*<div class="cmp-accordion">\s*<button class="cmp-accordion-btn">(.*?) <span class="arrow">.*?<div class="cmp-accordion-content">\s*(.*?)\s*</div></div>', src, flags=re.S)
    assert len(secs) == 5
    helper = re.search(r'<strong>Choose Raised Floor if:</strong>(.*?)<br><br>\s*<strong>Choose Slab-on-Grade if:</strong>(.*?)\s*</p>', src, flags=re.S)
    faq = re.findall(r'<button class="cmp-accordion-btn">([^<]*\?) <span class="arrow">.*?<div class="cmp-accordion-content">\s*(.*?)\s*</div></div>', src, flags=re.S)
    assert len(faq) == 3
    rel = re.findall(r'<a href="([^"]+)" class="cmp-link-card">\s*<h4>(?:<i[^>]*></i>\s*)?(.*?)</h4>\s*<p>(.*?)</p>', src, flags=re.S)
    parts = [ex.section(1, 'quick', 'Quick comparison', quick + '\n  <p class="ck-callout"><b>%s.</b> %s</p>' % (verdict.group(1), verdict.group(2)))]
    for i, (num, title, sub, body) in enumerate(secs):
        parts.append(ex.section(i + 2, 'sec-' + num, title.strip(), '  <div class="ex-prose">\n%s\n  </div>' % ex.clean(body), lead=sub.strip() + '.'))
    parts.append(ex.section(7, 'decide', 'Which one fits', ex.table(['Choose raised floor if', 'Choose slab-on-grade if'], [(helper.group(1).strip(), helper.group(2).strip())])))
    parts.append(ex.section(8, 'faq', 'Questions', '\n'.join('  <div class="ex-prose"><h3>%s</h3>\n    <p>%s</p>\n  </div>' % (q, a.strip()) for q, a in faq)))
    parts.append(ex.section(9, 'related', 'Related tools', ex.table(['Tool', 'What it does'], [(lnk(h, t.strip()), d) for h, t, d in rel])))
    return '<main id="main-content">\n' + ex.tool_head(
        'Building · <b>Compare</b> · C.09',
        'Raised floor vs slab-on-grade <span class="muted">plenum against overhead services</span>',
        'The floor decides airflow, cable routing, structural capacity and construction cost for the life of the building.',
        'basis published cost and load ranges · Uptime Institute · NEC power/data separation · no engine runs on this page',
        CRUMB + 'Raised floor vs slab') + '\n<div class="wrap ck-body">' + '\n'.join(parts) + '\n</div>\n' + ex.reference(
        10, [(ex.manual_href(src), 'Technical manual and methodology'), ('compare-air-vs-liquid-cooling.html', 'Air vs liquid cooling'),
             ('capex-calculator.html', 'CAPEX calculator')]) + '\n</main>'


def floor_scripts(src):
    """script.min.js (the homepage script: hero, ticker, bento, scroll-top) and the accordion script go: nothing on
    the refit page uses them. auth.js stays."""
    return ex.keep_scripts(src, r'src="auth\.js')


# ---------------------------------------------------------------- G.02 pln-sumatra-grid

SG_INIT = '''<script>
    /* Sumatra grid: the curated dataset on a Leaflet map, the totals as a fact list and the atlas table.
       Map marks: plants amber, substations and data centres in two greys, 275 kV backbone heavy, Batam island dashed. */
    (function(){
        function init(){
            var G = window.PLN_SUMATRA_GRID;
            if(!window.L || !G){ return; }
            var byId = {}; G.nodes.forEach(function(n){ byId[n.id]=n; });
            var subs=0, plants=0, dcs=0, genMW=0, kv275=0, batamMW=0, medcoMW=0;
            G.nodes.forEach(function(n){
                if(n.kind==='station'){ subs++; if(n.voltage===275) kv275++; }
                else if(n.kind==='plant'){ plants++; genMW += (n.mw||0); if(n.island) batamMW += (n.mw||0); if(n.operator==='Medco') medcoMW += (n.mw||0); }
                else if(n.kind==='dc'){ dcs++; }
            });
            var stats = [
                {v:subs, l:'Substations', s:'GI and GITET nodes mapped'}, {v:kv275, l:'275 kV nodes', s:'on the north-south backbone'},
                {v:plants, l:'Power plants', s:'coal, gas and hydro'}, {v:Math.round(genMW).toLocaleString(), u:'MW', l:'Mapped generation', s:'sum of plant ratings in the dataset'},
                {v:Math.round(batamMW).toLocaleString(), u:'MW', l:'Batam island generation', s:'not tied to the mainland grid'},
                {v:Math.round(medcoMW).toLocaleString(), u:'MW', l:'Medco-operated', s:'Panaran gas plants and others'}
            ];
            document.getElementById('sgStats').innerHTML = stats.map(function(s){ return '<div class="sg-row"><span class="sg-label">'+s.l+'</span><span class="sg-value">'+s.v+(s.u?'<small>'+s.u+'</small>':'')+'</span><span class="sg-note">'+s.s+'</span></div>'; }).join('');
            var ver = document.getElementById('sgVersion');
            if(ver) ver.textContent = G.version;
            var map = L.map('sgMap', { scrollWheelZoom:false }).setView([-0.5, 102.5], 5);
            // CARTO keyless tiles now return "API KEY REQUIRED"; Esri Canvas light gray is keyless.
            L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
                attribution:'Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors', maxNativeZoom:16, maxZoom:18
            }).addTo(map);
            function edgeStyle(e){
                if(e.island) return { color:'#4A5160', weight:2, opacity:.9, dashArray:'5 4' };
                if(e.voltage===275) return { color:'#2B2F36', weight:4, opacity:.9 };
                if(e.voltage===150) return { color:'#5E6673', weight:2, opacity:.85 };
                return { color:'#7D8794', weight:1.5, opacity:.8, dashArray:'2 3' };
            }
            G.edges.forEach(function(e){
                var a=byId[e.from], b=byId[e.to]; if(!a||!b) return;
                L.polyline([[a.lat,a.lng],[b.lat,b.lng]], edgeStyle(e)).addTo(map);
            });
            function nodeColor(n){
                if(n.kind==='plant') return '#D49A2A';
                if(n.kind==='dc') return '#1a1d23';
                return n.voltage===275?'#2B2F36':'#5E6673';
            }
            G.nodes.forEach(function(n){
                var cap = n.kind==='plant' ? (n.mw?n.mw+' MW':'') : (n.mva?n.mva+' MVA':(n.mw?n.mw+' MW':''));
                var html = '<b>'+n.name+'</b><br>'+(n.kind==='plant'?('Plant'+(n.fuel?' · '+n.fuel:'')):(n.kind==='dc'?'Data center':n.voltage+' kV substation'))
                    +(cap?(' · '+cap):'')+(n.operator?('<br>Operator: '+n.operator):'')+'<br>'+(n.prov||'')
                    +(n.notes?('<br><span class="sg-pop-note">'+n.notes+'</span>'):'')+'<br><span class="sg-pop-note">confidence: '+(n.confidence||'n/a')+'</span>';
                L.circleMarker([n.lat,n.lng], {
                    radius: n.kind==='plant'? Math.max(5,Math.min(12,Math.sqrt((n.mw||50))/2)) : (n.voltage===275?7:5),
                    fillColor: nodeColor(n), color:'#fff', weight:1, fillOpacity:.9
                }).addTo(map).bindPopup(html);
            });
            map.on('click', function(){ if(!map.scrollWheelZoomEnabled()){ map.scrollWheelZoom.enable(); } });
            var rows = G.nodes.slice().sort(function(a,b){ return (a.prov||'').localeCompare(b.prov||''); }).map(function(n){
                var type = n.kind==='plant'?'Plant'+(n.fuel?', '+n.fuel:''):(n.kind==='dc'?'Data center':'Substation');
                var cap = n.kind==='plant'?(n.mw?n.mw+' MW':'—'):(n.mva?n.mva+' MVA':'—');
                var tags = (n.operator==='Medco'?' · Medco':'')+(n.island?' · Batam':'');
                return '<tr><td><b>'+n.name+'</b>'+(tags?'<span class="sg-tags">'+tags+'</span>':'')+'</td><td>'+type+'</td><td class="num">'+(n.voltage||'—')+'</td><td class="num">'+cap+'</td><td>'+(n.prov||'—')+'</td><td class="sg-notes">'+(n.notes||'')+'</td></tr>';
            }).join('');
            document.querySelector('#sgTbl tbody').innerHTML = rows;
        }
        if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded', function(){ setTimeout(init, 60); }); } else { setTimeout(init, 60); }
    })();
    </script>'''


def sg_main(src):
    note = re.search(r'<div class="sg-note">(.*?)</div>', src).group(1)
    note = copy(note, [(" as a fast-growing, Singapore-adjacent AI/edge load", ", a Singapore-adjacent AI/edge load")])
    legend = ('<p class="ex-legend"><span><i class="k-line k-275"></i>275 kV backbone</span><span><i class="k-line k-150"></i>150 kV</span>'
              '<span><i class="k-line k-isl"></i>Batam island (separate grid)</span><span><i class="k-dot k-sub"></i>Substation</span>'
              '<span><i class="k-dot k-plant"></i>Plant</span><span><i class="k-dot k-dc"></i>Data center</span></p>')
    # the dataset header (js/pln-sumatra-grid-data.js): sources and version, quoted; the version is re-read from the data at load
    src_line = ('Source: RUPTL 2025-2034 / PLN AR 2024 / public sources. Coordinates approximate; not an operational topology. '
                'Dataset version <span id="sgVersion">2026-06-26</span>.')
    body = '\n'.join([
        ex.section(1, 'map', 'Grid map', '''  <figure class="fig ex-map">
    <div id="sgMap" aria-label="Interactive map of the PLN Sumatra grid"></div>
    %s
    <figcaption><b>FIG. 1</b> <span id="sgSource">%s</span></figcaption>
  </figure>''' % (legend, src_line), lead='Click the map to enable scroll zoom; click a mark for its rating, operator and confidence.'),
        ex.section(2, 'totals', 'What the dataset holds', '  <div class="ex-facts" id="sgStats" data-rz-fact-list></div>\n  <p class="ck-callout">%s</p>' % note),
        ex.section(3, 'atlas', 'Substation and plant atlas',
                   '  <div class="ck-tbl-wrap"><table class="ck-tbl" id="sgTbl"><thead><tr><th scope="col">Node</th><th scope="col">Type</th><th scope="col">kV</th>'
                   '<th scope="col">Capacity</th><th scope="col">Region</th><th scope="col">Notes</th></tr></thead><tbody></tbody></table></div>',
                   lead='Sorted by province. Capacity is MW for plants and MVA for substations.'),
    ])
    return '<main id="main-content">\n' + ex.tool_head(
        'Grid monitors · <b>Sumatra</b> · G.02',
        'PLN Sumatra interconnected grid <span class="muted">and the Batam island system</span>',
        'The Sumatra 275/150 kV system, a north-south backbone from Aceh through Medan, Pekanbaru and Palembang to Lampung, '
        'plus the separate Batam-Bintan (Barelang) island grid run by PLN Batam, where Medco Power operates the Panaran gas plants.',
        'source RUPTL 2025-2034 / PLN AR 2024 / public sources · dataset version 2026-06-26 · coordinates approximate; not an operational topology',
        CRUMB + '<a href="pln-java-grid.html">Java-Bali grid</a> → Sumatra grid') + '\n<div class="wrap ck-body">' + body + '\n</div>\n' + ex.reference(
        4, [(ex.manual_href(src), 'Technical manual and methodology'), ('pln-java-grid.html', 'Java-Bali grid monitor'),
            ('js/pln-sumatra-grid-data.js', 'The dataset (JavaScript, with sources)')]) + '\n</main>'


def sg_scripts(src):
    return SG_INIT + '\n' + ex.keep_scripts(src, r'src="auth\.js')


# ---------------------------------------------------------------- L.03 network-visualization-hub

NET_COPY = [
    (" The protocols that run your building when nobody's looking.", ''),
    (' but most CompTIA courses gloss past.', '.'),
    (' The handshakes that wrap modern traffic.', ''),
]


def net_main(src):
    src = copy(src, NET_COPY)
    lanes = re.findall(r'<div class="nh-lane">\s*<h2>(.*?) <span class="lane-tag">Lane ([A-E]) · (\d+) topics</span></h2>\s*<p class="lane-desc">(.*?)</p>\s*<div class="nh-grid">(.*?)</div>\s*</div>', src, flags=re.S)
    assert len(lanes) == 5
    parts, total = [], 0
    for i, (name, lane, n, desc, grid) in enumerate(sorted(lanes, key=lambda l: l[1])):
        cards = re.findall(r'<a class="nh-card" href="([^"]+)">\s*<div class="nh-card-title">(.*?) <span class="nh-status live">LIVE</span></div>\s*<div class="nh-card-desc">(.*?)</div>', grid, flags=re.S)
        assert len(cards) == int(n), (name, len(cards), n)
        total += len(cards)
        parts.append(ex.section(i + 1, 'lane-' + lane.lower(), '%s <span class="muted">lane %s · %s topics</span>' % (name, lane, n),
                                ex.table(['Protocol', 'What the animation shows'], [(lnk(h, t), d) for h, t, d in cards]), lead=desc))
    assert total == 25
    parts.append(ex.section(6, 'compare', 'Compare mode', ex.table(['Tool', 'What it does'], [(
        lnk('network-compare.html', 'Compare mode'),
        'Four panels side by side with a normalised strip per protocol (throughput, latency, overhead, status). All four lane B protocols are available.')])))
    return '<main id="main-content">\n' + ex.tool_head(
        'Knowledge labs · <b>Network</b> · L.03',
        'Network visualization hub <span class="muted">25 protocol labs in five lanes</span>',
        'Animated, parameter-driven labs for industrial and IT communication protocols, from Modbus RTU on RS-485 to MCP tool calls between AI agents.',
        'Canvas 2D + Web Audio · CompTIA Network+ N10-009 and Security+ SY0-701 aligned · all 25 labs live · free',
        CRUMB + '<a href="datacenter-solutions.html#knowledge-labs">Knowledge labs</a> → Network hub') + '\n<div class="wrap ck-body">' + '\n'.join(parts) + '\n</div>\n' + ex.reference(
        7, [(ex.manual_href(src), 'Technical manual and methodology'), ('tools.html', 'All tools')]) + '\n</main>'


def net_scripts(src):
    """the version stamp lives in the hub footer (#rz-version-stamp, filled by js/rz-version.js); the page's own
    #versionStamp writer goes with the old footer"""
    return ex.keep_scripts(src, r'src="js/rz-version\.js', r'src="js/rz-mobile-nav\.js', r'src="js/rz-cookie-consent\.js')


CONFIG = {
    'cdu-hub.html': {'key': 'cdu-hub', 'main': cdu_main, 'scripts': cdu_scripts},
    'compare-air-vs-liquid-cooling.html': {'key': 'compare-air', 'main': air_main, 'scripts': cdu_scripts},
    'compare-raised-floor-vs-slab.html': {'key': 'compare-floor', 'main': floor_main, 'scripts': floor_scripts},
    'pln-sumatra-grid.html': {'key': 'pln-sumatra', 'main': sg_main, 'scripts': sg_scripts},
    'network-visualization-hub.html': {'key': 'network-hub', 'main': net_main, 'scripts': net_scripts},
}
