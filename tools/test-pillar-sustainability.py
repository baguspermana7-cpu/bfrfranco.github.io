#!/usr/bin/env python3
"""test-pillar-sustainability.py — K25 laws for pillar-sustainability.html.

  P1 the page equals what tools/pillars/build-sustainability.py writes (figures excluded; they are build-article-diagrams')
  P2 every number in the worked example is recomputed from the stated inputs and matches as printed
  P3 every [Sn] link resolves to a source row, and every source row is cited at least once
  P4 the FAQPage JSON-LD carries exactly the questions shown on the page
  P5 both explorable figures are present with interactive nodes; no stat-tile or hub-card markup is left
Usage: python3 tools/test-pillar-sustainability.py
"""
import html, json, re, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
s = (ROOT / 'pillar-sustainability.html').read_text()
fails = []
def ok(name, cond, detail=''):
    print(('  ✓ ' if cond else '  ✘ ') + name + ('' if cond else '  — ' + str(detail)[:300]))
    if not cond: fails.append(name)

r = subprocess.run([sys.executable, str(ROOT / 'tools' / 'pillars' / 'build-sustainability.py'), '--check'])
ok('P1 page is current with its generator', r.returncode == 0)

pre = re.search(r'<pre class="formula" data-sust-example>(.*?)</pre>', s, re.S)
ok('P2 worked example present', bool(pre))
if pre:
    t = html.unescape(pre.group(1))
    def num(k):
        line = next((l for l in t.split('\n') if l.startswith(k + ' ') or l.startswith(k + '=')), '')
        m = re.search(r'=\s*([\d,\.]+)\s*(?:kWh|L/kWh|kg/kWh)?\s*$', line)
        return float(m.group(1).replace(',', '')) if m else float('nan')
    IT = 10000 * 8760; DC = 1.30 * IT; WATER_L = 157680 * 1000; EF = 0.70; REN = 0.25; REUSE = 0.05
    want = {'E_IT': IT, 'E_DC': DC, 'WUE': round(WATER_L / IT, 2), 'CUE (location)': round(EF * DC / IT, 2),
            'CUE (market)': round(EF * (1 - REN) * DC / IT, 2), 'ERF': round(REUSE * DC / DC, 2), 'REF': round(REN * DC / DC, 2)}
    got = {k: num(k) for k in want}
    ok('P2 every result equals the formula on its inputs', all(abs(got[k] - want[k]) < 1e-6 for k in want), {k: (got[k], want[k]) for k in want})
    ok('P2 the intermediate operands are what the inputs give', '5,694,000' in t and '28,470,000' in t and abs(5694000 - REUSE * DC) < 1e-3 and abs(28470000 - REN * DC) < 1e-3)
    prose = re.sub(r'<[^>]+>', '', s.split('data-sust-example>')[1].split('</pre>')[1].split('</p>')[0])
    loc_t, mkt_t = EF * DC / 1000, EF * (1 - REN) * DC / 1000
    save_kwh = (1.30 - 1.20) * IT; save_t = save_kwh * EF / 1000
    ok('P2 prose numbers: tonnes and the PUE 1.30 to 1.20 saving', f'{round(loc_t):,}' in prose and f'{round(mkt_t):,}' in prose and f'{round(save_kwh):,}' in prose and f'{round(save_t):,}' in prose,
       (round(loc_t), round(mkt_t), round(save_kwh), round(save_t), prose[:200]))

cited = set(re.findall(r'href="#src-(\d+)"', s)); rows = set(re.findall(r'<li id="src-(\d+)"', s))
ok('P3 every citation resolves', cited <= rows, sorted(cited - rows))
ok('P3 every source is cited', rows <= cited, sorted(rows - cited))

lds = [json.loads(b) for b in re.findall(r'<script type="application/ld\+json">(.*?)</script>', s, re.S)]
fq = next((b for b in lds if b.get('@type') == 'FAQPage'), None)
shown = [html.unescape(re.sub(r'<[^>]+>', '', q)).strip() for q in re.findall(r'<div class="ws-insight-box">\s*<h3>(.*?)</h3>', (s.split('<h2 id="faq"') + [''])[1])]
ok('P4 FAQPage JSON-LD = the questions on the page', bool(shown) and fq and [q['name'] for q in fq['mainEntity']] == shown, shown)

ok('P5 both figures drawn and explorable', all(re.search(r'data-rz-figure="' + f + r'"[^>]*>.*?data-rzd-hit', s, re.S) for f in ('sust-d1', 'sust-d2')))
ok('P5 no stat tiles or hub cards left', not re.search(r'stat-card|pillar-stat-badge|pillar-card|hub-node', s))
ok('P5 no fire-page text leaked', not re.search(r'NFPA|clean agent|Fire Protection', s))
print(f'PILLAR SUSTAINABILITY — {"FAIL" if fails else "PASS"} ({len(fails)} failed)')
sys.exit(1 if fails else 0)
