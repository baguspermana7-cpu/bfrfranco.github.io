"""Explorer refit configs for the infographic pages (R085, v3.28.2).

The old pages were a gradient hero with counter tiles, coloured bar fills, a dot timeline, icon insight cards, share
buttons and an inline-styled reference block. Each main() reads the ORIGINAL page and carries the figures and copy
over: counters and insights become fact lists, bars a table with a grey bar, the timeline a table, references a list.
Interactive parts keep their ids and get a small script on the register (state is a word, never a colour).
"""
import re

from . import explorer as ex
from .explorer_pages import CRUMB, copy

FACT = '''  <div data-rz-fact-list>
%s
  </div>'''


def facts(rows):
    """rows of (label, value, note) -> fact list markup (rz-tool.css reads roles from the class names)"""
    return FACT % '\n'.join('    <div><span class="f-label">%s</span><span class="f-value">%s</span><span class="f-note">%s</span></div>' % r for r in rows)


def refs(src):
    out = []
    for rid, n, body in re.findall(r'<div id="(ref-\d+)"[^>]*><span[^>]*>\[(\d+)\]</span><div>(.*?)</div></div>', src, flags=re.S):
        out.append('    <li id="%s"><span class="ref-n">[%s]</span> %s</li>' % (rid, n, ex.clean(body.strip())))
    assert out, 'no references'
    return '  <ol class="ig-refs">\n%s\n  </ol>' % '\n'.join(out)


def auth_only(src):
    return ex.keep_scripts(src, r'src="auth\.js')


# ---------------------------------------------------------------- infographic-pue-global

PUE_SLIDER = '''  <div class="ig-slider">
    <label class="ck-calc-in" for="pueSlider"><span>PUE</span>
      <input type="range" id="pueSlider" min="1.0" max="3.0" step="0.01" value="1.55"></label>
    <div data-rz-fact-list>
      <div><span class="f-label">Your PUE</span><span class="f-value" id="pueDisplay">1.55</span><span class="f-note" id="pueRating">Average</span></div>
    </div>
    <p class="ck-calc-out" id="pueSavings" aria-live="polite">A PUE of 1.55 means 35 % of total facility energy goes to overhead (cooling, lighting, UPS losses), equal to the 2026 global average of 1.55.</p>
  </div>'''
PUE_SCRIPT = '''<script>
/* PUE slider (ids carried over). One reference, the 2026 average 1.55: the old page compared the resting text with
   2026 and the moved slider with 2020 (1.58), and printed "Good" at load while its own bands said "Average". */
(function(){
  var s=document.getElementById('pueSlider'), d=document.getElementById('pueDisplay'), r=document.getElementById('pueRating'), o=document.getElementById('pueSavings');
  if(!s||!d||!r||!o) return;
  var AVG=1.55;
  function update(){
    var p=parseFloat(s.value); if(!(p>=1)) return;
    d.textContent=p.toFixed(2);
    r.textContent = p<=1.2 ? 'Excellent' : p<=1.4 ? 'Good' : p<=1.8 ? 'Average' : 'Poor';
    var cmp = p<AVG ? 'better than' : p>AVG ? 'worse than' : 'equal to';
    o.textContent='A PUE of '+p.toFixed(2)+' means '+Math.round((1-1/p)*100)+' % of total facility energy goes to overhead (cooling, lighting, UPS losses), '+cmp+' the 2026 global average of 1.55.';
  }
  s.addEventListener('input',update); update();
})();
</script>'''


# the note repeated the label it sits beside
INS_TRIM = [[('Energy saved for every 0.1 PUE reduction. For a 10MW facility, that is', 'For a 10 MW facility,')],
            [('Lowest confirmed PUE: Google', 'Google')],
            [('Share of total DC energy consumed by cooling. The single', 'The single')]]


