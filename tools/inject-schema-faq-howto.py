#!/usr/bin/env python3
"""
inject-schema-faq-howto.py
Idempotently inserts FAQPage schema into 5 calc pages and HowTo schema into
tia-942-checklist.html. Inserts blocks just before the first real </head> tag.
"""

import re
import sys
from pathlib import Path

WORKDIR = Path("/home/baguspermana7/rz-work")

# ---------------------------------------------------------------------------
# Schema blocks — defined as Python strings, NO embedded </script> danger
# (each block is a complete JSON-LD payload; Python writes the surrounding
# <script> and </script> tags separately so they are never inside a string)
# ---------------------------------------------------------------------------

FAQ_PUE = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
        {
            "@type": "Question",
            "name": "How is PUE calculated?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "PUE = Total Facility Power / IT Equipment Power. Total includes IT load + cooling + lighting + losses. Lower PUE means more energy reaches IT, less wasted on infrastructure."
            }
        },
        {
            "@type": "Question",
            "name": "What's a typical PUE range for hyperscale data centers?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "Best-in-class hyperscale facilities achieve PUE 1.10-1.20 (Google, Meta, AWS new-build averages). Typical enterprise tier-3 colos run PUE 1.40-1.60. Legacy facilities often exceed PUE 2.0."
            }
        },
        {
            "@type": "Question",
            "name": "How does climate affect PUE?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "Tropical-humid climates (Indonesia, MY, SG) push PUE +0.10-0.15 due to year-round mechanical cooling. Cold climates (Nordic, US-North) enable economiser/free-cooling for 4000+ hours/year, reducing PUE by 0.10-0.20."
            }
        },
        {
            "@type": "Question",
            "name": "What inputs affect PUE the most?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "1) Cooling system type (chilled water + economiser is most efficient), 2) IT load utilisation (low utilisation hurts PUE — fixed losses don't scale), 3) Climate zone, 4) Tier classification (Tier IV redundancy adds 5-10% overhead)."
            }
        }
    ]
}

FAQ_CAPEX = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
        {
            "@type": "Question",
            "name": "What's included in DC CAPEX?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "Land/site, civil shell, electrical (UPS/STS/PDU), mechanical (chillers/CRAH), fire/security/BMS, IT cabling, and soft costs (design/PM/commissioning)."
            }
        },
        {
            "@type": "Question",
            "name": "What's a typical $/kW for a Tier III data center?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "$9-12K/kW for hyperscale ground-up, $12-18K/kW for enterprise Tier III, $18-25K/kW for retrofit/colo."
            }
        },
        {
            "@type": "Question",
            "name": "How does country affect CAPEX?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "Indonesia/MY/Vietnam ~0.7-0.8x of US/EU baseline. Singapore ~1.2-1.4x. Japan ~1.1-1.3x. Use the country dropdown to apply local-rate multipliers."
            }
        },
        {
            "@type": "Question",
            "name": "What CAPEX category has the biggest variance?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "Mechanical (cooling) — varies 0.7-1.5x based on climate, tier, and cooling technology selection."
            }
        }
    ]
}

FAQ_OPEX = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
        {
            "@type": "Question",
            "name": "What's the largest line item in DC OPEX?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "Energy at 40-60% of OPEX, then staffing 20-30%, then maintenance 10-15%."
            }
        },
        {
            "@type": "Question",
            "name": "How do staffing models compare?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "In-House: full headcount, lower per-FTE cost, full control. Hybrid Mix: blended efficiency. Full Contractor: ~30% fewer FTE, higher per-FTE rate, net 10-15% savings."
            }
        },
        {
            "@type": "Question",
            "name": "How does PUE improvement affect OPEX?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "Each 0.1 PUE reduction saves ~6-8% of energy OPEX. For a 1MW Tier III in tropical climate, 0.1 PUE improvement equals approximately $50-80K/year saved."
            }
        },
        {
            "@type": "Question",
            "name": "Why is OPEX country-tuned?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "Energy rates vary 3-5x globally (Indonesia $0.075/kWh vs Singapore $0.18/kWh vs Germany $0.30/kWh). Labour costs vary 5-10x. Both are baked into the calculator country dropdown."
            }
        }
    ]
}

FAQ_ROI = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
        {
            "@type": "Question",
            "name": "What's a typical DC ROI horizon?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "5-7 years to payback for hyperscale build-to-suit, 8-12 years for enterprise CapEx-heavy facilities."
            }
        },
        {
            "@type": "Question",
            "name": "How is DC ROI calculated?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "(Annual Net Revenue - Annual OPEX) / Initial CAPEX, projected over 5-10 years with a discount rate applied to derive NPV and IRR."
            }
        },
        {
            "@type": "Question",
            "name": "What's the typical revenue per kW for colocation?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "$150-250/kW/month for retail colo, $80-120/kW/month for wholesale, $40-80/kW/month for hyperscale build-to-suit."
            }
        }
    ]
}

FAQ_TCO = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
        {
            "@type": "Question",
            "name": "What's included in 10-year TCO?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "CAPEX (year 0) + OPEX (years 1-10) + major infrastructure refresh (typically year 5-7) + decommissioning costs."
            }
        },
        {
            "@type": "Question",
            "name": "Build vs Colo vs Cloud — when does each win?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "Build: lowest TCO at >5MW with >7-year horizon. Colo: best for 1-5MW, 3-7 year flexibility. Cloud: best for variable workloads, <2MW, <3 years."
            }
        },
        {
            "@type": "Question",
            "name": "What's the biggest TCO sensitivity?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "Energy cost — over 10 years it dwarfs CAPEX. A 30% energy price hike adds 8-12% to TCO. Climate zone is the second-largest sensitivity driver."
            }
        }
    ]
}

