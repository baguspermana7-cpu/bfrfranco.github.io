"""L.04 ai-engineering-maintenance on the explorer shell. A locked concept brief: the hero, summary tiles, sticky
pill bar, card sections and SVG figures are carried over; the chrome around them changes.

  head        eyebrow / H1 / one lede / the paper citation as the basis line / crumb
  locked      body.locked shows the sign-in notice IN FLOW under the head (.root-gate, #rootLoginBtn kept); the brief
              itself is not drawn (never blurred behind a fixed glass overlay, as before)
  bar         the 9 section pills become .tool-bar chips (class nav-pill kept: the scroll-spy targets it)
  sections    numbered .ck-sec; intro -> lead; the case-study KPI tiles and the knowledge-base metrics -> fact lists;
              tables -> .ck-tbl in an overflow wrapper; cards keep their classes (css/rz-explorer.css draws them as
              hairline panels)
  figures     SVG classes re-pointed in css/rz-explorer.css: knowledge path amber, data path and output graphite;
              the one figure that marks a safety net in fault red declares [data-rz-series-meaning]
  footer      citation, related links and the "concept document" note -> .tool-ref; the hub footer replaces the rest
"""
import re

from . import explorer as ex


def _sections(src):
    a = src.index('<!-- ════════════════════════════════════════ SECTION 1')
    b = src.index('<div class="rz-manual-link"')
    body = src[a:b]
    body = re.sub(r'\s*<!-- ═+[^>]*-->', '', body)
    return body.strip()


def _legend(m):
    keymap = {'--amber': 'k-amber', '--cyan': 'k-grey', '--green': 'k-dash', '--red': 'k-red', '--line': 'k-line'}
    return '<i class="%s"></i>' % keymap[m.group(1)]


def _number_sections(body):
    n = [1]

    def h2(m):
        n[0] += 1
        return '<section class="ck-sec ex-sec" id="%s" data-nav-id="%s">\n            <h2><span class="n">%02d</span> %s</h2>' % (
            m.group(1), m.group(2), n[0], m.group(3).strip())
    return re.sub(r'<section class="section" id="([^"]+)" data-nav-id="([^"]+)">\s*<h2>(?:<i[^>]*></i>\s*)?(.*?)</h2>', h2, body, flags=re.S)


