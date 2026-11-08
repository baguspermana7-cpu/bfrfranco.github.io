"""Explorer refit configs for the eight compare-* pages that were still on the old templates (R085, v3.28.2).

Two source templates:
  cmp      (diesel/gas, online/offline UPS, wet/pre-action, N+1/2N): quick table with winner cells, a verdict box,
           numbered accordion sections, a "Decision Helper" paragraph, FAQ accordions and link cards.
           Same template as compare-raised-floor-vs-slab (explorer_pages.floor_main); this is that function made generic.
  accordion (PUE/DCiE, FM-200/Novec, ASHRAE/Uptime, Tier III/IV): see acc_main.

Each main() reads the ORIGINAL page and carries its copy over. The winner cell (a green fill + left rail) becomes a
word in an "Edge" column; accordions become open sections; the verdict is a callout; link cards a plain table.
Edits to copy are listed per page in COPY so every changed sentence is visible here.
"""
import re

from . import explorer as ex
from .explorer_pages import CRUMB, copy, lnk


def _cells(row):
    return re.findall(r'<td( class="cmp-winner-cell")?>(.*?)</td>', row, flags=re.S)


def cmp_quick(src):
    heads = re.findall(r'<th scope="col">(.*?)</th>', re.search(r'<table class="cmp-table">\s*<thead>(.*?)</thead>', src, flags=re.S).group(1))
    assert len(heads) == 3, heads
    body = re.search(r'<table class="cmp-table">.*?<tbody>(.*?)</tbody>', src, flags=re.S).group(1)
    rows = []
    for tr in re.findall(r'<tr>(.*?)</tr>', body, flags=re.S):
        cat = re.search(r'<td><strong>(.*?)</strong></td>', tr).group(1)
        cells = _cells(tr)[1:]
        assert len(cells) == 2, tr[:80]
        (wa, a), (wb, b) = cells
        edge = heads[1] if wa and not wb else heads[2] if wb and not wa else 'even'
        rows.append((cat, a, b, edge))
    return ex.table([heads[0], heads[1], heads[2], 'Edge'], rows), heads


def cmp_main(src, c):
    src = copy(src, c.get('copy', []))
    quick, heads = cmp_quick(src)
    v = re.search(r'<div class="cmp-verdict">\s*<h3>.*?Verdict: (.*?)</h3>\s*<p>(.*?)</p>', src, flags=re.S)
    secs = re.findall(r'<h2><span class="cmp-num">(\d+)</span>(.*?)</h2>\s*<div class="cmp-accordion">\s*<button class="cmp-accordion-btn">(.*?) <span class="arrow">.*?<div class="cmp-accordion-content">\s*(.*?)\s*</div></div>', src, flags=re.S)
    assert len(secs) == c['secs'], len(secs)
    helper = re.search(r'Decision Helper</h2>\s*<div[^>]*>\s*<p[^>]*>(.*?)</p>', src, flags=re.S).group(1)
    choices = re.findall(r'<strong>((?:Choose|Consider) [^<]*?):?</strong>\s*(.*?)(?:<br><br>|$)', helper.strip(), flags=re.S)
    assert len(choices) >= 2, choices
    faq_src = src[src.index('<div class="cmp-faq">'):]
    faq = re.findall(r'<button class="cmp-accordion-btn">([^<]*\?) <span class="arrow">.*?<div class="cmp-accordion-content">\s*(.*?)\s*</div></div>', faq_src, flags=re.S)
    assert len(faq) == c['faq'], len(faq)
    rel = re.findall(r'<a href="([^"]+)" class="cmp-link-card">\s*<h4>(?:<i[^>]*></i>\s*)?(.*?)</h4>\s*<p>(.*?)</p>', src, flags=re.S)
    assert len(rel) >= 2, rel
    n = 1
    parts = [ex.section(n, 'quick', 'Quick comparison', quick + '\n  <p class="ck-callout"><b>%s.</b> %s</p>' % (v.group(1).strip().rstrip('.'), v.group(2).strip()))]
    if c.get('calc'):
        n += 1
        parts.append(ex.section(n, 'calc', c['calc']['title'], c['calc']['html'], lead=c['calc']['lead']))
    for num, title, sub, body in secs:
        n += 1
        parts.append(ex.section(n, 'sec-' + num, title.strip(), '  <div class="ex-prose">\n%s\n  </div>' % ex.clean(body), lead=sub.strip() + '.'))
    n += 1
    parts.append(ex.section(n, 'decide', 'Which one fits', ex.table(['When', 'Conditions'], [(w.strip(), t.strip()) for w, t in choices])))
    n += 1
    parts.append(ex.section(n, 'faq', 'Questions', '\n'.join('  <div class="ex-prose"><h3>%s</h3>\n    <p>%s</p>\n  </div>' % (q, ex.clean(a.strip())) for q, a in faq)))
    n += 1
    parts.append(ex.section(n, 'related', 'Related tools', ex.table(['Tool', 'What it does'], [(lnk(h, t.strip()), d.strip()) for h, t, d in rel])))
    return '<main id="main-content">\n' + ex.tool_head(c['eyebrow'], c['h1'], c['lede'], c['basis'], CRUMB + c['crumb']) + \
        '\n<div class="wrap ck-body">' + '\n'.join(parts) + '\n</div>\n' + ex.reference(n + 1, c['links']) + '\n</main>'