HOWTO_TIA942 = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    "name": "How to audit a data center for TIA-942 compliance",
    "description": "Step-by-step guide to assess your data center against TIA-942-B/C rated tiers using this interactive compliance checklist.",
    "totalTime": "PT15M",
    "tool": [
        {"@type": "HowToTool", "name": "TIA-942 Compliance Checklist"}
    ],
    "step": [
        {
            "@type": "HowToStep",
            "position": 1,
            "name": "Map Facility Against Rated Tiers",
            "text": "Identify your target tier rating (Tier I-IV) and the data center type (enterprise, colo, hyperscale, edge, or modular) to scope the audit."
        },
        {
            "@type": "HowToStep",
            "position": 2,
            "name": "Inventory Critical Infrastructure",
            "text": "Document all critical subsystems: power (utility feeds, UPS, generators, PDUs), cooling (chillers, CRAH/CRAC, economisers), network (diverse paths, carrier diversity), security, and fire suppression."
        },
        {
            "@type": "HowToStep",
            "position": 3,
            "name": "Score Each Subsystem",
            "text": "Use the checklist to score each of the 80+ items across 6 categories against TIA-942-C requirements. Toggle tier filters to compare gaps between current state and target tier."
        },
        {
            "@type": "HowToStep",
            "position": 4,
            "name": "Identify Gaps and Remediation Cost",
            "text": "Review non-compliant items, flag priority gaps, and estimate remediation effort and cost for each deficiency."
        },
        {
            "@type": "HowToStep",
            "position": 5,
            "name": "Generate Compliance Report",
            "text": "Export the scored checklist as a PDF compliance report showing tier score, gap summary, and recommended remediation roadmap."
        }
    ]
}

# ---------------------------------------------------------------------------
# Files and their payloads
# ---------------------------------------------------------------------------

TASKS = [
    # (filename, check_type, schema_dict, comment_label)
    ("pue-calculator.html",   "FAQPage", FAQ_PUE,    "FAQPage"),
    ("capex-calculator.html", "FAQPage", FAQ_CAPEX,  "FAQPage"),
    ("opex-calculator.html",  "FAQPage", FAQ_OPEX,   "FAQPage"),
    ("roi-calculator.html",   "FAQPage", FAQ_ROI,    "FAQPage"),
    ("tco-calculator.html",   "FAQPage", FAQ_TCO,    "FAQPage"),
    ("tia-942-checklist.html","HowTo",   HOWTO_TIA942, "HowTo"),
    ("tier-advisor.html",     "HowTo",   None,       "HowTo"),   # already present — skip
    ("cx-calculator.html",    "HowTo",   None,       "HowTo"),   # already present — skip
]

import json

def build_script_block(schema_dict, comment_label):
    """Build the complete <script> block string.  The closing tag is a real
    HTML tag written in Python — never embedded inside a JS/JSON string."""
    json_text = json.dumps(schema_dict, indent=4, ensure_ascii=False)
    lines = [
        f'    <!-- Structured Data - {comment_label} -->',
        '    <script type="application/ld+json">',
    ]
    for line in json_text.splitlines():
        lines.append(f'    {line}')
    # Write closing tag as a plain string concatenation so it is never inside
    # a string literal that the browser HTML tokeniser would misparse.
    lines.append('    </' + 'script>')
    lines.append('')
    return '\n'.join(lines)


def inject(filepath: Path, check_type: str, schema_dict, comment_label: str):
    text = filepath.read_text(encoding='utf-8')

    # Idempotency check
    if f'"@type":"{check_type}"' in text or f'"@type": "{check_type}"' in text:
        print(f'  SKIP  {filepath.name} — {check_type} already present')
        return False

    if schema_dict is None:
        print(f'  SKIP  {filepath.name} — no schema provided (manual review needed)')
        return False

    block = build_script_block(schema_dict, comment_label)

    # Find the first real </head> (not inside a JS string or print-window template)
    # Strategy: find the FIRST occurrence that is on its own line (preceded by
    # optional whitespace only).
    # We use a line-based search to be safe.
    lines = text.splitlines(keepends=True)
    insert_idx = None
    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped == '</head>':
            insert_idx = i
            break

    if insert_idx is None:
        print(f'  ERROR {filepath.name} — could not find standalone </head> line')
        return False

    # Insert block before </head>
    lines.insert(insert_idx, block + '\n')
    new_text = ''.join(lines)
    filepath.write_text(new_text, encoding='utf-8')
    print(f'  ADDED {filepath.name} — {check_type} injected before line {insert_idx+1}')
    return True


def main():
    results = []
    for filename, check_type, schema_dict, comment_label in TASKS:
        filepath = WORKDIR / filename
        if not filepath.exists():
            print(f'  MISSING {filename}')
            results.append((filename, 'MISSING'))
            continue
        ok = inject(filepath, check_type, schema_dict, comment_label)
        results.append((filename, 'added' if ok else 'skipped'))

    print('\n--- Summary ---')
    for fname, status in results:
        print(f'  {status:8s}  {fname}')


if __name__ == '__main__':
    main()
