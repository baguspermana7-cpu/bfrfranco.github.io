#!/usr/bin/env python3
"""
build-changelog-html.py — Reads CHANGELOG.md and generates changelog.html.

Usage:
    python3 tools/build-changelog-html.py          # dry-run: prints to stdout
    python3 tools/build-changelog-html.py --apply  # writes changelog.html

The script is idempotent — each run fully regenerates the output from source.
"""

import re
import sys
import os
import html as html_mod
from datetime import datetime



# ── Paths ──────────────────────────────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR   = os.path.dirname(SCRIPT_DIR)

def _asset_token(relpath: str) -> str:
    """A cache token derived from the file it busts (v3.9.4, generalised v3.9.5).

    This template used to carry hardcoded tokens (`?v=20260908-editorial`, `?v=2026-09-06-cards`),
    so every regenerated changelog.html silently reverted the tokens the rest of the site had moved
    on from — exactly the staleness tools/test-asset-cache-tokens.mjs now fails on.

    v3.10.19 — the DATE half used to be `datetime.date.today()`, and that made this
    generator non-deterministic across midnight. The digest is content-derived and stable,
    so on any day after a release `--check` compared yesterday's committed artifact against
    a token stamped with today's date and reported the artifact stale when nothing had
    changed. The ship gate then failed every day, for a file nobody had touched.

    Worse, the obvious remedy was a trap. `styles.min.css?v=20260920-544ad99b` is on 74
    pages, `js/rz-version.js?v=20260920-abd0285c` on 176 and `script.min.js` on 66;
    regenerating with today's date would have left changelog.html as the ONLY page with a
    different token for three shared assets — the "one asset served under two tokens" defect
    that tools/test-asset-cache-tokens.mjs exists to catch, introduced while satisfying a
    different gate.

    So the token follows the SITE, not the clock: adopt the date already in use for this
    asset wherever its digest still matches, and mint today's date only when the digest
    shows the asset has genuinely changed.
    """
    import hashlib
    import datetime
    import glob
    import re
    path = os.path.join(ROOT_DIR, relpath)
    with open(path, "rb") as handle:
        digest = hashlib.sha256(handle.read()).hexdigest()[:8]

    # The date the rest of the site already carries for THIS digest, most common first.
    pattern = re.compile(re.escape(relpath) + r"\?v=(\d{8})-" + re.escape(digest) + r"\b")
    seen = {}
    for page in glob.glob(os.path.join(ROOT_DIR, "*.html")):
        if os.path.basename(page) == "changelog.html":
            continue                      # never take the date from the file we are writing
        try:
            with open(page, "r", encoding="utf-8", errors="ignore") as handle:
                for stamp in pattern.findall(handle.read()):
                    seen[stamp] = seen.get(stamp, 0) + 1
        except OSError:
            continue
    if seen:
        # most used, then newest, so one asset keeps one token across the whole site
        best = sorted(seen.items(), key=lambda kv: (-kv[1], kv[0]))[0][0]
        return "{}-{}".format(best, digest)
    return "{:%Y%m%d}-{}".format(datetime.date.today(), digest)
CHANGELOG  = os.path.join(ROOT_DIR, 'CHANGELOG.md')
OUTPUT     = os.path.join(ROOT_DIR, 'changelog.html')

GITHUB_REPO = 'https://github.com/baguspermana7-cpu/bfrfranco.github.io'
COMMIT_BASE = f'{GITHUB_REPO}/commit/'

# ── Semver tier ────────────────────────────────────────────────────────────────
def version_tier(version_str):
    """Return 'major', 'minor', or 'patch' for v1.X.Y strings."""
    m = re.match(r'v?(\d+)\.(\d+)\.(\d+)', version_str)
    if not m:
        return 'patch'
    major, minor, patch = int(m.group(1)), int(m.group(2)), int(m.group(3))
    if patch > 0:
        return 'patch'
    if minor > 0:
        return 'minor'
    return 'major'


# ── Inline Markdown → HTML ─────────────────────────────────────────────────────
ENTRY_TAGS = {'a', 'article', 'code', 'div', 'em', 'h3', 'h4', 'li', 'ol', 'p', 'pre', 'span',
              'strong', 'table', 'tbody', 'td', 'th', 'thead', 'time', 'tr', 'ul'}