def auth_only(src):
    return ex.keep_scripts(src, r'src="auth\.js')


# ---------------------------------------------------------------- N+1 vs 2N: the unit counter keeps its ids
N1_CALC = '''  <div class="ck-calc">
    <label class="ck-calc-in" for="calcN"><span>Required capacity units (N)</span>
      <input type="number" id="calcN" value="4" min="1" max="100" inputmode="numeric"></label>
    <div class="ck-facts" data-rz-fact-list>
      <div><span class="calc-label">N+1 total</span><span class="calc-value"><span id="calcN1">5</span><small>units</small></span><span class="calc-result-sub">1 spare unit (25% premium)</span></div>
      <div><span class="calc-label">2N total</span><span class="calc-value"><span id="calc2N">8</span><small>units</small></span><span class="calc-result-sub">Full path duplication (100% premium)</span></div>
    </div>
  </div>'''
N1_SCRIPT = '''<script>
/* N+1 vs 2N unit counter (ids carried over from the old page) */
(function(){
  var input=document.getElementById('calcN'), n1El=document.getElementById('calcN1'), twoNEl=document.getElementById('calc2N');
  if(!input||!n1El||!twoNEl) return;
  function update(){
    var n=parseInt(input.value,10)||1; if(n<1)n=1; if(n>100)n=100;
    n1El.textContent=n+1; twoNEl.textContent=n*2;
    n1El.closest('[data-rz-fact-list] > div').querySelector('.calc-result-sub').textContent='1 spare unit ('+Math.round(100/n)+'% premium)';
  }
  input.addEventListener('input',update); update();
})();
</script>'''


def n1_scripts(src):
    return N1_SCRIPT + '\n' + auth_only(src)


BASIS_NOTE = 'published vendor, operator and standards figures · no engine runs on this page'