def main(src):
    body = _sections(src)
    body = re.sub(r'<i style="background:var\((--[a-z]+)\);"></i>', _legend, body)
    body = body.replace('Case-Study Numbers &mdash; What the Paper Actually Reports', 'Case-Study Numbers &mdash; What the Paper Reports')
    body = _number_sections(body)
    body = body.replace('<p class="intro"', '<p class="lead"')
    # fact lists: KPI tiles (case study) and the knowledge-base metrics
    body = body.replace('<div class="kpi-row">', '<div class="ex-facts" data-rz-fact-list>')
    body = re.sub(r'<div class="kpi [a-z]+">', '<div class="ex-fact">', body)
    body = body.replace('class="kl"', 'class="f-label"').replace('class="kv"', 'class="f-value"').replace('class="ks"', 'class="f-note"')
    body = re.sub(r'<div class="metric-grid"[^>]*>', '<div class="ex-facts" data-rz-fact-list>', body)
    body = body.replace('<div class="metric">', '<div class="ex-fact">').replace('class="m-val"', 'class="f-value"').replace('class="m-lbl"', 'class="f-note"')
    # tables
    body = body.replace('<div class="table-wrap">\n                <table class="data-table">', '<div class="ck-tbl-wrap">\n                <table class="ck-tbl data-table">')
    body = re.sub(r'<table class="kb-table"[^>]*>(.*?)</table>', r'<div class="ck-tbl-wrap"><table class="ck-tbl kb-table">\1</table></div>', body, flags=re.S)
    # disclosure chevrons: the native summary marker carries it
    body = re.sub(r'\s*<span class="gap-chev">.*?</span>', '', body, flags=re.S)
    # the enhanced-engine figure marks its safety net in fault red: that hue carries meaning
    body = body.replace('<div class="big-diagram"', '<div class="big-diagram ex-figure"')
    sec6 = body.index('id="sec-enhanced"')
    i = body.index('<div class="big-diagram ex-figure"', sec6)
    body = body[:i] + '<div data-rz-series-meaning="safety net in fault red" class="big-diagram ex-figure"' + body[i + len('<div class="big-diagram ex-figure"'):]
    body = body.replace('fill="#6aa588"', 'fill="#7D8794"')  # the green arrow head: output path is graphite now
    body = ex.clean(body)

    hero = src[src.index('<section class="hero"'):src.index('</section>', src.index('<section class="hero"'))]
    banner = re.search(r'<strong[^>]*>(?:<i[^>]*></i>\s*)?(This is a concept-and-design document, not a production product\.)</strong>\s*(.*?)\s*</div>', hero, flags=re.S)
    tiles = re.findall(r'<div class="sum-tile[^"]*"><div class="num">(.*?)</div><div class="ttl">(.*?)</div><div class="dsc">(.*?)</div></div>', hero)
    assert len(tiles) == 4 and banner
    concept = ex.section(1, 'sec-concept', 'Concept', '  <p class="ck-callout"><b>%s</b> %s</p>\n%s' % (
        banner.group(1), ex.clean(banner.group(2)), ex.table(['Module', 'Name', 'What it does'], [(t[0].title(), t[1], t[2]) for t in tiles])),
        lead='A prescriptive maintenance advisor that joins FMECA documentation (IEC 60812), a Neo4j knowledge graph, a Random Forest + PCA '
             'classifier and a rule-based NLP layer (Aho-Corasick). Two ways in: ask in natural language (by API), or upload sensor data and '
             'let the engine diagnose (by engine).')
    pills = re.findall(r'<a class="nav-pill[^"]*" href="(#[^"]+)">(.*?)</a>', src)
    assert len(pills) == 9
    bar = '<div class="wrap">\n  <nav class="tool-bar ck-jump" aria-label="On this page">\n    <span class="lbl">Jump to</span>\n    %s\n  </nav>\n</div>' % ''.join(
        '<a class="chip nav-pill" href="%s">%s</a>' % p for p in pills)
    gate = re.search(r'<div class="root-gate">(.*?)</div>\s*</div>\s*</div>', src, flags=re.S).group(1)
    gate = ex.clean(gate).replace('<div class="root-card">', '<div class="root-card ck-callout">')
    gate = gate.replace('<button id="rootLoginBtn">', '<button class="tool-btn is-primary" id="rootLoginBtn" type="button">')
    gate = gate.replace('<a href="datacenter-solutions.html">Back to DC Solutions</a>', '<a class="tool-btn" href="datacenter-solutions.html">Back to DC Solutions</a>')

    return '<main id="main-content">\n' + ex.tool_head(
        'Labs · <b>Concept brief</b> · L.04',
        'AI engineering maintenance <span class="muted">an intelligent advisor system, as a concept</span>',
        'A design brief for a maintenance advisor built on FMECA, a knowledge graph and machine learning: the paper it starts from, '
        'twelve engineering gaps with a proposed fix each, a phased roadmap and a worldwide FMECA seed dataset.',
        'source Lin, H. &amp; Ompusunggu, A. P. (2026), Artificial Intelligence for Engineering, DOI '
        '<a href="https://doi.org/10.1049/aie2.70019" target="_blank" rel="noopener">10.1049/aie2.70019</a> · '
        'dataset Cranfield <a href="https://doi.org/10.17862/cranfield.rd.5097649" target="_blank" rel="noopener">10.17862/cranfield.rd.5097649</a> · '
        'Full access or Educator',
        '<a href="datacenter-solutions.html">DC Solutions</a> → <a href="datacenter-solutions.html#knowledge-labs">Labs</a> → AI engineering maintenance') + '''
<div class="wrap">
  <div class="root-gate">%s
      </div>
    </div>
  </div>
</div>
<div class="ex-locked">
%s
<div class="wrap ck-body">
%s
%s
</div>
%s
</div>
</main>''' % (gate, bar, concept, body, ex.reference(
        11, [(ex.manual_href(src), 'Technical manual and methodology'), ('spares-readiness-calculator.html', 'Spares readiness calculator'),
             ('cdu-hub.html', 'CDU toolkit'), ('datahallAI.html', 'AI data hall cockpit'), ('chiller-plant.html', 'Chiller plant cockpit')],
        notice='A concept-and-design document. Metrics are quoted from the source paper; architecture proposals are advisory. '
               'Dataset: Cranfield University linear actuator degradation.',
        against=['IEC 60812', 'Neo4j / Cypher', 'scikit-learn RF + PCA', 'Aho-Corasick NLP']))


def scripts(src):
    inline = re.search(r'<script>\s*/\* Theme toggle \*/(.*?)</script>', src, flags=re.S).group(1)
    keep = [l for l in inline.split('\n') if l.strip()]
    out, take = [], False
    for line in keep:
        if line.strip().startswith('/*'):
            take = ('Page-access tier gate' in line) or ('Section nav scroll-spy' in line)
        if take:
            out.append(line)
    assert len(out) == 4, out
    return ex.keep_scripts(src, r'src="js/rz-feature-flags\.js', r'src="auth\.js') + '\n    <script>\n' + '\n'.join(out) + '\n    </script>'


CONFIG = {'ai-engineering-maintenance.html': {'key': 'aiem', 'main': main, 'scripts': scripts, 'body_extra': ['locked']}}