def inline_md(text):
    """Convert minimal Markdown inline syntax to HTML."""
    # B-001 fix: pull inline-code spans out FIRST and html-escape their
    # content, so backticked HTML in CHANGELOG (e.g. `<script src>`, `<li>`,
    # `<style id=...>`) can never emit a live tag into changelog.html (the
    # easter-egg page) and code stays literal (correct Markdown semantics).
    _code_spans = []

    def _stash_code(m):
        _code_spans.append(html_mod.escape(m.group(1)))
        return '\x00C%d\x00' % (len(_code_spans) - 1)

    # A span opens with a run of N backticks and closes with a run of exactly N (CommonMark), so
    # `` `<script src>` `` is one span. The single-backtick pattern read that as two EMPTY spans
    # around a raw <script src>, and the page shipped a live script tag that swallowed every older
    # entry and script.min.js with them (v3.24.35).
    def _stash_run(m):
        body = m.group(2)
        if len(body) > 1 and body.startswith(' ') and body.endswith(' ') and body.strip():
            body = body[1:-1]
        _code_spans.append(html_mod.escape(body))
        return '\x00C%d\x00' % (len(_code_spans) - 1)

    text = re.sub(r'(?<!`)(`+)(?!`)(.+?)(?<!`)\1(?!`)', _stash_run, text)
    # Prose is text, never markup: a code span broken across two Markdown lines left a bare
    # `<html data-rz-register="editorial"` in body text, which the browser opened as a tag and
    # which ate the words up to the next ">". Every tag on the page is now one this function writes.
    text = text.replace('<', '&lt;')
    # Auto-link 40-char hex commit hashes (before other replacements)
    text = re.sub(
        r'\b([0-9a-f]{7,40})\b',
        lambda m: f'<a href="{COMMIT_BASE}{m.group(1)}" class="commit-link" '
                  f'target="_blank" rel="noopener">'
                  f'<code>{m.group(1)[:7]}</code></a>',
        text
    )
    # Bold **text** or __text__
    text = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text)
    text = re.sub(r'__(.+?)__',     r'<strong>\1</strong>', text)
    # Italic *text* (single, not double).
    # Note: _underscore_ emphasis intentionally DISABLED — too many false positives
    # in identifiers (target="_blank", snake_case, _rzAuth, etc.). Use HTML <em> directly
    # if underscore emphasis is needed.
    text = re.sub(r'(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)', r'<em>\1</em>', text)
    # (Inline code spans were stashed+escaped at the top — B-001 fix)
    # Markdown links [text](url) — preserve existing HTML links
    text = re.sub(
        r'\[([^\]]+)\]\((https?://[^\)]+)\)',
        r'<a href="\2" target="_blank" rel="noopener">\1</a>',
        text
    )
    # Plain URLs not already in an href
    text = re.sub(
        r'(?<!href=")(?<!href=\')(https?://[^\s<>"\']+)',
        r'<a href="\1" target="_blank" rel="noopener">\1</a>',
        text
    )
    # B-001: restore the stashed, html-escaped inline-code spans
    text = re.sub(
        r'\x00C(\d+)\x00',
        lambda m: '<code>%s</code>' % _code_spans[int(m.group(1))],
        text
    )
    return text


# ── Block Markdown → HTML ──────────────────────────────────────────────────────
def md_block_to_html(lines):
    """Convert a list of Markdown text lines to an HTML fragment."""
    output = []
    in_list = False
    in_table = False
    in_code = False
    code_buf = []
    table_buf = []

    def flush_list():
        nonlocal in_list
        if in_list:
            output.append('</ul>')
            in_list = False

    def flush_table():
        nonlocal in_table, table_buf
        if in_table and table_buf:
            # Skip separator rows (|----|-----|)
            rows = [r for r in table_buf if not re.match(r'^\|[-| :]+\|$', r.strip())]
            if rows:
                output.append('<div class="cl-table-wrap"><table class="cl-table">')
                for i, row in enumerate(rows):
                    cells = [c.strip() for c in row.strip().strip('|').split('|')]
                    tag = 'th' if i == 0 else 'td'
                    tr = '<tr>' + ''.join(f'<{tag}>{inline_md(c)}</{tag}>' for c in cells) + '</tr>'
                    output.append(tr)
                output.append('</table></div>')
        in_table = False
        table_buf = []

    i = 0
    while i < len(lines):
        raw = lines[i]
        line = raw.rstrip()

        # Fenced code block
        if line.startswith('```'):
            if not in_code:
                flush_list()
                flush_table()
                in_code = True
                lang = line[3:].strip()
                code_buf = []
            else:
                in_code = False
                escaped = html_mod.escape('\n'.join(code_buf))
                output.append(f'<pre class="cl-code"><code>{escaped}</code></pre>')
                code_buf = []
            i += 1
            continue

        if in_code:
            code_buf.append(raw.rstrip())
            i += 1
            continue

        # Table rows
        if line.startswith('|'):
            flush_list()
            in_table = True
            table_buf.append(line)
            i += 1
            continue
        else:
            if in_table:
                flush_table()

        # Heading h3/h4 inside entry body
        if line.startswith('#### '):
            flush_list()
            output.append(f'<h4 class="cl-subhead">{inline_md(line[5:])}</h4>')
        elif line.startswith('### '):
            flush_list()
            output.append(f'<h3 class="cl-subhead">{inline_md(line[4:])}</h3>')
        # Blank line
        elif not line.strip():
            flush_list()
        # Horizontal rule
        elif re.match(r'^-{3,}$', line.strip()):
            flush_list()
        # List item: - / * / + or numbered
        elif re.match(r'^[\-\*\+] ', line):
            if not in_list:
                output.append('<ul>')
                in_list = True
            content = inline_md(line[2:].strip())
            output.append(f'  <li>{content}</li>')
        elif re.match(r'^\d+\. ', line):
            if not in_list:
                output.append('<ul>')
                in_list = True
            content = inline_md(re.sub(r'^\d+\. ', '', line).strip())
            output.append(f'  <li>{content}</li>')
        # Indented sub-item (spaces before - / *)
        elif re.match(r'^\s+[\-\*\+] ', line):
            if not in_list:
                output.append('<ul>')
                in_list = True
            content = inline_md(re.sub(r'^\s+[\-\*\+] ', '', line).strip())
            output.append(f'  <li class="cl-sub-item">{content}</li>')
        # Paragraph text
        else:
            flush_list()
            stripped = line.strip()
            if stripped:
                output.append(f'<p>{inline_md(stripped)}</p>')

        i += 1

    flush_list()
    flush_table()
    return '\n'.join(output)