def pue_main(src):
    regions = re.findall(r'<span class="ig-bar-label">(.*?)</span>\s*<div class="ig-bar-track"><div class="ig-bar-fill (\w+)" style="--bar-width: (\d+)%;"></div></div>\s*<span class="ig-bar-value">([\d.]+)</span>', src)
    assert len(regions) == 5, regions
    band = {'excellent': 'excellent', 'good': 'good', 'avg': 'average', 'poor': 'poor'}
    reg_rows = [(name, '<span class="num">%s</span>' % v, '<span class="ig-bar" style="--w:%s%%" aria-hidden="true"></span>' % w, band[b])
                for name, b, w, v in regions]
    tl = re.findall(r'<div class="ig-tl-year">(\d{4})</div>\s*<div class="ig-tl-text">(.*?)</div>', src, flags=re.S)
    assert len(tl) == 5, tl
    ins = re.findall(r'<div class="ig-insight-num">(.*?)</div>\s*<div class="ig-insight-text">(.*?)</div>', src, flags=re.S)
    assert len(ins) == 3, ins
    ins_label = ['Energy saved per 0.1 PUE', 'Lowest confirmed PUE', 'Cooling share of DC energy']
    body = '\n'.join([
        ex.section(1, 'average', 'Global average', facts([
            ('2020 average', '1.58', 'start of the series'),
            ('2026 average', '1.55', 'flat within survey noise'),
            ('Change', '−1.9 %', '0.03 PUE in six years')])),
        ex.section(2, 'regions', 'PUE by region', ex.table(['Region', 'PUE 2026', 'Relative to the highest', 'Band'], reg_rows, cls='ig-regions'),
                   lead='Average power usage effectiveness across the major data-centre markets, 2026.'),
        ex.section(3, 'milestones', 'Milestones', ex.table(['Year', 'What happened'], tl)),
        ex.section(4, 'yours', 'Your PUE', PUE_SLIDER, lead='Move the slider; the overhead share and the comparison follow.'),
        ex.section(5, 'insights', 'Key figures', facts([(l, n, ex.clean(copy(t, c))) for l, (n, t), c in zip(ins_label, ins, INS_TRIM)])),
        ex.section(6, 'references', 'References', refs(src)),
    ])
    return '<main id="main-content">\n' + ex.tool_head(
        'Efficiency · <b>Infographic</b> · PUE',
        'Global PUE 2020 to 2026 <span class="muted">by region, by year, and for your own site</span>',
        'The global average PUE moved from 1.58 to 1.55 in six years. Regional averages, the milestones since 2007, and a slider for your own figure.',
        'basis published industry averages (references below) · The Green Grid · ISO/IEC 30134-2 · published figures, no engine runs on this page',
        CRUMB + 'Global PUE') + '\n<div class="wrap ck-body">' + body + '\n</div>\n' + ex.reference(
            7, [('pue-calculator.html', 'PUE calculator'), ('compare-pue-vs-dcie.html', 'PUE vs DCiE'), ('pillar-sustainability.html', 'Sustainability')],
            notice='Independent personal research from public sources; it does not represent any current or former employer. '
                   '<a href="terms.html">Terms and disclaimer</a>.') + '\n</main>'


CONFIG = {
    'infographic-pue-global.html': {'key': 'ig-pue', 'main': pue_main,
                                    'scripts': lambda src: PUE_SCRIPT + '\n' + auth_only(src)},
}

# ---------------------------------------------------------------- infographic-dc-cost-breakdown

