#!/usr/bin/env python3
"""
build-llms-txt.py — generate llms.txt from filesystem walk.
Per https://llmstxt.org spec: Markdown content map for LLM discovery.
Idempotent (overwrites llms.txt each run).

Usage:
  python3 tools/build-llms-txt.py
"""

import os
import re

SITE_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE_URL = "https://resistancezero.com"
OUTPUT = os.path.join(SITE_ROOT, "llms.txt")

EXCLUDE_FILES = {
    "article-9-paper.html", "rz-ops-p7x3k9m.html",
    "google1b98e0817bd5aa88.html", "404.html", "future-forward-1.html",
}

# Hardcoded category map: filename -> category
CATEGORY_MAP = {
    # About
    "index.html": "About",
    "datacenter-solutions.html": "About",
    # Calculators
    "pue-calculator.html": "Calculators",
    "capex-calculator.html": "Calculators",
    "opex-calculator.html": "Calculators",
    "roi-calculator.html": "Calculators",
    "tco-calculator.html": "Calculators",
    "cx-calculator.html": "Calculators",
    "carbon-footprint.html": "Calculators",
    # Tools + Monitors
    "dc-market-tracker.html": "Tools",
    "pln-java-grid.html": "Tools",
    "pln-java-grid-jabar.html": "Tools",
    "pln-java-grid-jakarta-banten.html": "Tools",
    "pln-java-grid-jateng.html": "Tools",
    "pln-java-grid-jatim.html": "Tools",
    "pln-java-grid-historical.html": "Tools",
    "tia-942-checklist.html": "Tools",
    "tier-advisor.html": "Tools",
    "ltc-uptime-tier-alignment.html": "Tools",
    "ltc-ansi-tia-topology-readiness.html": "Tools",
    "ltc-ashrae-thermal-control.html": "Tools",
    "ltc-iso-energy-governance.html": "Tools",
    "ltc-nfpa-fire-risk.html": "Tools",
    "ltc-system-modelling-lab.html": "Tools",
    "rfs-readiness-workbench.html": "Tools",
    "standards-ltc-lab.html": "Tools",
    "chiller-plant.html": "Tools",
    "EPMS_Telemetry.html": "Tools",
    # Simulations
    "datahallAI.html": "Simulations",
    "dc-conventional.html": "Simulations",
    "datahall.html": "Simulations",
    # Comparison guides
    "compare-air-vs-liquid-cooling.html": "Comparisons",
    "compare-ashrae-vs-uptime.html": "Comparisons",
    "compare-diesel-vs-gas-generator.html": "Comparisons",
    "compare-fm200-vs-novec.html": "Comparisons",
    "compare-n1-vs-2n.html": "Comparisons",
    "compare-pue-vs-dcie.html": "Comparisons",
    "compare-raised-floor-vs-slab.html": "Comparisons",
    "compare-tier-3-vs-tier-4.html": "Comparisons",
    "compare-ups-online-vs-offline.html": "Comparisons",
    "compare-wet-vs-preaction.html": "Comparisons",
    # Insight series
    "future-forward.html": "Insight Series",
    "future-forward-1.html": "Insight Series",
    "FF-1.html": "Insight Series",
    "FF-2.html": "Insight Series",
    "FF-3.html": "Insight Series",
    "geopolitics.html": "Insight Series",
    "geopolitics-1.html": "Insight Series",
    "geopolitics-2.html": "Insight Series",
    "geopolitics-3.html": "Insight Series",
    # Reports + Infographics
    "asean-dc-report-2026.html": "Reports",
    "infographic-dc-cost-breakdown.html": "Reports",
    "infographic-dc-sustainability.html": "Reports",
    "infographic-pue-global.html": "Reports",
    # Hub pages
    "articles.html": "Hubs",
    "glossary.html": "Hubs",
    "insights.html": "Hubs",
    # Pillar pages
    "pillar-cooling.html": "Pillar Pages",
    "pillar-fire-safety.html": "Pillar Pages",
    "pillar-power.html": "Pillar Pages",
    "pillar-standards.html": "Pillar Pages",
    "pillar-sustainability.html": "Pillar Pages",
    "ict.html": "Pillar Pages",
    "fire-system.html": "Pillar Pages",
    "fuel-system.html": "Pillar Pages",
    "water-system.html": "Pillar Pages",
    # Legal
    "privacy.html": "Legal",
    "terms.html": "Legal",
    # Misc
    "achievements.html": "About",
    "dashboard.html": "Tools",
}


