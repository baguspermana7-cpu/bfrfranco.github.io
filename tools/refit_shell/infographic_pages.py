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