CMP = {
    'compare-diesel-vs-gas-generator.html': dict(
        key='compare-gen', secs=7, faq=4,
        copy=[('Air quality permits are significantly easier', 'Air quality permits are easier'), ('Yes, significantly. Natural gas', 'Yes. Natural gas')],
        eyebrow='Power · <b>Compare</b> · generators',
        h1='Diesel vs natural gas generators <span class="muted">standby power for data centres</span>',
        lede='Fuel decides start time, on-site storage, emissions and cost of standby power. Diesel and natural gas compared on the points that set a data-centre design.',
        basis='basis NFPA 110 · ISO 8528 · EPA Tier 4 · ' + BASIS_NOTE, crumb='Diesel vs gas generators',
        links=[('pillar-power.html', 'Power infrastructure'), ('fuel-system.html', 'Fuel system cockpit'), ('capex-calculator.html', 'CAPEX calculator')]),
    'compare-ups-online-vs-offline.html': dict(
        key='compare-ups', secs=7, faq=4,
        eyebrow='Power · <b>Compare</b> · UPS topology',
        h1='Online vs offline UPS <span class="muted">double conversion against standby</span>',
        lede='The UPS topology decides whether the load rides through a power event or sees a transfer gap. Double-conversion and standby compared.',
        basis='basis IEC 62040-3 (VFI / VI / VFD) · Uptime Institute · TIA-942 · ' + BASIS_NOTE, crumb='Online vs offline UPS',
        links=[('pillar-power.html', 'Power infrastructure'), ('compare-n1-vs-2n.html', 'N+1 vs 2N'), ('capex-calculator.html', 'CAPEX calculator')]),
    'compare-wet-vs-preaction.html': dict(
        key='compare-sprinkler', secs=6, faq=3,
        copy=[('Comprehensive analysis of NFPA 75/76', 'Analysis of NFPA 75/76')],
        eyebrow='Fire · <b>Compare</b> · sprinklers',
        h1='Wet pipe vs pre-action sprinklers <span class="muted">water in the pipe against a double interlock</span>',
        lede='Over IT equipment the sprinkler type decides what an accidental discharge costs. Wet pipe and pre-action compared.',
        basis='basis NFPA 13 · NFPA 75 · FM Global DS 5-32 · ' + BASIS_NOTE, crumb='Wet pipe vs pre-action',
        links=[('pillar-fire-safety.html', 'Fire safety'), ('fire-calculator.html', 'Fire calculator'), ('compare-fm200-vs-novec.html', 'FM-200 vs Novec 1230')]),
    'compare-n1-vs-2n.html': dict(
        key='compare-redundancy', secs=7, faq=4,
        copy=[('<strong>Capital Cost Full access</strong>', '<strong>Capital Cost</strong>')],  # stray gate label from an old sweep
        eyebrow='Power · <b>Compare</b> · redundancy',
        h1='N+1 vs 2N redundancy <span class="muted">one spare against a second path</span>',
        lede='Redundancy sets availability, maintainability and cost. N+1 and 2N compared, with a unit counter for your own N.',
        basis='basis Uptime Institute Tier Standard · TIA-942 · ' + BASIS_NOTE, crumb='N+1 vs 2N',
        calc=dict(title='Unit counter', lead='Enter the capacity units the load needs (N); the totals follow.', html=N1_CALC),
        links=[('tier-advisor.html', 'Tier advisor'), ('compare-tier-3-vs-tier-4.html', 'Tier III vs Tier IV'), ('compare-ups-online-vs-offline.html', 'Online vs offline UPS')]),
}

CONFIG = {}
for page, c in CMP.items():
    CONFIG[page] = {'key': c['key'], 'main': (lambda src, c=c: cmp_main(src, c)),
                    'scripts': n1_scripts if c.get('calc') else auth_only}


# ---------------------------------------------------------------- accordion template (PUE/DCiE, FM-200/Novec, ASHRAE/Uptime, Tier III/IV)
# Same template as compare-air-vs-liquid-cooling (explorer_pages.air_main); this is that function made generic.