# ── Parse CHANGELOG.md ─────────────────────────────────────────────────────────
def parse_changelog(path):
    """
    Returns a list of entry dicts:
      { version, date, caption, tier, body_html }

    Only entries with a semver-style heading (## vX.Y.Z …) are included.
    Legacy bracket-date headings like ## [2026-04-28] are skipped (too many,
    no semver — they're surfaced as a single "Earlier history" note in the
    generator).
    """
    with open(path, encoding='utf-8') as fh:
        text = fh.read()

    # Pattern: ## v1.5.1 — 2026-05-09 (optional caption)
    ENTRY_RE = re.compile(
        r'^## (v\d+\.\d+\.\d+)\s*[—–-]+\s*(\d{4}-\d{2}-\d{2})\s*(?:\(([^)]*)\))?',
        re.MULTILINE
    )

    entries = []
    matches = list(ENTRY_RE.finditer(text))

    for idx, m in enumerate(matches):
        version  = m.group(1)
        date     = m.group(2)
        caption  = m.group(3) or ''
        start    = m.end()
        end      = matches[idx + 1].start() if idx + 1 < len(matches) else len(text)
        body_raw = text[start:end].strip()

        # Remove any sub-section headings that are part of this entry (keep ### onwards)
        # Convert markdown body to HTML
        body_lines = body_raw.splitlines()
        body_html  = md_block_to_html(body_lines)

        entries.append({
            'version'   : version,
            'date'      : date,
            'caption'   : caption.strip(),
            'tier'      : version_tier(version),
            'body_html' : body_html,
        })

    return entries


# ── Render entry card ──────────────────────────────────────────────────────────
TIER_LABEL = {
    'major': 'MAJOR',
    'minor': 'MINOR',
    'patch': 'PATCH',
}

def with_unique_anchors(entries):
    """Return copied entries with stable, unique fragment identifiers."""
    counts = {}
    anchored = []
    for entry in entries:
        version = entry['version']
        occurrence = counts.get(version, 0) + 1
        counts = {**counts, version: occurrence}
        anchor = version if occurrence == 1 else f'{version}-{occurrence}'
        anchored.append({**entry, 'anchor': anchor})
    return anchored


def render_entry(entry, is_current=False):
    tier   = entry['tier']
    label  = TIER_LABEL[tier]
    ver    = html_mod.escape(entry['version'])
    date   = html_mod.escape(entry['date'])
    cap    = html_mod.escape(entry['caption'])
    anchor = html_mod.escape(entry['anchor'])
    cls    = 'changelog-entry is-current' if is_current else 'changelog-entry'

    caption_html = f'<p class="changelog-caption">{cap}</p>' if cap else ''

    # Human-friendly date
    try:
        dt = datetime.strptime(entry['date'], '%Y-%m-%d')
        date_friendly = dt.strftime('%B %d, %Y')
    except ValueError:
        date_friendly = date

    return f'''
    <article class="{cls}" id="{anchor}" data-version-tier="{tier}" data-version="{ver}">
      <div class="changelog-meta">
        <span class="changelog-version-badge">{ver}</span>
        <span class="changelog-tier-pill tier-{tier}">{label}</span>
        <time class="changelog-date" datetime="{date}">{date_friendly}</time>
      </div>
      {caption_html}
      <div class="changelog-body">
        {entry['body_html']}
      </div>
    </article>'''


# ── Build full HTML ────────────────────────────────────────────────────────────
FILTER_JS = """\
  <script>
  /* Filter chip logic */
  (function() {
    function initFilters() {
      var chips = document.querySelectorAll('.filter-chip');
      var entries = document.querySelectorAll('.changelog-entry');
      chips.forEach(function(chip) {
        chip.addEventListener('click', function() {
          chips.forEach(function(c) {
            c.classList.remove('active');
            c.setAttribute('aria-pressed', 'false');
          });
          chip.classList.add('active');
          chip.setAttribute('aria-pressed', 'true');
          var filter = chip.getAttribute('data-filter');
          entries.forEach(function(entry) {
            if (filter === 'all') {
              entry.style.display = '';
              return;
            }
            var tier = entry.getAttribute('data-version-tier');
            entry.style.display = (tier === filter) ? '' : 'none';
          });
        });
      });
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initFilters);
    } else {
      initFilters();
    }
  })();
  </script>"""


