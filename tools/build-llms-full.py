#!/usr/bin/env python3
"""
build-llms-full.py — generate llms-full.txt (full-content Markdown variant).
Walks main HTML pages, strips nav/footer/script/style, extracts article/main body,
converts basic HTML to Markdown. Concatenates as one big Markdown file.
Idempotent. If output > 20 MB, splits into llms-full.txt + llms-archive.txt.

Usage:
  python3 tools/build-llms-full.py
"""

import os
import re
import html

SITE_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE_URL = "https://resistancezero.com"
OUTPUT = os.path.join(SITE_ROOT, "llms-full.txt")
ARCHIVE_OUTPUT = os.path.join(SITE_ROOT, "llms-archive.txt")
MAX_BYTES = 20 * 1024 * 1024  # 20 MB

EXCLUDE_FILES = {
    "article-9-paper.html", "rz-ops-p7x3k9m.html",
    "google1b98e0817bd5aa88.html", "404.html",
    "future-forward-1.html",  # redirect page
}

# Priority order: most important pages first
PRIORITY_FILES = [
    "index.html", "datacenter-solutions.html", "articles.html", "glossary.html",
    "datahallAI.html", "dc-conventional.html", "dc-market-tracker.html",
    "future-forward.html", "geopolitics.html", "insights.html",
    "pue-calculator.html", "capex-calculator.html", "opex-calculator.html",
    "roi-calculator.html", "tco-calculator.html", "cx-calculator.html",
    "carbon-footprint.html",
    "tia-942-checklist.html", "tier-advisor.html",
    "ltc-uptime-tier-alignment.html", "ltc-ansi-tia-topology-readiness.html",
    "ltc-ashrae-thermal-control.html", "ltc-iso-energy-governance.html",
    "ltc-nfpa-fire-risk.html", "ltc-system-modelling-lab.html",
    "pln-java-grid.html",
    "FF-1.html", "FF-2.html", "FF-3.html",
    "geopolitics-1.html", "geopolitics-2.html", "geopolitics-3.html",
    "asean-dc-report-2026.html",
    "compare-air-vs-liquid-cooling.html", "compare-ashrae-vs-uptime.html",
    "compare-diesel-vs-gas-generator.html", "compare-fm200-vs-novec.html",
    "compare-n1-vs-2n.html", "compare-pue-vs-dcie.html",
    "compare-raised-floor-vs-slab.html", "compare-tier-3-vs-tier-4.html",
    "compare-ups-online-vs-offline.html", "compare-wet-vs-preaction.html",
]

# Article files sorted numerically
def get_article_files():
    files = []
    for fname in os.listdir(SITE_ROOT):
        m = re.match(r'^article-(\d+)\.html$', fname)
        if m and fname not in EXCLUDE_FILES:
            files.append((int(m.group(1)), fname))
    return [f for _, f in sorted(files)]


def strip_block_tags(content, *tags):
    """Remove entire block-level tag sections (including content)."""
    for tag in tags:
        # Remove self-closing and block tags with content
        content = re.sub(
            rf'<{tag}(\s[^>]*)?>.*?</{tag}>',
            ' ', content, flags=re.DOTALL | re.IGNORECASE
        )
    return content