def acc_main(src, c):
    src = copy(src, c.get('copy', []))
    tbl = re.search(r'<table class="compare-table">(.*?)</table>', src, flags=re.S).group(1)
    heads = re.findall(r'<th scope="col">(.*?)</th>', tbl)
    assert len(heads) == 4, heads
    rows = []
    for tr in re.findall(r'<tr>(<td>.*?)</tr>', tbl, flags=re.S):
        cells = re.findall(r'<td[^>]*>(.*?)</td>', tr, flags=re.S)
        w = re.search(r'winner-icon (a|b|tie)', cells[3]).group(1)
        rows.append((cells[0], cells[1], cells[2], {'a': heads[1], 'b': heads[2], 'tie': 'even'}[w]))
    assert len(rows) >= 5, len(rows)
    acc = re.findall(r'<div class="accordion-header">\s*<span>(.*?)</span>.*?<div class="accordion-content">\s*(.*?)\s*</div>\s*</div>', src, flags=re.S)
    assert len(acc) == c['acc'], len(acc)
    cards = re.findall(r'<div class="decision-card [ab]">\s*<h4>(.*?)</h4>\s*<ul>(.*?)</ul>', src, flags=re.S)
    assert len(cards) == 2, cards
    la, lb = (re.findall(r'<li>(.*?)</li>', cards[i][1], flags=re.S) for i in (0, 1))
    n_fit = max(len(la), len(lb))
    fit = ex.table([cards[0][0].replace('...', ''), cards[1][0].replace('...', '')],
                   [((la + [''] * n_fit)[i], (lb + [''] * n_fit)[i]) for i in range(n_fit)])
    faq = re.findall(r'<div class="faq-item">\s*<h3>(.*?)</h3>\s*<p>(.*?)</p>\s*</div>', src, flags=re.S)
    assert len(faq) == c['faq'], len(faq)
    rel = re.findall(r'<a href="([^"]+)" class="related-card">\s*<h4>(.*?)</h4>\s*<p>(.*?)</p>\s*</a>', src, flags=re.S)
    assert len(rel) >= 2, rel
    n = 0
    parts = []
    for title, lead, html in c.get('extra', []):
        n += 1
        parts.append(ex.section(n, re.sub(r'\W+', '-', title.lower()).strip('-'), title, html, lead=lead))
    n += 1
    parts.append(ex.section(n, 'side-by-side', 'Side by side', ex.table(['Category', heads[1], heads[2], 'Edge'], rows), lead=c.get('table_lead')))
    n += 1
    parts.append(ex.section(n, 'analysis', 'Analysis', '\n'.join('  <div class="ex-prose"><h3>%s</h3>\n%s\n  </div>' % (t, ex.clean(b)) for t, b in acc)))
    n += 1
    parts.append(ex.section(n, 'which', 'Which one fits', fit))
    n += 1
    parts.append(ex.section(n, 'faq', 'Questions', '\n'.join('  <div class="ex-prose"><h3>%s</h3>\n    <p>%s</p>\n  </div>' % (q, ex.clean(a.strip())) for q, a in faq)))
    n += 1
    parts.append(ex.section(n, 'related', 'Related tools', ex.table(['Tool', 'What it does'], [(lnk(h, t), d) for h, t, d in rel])))
    return '<main id="main-content">\n' + ex.tool_head(c['eyebrow'], c['h1'], c['lede'], c['basis'], CRUMB + c['crumb']) + \
        '\n<div class="wrap ck-body">' + '\n'.join(parts) + '\n</div>\n' + ex.reference(
            n + 1, c['links'], notice='Independent personal research from public sources; it does not represent any current or former employer. '
                                      '<a href="terms.html">Terms and disclaimer</a>.') + '\n</main>'


PUE_FORMULAS = '''  <div class="ck-tbl-wrap"><table class="ck-tbl">
    <thead><tr><th scope="col">Metric</th><th scope="col">Formula</th><th scope="col">Range</th></tr></thead>
    <tbody>
      <tr><td>PUE</td><td><code>Total facility power / IT equipment power</code></td><td>1.0 ideal to 3.0+; lower is better</td></tr>
      <tr><td>DCiE</td><td><code>(IT equipment power / total facility power) × 100 %</code></td><td>100 % ideal to under 33 %; higher is better</td></tr>
    </tbody>
  </table></div>
  <div class="ck-calc">
    <label class="ck-calc-in" for="pueInput"><span>PUE</span>
      <input type="number" id="pueInput" value="1.50" min="1" max="5" step="0.01" inputmode="decimal"></label>
    <label class="ck-calc-in" for="dcieInput"><span>DCiE (%)</span>
      <input type="number" id="dcieInput" value="66.67" min="1" max="100" step="0.01" inputmode="decimal"></label>
    <p class="ck-calc-out" id="converterRating" aria-live="polite">Average efficiency, near the global mean of about 1.55 PUE</p>
  </div>'''
