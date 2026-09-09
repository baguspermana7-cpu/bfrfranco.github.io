#!/usr/bin/env python3
"""
build-llms-full.py — generate llms-full.txt (full-content Markdown variant).
Uses the shared publication inventory, strips nav/footer/script/style, extracts public body,
converts basic HTML to Markdown. Concatenates as one big Markdown file.
Idempotent. Fails closed above 20 MB rather than creating an unreviewed archive.

Usage:
  python3 tools/build-llms-full.py
"""

import re
import html
from pathlib import Path
import sys

from crawler_llms import (
    METADATA_ONLY_NOTICE, extract_meta, extract_public_body, publication_pages, run_builder,
)

MAX_BYTES = 20 * 1024 * 1024  # 20 MB
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

def html_to_markdown(content):
    """Convert basic HTML subset to Markdown."""

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
    content = html.unescape(content)

    # Clean up whitespace
    content = re.sub(r'[ \t]+', ' ', content)
    content = re.sub(r'\n{4,}', '\n\n\n', content)
    content = '\n'.join(line.rstrip() for line in content.splitlines())
    content = content.strip()

    return content


def extract_page(filepath, page):
    """Export approved public content, or metadata only when access checks exist."""
    title, desc = extract_meta(filepath)
    url = page["loc"]
    if page["content_policy"] == "metadata-only":
        return f"\n\n{'=' * 70}\n# {title} — {url}\n\n> {desc}\n\n{METADATA_ONLY_NOTICE}\n"
    raw = Path(filepath).read_text(encoding="utf-8")

    md = html_to_markdown(extract_public_body(raw))

    # Build section
    section = f"\n\n{'='*70}\n# {title} — {url}\n"
    if desc:
        section += f"\n> {desc}\n"
    section += f"\n{md}\n"

    return section


def build_content(root, inventory=None):
    pages = publication_pages(root, inventory)
    priority = {path: position for position, path in enumerate(PRIORITY_FILES)}
    ordered = sorted(pages, key=lambda page: (priority.get(page["path"], len(priority)), page["path"]))
    header = (
        "# resistancezero.com — Public Content Export\n"
        "# Generated by tools/build-llms-full.py\n"
        "# Format: Markdown sections delimited by === / # Title — URL headers\n"
        "# Access-controlled pages have metadata-only sections; this is not an access bypass.\n\n"
    )
    content = header + "".join(extract_page(Path(root) / page["path"], page) for page in ordered)
    if len(content.encode("utf-8")) > MAX_BYTES:
        raise ValueError("Public content exceeds 20 MB; review an explicit archive policy before exporting")
    if (Path(root) / "llms-archive.txt").exists():
        raise ValueError("Existing llms-archive.txt requires an explicit privacy review; not overwritten or deleted")
    return content


if __name__ == "__main__":
    sys.exit(run_builder(build_content, "llms-full.txt"))