def html_to_markdown(content):
    """Convert basic HTML subset to Markdown."""
    # Unescape HTML entities first
    content = html.unescape(content)

    # Headings
    for level in range(6, 0, -1):
        content = re.sub(
            rf'<h{level}[^>]*>(.*?)</h{level}>',
            lambda m, l=level: '\n' + '#' * l + ' ' + re.sub(r'<[^>]+>', '', m.group(1)).strip() + '\n',
            content, flags=re.DOTALL | re.IGNORECASE
        )

    # Bold / strong
    content = re.sub(r'<(strong|b)[^>]*>(.*?)</(strong|b)>', r'**\2**', content, flags=re.DOTALL | re.IGNORECASE)
    # Italic / em
    content = re.sub(r'<(em|i)[^>]*>(.*?)</(em|i)>', r'*\2*', content, flags=re.DOTALL | re.IGNORECASE)

    # Links — keep text only (LLMs can infer context)
    content = re.sub(r'<a[^>]+href=["\'](https?://[^"\']+)["\'][^>]*>(.*?)</a>', r'\2 (\1)', content, flags=re.DOTALL | re.IGNORECASE)
    content = re.sub(r'<a[^>]*>(.*?)</a>', r'\1', content, flags=re.DOTALL | re.IGNORECASE)

    # Paragraphs
    content = re.sub(r'<p[^>]*>(.*?)</p>', r'\n\1\n', content, flags=re.DOTALL | re.IGNORECASE)

    # Line breaks
    content = re.sub(r'<br\s*/?>', '\n', content, flags=re.IGNORECASE)

    # Lists
    content = re.sub(r'<li[^>]*>(.*?)</li>', r'\n- \1', content, flags=re.DOTALL | re.IGNORECASE)
    content = re.sub(r'<[ou]l[^>]*>', '\n', content, flags=re.IGNORECASE)
    content = re.sub(r'</[ou]l>', '\n', content, flags=re.IGNORECASE)

    # Code blocks
    content = re.sub(r'<pre[^>]*>(.*?)</pre>', lambda m: '\n```\n' + re.sub(r'<[^>]+>', '', m.group(1)) + '\n```\n', content, flags=re.DOTALL | re.IGNORECASE)
    content = re.sub(r'<code[^>]*>(.*?)</code>', r'`\1`', content, flags=re.DOTALL | re.IGNORECASE)

    # Table cells
    content = re.sub(r'<th[^>]*>(.*?)</th>', r' | \1', content, flags=re.DOTALL | re.IGNORECASE)
    content = re.sub(r'<td[^>]*>(.*?)</td>', r' | \1', content, flags=re.DOTALL | re.IGNORECASE)
    content = re.sub(r'<tr[^>]*>', '\n', content, flags=re.IGNORECASE)
    content = re.sub(r'</tr>', ' |', content, flags=re.IGNORECASE)
    content = re.sub(r'<t(head|body|foot)[^>]*>|</t(head|body|foot)>', '\n', content, flags=re.IGNORECASE)
    content = re.sub(r'<table[^>]*>|</table>', '\n', content, flags=re.IGNORECASE)

    # Blockquote
    content = re.sub(r'<blockquote[^>]*>(.*?)</blockquote>', lambda m: '\n> ' + re.sub(r'\n', '\n> ', m.group(1).strip()) + '\n', content, flags=re.DOTALL | re.IGNORECASE)

    # Section/div/article/main wrappers — just unwrap
    content = re.sub(r'<(div|section|article|main|aside|header|span|figure|figcaption)[^>]*>', ' ', content, flags=re.IGNORECASE)
    content = re.sub(r'</(div|section|article|main|aside|header|span|figure|figcaption)>', ' ', content, flags=re.IGNORECASE)

    # Remove remaining tags
    content = re.sub(r'<[^>]+>', ' ', content)

    # Clean up whitespace
    content = re.sub(r'[ \t]+', ' ', content)
    content = re.sub(r'\n{4,}', '\n\n\n', content)
    content = content.strip()

    return content