def cost_main(src):
    src = copy(src, [('Code compliance varies significantly by jurisdiction', 'Code requirements vary by jurisdiction')])
    segs = re.findall(r"\{ name: '([^']+)', pct: (\d+), cost: '([^']+)', color: '[^']+', detail: '((?:[^'\\]|\\.)*)' \}", src)
    assert len(segs) == 8 and sum(int(x[1]) for x in segs) == 100, segs
    mx = max(int(x[1]) for x in segs)
    seg_rows = [(n, '<span class="num">%s %%</span>' % pc, '<span class="num">%s</span>' % c,
                 '<span class="ig-bar" style="--w:%d%%" aria-hidden="true"></span>' % round(int(pc) * 100 / mx), d.replace("\\'", "'"))
                for n, pc, c, d in segs]
    tiers = re.findall(r'<div class="ig-tier-label">(.*?)</div>\s*<div class="ig-tier-multiplier">(.*?)</div>\s*<div class="ig-tier-cost">(.*?)</div>\s*<ul class="ig-tier-features">(.*?)</ul>', src, flags=re.S)
    assert len(tiers) == 3, tiers
    tier_rows = [(t, '<span class="num">%s</span>' % m, '<span class="num">%s</span>' % c, ' · '.join(re.findall(r'<li>(.*?)</li>', f))) for t, m, c, f in tiers]
    fx = re.findall(r'<div class="ig-fact-title">(.*?)</div>\s*<div class="ig-fact-text">(.*?)</div>', src, flags=re.S)
    assert len(fx) == 3, fx
    body = '\n'.join([
        ex.section(1, 'breakdown', 'Where the money goes', ex.table(['Category', 'Share', 'Of $10M', 'Relative to the largest', 'What it covers'], seg_rows, cls='ig-cost'),
                   lead='A $10M reference build split by category; the shares add to 100 %.'),
        ex.section(2, 'tiers', 'Tier cost multipliers', ex.table(['Tier', 'Multiplier', 'Build cost', 'What it buys'], tier_rows, cls='ig-tiers'),
                   lead='Redundancy scales the same build: multipliers on a $10M Tier II build.'),
        ex.section(3, 'facts', 'Cost facts', '\n'.join('  <div class="ex-prose"><h3>%s</h3>\n    <p>%s</p>\n  </div>' % (t, ex.clean(x)) for t, x in fx)),
        ex.section(4, 'references', 'References', refs(src)),
    ])
    return '<main id="main-content">\n' + ex.tool_head(
        'Cost · <b>Infographic</b> · CAPEX',
        'Data-centre build cost by category <span class="muted">where $10M goes, and what each tier adds</span>',
        'Mechanical and cooling is the largest share of a build, ahead of electrical. The split of a $10M reference build, the tier multipliers and the cost facts behind them.',
        'basis published industry cost ranges (references below) · Uptime Institute tier availability · reference figures, no engine runs on this page',
        CRUMB + 'Build cost by category') + '\n<div class="wrap ck-body">' + body + '\n</div>\n' + ex.reference(
            5, [('capex-calculator.html', 'CAPEX calculator'), ('tco-calculator.html', 'TCO calculator'), ('compare-tier-3-vs-tier-4.html', 'Tier III vs Tier IV')],
            notice='Independent personal research from public sources; it does not represent any current or former employer. '
                   '<a href="terms.html">Terms and disclaimer</a>.') + '\n</main>'


CONFIG['infographic-dc-cost-breakdown.html'] = {'key': 'ig-cost', 'main': cost_main, 'scripts': auth_only}


# ---------------------------------------------------------------- infographic-dc-sustainability

SLIDER_DEFAULT = {'renewVal': '50', 'pueVal': '1.50', 'wueVal': '1.0', 'heatVal': '0'}


def _slider(sid, label, vid, shown, mn, mx, step):
    return ('    <label class="ck-calc-in ig-range" for="%s"><span>%s <b id="%s">%s</b></span>\n'
            '      <input type="range" id="%s" min="%s" max="%s" step="%s" value="%s"></label>') % (
        sid, label, vid, shown, sid, mn, mx, step, SLIDER_DEFAULT[vid])


