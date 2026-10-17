#!/usr/bin/env python3
"""build-journal.py — ONE source of truth for the journal: data/journal.json + the card grids.

Every article page already states what it is in its own <head> (og:title, description,
article:published_time, article:section, article:tag, "N min read"). The journal hub
(articles.html) and the three series landings (insights.html, geopolitics.html,
future-forward.html) used to carry hand-written copies of those cards — 28 + 3 + 3 + 9 of
them, each drifting on its own. This tool reads the pages, assigns each one a TOPIC from
the curated map below (97 raw tags, 93 of them used once, are not a filter — Hick's law),
writes data/journal.json, and splices the rendered cards into every page that carries a
marker pair:

    <!-- journal:grid scope=all -->        ... <!-- /journal:grid -->
    <!-- journal:grid scope=series:ff -->  (series:global, series:journal)
    <!-- journal:grid scope=latest:9 -->
    <!-- journal:meta -->                  one mono line: "28 articles · 3 series · updated 22 Jul 2026"

Run:   python3 tools/build-journal.py --apply     (write json + splice pages)
       python3 tools/build-journal.py --check     (exit 1 when any output is stale, for the
                                                   generator-freshness gate)
A page whose meta is missing, or an article not in the topic map, fails the build — a card
with a blank where its date should be is worse than a red gate.
"""
import argparse
import datetime as dt
import html
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JSON_OUT = os.path.join(ROOT, 'data', 'journal.json')

TOPICS = [
    ('ai', 'AI & HPC infrastructure'),
    ('cooling', 'Cooling & thermal'),
    ('power', 'Power & grid'),
    ('ops', 'Operations & maintenance'),
    ('reliability', 'Reliability & safety'),
    ('market', 'Market, economics & policy'),
    ('water', 'Sustainability & water'),
    ('workforce', 'Workforce & careers'),
]
SERIES = [
    ('journal', 'Engineering Journal', 'insights.html'),
    ('global', 'Global Analysis', 'geopolitics.html'),
    ('ff', 'Future Forward', 'future-forward.html'),
]
# Curated: exactly one topic per page. Adding an article = one line here, or the build fails.
TOPIC_OF = {
    'article-1': 'reliability', 'article-2': 'ops', 'article-3': 'ops', 'article-4': 'ops',
    'article-5': 'reliability', 'article-6': 'reliability', 'article-7': 'reliability', 'article-8': 'reliability',
    'article-9': 'cooling', 'article-10': 'water', 'article-11': 'power', 'article-12': 'power',
    'article-13': 'power', 'article-14': 'market', 'article-15': 'ops', 'article-16': 'market',
    'article-17': 'market', 'article-18': 'ai', 'article-19': 'market', 'article-20': 'water',
    'article-21': 'power', 'article-22': 'ai', 'article-23': 'ai', 'article-24': 'workforce',
    'article-25': 'power', 'article-26': 'cooling', 'article-27': 'workforce', 'article-28': 'ai', 'article-29': 'ai',
    'FF-1': 'ai', 'FF-2': 'ai', 'FF-3': 'workforce',
    'geopolitics-1': 'reliability', 'geopolitics-2': 'market', 'geopolitics-3': 'reliability',
}
SERIES_OF = {'article-25': 'global', 'article-26': 'global', 'article-27': 'global', 'article-28': 'ff', 'article-29': 'ff',
             'article-14': 'global', 'article-16': 'global', 'article-17': 'global', 'article-19': 'global'}
PAGES = ['article-%d' % n for n in range(1, 30)] + ['FF-1', 'FF-2', 'FF-3', 'geopolitics-1', 'geopolitics-2', 'geopolitics-3']
SPLICE_PAGES = ['articles.html', 'articles1.html', 'insights.html', 'geopolitics.html', 'future-forward.html']

META_RE = re.compile(r'<meta\s+(?:property|name)="([^"]+)"\s+content="([^"]*)"', re.I)


