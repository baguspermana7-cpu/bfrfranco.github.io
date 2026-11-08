#!/usr/bin/env python3
"""Build pillar-sustainability.html (K25) on the reference-page frame of pillar-fire-safety.html.

The frame (CSS, scripts, TOC, explorable-figure runtime, nav, footer) comes from the fire pillar; the head
metadata, hero, body and JSON-LD are this page's own. Body: tools/pillars/sustainability-body.html.
Figures are filled afterwards by `node tools/build-article-diagrams.mjs` (ids sust-d1, sust-d2).
Usage: python3 tools/pillars/build-sustainability.py [--check]
"""
import html, json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FRAME = ROOT / 'pillar-fire-safety.html'
OUT = ROOT / 'pillar-sustainability.html'
BODY = ROOT / 'tools' / 'pillars' / 'sustainability-body.html'
SLUG = 'pillar-sustainability'
TITLE = 'Data Center Sustainability Metrics: PUE, WUE, CUE, ERF, REF'
DESC = ('PUE, WUE, CUE, ERF and REF on one facility drawing: the ISO/IEC 30134 definitions, PUE measurement categories '
        'and a worked 10 MW example.')
KEYWORDS = ('data center sustainability, PUE, WUE, CUE, ERF, REF, ISO/IEC 30134, power usage effectiveness, water usage '
            'effectiveness, carbon usage effectiveness, energy reuse factor, renewable energy factor, Energy Efficiency Directive')
OG_ALT = 'Data center sustainability metrics on one facility drawing'
DATE = '2026-11-09'


def sub1(pattern, repl, s, flags=0):
    out, n = re.subn(pattern, lambda m: repl, s, count=1, flags=flags)
    if n != 1:
        raise SystemExit('frame changed: no match for ' + pattern[:60])
    return out


def faq(body):
    qs = re.findall(r'<div class="ws-insight-box">\s*<h3>(.*?)</h3>\s*<p>(.*?)</p>', body.split('<h2 id="faq"')[1].split('<h2 id="sources"')[0], re.S)
    clean = lambda t: html.unescape(re.sub(r'<[^>]+>', '', t)).strip()
    return [{'@type': 'Question', 'name': clean(q), 'acceptedAnswer': {'@type': 'Answer', 'text': clean(a)}} for q, a in qs]


def build():
    s = FRAME.read_text()
    body = BODY.read_text()
    words = len(re.sub(r'<[^>]+>', ' ', body).split())
    esc = html.escape
    s = sub1(r'<title>.*?</title>', '<title>' + esc(TITLE) + ' | ResistanceZero</title>', s, re.S)
    s = sub1(r'<meta name="description" content="[^"]*">', '<meta name="description" content="' + esc(DESC) + '">', s)
    s = sub1(r'<meta name="keywords" content="[^"]*">', '<meta name="keywords" content="' + esc(KEYWORDS) + '">', s)
    for k in ('og:title', 'twitter:title'):
        attr = 'property' if k.startswith('og') else 'name'
        s = sub1(r'<meta ' + attr + '="' + k + '" content="[^"]*">', '<meta ' + attr + '="' + k + '" content="' + esc(TITLE) + '">', s)
    for k in ('og:description', 'twitter:description'):
        attr = 'property' if k.startswith('og') else 'name'
        s = sub1(r'<meta ' + attr + '="' + k + '" content="[^"]*">', '<meta ' + attr + '="' + k + '" content="' + esc(DESC) + '">', s)
    for k in ('og:image:alt', 'twitter:image:alt'):
        attr = 'property' if k.startswith('og') else 'name'
        s = sub1(r'<meta ' + attr + '="' + k + '" content="[^"]*">', '<meta ' + attr + '="' + k + '" content="' + esc(OG_ALT) + '">', s)
    s = s.replace('pillar-fire-safety', SLUG)
    ld = [
        {'@context': 'https://schema.org', '@type': 'CollectionPage', 'name': TITLE, 'description': DESC,
         'url': 'https://resistancezero.com/' + SLUG + '.html', 'dateModified': DATE, 'wordCount': words,
         'author': {'@type': 'Person', 'name': 'Bagus Dwi Permana', 'jobTitle': 'Engineering Operations Manager', 'url': 'https://resistancezero.com/'}},
        {'@context': 'https://schema.org', '@type': 'BreadcrumbList', 'itemListElement': [
            {'@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': 'https://resistancezero.com/'},
            {'@type': 'ListItem', 'position': 2, 'name': 'Sustainability metrics'}]},
        {'@context': 'https://schema.org', '@type': 'FAQPage', 'mainEntity': faq(body)}]
    blocks = re.findall(r'<script type="application/ld\+json">.*?</script>', s, re.S)
    if len(blocks) != 3:
        raise SystemExit('frame changed: expected 3 JSON-LD blocks')
    for old, new in zip(blocks, ld):
        s = s.replace(old, '<script type="application/ld+json">\n' + json.dumps(new, indent=4, ensure_ascii=False) + '\n</script>', 1)
    hero = ('<header class="article-hero">\n<div class="hero-container">\n<div class="article-category">Reference &middot; Sustainability</div>\n'
            '<h1 class="article-title">Data Center Sustainability Metrics<br><span class="highlight">PUE, WUE, CUE, ERF and REF on one facility</span></h1>\n'
            '<p class="article-subtitle">What each ratio divides by, where the meter must sit, why the same site can publish two carbon numbers, and a worked 10 MW example you can check.</p>\n'
            '<div class="article-meta">\n<span class="article-author">Bagus Dwi Permana</span>\n<span class="article-date">Updated November 9, 2026</span>\n'
            '<span class="article-readtime">' + str(max(1, round(words / 230))) + ' min read</span>\n</div>\n</div>\n</header>')
    s = sub1(r'<header class="article-hero">.*?</header>', hero, s, re.S)
    s = sub1(r'(<div class="article-body">\n).*?(\n</div>\n</div>\n</article>\n</main>)', None, s, re.S) if False else \
        re.sub(r'(<div class="article-body">\n).*?(\n</div>\n</div>\n</article>\n</main>)', lambda m: m.group(1) + body.strip() + '\n' + m.group(2), s, count=1, flags=re.S)
    return nav_register(s)


def nav_register(s):
    # the fire pillar frame is skipped by the site register's nav family; this page is not, so its menu
    # gets the same rewrite tools/sweep-site-register.py applies (one accent, no per-link hues)
    import importlib.util
    spec = importlib.util.spec_from_file_location('sweep_site_register', ROOT / 'tools' / 'sweep-site-register.py')
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    for pair in mod.FAMILIES['nav']['pairs']:
        s = re.sub(pair[1], pair[2], s)
    return s


if __name__ == '__main__':
    new = build()
    if '--check' in sys.argv:
        cur = OUT.read_text()
        strip = lambda t: re.sub(r'<figure class="rz-figure" data-rz-figure="[^"]+">.*?</figure>', '', t, flags=re.S)
        sys.exit(0 if strip(cur) == strip(new) else 1)
    OUT.write_text(new)
    print('wrote', OUT.name, len(new), 'bytes')
