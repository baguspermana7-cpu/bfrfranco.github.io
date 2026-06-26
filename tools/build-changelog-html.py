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

    text = re.sub(r'`([^`]+)`', _stash_code, text)
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
TIER_COLOR = {
    'major': '#8b5cf6',   # violet
    'minor': '#06b6d4',   # cyan
    'patch': '#10b981',   # emerald
}
TIER_LABEL = {
    'major': 'MAJOR',
    'minor': 'MINOR',
    'patch': 'PATCH',
}

def render_entry(entry, is_current=False):
    tier   = entry['tier']
    color  = TIER_COLOR[tier]
    label  = TIER_LABEL[tier]
    ver    = html_mod.escape(entry['version'])
    date   = html_mod.escape(entry['date'])
    cap    = html_mod.escape(entry['caption'])
    cls    = 'changelog-entry is-current' if is_current else 'changelog-entry'

    caption_html = f'<p class="changelog-caption">{cap}</p>' if cap else ''

    # Human-friendly date
    try:
        dt = datetime.strptime(entry['date'], '%Y-%m-%d')
        date_friendly = dt.strftime('%B %d, %Y')
    except ValueError:
        date_friendly = date

    return f'''
    <article class="{cls}" data-version-tier="{tier}" data-version="{ver}">
      <div class="changelog-meta">
        <span class="changelog-version-badge" style="--tier-color:{color};">{ver}</span>
        <span class="changelog-tier-pill" style="background:{color}20;color:{color};border:1px solid {color}40;">{label}</span>
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
    latest     = entries[0]['version'] if entries else '1.x.x'
    count      = len(entries)
    cards      = '\n'.join(render_entry(e, is_current=(i == 0)) for i, e in enumerate(entries))
    today      = datetime.now().strftime('%Y-%m-%d')
    filter_js  = FILTER_JS

    # JSON-LD structured data
    jsonld_items = []
    for i, e in enumerate(entries[:10]):   # First 10 for schema brevity
        jsonld_items.append(
            f'        {{"@type":"ListItem","position":{i+1},'
            f'"name":"{e["version"]} — {e["date"]}",'
            f'"url":"https://resistancezero.com/changelog.html#{e["version"]}"}}'
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

  <link rel="stylesheet" href="styles.min.css?v=20260509-share-fix">
  <script src="js/rz-version.js?v=2026-05-09" defer></script>

  <style>
    /* ── Changelog page-scoped styles ── */

    /* Aurora hero */
    .changelog-hero {{
      position: relative;
      padding: 7rem 2rem 3.5rem;
      text-align: center;
      overflow: hidden;
    }}
    .changelog-hero .aurora-orb {{
      z-index: 0;
    }}
    .changelog-hero > * {{ position: relative; z-index: 1; }}

    /* Gradient H1 */
    .changelog-hero h1 {{
      font-size: clamp(2.5rem, 6vw, 4rem);
      font-weight: 800;
      line-height: 1.1;
      letter-spacing: -0.02em;
      background: linear-gradient(
        120deg,
        #f8fafc 0%,
        #7dd5b4 25%,
        #f59e0b 55%,
        #f8fafc 80%
      );
      background-size: 300% 300%;
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
      animation: clNameSweep 10s ease-in-out infinite;
      margin: 0 0 0.75rem;
    }}
    @keyframes clNameSweep {{
      0%   {{ background-position: 0% 50%; }}
      50%  {{ background-position: 100% 50%; }}
      100% {{ background-position: 0% 50%; }}
    }}
    @media (prefers-reduced-motion: reduce) {{
      .changelog-hero h1 {{ animation: none; }}
    }}

    /* Hero subtitle */
    .changelog-hero .cl-subtitle {{
      font-size: 1.1rem;
      color: #94a3b8;
      margin: 0 0 0.5rem;
    }}
    .changelog-hero .cl-meta {{
      font-size: 0.82rem;
      color: #64748b;
      font-family: 'JetBrains Mono', ui-monospace, monospace;
      margin-bottom: 2rem;
    }}

    /* Filter chips */
    .filter-chips {{
      display: flex;
      gap: 0.5rem;
      justify-content: center;
      flex-wrap: wrap;
      margin: 0;
    }}
    .filter-chip {{
      padding: 0.45rem 1.2rem;
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,0.1);
      background: rgba(30,41,59,0.6);
      color: #94a3b8;
      font-size: 0.8rem;
      font-weight: 600;
      letter-spacing: 0.07em;
      cursor: pointer;
      transition: all 180ms ease;
      backdrop-filter: blur(8px);
    }}
    .filter-chip:hover {{
      border-color: rgba(125,221,180,0.4);
      color: #7dd5b4;
    }}
    .filter-chip.active {{
      background: rgba(125,221,180,0.15);
      border-color: rgba(125,221,180,0.6);
      color: #7dd5b4;
    }}
    .filter-chip[data-filter="major"].active {{
      background: rgba(139,92,246,0.15);
      border-color: rgba(139,92,246,0.6);
      color: #a78bfa;
    }}
    .filter-chip[data-filter="minor"].active {{
      background: rgba(6,182,212,0.12);
      border-color: rgba(6,182,212,0.5);
      color: #22d3ee;
    }}
    .filter-chip[data-filter="patch"].active {{
      background: rgba(16,185,129,0.12);
      border-color: rgba(16,185,129,0.5);
      color: #34d399;
    }}

    /* Entry count badge */
    .cl-count-badge {{
      display: inline-block;
      background: rgba(125,221,180,0.12);
      color: #7dd5b4;
      border: 1px solid rgba(125,221,180,0.25);
      padding: 2px 10px;
      border-radius: 999px;
      font-size: 0.72rem;
      font-family: 'JetBrains Mono', monospace;
      font-weight: 600;
      margin-left: 0.5rem;
      vertical-align: middle;
    }}

    /* List wrapper */
    .changelog-list {{
      max-width: 880px;
      margin: 2rem auto 0;
      padding: 0 1.5rem 5rem;
    }}

    /* Entry card */
    .changelog-entry {{
      background: rgba(30,41,59,0.5);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 16px;
      padding: 2rem 2rem 1.75rem;
      margin-bottom: 1.5rem;
      backdrop-filter: blur(12px);
      position: relative;
      transition: border-color 220ms ease, box-shadow 220ms ease;
      scroll-margin-top: 5rem;
    }}
    .changelog-entry:hover {{
      border-color: rgba(125,221,180,0.2);
      box-shadow: 0 4px 24px rgba(125,221,180,0.05);
    }}

    /* CURRENT badge */
    .changelog-entry.is-current {{
      border-color: rgba(16,185,129,0.3);
    }}
    .changelog-entry.is-current::after {{
      content: 'CURRENT';
      position: absolute;
      top: 1.1rem;
      right: 1.1rem;
      background: #10b981;
      color: #fff;
      padding: 0.2rem 0.6rem;
      border-radius: 999px;
      font-size: 0.62rem;
      font-weight: 700;
      letter-spacing: 0.12em;
      font-family: 'JetBrains Mono', monospace;
    }}

    /* Meta row */
    .changelog-meta {{
      display: flex;
      align-items: center;
      gap: 0.65rem;
      flex-wrap: wrap;
      margin-bottom: 0.6rem;
    }}

    /* Version badge */
    .changelog-version-badge {{
      font-family: 'JetBrains Mono', ui-monospace, monospace;
      font-size: 0.95rem;
      font-weight: 700;
      color: var(--tier-color, #7dd5b4);
      background: rgba(125,221,180,0.08);
      padding: 3px 10px;
      border-radius: 6px;
      letter-spacing: 0.04em;
    }}

    /* Tier pill */
    .changelog-tier-pill {{
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.62rem;
      font-weight: 700;
      letter-spacing: 0.1em;
      padding: 2px 8px;
      border-radius: 999px;
    }}

    /* Date */
    .changelog-date {{
      color: #64748b;
      font-size: 0.82rem;
      font-family: 'JetBrains Mono', monospace;
    }}

    /* Caption */
    .changelog-caption {{
      color: #94a3b8;
      font-style: italic;
      font-size: 0.92rem;
      margin: 0.25rem 0 0.75rem;
    }}

    /* Body content */
    .changelog-body {{
      color: #cbd5e1;
      font-size: 0.92rem;
      line-height: 1.7;
    }}
    .changelog-body p {{
      margin: 0.5rem 0;
    }}
    .changelog-body ul {{
      list-style: none;
      padding: 0;
      margin: 0.5rem 0;
    }}
    .changelog-body ul li {{
      padding: 0.3rem 0 0.3rem 1.4rem;
      position: relative;
      border-bottom: 1px solid rgba(255,255,255,0.04);
    }}
    .changelog-body ul li:last-child {{
      border-bottom: none;
    }}
    .changelog-body ul li::before {{
      content: '';
      position: absolute;
      left: 0;
      top: 50%;
      transform: translateY(-50%);
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #7dd5b4;
      opacity: 0.7;
    }}
    .changelog-body ul li.cl-sub-item::before {{
      width: 4px;
      height: 4px;
      background: #64748b;
    }}
    .changelog-body h3.cl-subhead,
    .changelog-body h4.cl-subhead {{
      color: #e2e8f0;
      font-size: 0.88rem;
      font-weight: 700;
      margin: 1rem 0 0.4rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      border-bottom: 1px solid rgba(255,255,255,0.08);
      padding-bottom: 0.3rem;
    }}
    .changelog-body strong {{
      color: #e2e8f0;
      font-weight: 600;
    }}
    .changelog-body code {{
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.8em;
      background: rgba(30,41,59,0.8);
      color: #7dd5b4;
      padding: 1px 5px;
      border-radius: 4px;
    }}
    .changelog-body a {{
      color: #7dd5b4;
      text-decoration: none;
      border-bottom: 1px solid rgba(125,221,180,0.3);
      transition: border-color 150ms ease;
    }}
    .changelog-body a:hover {{
      border-color: rgba(125,221,180,0.8);
    }}
    .commit-link code {{
      font-size: 0.78em;
      background: rgba(139,92,246,0.15);
      color: #a78bfa;
    }}
    .commit-link {{
      border-bottom: none !important;
    }}

    /* Table */
    .cl-table-wrap {{
      overflow-x: auto;
      margin: 0.75rem 0;
    }}
    .cl-table {{
      border-collapse: collapse;
      font-size: 0.8rem;
      width: 100%;
      min-width: 320px;
    }}
    .cl-table th, .cl-table td {{
      padding: 0.4rem 0.75rem;
      border: 1px solid rgba(255,255,255,0.08);
      text-align: left;
    }}
    .cl-table th {{
      background: rgba(30,41,59,0.7);
      color: #cbd5e1;
      font-weight: 600;
    }}
    .cl-table td {{
      color: #94a3b8;
    }}

    /* Code block */
    .cl-code {{
      background: rgba(15,23,42,0.8);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 8px;
      padding: 1rem;
      overflow-x: auto;
      font-size: 0.78rem;
      font-family: 'JetBrains Mono', monospace;
      color: #94a3b8;
      margin: 0.75rem 0;
    }}

    /* Earlier history note */
    .cl-earlier-note {{
      text-align: center;
      color: #475569;
      font-size: 0.85rem;
      padding: 2rem 0 1rem;
      font-style: italic;
    }}
    .cl-earlier-note a {{
      color: #7dd5b4;
    }}

    /* Light mode overrides */
    /* v1.48.x — light-mode body was missing, so the page stayed dark under a light navbar
       (a broken middle state). Lighten the body/surface; the hero band stays dark intentionally. */
    [data-theme="light"] body {{
      background: #f8fafc;
      color: #334155;
    }}
    [data-theme="light"] .changelog-entry {{
      background: rgba(248,250,252,0.8);
      border-color: rgba(0,0,0,0.08);
    }}
    [data-theme="light"] .changelog-body {{ color: #334155; }}
    [data-theme="light"] .changelog-body code {{
      background: rgba(241,245,249,0.9);
      color: #0d9488;
    }}
    [data-theme="light"] .changelog-body ul li::before {{ background: #0d9488; }}
    [data-theme="light"] .changelog-date {{ color: #94a3b8; }}
    [data-theme="light"] .filter-chip {{
      background: rgba(248,250,252,0.9);
      border-color: rgba(0,0,0,0.1);
      color: #64748b;
    }}
    [data-theme="light"] .changelog-hero h1 {{
      background: linear-gradient(120deg, #1e3a5f 0%, #0d9488 30%, #f59e0b 60%, #1e3a5f 100%);
      background-size: 300% 300%;
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
    }}

    /* v1.8.0 — mobile responsive landing patch */
    @media (max-width: 768px) {{
      html, body {{ overflow-x: hidden; max-width: 100vw; }}
      img {{ max-width: 100%; height: auto; display: block; }}
      .changelog-hero {{ padding: 4rem 1rem 2rem !important; }}
      .changelog-hero h1 {{ font-size: clamp(1.8rem, 7vw, 2.5rem) !important; }}
      .changelog-list {{ padding: 0 1rem 3rem !important; }}
      .changelog-entry {{ padding: 1.25rem !important; }}
      .filter-chips {{ gap: 0.4rem !important; padding: 0 1rem; flex-wrap: wrap; }}
      .filter-chip {{ padding: 0.4rem 0.9rem !important; font-size: 0.75rem !important; min-height: 44px; }}
      .navbar {{ padding: 0.5rem 0.75rem !important; }}
      .nav-menu, .nav-links {{ display: none !important; }}
      .footer-grid {{
        grid-template-columns: 1fr !important;
        gap: 1.25rem !important;
        padding: 1rem !important;
      }}
      button, a.btn, [role="button"], .nav-link {{ min-height: 44px; }}
    }}
    @media (max-width: 480px) {{
      .changelog-hero h1 {{ font-size: 1.4rem !important; }}
    }}
  </style>
</head>
<body data-theme="dark">

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
            <li role="menuitem"><a href="datacenter-solutions.html" style="color:#06b6d4;font-weight:600;">DC Solutions Hub</a></li>
            <li role="separator" style="border-bottom:1px solid rgba(255,255,255,0.1);margin:4px 0;"></li>
            <li role="menuitem"><a href="datahallAI.html" style="color:#8b5cf6;">DC AI/HPC</a></li>
            <li role="menuitem"><a href="dc-conventional.html">DC Conventional</a></li>
            <li role="separator" style="border-bottom:1px solid rgba(255,255,255,0.1);margin:4px 0;"></li>
            <li role="menuitem"><a href="tco-calculator.html" style="color:#4f46e5;font-weight:600;">TCO Calculator</a></li>
            <li role="menuitem"><a href="capex-calculator.html" style="color:#f59e0b;">CAPEX Calculator</a></li>
            <li role="menuitem"><a href="opex-calculator.html" style="color:#10b981;">OPEX Calculator</a></li>
            <li role="menuitem"><a href="roi-calculator.html" style="color:#3b82f6;">ROI Calculator</a></li>
            <li role="separator" style="border-bottom:1px solid rgba(255,255,255,0.1);margin:4px 0;"></li>
            <li role="menuitem"><a href="dc-market-tracker.html" style="color:#0d9488;font-weight:600;">DC Market</a></li>
            <li role="menuitem"><a href="dcmoc/" style="color:#ef4444;font-weight:600;">DC MOC</a></li>
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
            <li role="menuitem"><a href="articles.html" style="color:#06b6d4;font-weight:600;">Engineering Journal</a></li>
            <li role="menuitem"><a href="geopolitics.html" style="color:#dc2626;">Global Analysis</a></li>
            <li role="menuitem"><a href="future-forward.html" style="color:#7c3aed;">Future Forward</a></li>
            <li role="menuitem"><a href="glossary.html" style="color:#14b8a6;">Glossary</a></li>
            <li role="menuitem"><a href="Apps/second brain/index.html" style="color:#8b5cf6;font-weight:600;">&#x2022; Second Brain</a></li>
            <li role="separator" style="border-bottom:1px solid rgba(255,255,255,0.1);margin:4px 0;"></li>
            <li role="menuitem"><a href="changelog.html" style="color:#f59e0b;font-weight:600;">Changelog <span style="background:#f59e0b;color:#0f172a;font-size:0.58rem;font-weight:800;letter-spacing:0.1em;padding:1px 5px;border-radius:4px;vertical-align:middle;margin-left:3px;">NEW</span></a></li>
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
      <!-- Aurora orbs (reuse global .aurora-orb classes from styles.css) -->
      <div class="aurora-orb aurora-orb-1" aria-hidden="true"></div>
      <div class="aurora-orb aurora-orb-2" aria-hidden="true"></div>
      <div class="aurora-orb aurora-orb-3" aria-hidden="true"></div>

      <h1 id="cl-heading">Changelog</h1>
      <p class="cl-subtitle">Live release notes &mdash; every shipped version</p>
      <p class="cl-meta">
        Latest: <strong style="color:#7dd5b4;">{latest}</strong>
        &nbsp;&bull;&nbsp;
        <span id="rzVersionAnchor"></span>
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
            <li><a href="changelog.html" style="color:#7dd5b4;">Changelog</a></li>
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

  <script src="script.min.js?v=20260509-share-fix" defer></script>

  {filter_js}

</body>
</html>'''


# ── CLI entry point ────────────────────────────────────────────────────────────
def main():
    apply = '--apply' in sys.argv

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

    if apply:
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