def meta_of(text):
    out = {}
    for k, v in META_RE.findall(text):
        out.setdefault(k, []).append(html.unescape(v))
    return out


def read_page(pid):
    path = os.path.join(ROOT, pid + '.html')
    with open(path, encoding='utf-8') as fh:
        text = fh.read()
    m = meta_of(text)
    title = (m.get('og:title') or m.get('twitter:title') or [''])[0]
    title = re.sub(r'\s*[|–]\s*(ResistanceZero|Bagus Dwi Permana).*$', '', title).strip()
    desc = (m.get('description') or m.get('og:description') or [''])[0].strip()
    date = (m.get('article:published_time') or [''])[0][:10]
    section = (m.get('article:section') or [''])[0].strip()
    tags = [t.strip() for t in m.get('article:tag', []) if t.strip()]
    rm = re.search(r'(\d+)\s*min read', text)
    missing = [k for k, v in (('og:title', title), ('description', desc), ('article:published_time', date),
                              ('article:section', section), ('min read', rm)) if not v]
    if missing:
        raise SystemExit('%s.html: missing %s' % (pid, ', '.join(missing)))
    if pid not in TOPIC_OF:
        raise SystemExit('%s.html: not in TOPIC_OF — assign a topic in tools/build-journal.py' % pid)
    try:
        d = dt.date.fromisoformat(date)
    except ValueError:
        raise SystemExit('%s.html: bad article:published_time %r' % (pid, date))
    if pid.startswith('article-'):
        number = pid.split('-')[1]
    elif pid.startswith('FF-'):
        number = 'FF ' + pid.split('-')[1]
    else:
        number = 'G ' + pid.split('-')[1]
    series = SERIES_OF.get(pid, 'ff' if pid.startswith('FF-') else 'global' if pid.startswith('geopolitics-') else 'journal')
    image = None
    # a page may carry a separate card image (assets/<id>-card.webp) for the journal grid; else its hero;
    # the series pages keep their older cover naming (assets/future-forward-N-cover.webp, geopolitics-N-cover.*)
    series_cover = pid.replace('FF-', 'future-forward-') + '-cover'
    for cand in ('assets/%s-card.webp' % pid.lower(), 'assets/%s-card.webp' % pid, 'assets/%s-hero.webp' % pid.lower(), 'assets/%s-hero.webp' % pid,
                 'assets/%s.webp' % series_cover, 'assets/%s.jpg' % series_cover):
        if os.path.exists(os.path.join(ROOT, cand)):
            image = cand
            break
    alt = ''
    if image:
        am = re.search(r'<img[^>]*src="' + re.escape(image) + r'"[^>]*alt="([^"]*)"', text) or \
             re.search(r'<img[^>]*alt="([^"]*)"[^>]*src="' + re.escape(image) + r'"', text)
        alt = html.unescape(am.group(1)) if am else title
    return {
        'id': pid, 'url': pid + '.html', 'number': number, 'title': title, 'excerpt': desc,
        'date': date, 'dateLabel': d.strftime('%d %b %Y').lstrip('0'), 'section': section,
        'series': series, 'topic': TOPIC_OF[pid], 'tags': tags, 'readMin': int(rm.group(1)),
        'image': image, 'alt': alt,
    }


def build():
    items = [read_page(p) for p in PAGES]
    items.sort(key=lambda a: (a['date'], a['id'].startswith('article-') and int(a['id'].split('-')[1]) or 0), reverse=True)
    counts = {t[0]: sum(1 for a in items if a['topic'] == t[0]) for t in TOPICS}
    sc = {s[0]: sum(1 for a in items if a['series'] == s[0]) for s in SERIES}
    return {
        'generated': 'tools/build-journal.py',
        'count': len(items),
        'updated': items[0]['date'],
        'updatedLabel': items[0]['dateLabel'],
        'topics': [{'id': t[0], 'label': t[1], 'count': counts[t[0]]} for t in TOPICS],
        'series': [{'id': s[0], 'label': s[1], 'page': s[2], 'count': sc[s[0]]} for s in SERIES],
        'articles': items,
    }