GREEN_CALC = '\n'.join([
    '  <div class="ig-slider">',
    _slider('renewSlider', 'Renewable energy', 'renewVal', '50%', 0, 100, 5),
    _slider('pueSlider', 'PUE', 'pueVal', '1.50', '1.0', '3.0', '0.05'),
    _slider('wueSlider', 'WUE (L/kWh)', 'wueVal', '1.0', 0, '2.0', '0.1'),
    _slider('heatSlider', 'Waste heat recovery', 'heatVal', 'No', 0, 1, 1),
    '    <div data-rz-fact-list>',
    '      <div><span class="f-label">Green score</span><span class="f-value" id="scoreNum">50</span><span class="f-note" id="scoreGrade">Average</span></div>',
    '    </div>',
    '    <h3 class="ig-recs-h">Recommendations</h3>',
    '    <ul class="ig-recs" id="recsList"></ul>',
    '  </div>'])

GREEN_SCRIPT = r"""<script>
/* Green score (ids and weights carried over): renewable x0.35 (max 35) + PUE (3-p)/2 x30 + WUE (2-w)/2 x20 + heat 15.
   The grade is a word; the old page also coloured the number cyan / green / amber / red. */
(function(){
  var g=function(i){return document.getElementById(i);};
  var rs=g('renewSlider'), ps=g('pueSlider'), ws=g('wueSlider'), hs=g('heatSlider'), list=g('recsList');
  if(!rs||!ps||!ws||!hs||!list) return;
  function calc(){
    var renew=parseInt(rs.value,10), pue=parseFloat(ps.value), wue=parseFloat(ws.value), heat=parseInt(hs.value,10);
    g('renewVal').textContent=renew+'%'; g('pueVal').textContent=pue.toFixed(2); g('wueVal').textContent=wue.toFixed(1); g('heatVal').textContent=heat?'Yes':'No';
    var total=Math.round(renew*0.35 + Math.max(0,(3-pue)/2)*30 + Math.max(0,(2-wue)/2)*20 + heat*15);
    total=Math.min(100,Math.max(0,total));
    g('scoreNum').textContent=total;
    g('scoreGrade').textContent = total>=80 ? 'Excellent' : total>=60 ? 'Good' : total>=40 ? 'Average' : 'Needs improvement';
    var recs=[];
    if(renew<50) recs.push('Increase renewable energy procurement through PPAs or RECs to reduce Scope 2 emissions.');
    if(renew>=50&&renew<100) recs.push('Target 100% renewable matching and explore 24/7 carbon-free energy agreements.');
    if(pue>1.4) recs.push('Implement hot/cold aisle containment and optimize airflow management to lower PUE.');
    if(pue>1.6) recs.push('Consider liquid cooling for high-density zones; direct-to-chip cooling can reach a PUE below 1.1.');
    if(wue>1.0) recs.push('Evaluate hybrid or air-cooled alternatives to reduce water consumption in cooling systems.');
    if(wue>0.5&&wue<=1.0) recs.push('Explore closed-loop cooling or direct liquid cooling to reduce water dependency.');
    if(!heat) recs.push('Investigate waste heat recovery for district heating or adjacent facility use, up to 15% energy value recaptured.');
    if(total>=80) recs.push('Consider ISO 50001 certification and science-based targets.');
    list.innerHTML='';
    recs.forEach(function(r){ var li=document.createElement('li'); li.textContent=r; list.appendChild(li); });
  }
  [rs,ps,ws,hs].forEach(function(e){ e.addEventListener('input',calc); }); calc();
})();
</script>"""


