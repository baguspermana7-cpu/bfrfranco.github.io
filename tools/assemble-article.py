#!/usr/bin/env python3
"""assemble-article.py — build article-N.html from its research dossier and agent fragments.

ARTICLE_PRODUCTION_STANDARD.md §5. The shell (head, navbar, inline register styles, author bio,
footer, scripts) is taken from the PREVIOUS article, which is already on the editorial register;
everything specific comes from `Article/Article_<N>/build/article.json` plus the fragments next to it:

  build/sec-01.html … sec-NN.html   one per H2 (the prose agents' output)
  build/calc-<key>.html             spliced over `<div class="<calcClass>" data-<calcAttr>="<key>"></div>`
  build/facts.json                  hero fact list   [{value,label,sub}]
  build/key-numbers.json            key numbers      [{k,v,s}]
  build/faq.json                    visible FAQ + FAQPage JSON-LD [{q,a}]
  RESEARCH.md §Sources table        `| S1 | title | url | date | taken |` → #src-N list

article.json keys: n, prev, title, short, desc (<=160, a full sentence), keywords, tags[], date (YYYY-MM-DD),
dateLabel, category, section, highlightTitle, highlightClause, subtitle, ogAlt, cover (optional {src, alt,
caption}), calcScripts[], calcClass, calcAttr, related[[n, title, blurb]], keyAnswer, crossLinks[[text, href]].

Writes article-N.html and its search-index.json entry (idempotent), then restamps the cache tokens of the
scripts it loads. It does not run the figure builder or the series sync — the standard's §6 does.

  python3 tools/assemble-article.py 30
"""
import html
import json
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def main(n):
    B = f'{ROOT}/Article/Article_{n}/build'
    C = json.load(open(f'{B}/article.json', encoding='utf-8'))
    prev = C.get('prev', n - 1)
    src = open(f'{ROOT}/article-{prev}.html', encoding='utf-8').read()
    facts = json.load(open(f'{B}/facts.json', encoding='utf-8'))
    keys = json.load(open(f'{B}/key-numbers.json', encoding='utf-8'))
    faq = json.load(open(f'{B}/faq.json', encoding='utf-8'))
    calc_cls, calc_attr = C.get('calcClass', 'llm-calc'), C.get('calcAttr', 'data-llm-calc')

    # sources from the dossier
    research = open(f'{ROOT}/Article/Article_{n}/RESEARCH.md', encoding='utf-8').read()
    rows = [(a, b, c.split(' ; ')[0].strip(), d, e) for a, b, c, d, e in
            re.findall(r'^\| (S\d+[a-z]?) \| (.*?) \| (.*?) \| (.*?) \| (.*?) \|$', research, re.M)]
    src_items = []
    for sid, title, url, date, taken in rows:
        host = re.sub(r'^https?://(www\.)?', '', url).split('/')[0]
        link = (f'<a href="{html.escape(url)}" target="_blank" rel="noopener">{html.escape(host)}</a>'
                if url.startswith('http') else "the author's own files, not public; described in the text")
        src_items.append(f'<li id="src-{sid[1:]}"><strong>[{sid}]</strong> {title} &mdash; {link} ({html.escape(date)}). '
                         f'<span class="src-taken">Taken: {taken}</span></li>')

    # body
    parts = []
    i = 1
    while os.path.exists(f'{B}/sec-{i:02d}.html'):
        s = open(f'{B}/sec-{i:02d}.html', encoding='utf-8').read().strip()
        s = re.sub(r'<div class="' + re.escape(calc_cls) + r'" ' + re.escape(calc_attr) + r'="([a-z]+)"></div>',
                   lambda m: open(f'{B}/calc-{m.group(1)}.html', encoding='utf-8').read().strip()
                   if os.path.exists(f'{B}/calc-{m.group(1)}.html') else m.group(0), s)
        parts.append(s)
        i += 1
    if not parts:
        sys.exit(f'no fragments in {B}')
    body = '\n\n'.join(parts)
    for text, href in C.get('crossLinks', []):
        body = re.sub(r'(?<![">/])' + re.escape(text) + r'(?![^<]*</a>)', f'<a href="{href}">{text}</a>', body, count=1)
    words = len(re.sub(r'<[^>]+>', ' ', body).split())
    read = max(8, round(words / 230))
    cited = set(re.findall(r'href="#src-(\d+[a-z]?)"', body))
    defined = {sid[1:] for sid, *_ in rows}
    if cited - defined:
        sys.exit(f'cited sources missing from the dossier list: {sorted(cited - defined)}')

    # head
    head = src[:src.index('<body')].replace(f'article-{prev}', f'article-{n}')
    E = html.escape
    for pat, val in [(r'<title>[^<]*</title>', f'<title>{E(C["title"])} | ResistanceZero</title>'),
                     (r'<meta name="description" content="[^"]*">', f'<meta name="description" content="{E(C["desc"])}">'),
                     (r'<meta name="keywords" content="[^"]*">', f'<meta name="keywords" content="{E(C["keywords"])}">'),
                     (r'<meta property="og:title" content="[^"]*">', f'<meta property="og:title" content="{E(C["short"])}">'),
                     (r'<meta property="og:description" content="[^"]*">', f'<meta property="og:description" content="{E(C["desc"])}">'),
                     (r'<meta property="og:image:alt" content="[^"]*">', f'<meta property="og:image:alt" content="{E(C["ogAlt"])}">'),
                     (r'<meta name="twitter:title" content="[^"]*">', f'<meta name="twitter:title" content="{E(C["short"])}">'),
                     (r'<meta name="twitter:description" content="[^"]*">', f'<meta name="twitter:description" content="{E(C["desc"])}">'),
                     (r'<meta name="twitter:image:alt" content="[^"]*">', f'<meta name="twitter:image:alt" content="{E(C["ogAlt"])}">'),
                     (r'(<meta property="article:(?:published|modified)_time" content=")[^"]*(")', r'\g<1>' + C['date'] + r'T00:00:00Z\g<2>'),
                     (r'<meta property="article:section" content="[^"]*">', f'<meta property="article:section" content="{E(C["section"])}">')]:
        head = re.sub(pat, val, head)
    head = re.sub(r'(<meta property="article:tag" content="[^"]*">\s*)+',
                  ''.join(f'<meta property="article:tag" content="{E(t)}">\n    ' for t in C['tags']), head, count=1)
    # calculator scripts: drop the previous article's, add this one's (before the TOC script); an unchanged
    # shared helper keeps the token it already has everywhere (a --fix on an unchanged file re-dates it)
    mtok = re.search(r'js/rz-calc-utils\.js\?v=([^"]+)"', src)
    utils_tok = mtok.group(1) if mtok else 'dev'
    for old in ('rz-llm-calc.js', 'rz-agent-calc.js', 'rz-calc-utils.js'):
        head = re.sub(r'\s*<script src="js/' + re.escape(old) + r'\?v=[^"]*" defer></script>', '', head)
    scripts = f'<script src="js/rz-calc-utils.js?v={utils_tok}" defer></script>\n    ' + ''.join(f'<script src="js/{s}?v=dev" defer></script>\n    ' for s in C.get('calcScripts', []))
    head = head.replace('<script src="js/rz-article-toc.js', scripts + '<script src="js/rz-article-toc.js', 1)
    ld = [
        {"@context": "https://schema.org", "@type": "TechnicalArticle", "headline": C['title'], "description": C['desc'],
         "image": f"https://resistancezero.com/assets/og/article-{n}.webp",
         "author": {"@type": "Person", "name": "Bagus Dwi Permana", "jobTitle": "Engineering Operations Manager",
                    "sameAs": ["https://www.linkedin.com/in/bagus-dwi-permana-ba90b092/", "https://resistancezero.com"]},
         "publisher": {"@type": "Organization", "name": "ResistanceZero", "url": "https://resistancezero.com",
                       "logo": {"@type": "ImageObject", "url": "https://resistancezero.com/assets/Favicon.png"}},
         "datePublished": C['date'], "dateModified": C['date'], "wordCount": str(words), "articleSection": C['category'],
         "keywords": [k.strip() for k in C['keywords'].split(',')],
         "mainEntityOfPage": {"@type": "WebPage", "@id": f"https://resistancezero.com/article-{n}.html"}},
        {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": "https://resistancezero.com/"},
            {"@type": "ListItem", "position": 2, "name": "Journal", "item": "https://resistancezero.com/articles.html"},
            {"@type": "ListItem", "position": 3, "name": C['short'], "item": f"https://resistancezero.com/article-{n}.html"}]},
        {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [
            {"@type": "Question", "name": html.unescape(x['q']),
             "acceptedAnswer": {"@type": "Answer", "text": html.unescape(x['a'])}} for x in faq]}]
    blocks = ''.join('    <script type="application/ld+json">\n' + json.dumps(d, ensure_ascii=False, indent=2) + '\n    </script>\n' for d in ld)
    head = re.sub(r'\s*<script type="application/ld\+json">[\s\S]*?</script>', '', head)
    head = head.replace('<link rel="preconnect" href="https://fonts.googleapis.com">',
                        blocks + '    <link rel="preconnect" href="https://fonts.googleapis.com">', 1)

    # shell pieces
    body_open = src[src.index('<body'):src.index('<header class="article-hero">')]
    tail = src[src.index('<div class="author-bio">'):]
    for old in ('rz-llm-calc.js', 'rz-agent-calc.js', 'rz-calc-utils.js'):
        tail = re.sub(r'\n?<script src="js/' + re.escape(old) + r'\?v=[^"]*" defer></script>', '', tail)
    rel = ('<div class="related-articles">\n<h3>Continue Reading</h3>\n<div class="related-grid">\n' + ''.join(
        f'<a href="article-{r}.html" class="related-card">\n<div class="related-card-number">{r}</div>\n'
        f'<div class="related-card-content">\n<h4>{E(t)}</h4>\n<p>{E(d)}</p>\n</div>\n</a>\n' for r, t, d in C['related'])
        + '</div>\n</div>\n')
    m = re.search(r'<div class="related-articles">[\s\S]*?</div>\s*</div>\s*</div>\n', tail)
    if not m:
        sys.exit('related block not found in the previous article')
    tail = tail[:m.start()] + rel + tail[m.end():]

    cover = C.get('cover')
    cover_html = (f'<figure class="article-cover">\n<img src="{E(cover["src"])}" alt="{E(cover["alt"])}" width="1600" height="900" '
                  f'fetchpriority="high">\n<figcaption>{cover["caption"]}</figcaption>\n</figure>\n') if cover else ''
    hero = (f'<header class="article-hero">\n<div class="hero-container">\n<div class="article-category">{C["category"]} &middot; {C["section"]}</div>\n'
            f'<h1 class="article-title">{C["highlightTitle"]}<br><span class="highlight">{C["highlightClause"]}</span></h1>\n'
            f'<p class="article-subtitle">{C["subtitle"]}</p>\n<div class="article-meta">\n<span class="article-author">Bagus Dwi Permana</span>\n'
            f'<span class="article-date">{C["dateLabel"]}</span>\n<span class="article-readtime">{read} min read</span>\n</div>\n</div>\n</header>\n'
            '<!-- Evidence Block -->\n<div class="col-evidence-block">\n<div data-rz-fact-list class="col-evidence-grid">\n'
            + ''.join(f'<div class="col-evidence-card">\n<div class="col-evidence-value">{f["value"]}</div>\n<div class="col-evidence-label">{f["label"]}</div>\n'
                      f'<div class="col-evidence-sub">{f["sub"]}</div>\n</div>\n' for f in facts)
            + '</div>\n</div>\n<!-- Series Navigation -->\n<div class="series-nav">\n<div class="series-badge">\n'
            f'<span class="series-badge-icon">{n}</span>\nEngineering Journal &mdash; Article {n} of {n}\n</div>\n<span class="series-title"></span>\n'
            '<div class="series-links">\n'
            f'<a href="article-{prev}.html" class="series-link"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>Prev</a>\n'
            '<span class="series-link disabled">Next<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></span>\n'
            '</div>\n</div>\n<!-- Article Content -->\n<main id="main-content">\n<article class="article-content">\n<div class="container">\n<div class="article-body">\n'
            + cover_html)
    def src_ref(s):
        return ' '.join(f'<a href="#src-{x.strip().lstrip("S")}">[S{x.strip().lstrip("S")}]</a>' for x in str(s).split(',') if x.strip()) if s else ''
    key_html = ('<section id="key-numbers" class="key-numbers">\n<h2>Key numbers</h2>\n'
                f'<p>The figures this article rests on; each is sourced in <a href="#sources">Sources</a>.</p>\n<ol class="key-list">\n'
                + ''.join(f'<li><strong>{k["k"]}</strong> &mdash; {k["v"]} {src_ref(k.get("s"))}</li>\n' for k in keys)
                + f'</ol>\n<p class="key-answer">{C["keyAnswer"]}</p>\n</section>\n')
    faq_html = '<h2 id="faq">Frequently asked questions</h2>\n' + ''.join(
        f'<div class="ws-insight-box">\n<h4>{E(x["q"])}</h4>\n<p>{E(x["a"])}</p>\n</div>\n' for x in faq)
    sources_html = (f'<h2 id="sources">Sources &amp; further reading</h2>\n<p class="src-note">{len(rows)} sources, accessed '
                    f'{C.get("accessed", C["date"])} unless the source says otherwise. Numbers marked (derived) are recomputed '
                    'from these sources, with the arithmetic shown.</p>\n<ul class="ws-sources">\n' + '\n'.join(src_items) + '\n</ul>\n')
    nav_html = (f'<div class="article-nav">\n<a href="article-{prev}.html"><i class="fas fa-arrow-left"></i> Previous Article</a>\n'
                '<a href="articles.html">All Articles</a>\n<span>Latest Article</span>\n</div>\n')
    page = head + body_open + hero + key_html + body + '\n' + faq_html + sources_html + nav_html + tail
    open(f'{ROOT}/article-{n}.html', 'w', encoding='utf-8').write(page)
    print(f'article-{n}.html {len(page)} bytes; {words} words; {read} min; {len(rows)} sources; {len(faq)} FAQ')

    # search-index entry (idempotent)
    p = f'{ROOT}/search-index.json'
    idx = json.load(open(p, encoding='utf-8'))
    url = f'article-{n}.html'
    old = [e for e in idx if e.get('url') == url]
    entry = {"id": old[0]['id'] if old else max([e['id'] for e in idx if isinstance(e.get('id'), int)] + [0]) + 1,
             "title": C['title'], "url": url, "description": C['desc'], "category": C['category'],
             "keywords": [k.strip() for k in C['keywords'].split(',')][:12], "image": f"assets/og/article-{n}.webp",
             "date": C['date'], "readingTime": read}
    idx = [e for e in idx if e.get('url') != url]
    pos = next((i for i, e in enumerate(idx) if e.get('url') == f'article-{prev}.html'), len(idx) - 1)
    idx.insert(pos, entry)
    text = json.dumps(idx, ensure_ascii=False, indent=2) + '\n'
    open(p, 'w', encoding='utf-8').write(text)
    print(f'search-index: {url} id {entry["id"]}')
    r = subprocess.run(['node', 'tools/test-asset-cache-tokens.mjs', '--fix'] +
                       [f'js/{s}' for s in C.get('calcScripts', [])], cwd=ROOT, capture_output=True, text=True)
    print((r.stdout.strip().splitlines() or [''])[-1][:100])


if __name__ == '__main__':
    if len(sys.argv) != 2 or not sys.argv[1].isdigit():
        sys.exit('usage: python3 tools/assemble-article.py <N>')
    main(int(sys.argv[1]))