def build_html(entries):
    anchored_entries = with_unique_anchors(entries)
    latest     = anchored_entries[0]['version'] if anchored_entries else '1.x.x'
    count      = len(anchored_entries)
    cards      = '\n'.join(render_entry(e, is_current=(i == 0)) for i, e in enumerate(anchored_entries))
    # v1.134.16 — `dateModified` used to be the wall clock, which made this generated file
    # change every calendar day. The staleness gate compares a fresh build against the
    # committed one, so a build run on a later day failed the gate with a one-line diff that
    # had nothing to do with the changelog's content — an alarm that means nothing trains
    # people to regenerate-and-commit without reading. Stamp the LATEST RELEASE date instead:
    # it is what `dateModified` actually means for a release log, and it makes the artifact
    # reproducible, so the gate only fires on real drift.
    today      = anchored_entries[0]['date'] if anchored_entries else datetime.now().strftime('%Y-%m-%d')
    filter_js  = FILTER_JS

    # JSON-LD structured data
    jsonld_items = []
    for i, e in enumerate(anchored_entries[:10]):   # First 10 for schema brevity
        jsonld_items.append(
            f'        {{"@type":"ListItem","position":{i+1},'
            f'"name":"{e["version"]} — {e["date"]}",'
            f'"url":"https://resistancezero.com/changelog.html#{e["anchor"]}"}}'
        )
    jsonld_list = ',\n'.join(jsonld_items)

    return f'''<!DOCTYPE html>
<html lang="en">
<head>
  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-GED7FX8RTV"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){{dataLayer.push(arguments);}}
    gtag('js', new Date());
    gtag('config', 'G-GED7FX8RTV');
  </script>

  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">

  <title>Changelog — Resistance Zero ({latest} latest)</title>
  <meta name="description" content="Live release notes for resistancezero.com — every shipped version, Plan v12 → v15+, with Awwwards uplift, dark-mode coverage, and SEO/AI-search work.">
  <meta name="author" content="Bagus Dwi Permana">
  <meta name="robots" content="index, follow">
  <meta name="theme-color" content="#0f172a">
  <meta name="ai-content-declaration" content="human-authored">
  <link rel="canonical" href="https://resistancezero.com/changelog.html">

  <!-- Open Graph -->
  <meta property="og:type"        content="website">
  <meta property="og:url"         content="https://resistancezero.com/changelog.html">
  <meta property="og:title"       content="Resistance Zero — Changelog">
  <meta property="og:description" content="Live release notes for resistancezero.com — every shipped version, Awwwards uplift, dark-mode coverage, and SEO/AI-search work.">
  <meta property="og:image"       content="https://resistancezero.com/assets/og/index.webp">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:locale"      content="en_US">
  <meta property="og:site_name"   content="Bagus Dwi Permana Portfolio">

  <!-- Twitter Card -->
  <meta name="twitter:card"        content="summary_large_image">
  <meta name="twitter:site"        content="@BagusDPermana">
  <meta name="twitter:title"       content="Resistance Zero — Changelog">
  <meta name="twitter:description" content="Live release notes for resistancezero.com — every shipped version.">
  <meta name="twitter:image"       content="https://resistancezero.com/assets/og/index.webp">

  <!-- JSON-LD -->
  <script type="application/ld+json">
  {{
    "@context": "https://schema.org",
    "@graph": [
      {{
        "@type": "WebPage",
        "@id": "https://resistancezero.com/changelog.html",
        "url": "https://resistancezero.com/changelog.html",
        "name": "Changelog — Resistance Zero",
        "description": "Live release notes for resistancezero.com — {count} shipped versions.",
        "dateModified": "{today}",
        "author": {{
          "@type": "Person",
          "name": "Bagus Dwi Permana",
          "url": "https://resistancezero.com/"
        }},
        "isPartOf": {{
          "@type": "WebSite",
          "url": "https://resistancezero.com/",
          "name": "Resistance Zero"
        }}
      }},
      {{
        "@type": "BreadcrumbList",
        "itemListElement": [
          {{"@type":"ListItem","position":1,"name":"Home","item":"https://resistancezero.com/"}},
          {{"@type":"ListItem","position":2,"name":"Changelog","item":"https://resistancezero.com/changelog.html"}}
        ]
      }},
      {{
        "@type": "ItemList",
        "name": "Release history",
        "numberOfItems": {count},
        "itemListElement": [
{jsonld_list}
        ]
      }}
    ]
  }}
  </script>

  <!-- Preconnect -->
  <link rel="preconnect" href="https://www.googletagmanager.com" crossorigin>
  <link rel="dns-prefetch" href="https://www.googletagmanager.com">

  <link rel="stylesheet" href="styles.min.css?v={_asset_token('styles.min.css')}">
  <script src="js/rz-version.js?v={_asset_token('js/rz-version.js')}" defer></script>

  <style>
    /* ── Changelog page-scoped styles ──
       v3.24.35: the page ran its own palette (mint, cyan, emerald on slate-navy cards, an animated
       gradient title, aurora orbs, blurred glass). It now uses the site register: graphite, one
       amber, hairlines. Tokens first, then the rules read only tokens. */
    :root {{
      --cl-bg: #0E0F12; --cl-panel: #16181D; --cl-code: #1d2026;
      --cl-text: #CFD3DA; --cl-strong: #F6F7F9; --cl-muted: #969eaa;
      --cl-line: rgba(160,168,180,.14); --cl-line-strong: rgba(160,168,180,.28);
      --cl-accent: #E8B563; --cl-accent-soft: rgba(232,181,99,.12);
    }}
    [data-theme="light"] {{
      --cl-bg: #f8f9fa; --cl-panel: #ffffff; --cl-code: #f1f3f5;
      --cl-text: #343a40; --cl-strong: #1a1d23; --cl-muted: #5c6470;
      --cl-line: rgba(40,44,52,.12); --cl-line-strong: rgba(40,44,52,.24);
      --cl-accent: #92400e; --cl-accent-soft: rgba(146,64,14,.08);
    }}
    body {{ background: var(--cl-bg); color: var(--cl-text); }}

    .changelog-hero {{
      position: relative;
      padding: 7rem 2rem 3rem;
      text-align: center;
      border-bottom: 1px solid var(--cl-line);
    }}
    .changelog-hero h1 {{
      font-size: clamp(2.25rem, 5vw, 3.25rem);
      font-weight: 700;
      line-height: 1.1;
      letter-spacing: -0.02em;
      color: var(--cl-strong);
      margin: 0 0 0.75rem;
    }}
    .changelog-hero .cl-subtitle {{
      font-size: 1.05rem;
      color: var(--cl-muted);
      margin: 0 0 0.5rem;
    }}
    .changelog-hero .cl-meta {{
      font-size: 0.82rem;
      color: var(--cl-muted);
      font-family: 'JetBrains Mono', ui-monospace, monospace;
      margin-bottom: 2rem;
    }}
    .cl-meta strong {{ color: var(--cl-strong); }}

    /* Filter chips: a segmented control, one active state in amber */
    .filter-chips {{
      display: flex;
      gap: 0.5rem;
      justify-content: center;
      flex-wrap: wrap;
      margin: 0;
    }}
    .filter-chip {{
      padding: 0.45rem 1.1rem;
      border-radius: 4px;
      border: 1px solid var(--cl-line-strong);
      background: transparent;
      color: var(--cl-muted);
      font-family: 'JetBrains Mono', ui-monospace, monospace;
      font-size: 0.78rem;
      font-weight: 600;
      letter-spacing: 0.07em;
      cursor: pointer;
      transition: border-color 160ms ease, color 160ms ease;
    }}
    .filter-chip:hover {{ border-color: var(--cl-muted); color: var(--cl-strong); }}
    .filter-chip.active {{
      border-color: var(--cl-accent);
      color: var(--cl-accent);
      background: var(--cl-accent-soft);
    }}

    .cl-count-badge {{
      display: inline-block;
      color: var(--cl-text);
      border: 1px solid var(--cl-line-strong);
      padding: 1px 8px;
      border-radius: 4px;
      font-size: 0.72rem;
      font-family: 'JetBrains Mono', monospace;
      font-weight: 600;
      margin-left: 0.5rem;
      vertical-align: middle;
    }}

    .changelog-list {{
      max-width: 880px;
      margin: 2rem auto 0;
      padding: 0 1.5rem 5rem;
    }}

    /* Entry: a panel with a hairline, no glass, no glow */
    .changelog-entry {{
      background: var(--cl-panel);
      border: 1px solid var(--cl-line);
      border-radius: 4px;
      padding: 1.75rem 2rem 1.5rem;
      margin-bottom: 1.25rem;
      position: relative;
      transition: border-color 200ms ease;
      scroll-margin-top: 5rem;
    }}
    .changelog-entry:hover {{ border-color: var(--cl-line-strong); }}
    .changelog-entry.is-current {{ border-color: var(--cl-accent); }}
    .changelog-entry.is-current::after {{
      content: 'CURRENT';
      position: absolute;
      top: 1.1rem;
      right: 1.1rem;
      color: var(--cl-accent);
      border: 1px solid var(--cl-accent);
      padding: 0.15rem 0.5rem;
      border-radius: 4px;
      font-size: 0.62rem;
      font-weight: 700;
      letter-spacing: 0.12em;
      font-family: 'JetBrains Mono', monospace;
    }}

    .changelog-meta {{
      display: flex;
      align-items: center;
      gap: 0.65rem;
      flex-wrap: wrap;
      margin-bottom: 0.6rem;
    }}
    .changelog-version-badge {{
      font-family: 'JetBrains Mono', ui-monospace, monospace;
      font-size: 1rem;
      font-weight: 700;
      color: var(--cl-strong);
      letter-spacing: 0.02em;
    }}
    /* tier: MAJOR carries the accent, MINOR and PATCH are neutral outlines */
    .changelog-tier-pill {{
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.62rem;
      font-weight: 700;
      letter-spacing: 0.1em;
      padding: 1px 7px;
      border-radius: 4px;
      color: var(--cl-muted);
      border: 1px solid var(--cl-line-strong);
    }}
    .changelog-tier-pill.tier-major {{ color: var(--cl-accent); border-color: var(--cl-accent); }}
    .changelog-date {{
      color: var(--cl-muted);
      font-size: 0.82rem;
      font-family: 'JetBrains Mono', monospace;
    }}
    .changelog-caption {{
      color: var(--cl-muted);
      font-style: italic;
      font-size: 0.92rem;
      margin: 0.25rem 0 0.75rem;
    }}

    .changelog-body {{
      color: var(--cl-text);
      /* v3.3.x — was 0.92rem, which is 14.72px on a phone: the whole public changelog sat below
         the 16px reading floor (7,722 elements at 390 and 768). This is running prose, so it gets
         reading size and grows a little on a wide screen rather than shrinking on a narrow one. */
      font-size: clamp(1rem, .96rem + .12vw, 1.06rem);
      line-height: 1.7;
      /* Entries quote slash-joined identifier runs (a v1.115.x line lists 17 panel names
         joined by "/"), which Chrome offers no break opportunity inside: one line ran past
         the viewport on the published page. Long tokens wrap; ordinary prose is unaffected. */
      overflow-wrap: anywhere;
    }}
    .changelog-body p {{ margin: 0.5rem 0; }}
    .changelog-body ul {{ list-style: none; padding: 0; margin: 0.5rem 0; }}
    .changelog-body ul li {{
      padding: 0.3rem 0 0.3rem 1.4rem;
      position: relative;
      border-bottom: 1px solid var(--cl-line);
    }}
    .changelog-body ul li:last-child {{ border-bottom: none; }}
    .changelog-body ul li::before {{
      content: '';
      position: absolute;
      left: 0.2rem;
      top: 1.05em;
      width: 5px;
      height: 5px;
      background: var(--cl-muted);
    }}
    .changelog-body ul li.cl-sub-item::before {{ width: 3px; height: 3px; }}
    .changelog-body h3.cl-subhead,
    .changelog-body h4.cl-subhead {{
      color: var(--cl-strong);
      font-size: 0.85rem;
      font-weight: 700;
      margin: 1rem 0 0.4rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      border-bottom: 1px solid var(--cl-line);
      padding-bottom: 0.3rem;
    }}
    .changelog-body strong {{ color: var(--cl-strong); font-weight: 600; }}
    .changelog-body code {{
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.82em;
      background: var(--cl-code);
      color: var(--cl-strong);
      padding: 1px 5px;
      border-radius: 3px;
    }}
    .changelog-body a {{
      color: var(--cl-accent);
      text-decoration: none;
      border-bottom: 1px solid currentColor;
    }}
    .commit-link code {{ color: var(--cl-muted); }}
    .commit-link {{ border-bottom: none !important; }}

    .cl-table-wrap {{ overflow-x: auto; margin: 0.75rem 0; }}
    .cl-table {{
      border-collapse: collapse;
      font-size: 0.85rem;
      width: 100%;
      min-width: 320px;
    }}
    .cl-table th, .cl-table td {{
      padding: 0.4rem 0.75rem;
      border-bottom: 1px solid var(--cl-line);
      text-align: left;
    }}
    .cl-table th {{ color: var(--cl-strong); font-weight: 600; border-bottom-color: var(--cl-line-strong); }}
    .cl-table td {{ color: var(--cl-text); }}

    .cl-code {{
      background: var(--cl-code);
      border: 1px solid var(--cl-line);
      border-radius: 4px;
      padding: 1rem;
      overflow-x: auto;
      font-size: 0.8rem;
      font-family: 'JetBrains Mono', monospace;
      color: var(--cl-text);
      margin: 0.75rem 0;
    }}
    .cl-code code {{ background: none; padding: 0; color: inherit; }}

    .cl-earlier-note {{
      text-align: center;
      color: var(--cl-muted);
      font-size: 0.85rem;
      padding: 2rem 0 1rem;
      font-style: italic;
    }}
    .cl-earlier-note a {{ color: var(--cl-accent); }}
    [data-theme="light"] .navbar .nav-link, [data-theme="light"] .navbar .nav-vibrate {{ color: var(--cl-text); }}

    /* v1.8.0 — mobile responsive landing patch */
    @media (max-width: 768px) {{
      html, body {{ overflow-x: hidden; max-width: 100vw; }}
      img {{ max-width: 100%; height: auto; display: block; }}
      /* v3.3.x — 4rem is 64px and the wrapped mobile navbar is 93px tall, so "Changelog" sat
         29px UNDER the fixed nav. Same defect the 18-page sweep at a8d65a9e fixed elsewhere. */
      .changelog-hero {{ padding: 6.5rem 1rem 2rem !important; }}
      .changelog-hero h1 {{ font-size: clamp(1.8rem, 7vw, 2.5rem) !important; }}
      .changelog-list {{ padding: 0 1rem 3rem !important; }}
      .changelog-entry {{ padding: 1.25rem !important; }}
      .changelog-entry.is-current::after {{ position: static; display: inline-block; margin-bottom: 0.5rem; }}
      .filter-chips {{ gap: 0.4rem !important; padding: 0 1rem; flex-wrap: wrap; }}
      .filter-chip {{ padding: 0.4rem 0.9rem !important; font-size: 0.75rem !important; min-height: 44px; }}
      .navbar {{ padding: 0.5rem 0.75rem !important; }}
      .footer-grid {{
        grid-template-columns: 1fr !important;
        gap: 1.25rem !important;
        padding: 1rem !important;
      }}
      button, a.btn, [role="button"], .nav-link {{ min-height: 44px; }}
    }}
    @media (max-width: 480px) {{
      .changelog-hero h1 {{ font-size: 1.6rem !important; }}
    }}
  </style>
</head>
<body>

  <!-- ── Navbar (mirrors articles.html) ── -->
  <nav class="navbar" id="mainNav" role="navigation" aria-label="Main navigation">
    <div class="nav-container">
      <a href="index.html" class="nav-logo">
        <img src="assets/profile-photo-sm.webp" alt="Bagus Dwi Permana" class="nav-avatar" width="40" height="40" decoding="async">
      </a>
      <ul class="nav-menu">
        <li><a href="index.html" class="nav-link">Home</a></li>
        <li class="nav-dropdown">
          <a href="datacenter-solutions.html" class="nav-link nav-vibrate" aria-haspopup="true" aria-expanded="false">
            DC Solutions
            <svg class="dropdown-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </a>
          <ul class="dropdown-menu" role="menu">
            <li role="menuitem"><a href="datacenter-solutions.html" style="font-weight:600;">DC Solutions Hub</a></li>
            <li role="separator" style="border-bottom:1px solid rgba(255,255,255,0.1);margin:4px 0;"></li>
            <li role="menuitem"><a href="datahallAI.html" style="color:#64748b;">DC AI/HPC</a></li>
            <li role="menuitem"><a href="dc-conventional.html">DC Conventional</a></li>
            <li role="separator" style="border-bottom:1px solid rgba(255,255,255,0.1);margin:4px 0;"></li>
            <li role="menuitem"><a href="tco-calculator.html" style="color:#64748b;font-weight:600;">TCO Calculator</a></li>
            <li role="menuitem"><a href="capex-calculator.html">CAPEX Calculator</a></li>
            <li role="menuitem"><a href="opex-calculator.html">OPEX Calculator</a></li>
            <li role="menuitem"><a href="roi-calculator.html">ROI Calculator</a></li>
            <li role="separator" style="border-bottom:1px solid rgba(255,255,255,0.1);margin:4px 0;"></li>
            <li role="menuitem"><a href="dc-market-tracker.html" style="font-weight:600;">DC Market</a></li>
            <li role="menuitem"><a href="dcmoc/" style="font-weight:600;">DC MOC</a></li>
          </ul>
        </li>
        <li><a href="index.html#metrics" class="nav-link">Results</a></li>
        <li><a href="index.html#case-studies" class="nav-link">Case Studies</a></li>
        <li class="nav-dropdown">
          <a href="articles.html" class="nav-link" aria-haspopup="true" aria-expanded="false">
            Insights
            <svg class="dropdown-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </a>
          <ul class="dropdown-menu" role="menu">
            <li role="menuitem"><a href="articles.html" style="font-weight:600;">Engineering Journal</a></li>
            <li role="menuitem"><a href="geopolitics.html">Global Analysis</a></li>
            <li role="menuitem"><a href="future-forward.html" style="color:#64748b;">Future Forward</a></li>
            <li role="menuitem"><a href="glossary.html">Glossary</a></li>
            <li role="menuitem"><a href="Apps/second brain/index.html" style="color:#64748b;font-weight:600;">&#x2022; Second Brain</a></li>
            <li role="separator" style="border-bottom:1px solid rgba(255,255,255,0.1);margin:4px 0;"></li>
            <li role="menuitem"><a href="changelog.html" style="font-weight:600;">Changelog <span style="background:#f59e0b;color:#0f172a;font-size:0.58rem;font-weight:800;letter-spacing:0.1em;padding:1px 5px;border-radius:4px;vertical-align:middle;margin-left:3px;">NEW</span></a></li>
            <li role="menuitem"><a href="insights.html" style="color:#64748b;font-size:0.85rem;">All Insights</a></li>
          </ul>
        </li>
        <li><a href="index.html#faq" class="nav-link">FAQ</a></li>
        <li><a href="index.html#contact" class="nav-link">Contact</a></li>
      </ul>
      <button class="nav-search-btn" id="navSearchBtn" aria-label="Search" title="Search (Ctrl+K)">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
      </button>
      <button class="theme-toggle" id="themeToggle" aria-label="Toggle dark mode" aria-pressed="false" title="Toggle dark/light mode">
        <svg class="moon-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
        </svg>
        <svg class="sun-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="5"></circle>
          <line x1="12" y1="1" x2="12" y2="3"></line>
          <line x1="12" y1="21" x2="12" y2="23"></line>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
          <line x1="1" y1="12" x2="3" y2="12"></line>
          <line x1="21" y1="12" x2="23" y2="12"></line>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        </svg>
      </button>
      <button class="hamburger" aria-label="Open navigation menu" aria-expanded="false">
        <span class="bar"></span>
        <span class="bar"></span>
        <span class="bar"></span>
      </button>
    </div>
  </nav>

  <main id="main-content">

    <!-- ── Hero ── -->
    <section class="changelog-hero" aria-labelledby="cl-heading">

      <h1 id="cl-heading">Changelog</h1>
      <p class="cl-subtitle">Live release notes &mdash; every shipped version</p>
      <p class="cl-meta">
        Latest: <strong>{latest}</strong>
        &nbsp;&middot;&nbsp;
        <span class="cl-count-badge">{count} releases</span>
      </p>

      <div class="filter-chips" role="group" aria-label="Filter by version tier">
        <button class="filter-chip active" data-filter="all" aria-pressed="true">All</button>
        <button class="filter-chip" data-filter="major" aria-pressed="false">MAJOR</button>
        <button class="filter-chip" data-filter="minor" aria-pressed="false">MINOR</button>
        <button class="filter-chip" data-filter="patch" aria-pressed="false">PATCH</button>
      </div>
    </section>

    <!-- ── Entry list ── -->
    <section class="changelog-list" aria-label="Release history">
{cards}
      <p class="cl-earlier-note">
        Earlier changes (before 2026-04-12) are tracked in
        <a href="{GITHUB_REPO}/commits/main" target="_blank" rel="noopener">git log</a>
        and per-session memory files.
      </p>
    </section>

  </main>

  <!-- ── Footer ── -->
  <footer class="footer footer-enhanced">
    <div class="container">
      <div class="footer-grid">
        <div class="footer-brand">
          <p class="footer-tagline-main">BUILT FOR MISSION CRITICAL INFRASTRUCTURE<br>MANAGEMENT // 2026</p>
          <p class="footer-tagline-sub">ALL OPERATIONAL DATASETS PRESERVED.</p>
          <p class="footer-copyright">&copy; 2026 Bagus Dwi Permana. All rights reserved.</p>
        </div>
        <div class="footer-nav">
          <h4 class="footer-heading">NAVIGATION</h4>
          <ul class="footer-links">
            <li><a href="index.html">Home Dashboard</a></li>
            <li><a href="articles.html">Technical Journal</a></li>
            <li><a href="index.html#case-studies">Case Studies</a></li>
            <li><a href="datacenter-solutions.html">DC Solutions</a></li>
            <li><a href="glossary.html">Glossary</a></li>
            <li><a href="changelog.html" aria-current="page">Changelog</a></li>
          </ul>
        </div>
        <div class="footer-connect">
          <h4 class="footer-heading">CONNECT</h4>
          <ul class="footer-links">
            <li><a href="https://www.linkedin.com/in/bagus-dwi-permana-ba90b092" target="_blank" rel="noopener">LinkedIn Profile</a></li>
            <li><a href="articles.html">Technical Journal</a></li>
            <li><a href="mailto:baguspermana7@gmail.com">Direct Contact</a></li>
            <li><a href="https://github.com/baguspermana7-cpu" target="_blank" rel="noopener">GitHub</a></li>
          </ul>
        </div>
      </div>
    </div>
  </footer>

  <script src="script.min.js?v={_asset_token('script.min.js')}" defer></script>

  <!-- every other page with a navbar loads this; without it the phone menu had no button (v3.24.35) -->

  <script src="js/rz-mobile-nav.js?v={_asset_token('js/rz-mobile-nav.js')}" defer></script>

  {filter_js}

</body>
</html>'''