def extract_meta(path):
    import html as html_mod
    with open(path, encoding="utf-8", errors="ignore") as fh:
        content = fh.read(5000)
    title = re.search(r'<title>(.*?)</title>', content, re.DOTALL | re.IGNORECASE)
    desc = re.search(r'<meta[^>]+name=["\']description["\'][^>]+content=["\'](.*?)["\']', content, re.IGNORECASE)
    if not desc:
        desc = re.search(r'<meta[^>]+content=["\'](.*?)["\'][^>]+name=["\']description["\']', content, re.IGNORECASE)
    t = html_mod.unescape(title.group(1).strip()) if title else os.path.basename(path)
    d = html_mod.unescape(desc.group(1).strip()) if desc else ""
    return t, d


def categorize(fname):
    if fname in CATEGORY_MAP:
        return CATEGORY_MAP[fname]
    if re.match(r'^article-\d+\.html$', fname):
        return "Technical Articles"
    return "Other"


def main():
    # Collect all html files at root level
    files = []
    for fname in os.listdir(SITE_ROOT):
        if not fname.endswith(".html"):
            continue
        if fname in EXCLUDE_FILES:
            continue
        filepath = os.path.join(SITE_ROOT, fname)
        if not os.path.isfile(filepath):
            continue
        title, desc = extract_meta(filepath)
        category = categorize(fname)
        url = f"{SITE_URL}/{fname}"
        files.append((category, fname, title, desc, url))

    # Group by category
    categories = {}
    for cat, fname, title, desc, url in files:
        categories.setdefault(cat, []).append((fname, title, desc, url))

    # Sort articles numerically
    def sort_articles(items):
        def key(item):
            m = re.search(r'(\d+)', item[0])
            return int(m.group(1)) if m else 0
        return sorted(items, key=key)

    # Build output
    lines = [
        "# resistancezero.com",
        "",
        "> Mission-critical data center engineering — calculators, technical articles, grid monitors,",
        "> and operator-grade simulations by Bagus Dwi Permana. 12+ years experience in hyperscale",
        "> DC operations, electrical infrastructure, and industrial automation.",
        "> CDFOM + Ahli K3 Listrik certified.",
        "",
    ]

    CATEGORY_ORDER = [
        "About", "Calculators", "Technical Articles", "Comparisons",
        "Tools", "Simulations", "Insight Series", "Reports",
        "Pillar Pages", "Hubs", "Legal", "Other",
    ]

    SECTION_NOTES = {
        "About": "Profile and background",
        "Calculators": "Decision support tools — free, no signup required",
        "Technical Articles": "27 deep-dive engineering articles (Operations Journal series)",
        "Comparisons": "Side-by-side infrastructure technology analysis",
        "Tools": "Interactive monitors, checklists, and labs",
        "Simulations": "Operator-grade BMS + infrastructure dashboards",
        "Insight Series": "Long-form research series on AI, platforms, geopolitics",
        "Reports": "Market reports and infographics",
        "Pillar Pages": "Infrastructure domain deep-dives",
        "Hubs": "Content index pages",
        "Legal": "Privacy policy and terms",
    }

    for cat in CATEGORY_ORDER:
        items = categories.get(cat)
        if not items:
            continue
        note = SECTION_NOTES.get(cat, "")
        heading = f"## {cat}"
        if note:
            heading += f" ({note})"
        lines.append(heading)
        lines.append("")

        sorted_items = sort_articles(items) if cat == "Technical Articles" else sorted(items, key=lambda x: x[0])
        for fname, title, desc, url in sorted_items:
            if desc:
                # Truncate desc to ~120 chars
                if len(desc) > 120:
                    desc = desc[:117] + "..."
                lines.append(f"- [{title}]({url}): {desc}")
            else:
                lines.append(f"- [{title}]({url})")

        lines.append("")

    content = "\n".join(lines)

    with open(OUTPUT, "w", encoding="utf-8") as fh:
        fh.write(content)

    print(f"Written: {OUTPUT} ({len(lines)} lines, {len(files)} pages)")


if __name__ == "__main__":
    main()