PUE_SCRIPT = '''<script>
/* PUE <-> DCiE converter (ids carried over from the old page); the band is a word, not a colour */
(function(){
  var pueIn=document.getElementById('pueInput'), dcieIn=document.getElementById('dcieInput'), out=document.getElementById('converterRating');
  if(!pueIn||!dcieIn||!out) return;
  function rate(p){
    var band = p < 1.2 ? 'Excellent efficiency, hyperscale level' : p < 1.4 ? 'Good efficiency, above average'
             : p < 1.6 ? 'Average efficiency, near the global mean' : 'Below average, room to improve';
    out.textContent = band + ' (' + p.toFixed(2) + ' PUE / ' + (100/p).toFixed(1) + ' % DCiE)';
  }
  pueIn.addEventListener('input', function(){ var p=parseFloat(this.value); if(p>=1){ dcieIn.value=(100/p).toFixed(2); rate(p); } });
  dcieIn.addEventListener('input', function(){ var d=parseFloat(this.value); if(d>0&&d<=100){ var p=100/d; pueIn.value=p.toFixed(2); rate(p); } });
})();
</script>'''

TIER_CALC = '''  <div class="ck-calc">
    <label class="ck-calc-in" for="mtbf"><span>MTBF (hours between failures)</span>
      <input type="number" id="mtbf" value="8760" min="1" inputmode="decimal"></label>
    <label class="ck-calc-in" for="mttr"><span>MTTR (hours to repair)</span>
      <input type="number" id="mttr" value="4" min="0.1" step="0.1" inputmode="decimal"></label>
    <div class="ck-facts" data-rz-fact-list>
      <div><span class="calc-label">Tier III (N+1)</span><span class="calc-value" id="t3result">--</span><span class="calc-sub" id="t3down">two units, either carries the load: 1 − (1 − A)²</span></div>
      <div><span class="calc-label">Tier IV (2N)</span><span class="calc-value" id="t4result">--</span><span class="calc-sub" id="t4down">Tier III plus a further path: A₃ + (1 − A₃)·A</span></div>
    </div>
  </div>'''
TIER_SCRIPT = '''<script>
/* Tier III / IV availability from MTBF and MTTR (ids and model carried over from the old page; recomputed on input).
   A = MTBF / (MTBF + MTTR); Tier III = 1 - (1 - A)^2; Tier IV = A3 + (1 - A3) * A. Illustration only.
   The old page printed 4 decimals (every realistic input read "100.0000 %") and capped Tier IV at 99.9999 %, which put
   it BELOW Tier III for a good component; now as many decimals as the shortfall needs, no cap, and the downtime a year. */
(function(){
  var f=document.getElementById('mtbf'), r=document.getElementById('mttr'), o3=document.getElementById('t3result'), o4=document.getElementById('t4result');
  var d3=document.getElementById('t3down'), d4=document.getElementById('t4down');
  if(!f||!r||!o3||!o4) return;
  function down(a){ var m=(1-a)*525600, u=' of downtime a year'; return m>=60 ? (m/60).toFixed(2)+' h'+u : m>=1 ? m.toFixed(2)+' min'+u : m*60>=1 ? (m*60).toFixed(2)+' s'+u : m*6e4>=1 ? (m*6e4).toPrecision(2)+' ms'+u : m*6e7>=1 ? (m*6e7).toPrecision(2)+' \u00b5s'+u : 'under 1 \u00b5s'+u; }
  /* As many decimals as it takes to show two significant digits of the shortfall, so a good plant reads its nines
     (99.99999943 %) instead of rounding to 100 %. */
  function pct(a){ var s=(1-a)*100; if(!(s>0)) return '> 99.99999999999\\u00a0%'; var d=Math.min(13, Math.max(4, Math.ceil(-Math.log10(s))+1)); return (100-s).toFixed(d)+'\\u00a0%'; }
  function calc(){
    var mtbf=parseFloat(f.value), mttr=parseFloat(r.value);
    if(!(mtbf>0)||!(mttr>0)){ o3.textContent=o4.textContent='--'; return; }
    var a=mtbf/(mtbf+mttr), t3=1-Math.pow(1-a,2), t4=t3+(1-t3)*a;
    o3.textContent=pct(t3); o4.textContent=pct(t4);
    if(d3) d3.textContent=down(t3); if(d4) d4.textContent=down(t4);
  }
  f.addEventListener('input',calc); r.addEventListener('input',calc); calc();
})();
</script>'''