# ── CLI entry point ────────────────────────────────────────────────────────────
def verify_generated_output(html_out):
    """Fail unless the checked-in generated artifact is byte-identical."""
    try:
        with open(OUTPUT, encoding='utf-8') as fh:
            existing = fh.read()
    except OSError as exc:
        print(f'CHECK FAILED — cannot read {OUTPUT}: {exc}', file=sys.stderr)
        return False

    if existing != html_out:
        print('CHECK FAILED — changelog.html is stale; run '
              '`python3 tools/build-changelog-html.py --apply`', file=sys.stderr)
        return False

    print('[OK] Generated changelog matches CHANGELOG.md byte-for-byte')
    return True


def main():
    apply = '--apply' in sys.argv
    check = '--check' in sys.argv

    if apply and check:
        print('ERROR: choose either --apply or --check', file=sys.stderr)
        sys.exit(2)

    if not os.path.isfile(CHANGELOG):
        print(f'ERROR: CHANGELOG.md not found at {CHANGELOG}', file=sys.stderr)
        sys.exit(1)

    entries = parse_changelog(CHANGELOG)
    if not entries:
        print('WARNING: No versioned entries found in CHANGELOG.md', file=sys.stderr)

    html_out = build_html(entries)

    # B-001 defense-in-depth: a CHANGELOG code-span split across md lines (or
    # any stray backtick) leaves a raw "`<" in body text → the browser
    # tokenizer treats it as a live tag and breaks changelog.html (the
    # easter-egg page). Fail the build LOUDLY rather than ship it silently.
    danger = re.findall(r'`<\s*(?:script|style|li|details|div|a|img|iframe)\b',
                         html_out, re.IGNORECASE)
    if danger:
        bad = [ln for ln in html_out.splitlines()
               if re.search(r'`<\s*(?:script|style|li|details|div|a|img'
                            r'|iframe)\b', ln, re.IGNORECASE)]
        print('BUILD FAILED — raw "`<tag" leaked into changelog.html '
              '(a CHANGELOG.md code-span is split across lines or has an '
              'unbalanced backtick — keep each `...` span on ONE line):',
              file=sys.stderr)
        for ln in bad[:8]:
            print('  ' + ln.strip()[:140], file=sys.stderr)
        sys.exit(1)

    # The entries may only carry the tags this generator writes. The older "`<tag" check above was
    # blind to `` `<script src>` ``, which left no backtick beside the tag and shipped a live
    # <script> that hid every entry older than v1.19.1 and script.min.js with them (v3.24.35).
    entries_region = html_out[html_out.find('class="changelog-entry'):html_out.rfind('</article>')]
    stray = sorted({t.lower() for t in re.findall(r'<([a-zA-Z][a-zA-Z0-9-]*)', entries_region)}
                   - ENTRY_TAGS)
    if stray:
        print('BUILD FAILED — tags no Markdown rule writes leaked into the entries: '
              + ', '.join('<' + t + '>' for t in stray), file=sys.stderr)
        sys.exit(1)

    if check:
        if not verify_generated_output(html_out):
            sys.exit(1)
    elif apply:
        with open(OUTPUT, 'w', encoding='utf-8') as fh:
            fh.write(html_out)
        size_kb = os.path.getsize(OUTPUT) / 1024
        print(f'[OK] Written: {OUTPUT}')
        print(f'     Entries : {len(entries)}')
        print(f'     Size    : {size_kb:.1f} KB')
        print(f'     Lines   : {html_out.count(chr(10))}')
    else:
        print(html_out)


if __name__ == '__main__':
    main()