def card(a, labels):
    e = html.escape
    tags = a['tags'][:3]
    # no image = no media block: a numbered grey box carries nothing (ANTI_VIBECODE §D18)
    media = ('<div class="jcard-media"><img loading="lazy" decoding="async" src="%s" alt="%s" width="1200" height="630"></div>'
             % (e(a['image']), e(a['alt']))) if a['image'] else ''
    return ('<article class="jcard" data-id="%s" data-topic="%s" data-series="%s" data-date="%s" data-read="%d" data-tags="%s">'
            % (e(a['id']), a['topic'], a['series'], a['date'], a['readMin'], e('|'.join(t.lower() for t in a['tags'])))
            + media
            + '<div class="jcard-body">'
            + '<p class="jcard-eyebrow"><span>%s</span><span>%s</span></p>' % (e(labels['topic'][a['topic']]), e(labels['series'][a['series']]))
            + '<h3 class="jcard-title"><a href="%s">%s</a></h3>' % (e(a['url']), e(a['title']))
            + '<p class="jcard-excerpt">%s</p>' % e(a['excerpt'])
            + '<p class="jcard-meta"><time datetime="%s">%s</time><span>%d min read</span><span class="jcard-no">No. %s</span></p>'
              % (a['date'], e(a['dateLabel']), a['readMin'], e(a['number']))
            + ('<p class="jcard-tags">' + ''.join('<button type="button" class="jtag" data-tag="%s">%s</button>' % (e(t.lower()), e(t)) for t in tags) + '</p>' if tags else '')
            + '</div></article>')


def render(scope, data):
    labels = {'topic': {t['id']: t['label'] for t in data['topics']}, 'series': {s['id']: s['label'] for s in data['series']}}
    items = data['articles']
    if scope.startswith('series:'):
        items = [a for a in items if a['series'] == scope.split(':')[1]]
    elif scope.startswith('latest:'):
        items = items[:int(scope.split(':')[1])]
    elif scope != 'all':
        raise SystemExit('unknown journal:grid scope %r' % scope)
    return '\n'.join(card(a, labels) for a in items)


def chip(key, value, label, n, on=False):
    return ('<button type="button" class="jchip" data-%s="%s" aria-pressed="%s">%s <span class="jchip-n">%d</span></button>'
            % (key, value, 'true' if on else 'false', html.escape(label), n))


def toolbar(scope, data):
    """The static toolbar js/rz-journal-filter.js wires: search, sort, topic chips, series chips
    (hub only), the live count, the active-tag chip and the Clear action. Counts are for the
    scope; the script recounts them under the live filters."""
    items = data['articles']
    series_fixed = scope.split(':')[1] if scope.startswith('series:') else ''
    if series_fixed:
        items = [a for a in items if a['series'] == series_fixed]
    tc = {t['id']: sum(1 for a in items if a['topic'] == t['id']) for t in data['topics']}
    sc = {s['id']: sum(1 for a in items if a['series'] == s['id']) for s in data['series']}
    rows = ['<form class="jtool" role="search" aria-label="Filter the journal" data-journal-filter data-scope="%s">' % html.escape(scope),
            '<div class="jtool-row jtool-fields">',
            '<label class="jtool-search"><span class="jtool-label">Search</span>'
            '<input type="search" name="q" placeholder="Title, summary or tag" autocomplete="off" spellcheck="false">'
            '<kbd aria-hidden="true">/</kbd></label>',
            '<label class="jtool-sort"><span class="jtool-label">Sort</span><select name="sort">'
            '<option value="new">Newest first</option><option value="old">Oldest first</option>'
            '<option value="long">Longest read</option><option value="short">Shortest read</option></select></label>',
            '</div>',
            '<div class="jtool-row jtool-chips" role="group" aria-label="Topic">',
            chip('topic', '', 'All topics', len(items), True)]
    rows += [chip('topic', t['id'], t['label'], tc[t['id']]) for t in data['topics']]
    rows.append('</div>')
    if not series_fixed:
        rows.append('<div class="jtool-row jtool-chips jtool-series" role="group" aria-label="Series">')
        rows.append(chip('series', '', 'All series', len(items), True))
        rows += [chip('series', s['id'], s['label'], sc[s['id']]) for s in data['series']]
        rows.append('</div>')
    rows.append('<p class="jtool-status"><span aria-live="polite"><b data-journal-count>%d</b> of %d articles</span>'
                '<span class="jtool-tag" data-journal-tag hidden>tag: <span></span> <button type="button" aria-label="Remove tag filter">×</button></span>'
                '<button type="button" class="jtool-clear" hidden>Clear filters</button></p>' % (len(items), len(items)))
    rows.append('</form>')
    return '\n'.join(rows)


