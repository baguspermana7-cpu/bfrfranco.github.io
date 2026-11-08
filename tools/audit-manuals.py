#!/usr/bin/env python3
"""audit-manuals.py — K26 (owner: "page manual/ pastikan ini selalu diupdate dan align dengan toolsnya").

  M1 every internal link on every manual/ page resolves (dead links were found: ../pue.html, ../capex.html, ...)
  M2 every manual (bar the index) links to the tool page it documents (its mn-toollink, else the same-named page), and it exists
  M3 manual/index.html carries a card for every manual, and every card opens an existing manual
  M5 a hub manual's "What this hub links to" list names only links the hub page really carries (K26: the power
     manual listed pln-java-grid.html and the cooling manual water-system.html; neither hub links them)
  M4 MONITOR (reported, never fails): manuals whose tool page changed in git after the manual did, with the gap in
     days. A manual that is many commits behind its tool is the drift the owner asked to stop; the list is the backlog.
Usage: python3 tools/audit-manuals.py [--strict] [--root=<tree>]
"""
import glob, os, re, subprocess, sys

ROOT = next((a.split('=', 1)[1] for a in sys.argv if a.startswith('--root=')), os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
ROOT = os.path.abspath(ROOT)
STRICT = '--strict' in sys.argv
MAN = os.path.join(ROOT, 'manual')
ALIAS = {'epms-telemetry': 'EPMS_Telemetry.html'}   # manual stem -> tool page, where the names differ


def norm(x):
    return re.sub(r'[^a-z0-9]', '', x.lower())


def tool_of(stem):
    if stem in ALIAS:
        return ALIAS[stem]
    cands = {norm(os.path.splitext(f)[0]): f for f in os.listdir(ROOT) if f.endswith('.html')}
    return cands.get(norm(stem))


def last_commit(path):
    try:
        out = subprocess.run(['git', '-C', ROOT, 'log', '-1', '--format=%ct', '--', path], capture_output=True, text=True, timeout=30).stdout.strip()
        return int(out) if out else None
    except Exception:
        return None


fails = []
def ok(name, cond, detail=''):
    print(('  ✓ ' if cond else '  ✘ ') + name + ('' if cond else '  — ' + str(detail)[:600]))
    if not cond:
        fails.append(name)

pages = sorted(glob.glob(os.path.join(MAN, '*.html')))
dead = []
for f in pages:
    s = open(f, encoding='utf-8').read()
    for h in re.findall(r'href="([^"]+)"', s):
        if re.match(r'(https?:|mailto:|#|javascript:|data:|tel:)', h):
            continue
        p = h.split('#')[0].split('?')[0]
        if not p:
            continue
        t = os.path.normpath(os.path.join(MAN, p))
        if p.endswith('/'):
            t = os.path.join(t, 'index.html')
        if not os.path.exists(t):
            dead.append(os.path.basename(f) + ' -> ' + h)
ok('M1 every internal link on %d manual pages resolves' % len(pages), not dead, dead)

missing = []
pairs = []
for f in pages:
    stem = os.path.splitext(os.path.basename(f))[0]
    if stem == 'index':
        continue
    s = open(f, encoding='utf-8').read()
    tl = re.search(r'class="mn-toollink" href="\.\./([^"#?]+)', s)
    tool = tl.group(1) if tl and os.path.exists(os.path.join(ROOT, tl.group(1))) else tool_of(stem)
    if not tool:
        missing.append(stem + ': no tool page found')
        continue
    if ('"../' + tool + '"') not in s and ('"../' + tool + '#') not in s:
        missing.append(stem + ': does not link ../' + tool)
        continue
    pairs.append((stem, tool))
ok('M2 every manual links the tool page it documents', not missing, missing)

idx = open(os.path.join(MAN, 'index.html'), encoding='utf-8').read()
cards = set(h for h in re.findall(r'class="mn-manual" href="([^"#?]+)"', idx))
have = set(os.path.basename(f) for f in pages) - {'index.html'}
ok('M3 every card opens an existing manual', cards <= have, sorted(cards - have))
ok('M3 every manual has a card on the index', have <= cards, sorted(have - cards))

hub_bad = []
for stem, tool in pairs:
    s = open(os.path.join(MAN, stem + '.html'), encoding='utf-8').read()
    m = re.search(r'What this hub links to</h2>(.*?)(<h2|</main>)', s, re.S)
    if not m:
        continue
    page = open(os.path.join(ROOT, tool), encoding='utf-8').read()
    on = set(h.split('#')[0].split('?')[0] for h in re.findall(r'href="([^"]+)"', page))
    for h in re.findall(r'href="\.\./([^"#?]+)"', m.group(1)):
        if h.startswith('manual/') or h == tool:
            continue
        if h not in on and ('/' + h) not in on:
            hub_bad.append(stem + ' lists ' + h + ' but ' + tool + ' does not link it')
ok('M5 every hub manual lists only links its hub really carries', not hub_bad, hub_bad)

lag = []
for stem, tool in pairs:
    tm, mm = last_commit(os.path.join(ROOT, tool)), last_commit(os.path.join(MAN, stem + '.html'))
    if tm and mm and tm > mm:
        lag.append((round((tm - mm) / 86400, 1), stem, tool))
lag.sort(reverse=True)
print('  · M4 MONITOR: %d of %d manuals older than their tool page in git' % (len(lag), len(pairs)))
for d, stem, tool in lag[:12]:
    print('      %6.1f d  manual/%s.html  behind  %s' % (d, stem, tool))
print('MANUALS — %s (%d failed)' % ('FAIL' if fails else 'PASS', len(fails)))
sys.exit(1 if (fails and STRICT) else 0)
