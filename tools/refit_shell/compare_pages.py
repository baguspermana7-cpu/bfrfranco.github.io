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
