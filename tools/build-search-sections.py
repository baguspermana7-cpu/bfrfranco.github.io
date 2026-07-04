#!/usr/bin/env python3
"""build-search-sections.py — generate search-sections.json for palette deep search.

Scans editorial article pages (article-*.html, FF-*.html, geopolitics-*.html) for
<h2 id="..."> section headings inside the article body and emits one entry per
section:  { "t": heading text, "u": "page.html#id", "a": article title }

Only h2s with a STATIC id are indexed — runtime-assigned ids (toc-section-N /
slugs) are not reliable cross-page hash targets. Run with --apply to write
search-sections.json; without it, prints a summary.
"""
import glob, io, json, re, sys, html

APPLY = '--apply' in sys.argv

def text_of(fragment: str) -> str:
    t = re.sub(r'<[^>]+>', ' ', fragment)
    t = html.unescape(t)
    return ' '.join(t.split())

entries = []
pages = sorted(glob.glob('article-*.html')) + sorted(glob.glob('FF-*.html')) + sorted(glob.glob('geopolitics-*.html'))
for f in pages:
    if 'paper' in f:
        continue
    s = io.open(f, encoding='utf-8').read()
    tm = re.search(r'<title>([^<|]+)', s)
    title = text_of(tm.group(1)).strip() if tm else f
    body_at = s.find('class="article-body"')
    if body_at == -1:
        continue
    body = s[body_at:]
    for m in re.finditer(r'<h2\b[^>]*\bid="([^"]+)"[^>]*>(.*?)</h2>', body, re.S):
        hid, inner = m.group(1), m.group(2)
        heading = text_of(inner)
        # strip the runtime anchor glyph if present in source (it isn't) + numbering artifacts
        heading = heading.strip(' #').strip()
        if not heading or len(heading) < 4:
            continue
        entries.append({'t': heading[:110], 'u': f + '#' + hid, 'a': title[:80]})

print(f'{len(entries)} section entries from {len(pages)} pages')
if APPLY:
    io.open('search-sections.json', 'w', encoding='utf-8').write(
        json.dumps(entries, ensure_ascii=False, separators=(',', ':')))
    print('wrote search-sections.json')
else:
    for e in entries[:5]:
        print('  ', e)
    print('  … (--apply to write search-sections.json)')