EMPTY = '<p class="jtool-empty" data-journal-empty hidden>No article matches these filters. <button type="button">Clear filters</button></p>'

GRID_RE = re.compile(r'(<!-- journal:grid scope=([a-z0-9:]+) -->)(.*?)(<!-- /journal:grid -->)', re.S)
TOOLBAR_RE = re.compile(r'(<!-- journal:toolbar scope=([a-z0-9:]+) -->)(.*?)(<!-- /journal:toolbar -->)', re.S)
META_BLOCK_RE = re.compile(r'(<!-- journal:meta -->)(.*?)(<!-- /journal:meta -->)', re.S)


def splice(text, data):
    def g(m):
        return m.group(1) + '\n<div class="jgrid" data-journal-grid>\n' + render(m.group(2), data) + '\n</div>\n' + EMPTY + '\n' + m.group(4)
    text = GRID_RE.sub(g, text)
    text = TOOLBAR_RE.sub(lambda m: m.group(1) + '\n' + toolbar(m.group(2), data) + '\n' + m.group(4), text)
    meta = '%d articles · %d series · updated %s' % (data['count'], len(data['series']), data['updatedLabel'])
    return META_BLOCK_RE.sub(lambda m: m.group(1) + meta + m.group(3), text)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--apply', action='store_true', help='write data/journal.json and splice the pages')
    ap.add_argument('--check', action='store_true', help='exit 1 when any output is stale')
    args = ap.parse_args()
    data = build()
    js = json.dumps(data, ensure_ascii=False, indent=1) + '\n'
    stale = []
    cur = open(JSON_OUT, encoding='utf-8').read() if os.path.exists(JSON_OUT) else ''
    if cur != js:
        stale.append('data/journal.json')
    outputs = {}
    for page in SPLICE_PAGES:
        path = os.path.join(ROOT, page)
        if not os.path.exists(path):
            continue
        text = open(path, encoding='utf-8').read()
        if '<!-- journal:grid' not in text and '<!-- journal:meta -->' not in text:
            continue
        new = splice(text, data)
        if new != text:
            stale.append(page)
            outputs[path] = new
    if args.apply:
        os.makedirs(os.path.dirname(JSON_OUT), exist_ok=True)
        with open(JSON_OUT, 'w', encoding='utf-8') as fh:
            fh.write(js)
        for path, new in outputs.items():
            with open(path, 'w', encoding='utf-8') as fh:
                fh.write(new)
        print('journal: %d pages, %d topics; wrote data/journal.json and %d page(s)' % (data['count'], len(TOPICS), len(outputs)))
        return 0
    if stale:
        print('journal: STALE — ' + ', '.join(stale) + '  (run: python3 tools/build-journal.py --apply)')
        return 1 if args.check else 0
    print('journal: fresh (%d pages)' % data['count'])
    return 0


if __name__ == '__main__':
    sys.exit(main())