def extract_page(filepath):
    """Extract title + body content from HTML file as Markdown."""
    fname = os.path.basename(filepath)
    url = f"{SITE_URL}/{fname}"

    with open(filepath, encoding="utf-8", errors="ignore") as fh:
        raw = fh.read()

    # Extract title
    m = re.search(r'<title>(.*?)</title>', raw, re.DOTALL | re.IGNORECASE)
    title = m.group(1).strip() if m else fname

    # Extract meta description
    m = re.search(r'<meta[^>]+name=["\']description["\'][^>]+content=["\'](.*?)["\']', raw, re.IGNORECASE)
    if not m:
        m = re.search(r'<meta[^>]+content=["\'](.*?)["\'][^>]+name=["\']description["\']', raw, re.IGNORECASE)
    desc = m.group(1).strip() if m else ""

    # Remove script, style, nav, footer, template, noscript blocks
    content = strip_block_tags(
        raw,
        'script', 'style', 'nav', 'footer', 'noscript',
        'template', 'svg', 'canvas',
    )

    # Remove HTML comments
    content = re.sub(r'<!--.*?-->', ' ', content, flags=re.DOTALL)

    # Try to extract <article> or <main> first
    body = None
    for tag in ['article', 'main']:
        m = re.search(rf'<{tag}[^>]*>(.*?)</{tag}>', content, re.DOTALL | re.IGNORECASE)
        if m and len(m.group(1)) > 200:
            body = m.group(1)
            break

    # Fall back to <body>
    if not body:
        m = re.search(r'<body[^>]*>(.*?)</body>', content, re.DOTALL | re.IGNORECASE)
        body = m.group(1) if m else content

    md = html_to_markdown(body)

    # Build section
    section = f"\n\n{'='*70}\n# {title} — {url}\n"
    if desc:
        section += f"\n> {desc}\n"
    section += f"\n{md}\n"

    return section


def main():
    # Build ordered file list
    article_files = get_article_files()
    all_files = list(dict.fromkeys(PRIORITY_FILES + article_files))  # dedup, preserve order

    # Add any remaining files not in priority or article list
    for fname in sorted(os.listdir(SITE_ROOT)):
        if fname.endswith(".html") and fname not in EXCLUDE_FILES and fname not in all_files:
            all_files.append(fname)

    header = (
        "# resistancezero.com — Full Content Dump\n"
        "# Generated by tools/build-llms-full.py\n"
        "# Format: Markdown sections delimited by === / # Title — URL headers\n"
        "# Purpose: One-shot LLM context loading for resistancezero.com content\n\n"
    )

    sections = [header]
    primary_sections = [header]  # for size-limited primary file
    archive_sections = []

    processed = 0
    primary_size = len(header.encode("utf-8"))
    in_archive = False

    for fname in all_files:
        filepath = os.path.join(SITE_ROOT, fname)
        if not os.path.isfile(filepath):
            continue

        try:
            section = extract_page(filepath)
        except Exception as e:
            section = f"\n\n[ERROR extracting {fname}: {e}]\n"

        section_bytes = len(section.encode("utf-8"))
        processed += 1

        if not in_archive:
            if primary_size + section_bytes > MAX_BYTES:
                in_archive = True
                archive_sections.append(
                    f"# resistancezero.com — Archive (overflow from llms-full.txt)\n\n"
                )
            else:
                primary_size += section_bytes
                primary_sections.append(section)

        if in_archive:
            archive_sections.append(section)

    primary_content = "".join(primary_sections)
    with open(OUTPUT, "w", encoding="utf-8") as fh:
        fh.write(primary_content)
    primary_lines = primary_content.count('\n')
    print(f"Written: {OUTPUT} ({primary_lines:,} lines, {len(primary_content):,} bytes, {len(primary_sections)-1} pages)")

    if archive_sections:
        archive_content = "".join(archive_sections)
        with open(ARCHIVE_OUTPUT, "w", encoding="utf-8") as fh:
            fh.write(archive_content)
        archive_lines = archive_content.count('\n')
        print(f"Written: {ARCHIVE_OUTPUT} ({archive_lines:,} lines, {len(archive_content):,} bytes, {len(archive_sections)-1} pages)")
    else:
        # Remove old archive if it exists
        if os.path.exists(ARCHIVE_OUTPUT):
            os.remove(ARCHIVE_OUTPUT)
            print("Removed stale llms-archive.txt (all pages fit in llms-full.txt)")

    print(f"Total pages processed: {processed}")


if __name__ == "__main__":
    main()