ACC = {
    'compare-pue-vs-dcie.html': dict(
        key='compare-pue', acc=5, faq=3,
        eyebrow='Efficiency · <b>Compare</b> · metrics',
        h1='PUE vs DCiE <span class="muted">one ratio written two ways</span>',
        lede='DCiE is the reciprocal of PUE as a percentage. The two compared on how they are reported and read, with a converter.',
        basis='basis The Green Grid · ISO/IEC 30134-2 · ' + BASIS_NOTE, crumb='PUE vs DCiE',
        extra=[('Formulas and converter', 'Type either value; the other follows.', PUE_FORMULAS)],
        links=[('pue-calculator.html', 'PUE calculator'), ('infographic-pue-global.html', 'Global PUE'), ('pillar-sustainability.html', 'Sustainability')],
        script=PUE_SCRIPT),
    'compare-fm200-vs-novec.html': dict(
        key='compare-agent', acc=6, faq=4,
        eyebrow='Fire · <b>Compare</b> · clean agents',
        h1='FM-200 vs Novec 1230 <span class="muted">HFC-227ea against FK-5-1-12</span>',
        lede='Two clean agents for data-centre suppression. Compared on mechanism, safety margin, environment, cost and regulation.',
        basis='basis NFPA 2001 · ISO 14520 · EU F-Gas Regulation · Kigali Amendment · ' + BASIS_NOTE, crumb='FM-200 vs Novec 1230',
        links=[('pillar-fire-safety.html', 'Fire safety'), ('fire-calculator.html', 'Fire calculator'), ('compare-wet-vs-preaction.html', 'Wet pipe vs pre-action')]),
    'compare-ashrae-vs-uptime.html': dict(
        key='compare-standards', acc=5, faq=4,
        eyebrow='Standards · <b>Compare</b> · frameworks',
        h1='ASHRAE vs Uptime Institute <span class="muted">thermal envelope against availability tiers</span>',
        lede='ASHRAE TC 9.9 sets the thermal environment; the Uptime Tier Standard sets redundancy and certification. The two compared on scope and use.',
        basis='basis ASHRAE TC 9.9 · Uptime Institute Tier Standard · ' + BASIS_NOTE, crumb='ASHRAE vs Uptime',
        links=[('pillar-standards.html', 'Standards'), ('compare-tier-3-vs-tier-4.html', 'Tier III vs Tier IV'), ('tier-advisor.html', 'Tier advisor')]),
    'compare-tier-3-vs-tier-4.html': dict(
        key='compare-tier', acc=5, faq=4,
        eyebrow='Standards · <b>Compare</b> · tiers',
        h1='Tier III vs Tier IV <span class="muted">concurrently maintainable against fault tolerant</span>',
        lede='Tier III can be maintained without a shutdown; Tier IV also survives a fault. The two compared on topology, availability and cost, with an availability estimate.',
        basis='basis Uptime Institute Tier Standard: Topology · TIA-942 · ' + BASIS_NOTE, crumb='Tier III vs Tier IV',
        extra=[('Availability estimate', 'From one component\'s MTBF and MTTR; a simplified model for illustration.', TIER_CALC)],
        links=[('tier-advisor.html', 'Tier advisor'), ('compare-n1-vs-2n.html', 'N+1 vs 2N'), ('pillar-standards.html', 'Standards')],
        script=TIER_SCRIPT),
}

for page, c in ACC.items():
    CONFIG[page] = {'key': c['key'], 'main': (lambda src, c=c: acc_main(src, c)),
                    'scripts': (lambda src, c=c: (c['script'] + '\n' if c.get('script') else '') + auth_only(src))}
