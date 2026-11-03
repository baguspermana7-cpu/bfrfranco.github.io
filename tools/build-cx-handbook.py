#!/usr/bin/env python3
"""build-cx-handbook.py — publish the Data Centre Commissioning Field Manual R01 as web pages.

Source (in this repo, copied from the field_r01 handbook build):
    data/cx-handbook/chapters/NN_*.md      32 chapters (01-30, 32, 33)
    data/cx-handbook/figures/FNN-n.svg     the drawing sheets
    data/cx-handbook/figures_manifest.json figure id, title, caption, chapter, anchor section
    data/cx-handbook/chapters.json         parts and chapter titles

Output:
    cx-handbook/index.html                 parts, chapters with a one-line scope, figure counts, how to cite
    cx-handbook/NN-slug.html               one page per chapter: contents list, inline figures, prev/next

A figure is placed the way the PDF builder (build_r04.place_figures) anchors it: after the first
top-level paragraph of the section its manifest `section` names (e.g. "02.3"). Prose references
such as "F02-1 shows" become links to the figure id, on the same page or on the chapter that owns it.

    python3 tools/build-cx-handbook.py            # summary, writes nothing
    python3 tools/build-cx-handbook.py --apply    # write cx-handbook/
    python3 tools/build-cx-handbook.py --check    # exit 1 if cx-handbook/ differs from a fresh build

Needs the `markdown` package (3.x). System python3 here lacks it, so the script re-runs itself under
$CXHB_PYTHON or ~/.venvs/pdfkit/bin/python when the import fails.
"""
import datetime
import hashlib
import html
import json
import os
import re
import sys
from pathlib import Path

try:
    import markdown
except ImportError:  # re-exec under an interpreter that has it
    for cand in (os.environ.get('CXHB_PYTHON'), os.path.expanduser('~/.venvs/pdfkit/bin/python')):
        if cand and os.path.exists(cand) and not os.environ.get('CXHB_REEXEC'):
            os.environ['CXHB_REEXEC'] = '1'  # a venv python is a symlink to the same binary; guard the loop by env
            os.execv(cand, [cand, os.path.abspath(__file__)] + sys.argv[1:])
    sys.stderr.write('build-cx-handbook: the markdown package is missing (pip install markdown, or set CXHB_PYTHON)\n')
    sys.exit(2)

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'data' / 'cx-handbook'
OUT = ROOT / 'cx-handbook'
SITE = 'https://resistancezero.com'
BOOK = 'Data Centre Commissioning Field Manual'
EDITION = 'R01'
PUBLISHED = '2026-11-03'
AUTHOR = 'Bagus Dwi Permana'
FIG_URL = '../data/cx-handbook/figures/'
GA = 'G-GED7FX8RTV'

# Shared assets: reuse the token the reference pages already carry, so one asset keeps one token.
ASSETS_CSS = ['css/rz-hub.css', 'css/rz-tool.css', 'css/rz-cx-handbook.css']
ASSETS_JS = ['js/rz-version.js', 'js/rz-mobile-nav.js', 'js/rz-cookie-consent.js', 'js/rz-command-palette.js']
TOKEN_REFS = ['cx-calculator.html', 'manual/cx.html', 'manual/index.html']


# ---------------------------------------------------------------- helpers
def esc(s):
    return html.escape(s, quote=True)