def sus_main(src):
    stats = re.findall(r'<span class="num[^"]*"(?: id="\w+")?>(.*?)</span>\s*<span class="label">(.*?)</span>', src)
    assert len(stats) == 3, stats
    gauges = re.findall(r'<div class="ig-gauge-val">(.*?)</div>\s*<div class="ig-gauge-name">(.*?)</div>\s*<div class="ig-gauge-sub">(.*?)</div>', src)
    assert len(gauges) == 4, gauges
    wue = re.findall(r'<div class="ig-wue-type">(.*?)</div>\s*<div class="ig-wue-val"[^>]*>(.*?)</div>\s*<div class="ig-wue-unit">.*?</div>\s*<div class="ig-wue-bar"><div class="ig-wue-bar-fill" style="width: (\d+)%', src, flags=re.S)
    assert len(wue) == 3, wue
    carbon = re.findall(r'<span class="ig-carbon-region">(.*?)</span><span class="ig-carbon-bar"><span class="ig-carbon-bar-fill" style="width: (\d+)%"></span></span><span class="ig-carbon-val">(\d+) ', src)
    assert len(carbon) == 8, carbon
    sdg = re.findall(r'<div class="ig-sdg-num">(.*?)</div>\s*<div class="ig-sdg-name">(.*?)</div>\s*<div class="ig-sdg-text">(.*?)</div>', src, flags=re.S)
    assert len(sdg) == 4, sdg

    def bar(w):
        return '<span class="ig-bar" style="--w:%s%%" aria-hidden="true"></span>' % w

    def num(v):
        return '<span class="num">%s</span>' % v

    stat_label = {'of Global Electricity': 'Share of global electricity', 'of Carbon Emissions': 'Share of global carbon emissions', 'TWh / Year': 'Electricity a year'}
    body = '\n'.join([
        ex.section(1, 'footprint', 'Global footprint', facts([(stat_label.get(l, l), v + (' TWh' if l == 'TWh / Year' else ''), '') for v, l in stats])),
        ex.section(2, 'renewables', 'Renewable matching by operator', ex.table(['Operator', 'Matched', 'Target'], [(n, num(v), sub) for v, n, sub in gauges]),
                   lead='Share of operations matched with renewable energy, as each operator reports it.'),
        ex.section(3, 'water', 'Water by cooling type', ex.table(['Cooling', 'WUE (L/kWh IT)', 'Relative to evaporative'], [(t, num(v), bar(w)) for t, v, w in wue], cls='ig-regions')),
        ex.section(4, 'carbon', 'Grid carbon intensity by region', ex.table(['Region', 'gCO₂/kWh', 'Relative to the highest'], [(r, num(v), bar(w)) for r, w, v in carbon], cls='ig-regions'),
                   lead='Grams of CO₂ per kWh of grid electricity, lowest first; it sets the footprint of a site on that grid.'),
        ex.section(5, 'score', 'Green score', GREEN_CALC, lead='Four inputs, one score out of 100; the weights are in the basis line above.'),
        ex.section(6, 'sdg', 'UN Sustainable Development Goals', ex.table(['Goal', 'Name', 'How data centres contribute'], sdg)),
        ex.section(7, 'references', 'References', refs(src)),
    ])
    return '<main id="main-content">\n' + ex.tool_head(
        'Sustainability · <b>Infographic</b> · scorecard',
        'Data-centre sustainability 2026 <span class="muted">energy, water, carbon and a score for your site</span>',
        'Data centres use about 1.5 % of global electricity. Renewable matching by operator, water by cooling type, grid carbon by region, and a four-input score.',
        'basis published operator, IEA and grid-intensity figures (references below) · score weights: renewables 35, PUE 30, WUE 20, heat recovery 15',
        CRUMB + 'Sustainability scorecard') + '\n<div class="wrap ck-body">' + body + '\n</div>\n' + ex.reference(
            8, [('carbon-footprint.html', 'Carbon footprint calculator'), ('infographic-pue-global.html', 'Global PUE'), ('pillar-sustainability.html', 'Sustainability')],
            notice='Independent personal research from public sources; it does not represent any current or former employer. '
                   '<a href="terms.html">Terms and disclaimer</a>.') + '\n</main>'


CONFIG['infographic-dc-sustainability.html'] = {'key': 'ig-sus', 'main': sus_main,
                                                'scripts': lambda src: GREEN_SCRIPT + '\n' + auth_only(src)}