def sha8(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()[:8]


def asset_token(asset):
    want = sha8(ROOT / asset)
    pool = [ROOT / p for p in TOKEN_REFS] + sorted(OUT.glob('*.html')) if OUT.exists() else [ROOT / p for p in TOKEN_REFS]
    rx = re.compile(re.escape(asset.split('/')[-1]) + r'\?v=([0-9A-Za-z.-]+)"')
    for p in pool:
        if p.exists():
            for m in rx.finditer(p.read_text(encoding='utf-8')):
                if m.group(1).split('-')[-1] == want:
                    return m.group(1)
    return f'{datetime.date.today():%Y%m%d}-{want}'


def plain(fragment):
    return ' '.join(html.unescape(re.sub(r'<[^>]+>', ' ', fragment)).split())


def slugify(s):
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')[:60] or 'h'


def first_sentence(text):
    m = re.match(r'(.+?[.!?])(\s|$)', text)
    return m.group(1) if m else text


# The manual shares the Cx calculator's social card: same subject, one card to keep fresh.
OG_IMAGE = 'https://resistancezero.com/assets/og/cx-calculator.webp'
# Descriptions are written, not clipped: a cut-off sentence fails the meta description gate.
DESC = json.loads((ROOT / 'data' / 'cx-handbook' / 'descriptions.json').read_text(encoding='utf-8'))


def described(key):
    text = DESC.get(key)
    if not text or len(text) > 160 or text.endswith('…'):
        raise SystemExit(f'descriptions.json: "{key}" missing, longer than 160 chars, or clipped')
    return text


def clip(text, n=158):
    if len(text) <= n:
        return text
    cut = text[:n].rsplit(' ', 1)[0].rstrip(',;:')
    return cut + '…'


# ---------------------------------------------------------------- sources
def load():
    spec = json.loads((SRC / 'chapters.json').read_text(encoding='utf-8'))
    figs = json.loads((SRC / 'figures_manifest.json').read_text(encoding='utf-8'))['figures']
    chapters = []
    part_of = {}
    for i, p in enumerate(spec['parts']):
        for c in p['chapters']:
            part_of[c] = (i, p['title'])
    for c in spec['chapters']:
        n = c['id']
        md = sorted((SRC / 'chapters').glob(f'{n}_*.md'))
        if len(md) != 1:
            raise SystemExit(f'chapter {n}: expected one source file, found {len(md)}')
        slug = f'{n}-' + md[0].stem.split('_', 1)[1].replace('_', '-')
        chapters.append({'id': n, 'title': c['title'], 'md': md[0], 'slug': slug, 'file': slug + '.html',
                         'part': part_of[n], 'figs': [f for f in figs if f['chapter'] == n]})
    known = {c['id'] for c in chapters}
    stray = [f['id'] for f in figs if f['chapter'] not in known]
    if stray:
        raise SystemExit(f'figures for chapters not published: {stray[:5]}')
    return spec, chapters, figs


def viewbox(fid):
    head = (SRC / 'figures' / f'{fid}.svg').read_text(encoding='utf-8')[:600]
    m = re.search(r'viewBox="0 0 ([\d.]+) ([\d.]+)"', head)
    if not m:
        raise SystemExit(f'{fid}.svg has no viewBox')
    return int(float(m.group(1))), int(float(m.group(2)))


# ---------------------------------------------------------------- markdown -> html
MARK = re.compile(r'==(?!=)(.+?)==')
HEAD = re.compile(r'<h([2-4])>(.*?)</h\1>', re.S)
NUM = re.compile(r'^(\d{2}(?:\.\d+)+)\s+(.*)$', re.S)


def convert(ch):
    lines = ch['md'].read_text(encoding='utf-8').splitlines()
    if lines and lines[0].startswith('# '):
        lines = lines[1:]
    text = '\n'.join(MARK.sub(r'<mark>\1</mark>', ln) for ln in lines) + '\n'
    body = markdown.markdown(text, extensions=['tables', 'sane_lists'])
    words = len(re.sub(r'[#|*=`>-]+', ' ', '\n'.join(lines)).split())
    return body, words


def number_headings(body):
    toc, used = [], set()

    def repl(m):
        lev, inner = int(m.group(1)), m.group(2).strip()
        txt = plain(inner)
        nm = NUM.match(inner)
        if nm:
            hid = 's' + nm.group(1).replace('.', '-')
            label = f'<span class="n">{nm.group(1)}</span>{nm.group(2)}'
            num, title = nm.group(1), plain(nm.group(2))
        else:
            hid = 'h-' + slugify(txt)
            label, num, title = inner, '', txt
        base, k = hid, 2
        while hid in used:
            hid, k = f'{base}-{k}', k + 1
        used.add(hid)
        if lev <= 3:
            toc.append((lev, hid, num, title))
        return f'<h{lev} id="{hid}">{label}</h{lev}>'

    return HEAD.sub(repl, body), toc


def wrap_tables(body):
    return re.sub(r'<table>(.*?)</table>',
                  lambda m: f'<div class="tbl" role="region" aria-label="Table" tabindex="0"><table>{m.group(1)}</table></div>',
                  body, flags=re.S)


def figure_html(f):
    fid = f['id']
    w, h = viewbox(fid)
    src = FIG_URL + f['file']
    return (f'<figure class="sheet" id="{esc(fid)}">'
            f'<a href="{esc(src)}" title="Open drawing {esc(fid)} at full size">'
            f'<img src="{esc(src)}" alt="{esc(fid)}: {esc(f["title"])}" width="{w}" height="{h}" loading="lazy" decoding="async"></a>'
            f'<figcaption><span class="fig-no">FIG. {esc(fid)}</span> — <b>{esc(f["title"])}</b>. {esc(f["caption"])}</figcaption>'
            f'</figure>\n')


BLOCK = re.compile(r'<(/?)(ul|ol|table|div|blockquote|p|figure)\b[^>]*>')
ANCHOR_HEAD = re.compile(r'<h([2-4]) id="([^"]+)">(.*?)</h\1>', re.S)


def place_figures(body, figs, report):
    heads = list(ANCHOR_HEAD.finditer(body))
    inserts = []
    for seq, f in enumerate(figs):
        rx = re.compile(r'^0?' + re.escape(f['section']) + r'(?!\d)')
        hit = next((i for i, m in enumerate(heads) if rx.match(plain(m.group(3)))), None)
        if hit is None:
            report['unanchored'].append(f['id'])
            inserts.append((len(body), seq, figure_html(f)))
            continue
        m = heads[hit]
        lev = int(m.group(1))
        end = next((m2.start() for m2 in heads[hit + 1:] if int(m2.group(1)) <= lev), len(body))
        nxt = heads[hit + 1].start() if hit + 1 < len(heads) else len(body)
        at, depth = None, 0
        for b in BLOCK.finditer(body, m.end(), nxt):
            tag, closing = b.group(2), b.group(1) == '/'
            if tag == 'p':
                if closing and depth == 0:
                    at = b.end()
                    break
                continue
            depth += -1 if closing else 1
        if at is None:
            at = nxt if nxt <= end else m.end()
        inserts.append((at, seq, '\n' + figure_html(f)))
    for pos, _seq, chunk in sorted(inserts, key=lambda t: (-t[0], -t[1])):
        body = body[:pos] + chunk + body[pos:]
    return body


TAGSPLIT = re.compile(r'(<[^>]+>)')
FIGREF = re.compile(r'\bF(\d{2})-(\d+)\b')
URL = re.compile(r'https?://[^\s<>"]+[^\s<>".,;:)\]]')


def link_text(body, fig_page, here):
    """Link figure ids and bare URLs in text nodes; leave tags, links and figure captions alone."""
    out, in_a, in_cap = [], 0, 0
    for part in TAGSPLIT.split(body):
        if part.startswith('<'):
            t = part[1:].split(None, 1)[0].rstrip('>').lower() if len(part) > 2 else ''
            if t == 'a':
                in_a += 1
            elif t == '/a':
                in_a -= 1
            elif t == 'figcaption':
                in_cap += 1
            elif t == '/figcaption':
                in_cap -= 1
            out.append(part)
            continue
        if in_a or in_cap or not part:
            out.append(part)
            continue

        def fig(m):
            fid = m.group(0)
            page = fig_page.get(fid)
            if not page:
                return fid
            href = f'#{fid}' if page == here else f'{page}#{fid}'
            return f'<a class="figref" href="{href}">{fid}</a>'

        def url(u):
            return f'<a href="{u}" rel="noopener">{u}</a>'

        pieces = URL.split(part)
        urls = URL.findall(part)
        seg = []
        for i, p in enumerate(pieces):
            seg.append(FIGREF.sub(fig, p))
            if i < len(urls):
                seg.append(url(urls[i]))
        out.append(''.join(seg))
    return ''.join(out)


def scope_of(body):
    m = re.search(r'<h2 id="s\d{2}-0">.*?</h2>\s*<p>(.*?)</p>', body, re.S)
    if not m:
        m = re.search(r'<p>(.*?)</p>', body, re.S)
    return first_sentence(plain(m.group(1))) if m else ''


# ---------------------------------------------------------------- page chrome
def head(title, desc, canonical, jsonld, tokens):
    css = ''.join(f'    <link rel="stylesheet" href="../{a}?v={tokens[a]}">\n' for a in ASSETS_CSS)
    js = ''.join(f'    <script src="../{a}?v={tokens[a]}" defer></script>\n' for a in ASSETS_JS)
    ld = json.dumps(jsonld, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
    return f'''<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<!-- Google tag (gtag.js) - deferred until user interaction + consent-aware -->
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){{dataLayer.push(arguments);}}
  if (localStorage.getItem('rz_cookie_consent') === 'declined') {{
    window['ga-disable-{GA}'] = true;
  }}
  gtag('js', new Date());
  gtag('config', '{GA}');
  (function(){{
    var loaded=false;
    function loadGtag(){{
      if(loaded)return;loaded=true;
      if(window['ga-disable-{GA}'])return;
      var s=document.createElement('script');
      s.src='https://www.googletagmanager.com/gtag/js?id={GA}';
      s.async=true;document.head.appendChild(s);
    }}
    ['scroll','click','keydown','touchstart'].forEach(function(e){{
      document.addEventListener(e,loadGtag,{{once:true,passive:true}});
    }});
  }})();
</script>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}">
<meta name="author" content="{AUTHOR}">
<meta name="robots" content="index, follow">
<meta name="theme-color" content="#0b0c0e">
<link rel="canonical" href="{canonical}">
<link rel="alternate" hreflang="en" href="{canonical}">
<link rel="alternate" hreflang="x-default" href="{canonical}">
<meta property="og:type" content="article">
<meta property="og:url" content="{canonical}">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(desc)}">
<meta property="og:locale" content="en_US">
<meta property="og:site_name" content="Bagus Dwi Permana Portfolio">
<meta property="og:image" content="{OG_IMAGE}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Data centre commissioning field manual">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="{OG_IMAGE}">
<meta name="twitter:title" content="{esc(title)}">
<meta name="twitter:description" content="{esc(desc)}">
<script type="application/ld+json">{ld}</script>
<link rel="icon" type="image/png" href="../assets/Favicon.png">
<link rel="apple-touch-icon" href="../assets/Favicon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<script>(function(){{try{{var t=localStorage.getItem('theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t);}}catch(e){{}}}})();</script>
{js}{css}</head>
'''


NAV = '''<body class="hub tool cxhb">
<a href="#main-content" class="skip-link">Skip to main content</a>
<nav class="navbar hub-nav" id="navbar" aria-label="Primary">
  <div class="nav-container wrap">
    <a href="../index.html" class="nav-brand">
      <img src="../assets/favicon-32.png" alt="" width="24" height="24">
      <span class="nav-title">DC Solutions<small>Engineering &amp; Telemetry</small></span>
    </a>
    <div class="nav-links">
      <a href="../glossary.html" class="nav-link">Glossary</a>
      <a href="../datahallAI.html" class="nav-link">DC AI/HPC</a>
      <a href="../dc-conventional.html" class="nav-link">DC Conventional</a>
      <div class="nav-dropdown">
        <a href="../cx-calculator.html" class="nav-link" aria-haspopup="true">Calculators</a>
        <div class="dropdown-menu">
          <a href="../capex-calculator.html" class="dropdown-item">CAPEX</a>
          <a href="../opex-calculator.html" class="dropdown-item">OPEX</a>
          <a href="../pue-calculator.html" class="dropdown-item">PUE</a>
          <a href="../tia-942-checklist.html" class="dropdown-item">TIA-942</a>
          <a href="../cx-calculator.html" class="dropdown-item">Cx</a>
          <a href="../rfs-readiness-workbench.html" class="dropdown-item">RFS Workbench</a>
        </div>
      </div>
      <a href="index.html" class="nav-link"{cur}>Cx field manual</a>
      <a href="../index.html" class="nav-link">← Portfolio</a>
    </div>
    <button class="nav-icon" id="navSearchBtn" aria-label="Search (Ctrl+K)" title="Search (Ctrl+K)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></button>
    <button class="theme-toggle-text" id="themeToggle" type="button" aria-label="Toggle dark or light mode">Theme</button>
  </div>
</nav>
'''

FOOT = '''<footer class="hub-foot">
  <div class="wrap">
    <div class="cols">
      <div><p class="eyebrow"><b>Resistance Zero</b></p><p>Data-center engineering tools and telemetry models.</p></div>
      <ul><li><a href="../index.html">Home</a></li><li><a href="../articles.html">Technical journal</a></li><li><a href="../dc-incidents.html">Incident library</a></li><li><a href="../glossary.html">Glossary</a></li></ul>
      <ul><li><a href="https://www.linkedin.com/in/bagusdpermana/" rel="me noopener" target="_blank">LinkedIn</a></li><li><a href="../index.html#contact">Contact</a></li><li><a href="../manual/">Technical manuals</a></li></ul>
    </div>
    <div class="legal"><span>© 2026 Bagus Dwi Permana</span><a href="../terms.html">Terms</a><a href="../privacy.html">Privacy</a><span id="rz-version-stamp"></span></div>
  </div>
</footer>
<script>
(function(){
  var b=document.getElementById('themeToggle');
  if(b)b.addEventListener('click',function(){
    var t=document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark';
    document.documentElement.setAttribute('data-theme',t);
    try{localStorage.setItem('theme',t);}catch(e){}
  });
  var d=document.querySelector('.cxhb-toc details');
  if(d&&window.matchMedia&&window.matchMedia('(min-width: 961px)').matches)d.open=true;
})();
</script>
</body>
</html>
'''

NOTICE = ('Educational field reference compiled from public standards, guides, manufacturer documents and published '
          'incident reports; sources close each chapter. The project specification, the Engineer of Record and the OEM '
          'documents govern; check the current edition of every standard before use. Worked examples use an example '
          'campus (MSC-1: 4 buildings, 12 halls of 12 MW), not project data. Independent research; not affiliated with '
          'any current or former employer.')

AUTHOR_LD = {'@type': 'Person', 'name': AUTHOR, 'url': SITE + '/'}


def book_ld(index_url):
    return {'@type': 'Book', 'name': BOOK, 'bookEdition': EDITION, 'url': index_url, 'author': AUTHOR_LD, 'inLanguage': 'en'}


# ---------------------------------------------------------------- pages
def toc_html(toc):
    out, open_sub = ['<ol>'], False
    for lev, hid, num, title in toc:
        n = f'<span class="n">{num}</span>' if num else ''
        item = f'<a href="#{hid}">{n}{esc(title)}</a>'
        if lev == 2:
            if open_sub:
                out.append('</ol></li>')
                open_sub = False
            elif len(out) > 1:
                out.append('</li>')
            out.append(f'<li>{item}')
        else:
            if not open_sub:
                out.append('<ol>')
                open_sub = True
            out.append(f'<li>{item}</li>')
    out.append('</ol></li>' if open_sub else ('</li>' if len(out) > 1 else ''))
    out.append('</ol>')
    return ''.join(out)


def chapter_page(ch, prev, nxt, tokens, total):
    url = f'{SITE}/cx-handbook/{ch["file"]}'
    index_url = f'{SITE}/cx-handbook/'
    short = ch['title'].split(':')[0]
    title = f'{ch["id"]} {short} | Cx Field Manual {EDITION}'
    desc = described(ch['id'])
    ld = [{'@context': 'https://schema.org', '@type': 'TechArticle', 'headline': clip(f'{ch["id"]} {ch["title"]}', 110),
           'name': ch['title'], 'description': desc, 'url': url, 'mainEntityOfPage': url, 'inLanguage': 'en',
           'author': AUTHOR_LD, 'publisher': AUTHOR_LD, 'datePublished': PUBLISHED, 'dateModified': PUBLISHED,
           'wordCount': ch['words'], 'position': int(ch['id']), 'isPartOf': book_ld(index_url)},
          {'@context': 'https://schema.org', '@type': 'BreadcrumbList', 'itemListElement': [
              {'@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': SITE + '/'},
              {'@type': 'ListItem', 'position': 2, 'name': BOOK, 'item': index_url},
              {'@type': 'ListItem', 'position': 3, 'name': f'{ch["id"]} {short}', 'item': url}]}]
    part_no, part_title = ch['part']
    pager = ['<nav class="cxhb-pager" aria-label="Chapters">']
    side = ['<div class="side-pager">']
    if prev:
        pager.append(f'<a class="prev" href="{prev["file"]}"><span>Previous · {prev["id"]}</span><span class="t">{esc(prev["title"].split(":")[0])}</span></a>')
        side.append(f'<a href="{prev["file"]}"><span>Previous</span>{prev["id"]} {esc(prev["title"].split(":")[0])}</a>')
    else:
        pager.append('<a class="prev" href="index.html"><span>Contents</span><span class="t">All chapters</span></a>')
    if nxt:
        pager.append(f'<a class="next" href="{nxt["file"]}"><span>Next · {nxt["id"]}</span><span class="t">{esc(nxt["title"].split(":")[0])}</span></a>')
        side.append(f'<a href="{nxt["file"]}"><span>Next</span>{nxt["id"]} {esc(nxt["title"].split(":")[0])}</a>')
    else:
        pager.append('<a class="next" href="index.html"><span>Contents</span><span class="t">All chapters</span></a>')
    side.append('<a href="index.html"><span>Manual</span>All chapters</a></div>')
    pager.append('</nav>')
    nfig = len(ch['figs'])
    return (head(title, desc, url, ld, tokens) + NAV.replace('{cur}', '') + f'''<main class="main-content" id="main-content">
<header class="tool-head">
  <div class="wrap">
    <p class="eyebrow"><b>Cx field manual {EDITION}</b> · Part {part_title}</p>
    <h1><span class="num">{ch["id"]}</span>{esc(ch["title"])}</h1>
    <p class="lede">{esc(ch["scope"])}</p>
    <p class="basis">Chapter {ch["id"]} of {total} · {sum(1 for t in ch["toc"] if t[0] == 2)} sections · {nfig} figure{"s" if nfig != 1 else ""} · {ch["words"]:,} words · October 2026</p>
    <p class="crumb"><a href="../cx-calculator.html">Cx calculator</a> / <a href="index.html">Field manual</a> / Chapter {ch["id"]}</p>
  </div>
</header>
<div class="wrap cxhb-layout">
<nav class="cxhb-toc" aria-label="Chapter contents">
<details><summary>Contents of chapter {ch["id"]}</summary>
{toc_html(ch["toc"])}
</details>
{"".join(side)}
</nav>
<article class="cxhb-body">
{ch["html"]}
{"".join(pager)}
<p class="notice">{esc(NOTICE)} <a href="../privacy.html">Privacy</a> · <a href="../terms.html">Terms</a>.</p>
</article>
</div>
</main>
''' + FOOT)


def index_page(spec, chapters, figs, tokens):
    url = f'{SITE}/cx-handbook/'
    words = sum(c['words'] for c in chapters)
    title = f'{BOOK} {EDITION} | Resistance Zero'
    desc = described('index')
    ld = [{'@context': 'https://schema.org', '@type': 'CollectionPage', 'name': f'{BOOK} {EDITION}', 'url': url,
           'description': desc, 'inLanguage': 'en', 'datePublished': PUBLISHED,
           'isPartOf': {'@type': 'WebSite', 'name': 'Resistance Zero', 'url': SITE + '/'},
           'mainEntity': {**book_ld(url), 'datePublished': PUBLISHED, 'numberOfPages': len(chapters),
                          'hasPart': [{'@type': 'Chapter', 'position': int(c['id']), 'name': f'{c["id"]} {c["title"]}',
                                       'url': f'{SITE}/cx-handbook/{c["file"]}'} for c in chapters]}},
          {'@context': 'https://schema.org', '@type': 'BreadcrumbList', 'itemListElement': [
              {'@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': SITE + '/'},
              {'@type': 'ListItem', 'position': 2, 'name': BOOK, 'item': url}]}]
    by_id = {c['id']: c for c in chapters}
    parts = []
    for p in spec['parts']:
        rows = ''.join(f'<tr><td>{c}</td><td><a href="{by_id[c]["file"]}">{esc(by_id[c]["title"])}</a>'
                       f'<span class="scope">{esc(by_id[c]["scope"])}</span></td><td>{len(by_id[c]["figs"])}</td></tr>'
                       for c in p['chapters'])
        letter, _, name = p['title'].partition(' · ')
        parts.append(f'<h2 id="part-{letter.strip().lower()}"><span class="n">Part {esc(letter.strip())}</span>{esc(name)}</h2>\n'
                     f'<div class="tbl" role="region" aria-label="Part {esc(letter.strip())} chapters" tabindex="0"><table>'
                     f'<thead><tr><th>Ch.</th><th>Chapter and scope</th><th>Figures</th></tr></thead><tbody>{rows}</tbody></table></div>')
    example = chapters[1]
    cite = (f'{AUTHOR} (2026). {BOOK}, edition {EDITION}. Resistance Zero. {url}')
    cite_ch = (f'{AUTHOR} (2026). "{example["id"]} {example["title"]}". In {BOOK}, edition {EDITION}. '
               f'Resistance Zero. {SITE}/cx-handbook/{example["file"]}')
    return (head(title, desc, url, ld, tokens) + NAV.replace('{cur}', ' aria-current="page"') + f'''<main class="main-content" id="main-content">
<header class="tool-head">
  <div class="wrap">
    <p class="eyebrow"><b>Field reference</b> · Edition {EDITION} · October 2026</p>
    <h1>Data centre commissioning field manual</h1>
    <p class="lede">Procedures, acceptance values, records and drawings for commissioning a hyperscale data-centre campus, from the first design review to the end of the first year of operation.</p>
    <p class="basis">{len(spec["parts"])} parts · {len(chapters)} chapters · {len(figs)} figures · {words:,} words</p>
    <p class="crumb"><a href="../cx-calculator.html">Cx calculator</a> / Field manual</p>
  </div>
</header>
<div class="wrap cxhb-index">
<section class="use" aria-labelledby="use-h">
<h2 id="use-h">How to use this manual</h2>
<p><b>Procedures</b> are numbered steps. Each step names who does it, what is measured or checked, the acceptance value and the record that proves it. <b>Highlighted text</b> marks the values and decisions to remember.</p>
<p><b>Acceptance values</b> are quoted from the standard named next to them. Where a value depends on the edition, the project specification or the manufacturer, the text says so. The project specification and the OEM instructions govern over this manual.</p>
<p><b>Figures</b> sit in the section they illustrate; each has a stable link (for example <a href="{chapters[1]["file"]}#F02-1">F02-1</a>) and opens at full size from the sheet. Symbols follow EN 60617 (electrical) and ISO 10628 (process).</p>
<p><b>Worked examples</b> use the MSC-1 example campus (4 × 80 MVA, 20 kV ring, four buildings, 12 halls of 12 MW) or a stated example quantity; they are examples, not project data.</p>
</section>
{"".join(parts)}
<div class="tbl" role="region" aria-label="Totals" tabindex="0"><table><tfoot><tr><td></td><td>{len(chapters)} chapters</td><td>{len(figs)}</td></tr></tfoot></table></div>
<section class="cite" aria-labelledby="cite-h">
<h2 id="cite-h">How to cite</h2>
<p>Cite the edition and the chapter page. Section numbers (for example 28.3) and figure ids (for example <a href="{by_id['28']['file']}#F28-1">F28-1</a>) are stable within edition {EDITION}.</p>
<pre>{esc(cite)}</pre>
<pre>{esc(cite_ch)}</pre>
</section>
<p class="notice">{esc(NOTICE)} <a href="../privacy.html">Privacy</a> · <a href="../terms.html">Terms</a>.</p>
</div>
</main>
''' + FOOT)


# ---------------------------------------------------------------- build
def build():
    spec, chapters, figs = load()
    tokens = {a: asset_token(a) for a in ASSETS_CSS + ASSETS_JS}
    fig_page = {f['id']: c['file'] for c in chapters for f in c['figs']}
    report = {'unanchored': []}
    for c in chapters:
        body, c['words'] = convert(c)
        body, c['toc'] = number_headings(body)
        c['scope'] = scope_of(body)
        body = wrap_tables(body)
        body = place_figures(body, c['figs'], report)
        c['html'] = link_text(body, fig_page, c['file']).strip()
    out = {'index.html': index_page(spec, chapters, figs, tokens)}
    for i, c in enumerate(chapters):
        out[c['file']] = chapter_page(c, chapters[i - 1] if i else None,
                                      chapters[i + 1] if i + 1 < len(chapters) else None, tokens, len(chapters))
    return out, chapters, figs, report


def main():
    apply_, check = '--apply' in sys.argv, '--check' in sys.argv
    out, chapters, figs, report = build()
    summary = f'{len(out)} pages ({len(chapters)} chapters + index), {len(figs)} figures, unanchored {len(report["unanchored"])}'
    if check:
        existing = {p.name for p in OUT.glob('*.html')} if OUT.exists() else set()
        stale = sorted(n for n, s in out.items() if not (OUT / n).exists() or (OUT / n).read_text(encoding='utf-8') != s)
        extra = sorted(existing - set(out))
        if stale or extra:
            print(f'STALE — cx-handbook/ differs from a fresh build: {len(stale)} changed/missing, {len(extra)} extra '
                  f'({", ".join((stale + extra)[:4])}). Run: python3 tools/build-cx-handbook.py --apply')
            return 1
        print(f'OK — cx-handbook/ is current: {summary}')
        return 0
    if apply_:
        OUT.mkdir(exist_ok=True)
        for n, s in out.items():
            (OUT / n).write_text(s, encoding='utf-8')
        for p in OUT.glob('*.html'):
            if p.name not in out:
                p.unlink()
        print(f'wrote cx-handbook/: {summary}')
        return 0
    print(f'dry run: {summary}; unanchored: {report["unanchored"]}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
