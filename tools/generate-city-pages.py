#!/usr/bin/env python3
"""
Programmatic SEO City Page Generator for ResistanceZero.com

Reads city-data.json and generates self-contained HTML pages
for each data center market city, plus a hub index page.

Usage:
    python3 tools/generate-city-pages.py
"""

import json
import os
from datetime import date

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(SCRIPT_DIR, "city-data.json")
OUTPUT_DIR = os.path.join(os.path.dirname(SCRIPT_DIR), "dc-market")
BASE_URL = "https://resistancezero.com"
TODAY = date.today().isoformat()


def load_city_data():
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        return json.load(f)["cities"]


def generate_faq_schema(city_data):
    faq_items = []
    for faq in city_data["faq"]:
        faq_items.append(f"""        {{
            "@type": "Question",
            "name": "{escape_json_string(faq['question'])}",
            "acceptedAnswer": {{
                "@type": "Answer",
                "text": "{escape_json_string(faq['answer'])}"
            }}
        }}""")
    return ",\n".join(faq_items)


def escape_json_string(s):
    return s.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")


def escape_html(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


def generate_city_page(city):
    slug = city["slug"]
    city_name = city["city"]
    country = city["country"]
    flag = city["flag"]
    region = city["region"]
    capacity_label = city["capacity_label"]
    avg_pue = city["avg_pue"]
    climate = city["climate_type"]
    power_cost = city["power_cost_kwh"]
    renewable = city["renewable_percent"]
    growth = city["growth_rate"]
    standards = city["key_standards"]
    operators = city["major_operators"]
    challenges = city["key_challenges"]
    cooling = city["cooling_strategy"]
    faqs = city["faq"]

    title = f"{city_name} Data Center Market Guide | Standards, Cost & Infrastructure"
    description = f"Complete guide to the {city_name} data center market. {capacity_label} capacity, PUE {avg_pue}, {growth}% growth rate. Standards, cooling, operators, and infrastructure analysis."
    keywords = f"{city_name} data center, {country} data center, {city_name} colocation, {city_name} data center market, {city_name} PUE, {city_name} cooling, {region} data center"
    canonical = f"{BASE_URL}/dc-market/{slug}.html"

    standards_html = ""
    for std in standards:
        standards_html += f"""                    <div class="standard-tag">{escape_html(std)}</div>\n"""

    operators_html = ""
    for op in operators:
        operators_html += f"""                    <div class="operator-card">
                        <div class="operator-name">{escape_html(op)}</div>
                    </div>\n"""

    challenges_html = ""
    for ch in challenges:
        challenges_html += f"""                    <li>{escape_html(ch)}</li>\n"""

    faq_html = ""
    for faq in faqs:
        faq_html += f"""                <div class="faq-item">
                    <button class="faq-question" aria-expanded="false">
                        <span>{escape_html(faq['question'])}</span>
                        <svg class="faq-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                    </button>
                    <div class="faq-answer">
                        <p>{escape_html(faq['answer'])}</p>
                    </div>
                </div>\n"""

    faq_schema = generate_faq_schema(city)

    # Build PUE rating class
    if avg_pue <= 1.4:
        pue_class = "excellent"
        pue_label = "Excellent"
    elif avg_pue <= 1.5:
        pue_class = "good"
        pue_label = "Good"
    elif avg_pue <= 1.6:
        pue_class = "average"
        pue_label = "Average"
    else:
        pue_class = "below-avg"
        pue_label = "Needs Improvement"

    html = f"""<!DOCTYPE html>
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

    <!-- SEO Meta Tags -->
    <title>{escape_html(title)}</title>
    <meta name="description" content="{escape_html(description)}">
    <meta name="keywords" content="{escape_html(keywords)}">
    <meta name="author" content="Bagus Dwi Permana">
    <meta name="robots" content="index, follow">
    <meta name="theme-color" content="#2563eb">
    <link rel="canonical" href="{canonical}">

    <link rel="alternate" hreflang="en" href="{canonical}">
    <link rel="alternate" hreflang="x-default" href="{canonical}">

    <!-- Resource Hints -->
    <link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
    <link rel="preconnect" href="https://www.googletagmanager.com" crossorigin>
    <link rel="dns-prefetch" href="https://cdn.jsdelivr.net">
    <link rel="dns-prefetch" href="https://www.googletagmanager.com">

    <!-- Open Graph Meta Tags -->
    <meta property="og:type" content="article">
    <meta property="og:url" content="{canonical}">
    <meta property="og:title" content="{escape_html(title)}">
    <meta property="og:description" content="{escape_html(description)}">
    <meta property="og:image" content="{BASE_URL}/assets/profile-photo.jpg">
    <meta property="og:image:alt" content="{city_name} Data Center Market Guide">
    <meta property="og:locale" content="en_US">
    <meta property="og:site_name" content="Bagus Dwi Permana Portfolio">

    <!-- Twitter Card Meta Tags -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:site" content="@BagusDPermana">
    <meta name="twitter:title" content="{escape_html(title)}">
    <meta name="twitter:description" content="{escape_html(description)}">
    <meta name="twitter:image" content="{BASE_URL}/assets/profile-photo.jpg">
    <meta name="twitter:image:alt" content="{city_name} Data Center Market Guide">

    <!-- Structured Data - BreadcrumbList -->
    <script type="application/ld+json">
    {{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {{
                "@type": "ListItem",
                "position": 1,
                "name": "Home",
                "item": "{BASE_URL}/"
            }},
            {{
                "@type": "ListItem",
                "position": 2,
                "name": "DC Markets",
                "item": "{BASE_URL}/dc-market/"
            }},
            {{
                "@type": "ListItem",
                "position": 3,
                "name": "{city_name}"
            }}
        ]
    }}
    </script>

    <!-- Structured Data - FAQPage -->
    <script type="application/ld+json">
    {{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
{faq_schema}
        ]
    }}
    </script>

    <link rel="icon" type="image/png" href="../assets/Favicon.png">
    <link rel="apple-touch-icon" href="../assets/Favicon.png">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="../styles.min.css?v=20260225">

    <style>
        /* DC Market Page Variables */
        :root {{
            --dcm-primary: #2563eb;
            --dcm-primary-light: #3b82f6;
            --dcm-primary-dark: #1d4ed8;
            --dcm-bg: #f8fafc;
            --dcm-card-bg: #ffffff;
            --dcm-text: #1e293b;
            --dcm-text-secondary: #64748b;
            --dcm-border: #e2e8f0;
            --dcm-success: #10b981;
            --dcm-warning: #f59e0b;
            --dcm-danger: #ef4444;
        }}

        [data-theme="dark"] {{
            --dcm-bg: #0f172a;
            --dcm-card-bg: #1e293b;
            --dcm-text: #f1f5f9;
            --dcm-text-secondary: #94a3b8;
            --dcm-border: #334155;
        }}

        .dcm-hero {{
            background: linear-gradient(135deg, #1e3a5f 0%, #1d4ed8 50%, #2563eb 100%);
            padding: 8rem 2rem 4rem;
            color: #fff;
            text-align: center;
            position: relative;
            overflow: hidden;
        }}

        .dcm-hero::before {{
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0; bottom: 0;
            background:
                radial-gradient(circle at 20% 80%, rgba(37, 99, 235, 0.3) 0%, transparent 50%),
                radial-gradient(circle at 80% 20%, rgba(16, 185, 129, 0.15) 0%, transparent 50%);
            z-index: 0;
        }}

        .dcm-hero > * {{ position: relative; z-index: 1; }}

        .dcm-hero h1 {{
            font-size: clamp(2.2rem, 5vw, 3.2rem);
            margin-bottom: 0.5rem;
            font-weight: 800;
        }}

        .dcm-hero .flag {{
            font-size: 2.5rem;
            display: block;
            margin-bottom: 0.75rem;
        }}

        .dcm-hero .subtitle {{
            font-size: 1.15rem;
            color: rgba(255, 255, 255, 0.85);
            margin-bottom: 2rem;
        }}

        .dcm-hero-stats {{
            display: flex;
            justify-content: center;
            gap: 2rem;
            flex-wrap: wrap;
        }}

        .dcm-hero-stat {{
            background: rgba(255, 255, 255, 0.12);
            backdrop-filter: blur(10px);
            border-radius: 12px;
            padding: 1rem 1.5rem;
            min-width: 140px;
            border: 1px solid rgba(255, 255, 255, 0.15);
        }}

        .dcm-hero-stat .stat-value {{
            font-size: 1.6rem;
            font-weight: 700;
            display: block;
        }}

        .dcm-hero-stat .stat-label {{
            font-size: 0.75rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: rgba(255, 255, 255, 0.7);
            margin-top: 0.25rem;
        }}

        /* Breadcrumb */
        .dcm-breadcrumb {{
            padding: 1rem 2rem;
            background: var(--dcm-bg);
            border-bottom: 1px solid var(--dcm-border);
        }}

        .dcm-breadcrumb nav {{
            max-width: 1100px;
            margin: 0 auto;
            font-size: 0.85rem;
            color: var(--dcm-text-secondary);
        }}

        .dcm-breadcrumb a {{
            color: var(--dcm-primary);
            text-decoration: none;
        }}

        .dcm-breadcrumb a:hover {{ text-decoration: underline; }}

        .dcm-breadcrumb .sep {{ margin: 0 0.5rem; }}

        /* Content Sections */
        .dcm-content {{
            max-width: 1100px;
            margin: 0 auto;
            padding: 2rem;
        }}

        .dcm-section {{
            margin-bottom: 3rem;
        }}

        .dcm-section-title {{
            font-size: 1.6rem;
            font-weight: 700;
            color: var(--dcm-text);
            margin-bottom: 1rem;
            padding-bottom: 0.5rem;
            border-bottom: 3px solid var(--dcm-primary);
            display: inline-block;
        }}

        .dcm-section p {{
            color: var(--dcm-text-secondary);
            line-height: 1.8;
            font-size: 1.05rem;
        }}

        /* Stats Grid */
        .dcm-stats-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 1.5rem;
            margin-bottom: 2rem;
        }}

        .dcm-stat-card {{
            background: var(--dcm-card-bg);
            border: 1px solid var(--dcm-border);
            border-radius: 16px;
            padding: 1.5rem;
            text-align: center;
            transition: transform 0.2s ease, box-shadow 0.2s ease;
        }}

        .dcm-stat-card:hover {{
            transform: translateY(-4px);
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
        }}

        .dcm-stat-card .stat-icon {{
            font-size: 2rem;
            margin-bottom: 0.75rem;
        }}

        .dcm-stat-card .stat-value {{
            font-size: 2rem;
            font-weight: 800;
            color: var(--dcm-primary);
            display: block;
        }}

        .dcm-stat-card .stat-label {{
            font-size: 0.85rem;
            color: var(--dcm-text-secondary);
            text-transform: uppercase;
            letter-spacing: 0.03em;
            margin-top: 0.25rem;
        }}

        /* PUE Rating Badge */
        .pue-badge {{
            display: inline-block;
            padding: 0.25rem 0.75rem;
            border-radius: 20px;
            font-size: 0.75rem;
            font-weight: 600;
            margin-top: 0.5rem;
        }}
        .pue-badge.excellent {{ background: #d1fae5; color: #065f46; }}
        .pue-badge.good {{ background: #dbeafe; color: #1e40af; }}
        .pue-badge.average {{ background: #fef3c7; color: #92400e; }}
        .pue-badge.below-avg {{ background: #fee2e2; color: #991b1b; }}

        [data-theme="dark"] .pue-badge.excellent {{ background: #064e3b; color: #6ee7b7; }}
        [data-theme="dark"] .pue-badge.good {{ background: #1e3a5f; color: #93c5fd; }}
        [data-theme="dark"] .pue-badge.average {{ background: #78350f; color: #fcd34d; }}
        [data-theme="dark"] .pue-badge.below-avg {{ background: #7f1d1d; color: #fca5a5; }}

        /* Standards Tags */
        .dcm-standards-list {{
            display: flex;
            flex-wrap: wrap;
            gap: 0.75rem;
            margin-top: 1rem;
        }}

        .standard-tag {{
            background: var(--dcm-card-bg);
            border: 1px solid var(--dcm-border);
            border-radius: 8px;
            padding: 0.6rem 1rem;
            font-size: 0.9rem;
            color: var(--dcm-text);
            font-weight: 500;
            transition: border-color 0.2s;
        }}

        .standard-tag:hover {{
            border-color: var(--dcm-primary);
        }}

        /* Cooling Section */
        .dcm-cooling-box {{
            background: var(--dcm-card-bg);
            border: 1px solid var(--dcm-border);
            border-radius: 16px;
            padding: 2rem;
            margin-top: 1rem;
            border-left: 4px solid var(--dcm-primary);
        }}

        .dcm-cooling-box .climate-badge {{
            display: inline-block;
            background: var(--dcm-primary);
            color: #fff;
            padding: 0.3rem 0.8rem;
            border-radius: 6px;
            font-size: 0.8rem;
            font-weight: 600;
            margin-bottom: 1rem;
        }}

        /* Challenges */
        .dcm-challenges-list {{
            list-style: none;
            padding: 0;
            margin-top: 1rem;
        }}

        .dcm-challenges-list li {{
            padding: 1rem;
            margin-bottom: 0.75rem;
            background: var(--dcm-card-bg);
            border: 1px solid var(--dcm-border);
            border-radius: 10px;
            color: var(--dcm-text);
            line-height: 1.6;
            padding-left: 2.5rem;
            position: relative;
        }}

        .dcm-challenges-list li::before {{
            content: '';
            position: absolute;
            left: 1rem;
            top: 1.25rem;
            width: 8px;
            height: 8px;
            background: var(--dcm-warning);
            border-radius: 50%;
        }}

        /* Operators */
        .dcm-operators-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 1rem;
            margin-top: 1rem;
        }}

        .operator-card {{
            background: var(--dcm-card-bg);
            border: 1px solid var(--dcm-border);
            border-radius: 12px;
            padding: 1.25rem;
            text-align: center;
            transition: border-color 0.2s;
        }}

        .operator-card:hover {{
            border-color: var(--dcm-primary);
        }}

        .operator-name {{
            font-weight: 600;
            color: var(--dcm-text);
            font-size: 0.95rem;
        }}

        /* FAQ */
        .dcm-faq {{
            margin-top: 1rem;
        }}

        .faq-item {{
            border: 1px solid var(--dcm-border);
            border-radius: 12px;
            margin-bottom: 0.75rem;
            overflow: hidden;
            background: var(--dcm-card-bg);
        }}

        .faq-question {{
            width: 100%;
            padding: 1.25rem 1.5rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: none;
            border: none;
            cursor: pointer;
            font-size: 1rem;
            font-weight: 600;
            color: var(--dcm-text);
            text-align: left;
            gap: 1rem;
            font-family: 'Inter', sans-serif;
        }}

        .faq-question:hover {{
            background: rgba(37, 99, 235, 0.05);
        }}

        .faq-chevron {{
            width: 20px;
            height: 20px;
            flex-shrink: 0;
            transition: transform 0.3s ease;
            color: var(--dcm-text-secondary);
        }}

        .faq-item.open .faq-chevron {{
            transform: rotate(180deg);
        }}

        .faq-answer {{
            max-height: 0;
            overflow: hidden;
            transition: max-height 0.3s ease;
        }}

        .faq-answer p {{
            padding: 0 1.5rem 1.25rem;
            color: var(--dcm-text-secondary);
            line-height: 1.7;
            font-size: 0.95rem;
            margin: 0;
        }}

        .faq-item.open .faq-answer {{
            max-height: 500px;
        }}

        /* Cross-links */
        .dcm-crosslinks {{
            background: var(--dcm-card-bg);
            border: 1px solid var(--dcm-border);
            border-radius: 16px;
            padding: 2rem;
            margin-top: 2rem;
        }}

        .dcm-crosslinks h3 {{
            font-size: 1.2rem;
            font-weight: 700;
            color: var(--dcm-text);
            margin-bottom: 1rem;
        }}

        .dcm-crosslinks-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 0.75rem;
        }}

        .dcm-crosslink {{
            display: block;
            padding: 0.75rem 1rem;
            background: var(--dcm-bg);
            border: 1px solid var(--dcm-border);
            border-radius: 8px;
            color: var(--dcm-primary);
            text-decoration: none;
            font-size: 0.9rem;
            font-weight: 500;
            transition: background 0.2s, border-color 0.2s;
        }}

        .dcm-crosslink:hover {{
            background: rgba(37, 99, 235, 0.08);
            border-color: var(--dcm-primary);
        }}

        /* Disclaimer */
        .dcm-disclaimer {{
            max-width: 900px;
            margin: 2rem auto 0;
            padding: 1rem 1.5rem;
            text-align: center;
        }}

        .dcm-disclaimer p {{
            font-size: 0.72rem;
            color: #64748b;
            font-style: italic;
            line-height: 1.6;
            margin: 0;
        }}

        .dcm-disclaimer a {{ color: #8b5cf6; }}

        /* Responsive */
        @media (max-width: 768px) {{
            .dcm-hero {{ padding: 6rem 1.5rem 3rem; }}
            .dcm-hero-stats {{ gap: 1rem; }}
            .dcm-hero-stat {{ min-width: 120px; padding: 0.75rem 1rem; }}
            .dcm-content {{ padding: 1.5rem; }}
            .dcm-stats-grid {{ grid-template-columns: repeat(2, 1fr); }}
            .dcm-operators-grid {{ grid-template-columns: repeat(2, 1fr); }}
        }}

        @media (max-width: 480px) {{
            .dcm-stats-grid {{ grid-template-columns: 1fr; }}
            .dcm-operators-grid {{ grid-template-columns: 1fr; }}
            .dcm-crosslinks-grid {{ grid-template-columns: 1fr; }}
        }}
    </style>
</head>
<body>
    <a href="#main-content" class="skip-link">Skip to main content</a>
    <!-- Navigation -->
    <nav class="navbar">
        <div class="nav-container">
            <a href="../index.html" class="nav-logo">
                <img src="../assets/profile-photo.jpg" alt="Bagus Dwi Permana" class="nav-avatar" fetchpriority="high">
            </a>
            <ul class="nav-menu">
                <li><a href="../index.html" class="nav-link">Home</a></li>
                <li class="nav-dropdown">
                    <a href="../datacenter-solutions.html" class="nav-link">
                        DC Solutions
                        <svg class="dropdown-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                    </a>
                    <ul class="dropdown-menu">
                        <li><a href="../datacenter-solutions.html" style="color: #06b6d4; font-weight: 600;">DC Solutions Hub</a></li>
                        <li style="border-bottom: 1px solid rgba(255,255,255,0.1); margin: 4px 0;"></li>
                        <li><a href="../datahallAI.html" style="color: #8b5cf6;"><i class="fas fa-lock" style="font-size:.7em;margin-right:5px;opacity:.6"></i>DC AI/HPC</a></li>
                        <li><a href="../dc-conventional.html"><i class="fas fa-lock" style="font-size:.7em;margin-right:5px;opacity:.6"></i>DC Conventional</a></li>
                        <li style="border-bottom: 1px solid rgba(255,255,255,0.1); margin: 4px 0;"></li>
                        <li><a href="../capex-calculator.html" style="color: #f59e0b;">CAPEX Calculator</a></li>
                        <li><a href="../opex-calculator.html" style="color: #10b981;">OPEX Calculator</a></li>
                        <li style="border-bottom: 1px solid rgba(255,255,255,0.1); margin: 4px 0;"></li>
                        <li><a href="../dcmoc/" style="color: #ef4444; font-weight: 600;">DC MOC</a></li>
                    </ul>
                </li>
                <li class="nav-dropdown">
                    <a href="../insights.html" class="nav-link">
                        Insights
                        <svg class="dropdown-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                    </a>
                    <ul class="dropdown-menu">
                        <li><a href="../articles.html" style="color: #06b6d4; font-weight: 600;">Engineering Journal</a></li>
                        <li><a href="../geopolitics.html" style="color: #ef4444;">Global Analysis</a></li>
                        <li><a href="../future-forward.html" style="color: #a855f7;">Future Forward</a></li>
                        <li style="border-bottom: 1px solid rgba(255,255,255,0.1); margin: 4px 0;"></li>
                        <li><a href="../insights.html" style="color: #64748b; font-size: 0.85rem;">All Insights</a></li>
                    </ul>
                </li>
                <li><a href="../index.html#contact" class="nav-link">Contact</a></li>
            </ul>
            <button class="theme-toggle" id="themeToggle" aria-label="Toggle dark mode">
                <svg class="moon-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                </svg>
                <svg class="sun-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
        <!-- Hero -->
        <section class="dcm-hero">
            <span class="flag">{flag}</span>
            <h1>{city_name} Data Center Market</h1>
            <p class="subtitle">{country} &mdash; {region} | {climate}</p>
            <div class="dcm-hero-stats">
                <div class="dcm-hero-stat">
                    <span class="stat-value">{capacity_label}</span>
                    <span class="stat-label">Total Capacity</span>
                </div>
                <div class="dcm-hero-stat">
                    <span class="stat-value">{avg_pue}</span>
                    <span class="stat-label">Avg PUE</span>
                </div>
                <div class="dcm-hero-stat">
                    <span class="stat-value">{growth}%</span>
                    <span class="stat-label">YoY Growth</span>
                </div>
            </div>
        </section>

        <!-- Breadcrumb -->
        <div class="dcm-breadcrumb">
            <nav aria-label="Breadcrumb">
                <a href="../index.html">Home</a>
                <span class="sep">/</span>
                <a href="index.html">DC Markets</a>
                <span class="sep">/</span>
                <span>{city_name}</span>
            </nav>
        </div>

        <div class="dcm-content">
            <!-- Market Overview -->
            <section class="dcm-section" id="overview">
                <h2 class="dcm-section-title">Market Overview</h2>
                <p>{city_name} is a key data center market in {region} with a total capacity of {capacity_label} and a year-over-year growth rate of {growth}%. Operating in a {climate.lower()} climate, facilities in this market achieve an average PUE of {avg_pue}. The market is driven by strong demand from enterprise, cloud, and hyperscale operators, supported by a well-defined standards framework and expanding digital infrastructure.</p>
            </section>

            <!-- Key Statistics -->
            <section class="dcm-section" id="statistics">
                <h2 class="dcm-section-title">Key Statistics</h2>
                <div class="dcm-stats-grid">
                    <div class="dcm-stat-card">
                        <div class="stat-icon">&#9889;</div>
                        <span class="stat-value">{capacity_label}</span>
                        <span class="stat-label">Total Capacity</span>
                    </div>
                    <div class="dcm-stat-card">
                        <div class="stat-icon">&#127919;</div>
                        <span class="stat-value">{avg_pue}</span>
                        <span class="stat-label">Avg PUE</span>
                        <span class="pue-badge {pue_class}">{pue_label}</span>
                    </div>
                    <div class="dcm-stat-card">
                        <div class="stat-icon">&#128176;</div>
                        <span class="stat-value">${power_cost:.2f}</span>
                        <span class="stat-label">Power Cost ($/kWh)</span>
                    </div>
                    <div class="dcm-stat-card">
                        <div class="stat-icon">&#127807;</div>
                        <span class="stat-value">{renewable}%</span>
                        <span class="stat-label">Renewable Energy</span>
                    </div>
                </div>
            </section>

            <!-- Standards & Compliance -->
            <section class="dcm-section" id="standards">
                <h2 class="dcm-section-title">Standards &amp; Compliance</h2>
                <p>Data centers in {city_name} typically follow these standards and compliance frameworks:</p>
                <div class="dcm-standards-list">
{standards_html}                </div>
            </section>

            <!-- Cooling Strategy -->
            <section class="dcm-section" id="cooling">
                <h2 class="dcm-section-title">Cooling Strategy</h2>
                <div class="dcm-cooling-box">
                    <span class="climate-badge">{climate}</span>
                    <p style="color: var(--dcm-text); line-height: 1.8;">{cooling}</p>
                </div>
            </section>

            <!-- Key Challenges -->
            <section class="dcm-section" id="challenges">
                <h2 class="dcm-section-title">Key Challenges</h2>
                <ul class="dcm-challenges-list">
{challenges_html}                </ul>
            </section>

            <!-- Major Operators -->
            <section class="dcm-section" id="operators">
                <h2 class="dcm-section-title">Major Operators</h2>
                <div class="dcm-operators-grid">
{operators_html}                </div>
            </section>

            <!-- FAQ -->
            <section class="dcm-section" id="faq">
                <h2 class="dcm-section-title">Frequently Asked Questions</h2>
                <div class="dcm-faq">
{faq_html}                </div>
            </section>

            <!-- Cross-links -->
            <div class="dcm-crosslinks">
                <h3>Explore More DC Resources</h3>
                <div class="dcm-crosslinks-grid">
                    <a href="index.html" class="dcm-crosslink">All DC Markets</a>
                    <a href="../pue-calculator.html" class="dcm-crosslink">PUE Calculator</a>
                    <a href="../capex-calculator.html" class="dcm-crosslink">CAPEX Calculator</a>
                    <a href="../opex-calculator.html" class="dcm-crosslink">OPEX Calculator</a>
                    <a href="../carbon-footprint.html" class="dcm-crosslink">Carbon Footprint</a>
                    <a href="../roi-calculator.html" class="dcm-crosslink">ROI Calculator</a>
                    <a href="../tier-advisor.html" class="dcm-crosslink">Tier Advisor</a>
                    <a href="../pillar-cooling.html" class="dcm-crosslink">Cooling Guide</a>
                    <a href="../pillar-power.html" class="dcm-crosslink">Power Systems Guide</a>
                    <a href="../pillar-standards.html" class="dcm-crosslink">Standards Guide</a>
                    <a href="../compare-air-vs-liquid-cooling.html" class="dcm-crosslink">Air vs Liquid Cooling</a>
                    <a href="../glossary.html" class="dcm-crosslink">DC Glossary (300+ Terms)</a>
                </div>
            </div>
        </div>
    </main>

    <!-- Disclaimer -->
    <div class="dcm-disclaimer">
        <p>All content on ResistanceZero is independent personal research derived from publicly available sources. This site does not represent any current or former employer. <a href="../terms.html">Terms &amp; Disclaimer</a></p>
    </div>

    <!-- Footer -->
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
                        <li><a href="../index.html">Home Dashboard</a></li>
                        <li><a href="../articles.html">Technical Journal</a></li>
                        <li><a href="../index.html#case-studies">Case Studies</a></li>
                        <li><a href="../datacenter-solutions.html">DC Solutions</a></li>
                    </ul>
                </div>
                <div class="footer-connect">
                    <h4 class="footer-heading">CONNECT</h4>
                    <ul class="footer-links">
                        <li><a href="https://www.linkedin.com/in/bagus-dwi-permana-ba90b092" target="_blank" rel="noopener">LinkedIn Profile</a></li>
                        <li><a href="../articles.html">Technical Journal</a></li>
                        <li><a href="mailto:baguspermana7@gmail.com">Direct Contact</a></li>
                        <li><a href="https://github.com/baguspermana7-cpu" target="_blank" rel="noopener">GitHub</a></li>
                    </ul>
                </div>
            </div>
        </div>
    </footer>

    <script src="../script.min.js?v=20260225"></script>
    <script src="../auth.js?v=20260228"></script>

    <!-- Cookie Consent Banner -->
    <div class="cookie-banner hidden" id="cookieBanner">
        <p>We use cookies for analytics to improve your experience. <a href="../privacy.html">Learn more</a></p>
        <div class="cookie-actions">
            <button class="cookie-accept" id="cookieAccept">Accept</button>
            <button class="cookie-decline" id="cookieDecline">Decline</button>
        </div>
    </div>

    <!-- Scroll to Top -->
    <button class="scroll-top-btn" id="scrollTopBtn" aria-label="Scroll to top">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
    </button>

    <script>
    (function(){{
        // Cookie Banner
        var cb = document.getElementById('cookieBanner');
        var consent = localStorage.getItem('rz_cookie_consent');
        if (!consent && cb) {{
            cb.classList.remove('hidden');
        }}
        var acceptBtn = document.getElementById('cookieAccept');
        var declineBtn = document.getElementById('cookieDecline');
        if (acceptBtn) acceptBtn.addEventListener('click', function() {{
            localStorage.setItem('rz_cookie_consent', 'accepted');
            if (cb) cb.classList.add('hidden');
        }});
        if (declineBtn) declineBtn.addEventListener('click', function() {{
            localStorage.setItem('rz_cookie_consent', 'declined');
            if (cb) cb.classList.add('hidden');
        }});

        // FAQ Accordion
        document.querySelectorAll('.faq-question').forEach(function(btn) {{
            btn.addEventListener('click', function() {{
                var item = this.closest('.faq-item');
                var isOpen = item.classList.contains('open');
                document.querySelectorAll('.faq-item').forEach(function(el) {{
                    el.classList.remove('open');
                }});
                if (!isOpen) {{
                    item.classList.add('open');
                }}
                this.setAttribute('aria-expanded', !isOpen);
            }});
        }});

        // Scroll to top
        var scrollBtn = document.getElementById('scrollTopBtn');
        if (scrollBtn) {{
            window.addEventListener('scroll', function() {{
                scrollBtn.style.display = window.scrollY > 400 ? 'flex' : 'none';
            }});
            scrollBtn.addEventListener('click', function() {{
                window.scrollTo({{ top: 0, behavior: 'smooth' }});
            }});
        }}
    }})();
    </script>
</body>
</html>"""

    return html


def generate_hub_page(cities):
    title = "Data Center Markets Worldwide | City-by-City Infrastructure Guide"
    description = "Explore data center markets across 10 major cities worldwide. Compare capacity, PUE, power costs, standards, and growth rates for Singapore, Tokyo, London, Northern Virginia, and more."
    canonical = f"{BASE_URL}/dc-market/"

    city_cards_html = ""
    for city in cities:
        city_cards_html += f"""                <a href="{city['slug']}.html" class="hub-city-card" data-region="{city['region']}" data-city="{city['city'].lower()}">
                    <div class="hub-card-flag">{city['flag']}</div>
                    <h3 class="hub-card-city">{city['city']}</h3>
                    <p class="hub-card-country">{city['country']}</p>
                    <div class="hub-card-stats">
                        <span class="hub-card-stat"><strong>{city['capacity_label']}</strong> Capacity</span>
                        <span class="hub-card-stat"><strong>PUE {city['avg_pue']}</strong> Average</span>
                        <span class="hub-card-stat"><strong>{city['growth_rate']}%</strong> YoY Growth</span>
                    </div>
                    <div class="hub-card-region-tag">{city['region']}</div>
                </a>\n"""

    # Region filter buttons
    regions = sorted(set(c["region"] for c in cities))
    region_btns = '                    <button class="hub-filter-btn active" data-filter="all">All Regions</button>\n'
    for r in regions:
        region_btns += f'                    <button class="hub-filter-btn" data-filter="{r}">{r}</button>\n'

    # Aggregate stats
    total_capacity = sum(c["capacity_mw"] for c in cities)
    avg_pue = sum(c["avg_pue"] for c in cities) / len(cities)
    avg_growth = sum(c["growth_rate"] for c in cities) / len(cities)

    # World map dots (CSS-based positions approximating real-world locations)
    map_dots = ""
    city_positions = {
        "singapore": (72, 58),
        "jakarta": (73, 62),
        "kuala-lumpur": (71, 55),
        "sydney": (85, 78),
        "tokyo": (84, 36),
        "mumbai": (62, 48),
        "dubai": (55, 42),
        "london": (42, 26),
        "frankfurt": (44, 28),
        "northern-virginia": (22, 34),
    }
    for city in cities:
        pos = city_positions.get(city["slug"], (50, 50))
        map_dots += f'                    <div class="map-dot" style="left:{pos[0]}%;top:{pos[1]}%" title="{city["city"]}, {city["country"]}"><span class="map-label">{city["city"]}</span></div>\n'

    html = f"""<!DOCTYPE html>
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

    <!-- SEO Meta Tags -->
    <title>{escape_html(title)}</title>
    <meta name="description" content="{escape_html(description)}">
    <meta name="keywords" content="data center markets, global data center, colocation, data center capacity, PUE, data center growth, Singapore data center, Tokyo data center, London data center, Northern Virginia data center">
    <meta name="author" content="Bagus Dwi Permana">
    <meta name="robots" content="index, follow">
    <meta name="theme-color" content="#2563eb">
    <link rel="canonical" href="{canonical}">

    <link rel="alternate" hreflang="en" href="{canonical}">
    <link rel="alternate" hreflang="x-default" href="{canonical}">

    <!-- Resource Hints -->
    <link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
    <link rel="preconnect" href="https://www.googletagmanager.com" crossorigin>
    <link rel="dns-prefetch" href="https://cdn.jsdelivr.net">
    <link rel="dns-prefetch" href="https://www.googletagmanager.com">

    <!-- Open Graph Meta Tags -->
    <meta property="og:type" content="website">
    <meta property="og:url" content="{canonical}">
    <meta property="og:title" content="{escape_html(title)}">
    <meta property="og:description" content="{escape_html(description)}">
    <meta property="og:image" content="{BASE_URL}/assets/profile-photo.jpg">
    <meta property="og:image:alt" content="Global Data Center Markets Guide">
    <meta property="og:locale" content="en_US">
    <meta property="og:site_name" content="Bagus Dwi Permana Portfolio">

    <!-- Twitter Card Meta Tags -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:site" content="@BagusDPermana">
    <meta name="twitter:title" content="{escape_html(title)}">
    <meta name="twitter:description" content="{escape_html(description)}">
    <meta name="twitter:image" content="{BASE_URL}/assets/profile-photo.jpg">
    <meta name="twitter:image:alt" content="Global Data Center Markets Guide">

    <!-- Structured Data - BreadcrumbList -->
    <script type="application/ld+json">
    {{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {{
                "@type": "ListItem",
                "position": 1,
                "name": "Home",
                "item": "{BASE_URL}/"
            }},
            {{
                "@type": "ListItem",
                "position": 2,
                "name": "DC Markets"
            }}
        ]
    }}
    </script>

    <link rel="icon" type="image/png" href="../assets/Favicon.png">
    <link rel="apple-touch-icon" href="../assets/Favicon.png">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="../styles.min.css?v=20260225">

    <style>
        :root {{
            --dcm-primary: #2563eb;
            --dcm-primary-light: #3b82f6;
            --dcm-primary-dark: #1d4ed8;
            --dcm-bg: #f8fafc;
            --dcm-card-bg: #ffffff;
            --dcm-text: #1e293b;
            --dcm-text-secondary: #64748b;
            --dcm-border: #e2e8f0;
        }}

        [data-theme="dark"] {{
            --dcm-bg: #0f172a;
            --dcm-card-bg: #1e293b;
            --dcm-text: #f1f5f9;
            --dcm-text-secondary: #94a3b8;
            --dcm-border: #334155;
        }}

        /* Hub Hero */
        .hub-hero {{
            background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 40%, #1d4ed8 100%);
            padding: 8rem 2rem 4rem;
            color: #fff;
            text-align: center;
            position: relative;
            overflow: hidden;
        }}

        .hub-hero::before {{
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0; bottom: 0;
            background:
                radial-gradient(circle at 30% 70%, rgba(37, 99, 235, 0.3) 0%, transparent 50%),
                radial-gradient(circle at 70% 30%, rgba(16, 185, 129, 0.15) 0%, transparent 50%);
            z-index: 0;
        }}

        .hub-hero > * {{ position: relative; z-index: 1; }}

        .hub-hero h1 {{
            font-size: clamp(2.2rem, 5vw, 3.2rem);
            margin-bottom: 0.75rem;
            font-weight: 800;
        }}

        .hub-hero p {{
            font-size: 1.15rem;
            color: rgba(255, 255, 255, 0.85);
            max-width: 700px;
            margin: 0 auto 2rem;
        }}

        .hub-hero-stats {{
            display: flex;
            justify-content: center;
            gap: 2rem;
            flex-wrap: wrap;
        }}

        .hub-hero-stat {{
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            border-radius: 12px;
            padding: 1rem 1.5rem;
            min-width: 160px;
            border: 1px solid rgba(255, 255, 255, 0.15);
        }}

        .hub-hero-stat .stat-value {{
            font-size: 1.6rem;
            font-weight: 700;
            display: block;
        }}

        .hub-hero-stat .stat-label {{
            font-size: 0.75rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: rgba(255, 255, 255, 0.7);
            margin-top: 0.25rem;
        }}

        /* Breadcrumb */
        .hub-breadcrumb {{
            padding: 1rem 2rem;
            background: var(--dcm-bg);
            border-bottom: 1px solid var(--dcm-border);
        }}

        .hub-breadcrumb nav {{
            max-width: 1200px;
            margin: 0 auto;
            font-size: 0.85rem;
            color: var(--dcm-text-secondary);
        }}

        .hub-breadcrumb a {{
            color: var(--dcm-primary);
            text-decoration: none;
        }}

        .hub-breadcrumb a:hover {{ text-decoration: underline; }}
        .hub-breadcrumb .sep {{ margin: 0 0.5rem; }}

        /* World Map */
        .hub-map-section {{
            padding: 3rem 2rem;
            background: var(--dcm-bg);
        }}

        .hub-map-container {{
            max-width: 1200px;
            margin: 0 auto;
        }}

        .hub-map-title {{
            text-align: center;
            font-size: 1.5rem;
            font-weight: 700;
            color: var(--dcm-text);
            margin-bottom: 2rem;
        }}

        .hub-world-map {{
            position: relative;
            width: 100%;
            padding-bottom: 50%;
            background: var(--dcm-card-bg);
            border: 1px solid var(--dcm-border);
            border-radius: 16px;
            overflow: hidden;
            background-image:
                radial-gradient(circle at 45% 35%, rgba(37, 99, 235, 0.08) 0%, transparent 30%),
                radial-gradient(circle at 75% 55%, rgba(37, 99, 235, 0.06) 0%, transparent 25%),
                radial-gradient(circle at 20% 40%, rgba(37, 99, 235, 0.06) 0%, transparent 20%);
        }}

        /* Continent outlines (CSS shapes) */
        .hub-world-map::before {{
            content: '';
            position: absolute;
            inset: 0;
            background:
                /* North America */
                radial-gradient(ellipse 18% 22% at 20% 35%, rgba(37, 99, 235, 0.06) 0%, transparent 100%),
                /* South America */
                radial-gradient(ellipse 8% 20% at 26% 65%, rgba(37, 99, 235, 0.05) 0%, transparent 100%),
                /* Europe */
                radial-gradient(ellipse 10% 12% at 45% 28%, rgba(37, 99, 235, 0.06) 0%, transparent 100%),
                /* Africa */
                radial-gradient(ellipse 10% 18% at 47% 55%, rgba(37, 99, 235, 0.05) 0%, transparent 100%),
                /* Asia */
                radial-gradient(ellipse 22% 20% at 70% 38%, rgba(37, 99, 235, 0.06) 0%, transparent 100%),
                /* Australia */
                radial-gradient(ellipse 10% 10% at 82% 72%, rgba(37, 99, 235, 0.05) 0%, transparent 100%);
        }}

        .map-dot {{
            position: absolute;
            width: 12px;
            height: 12px;
            background: var(--dcm-primary);
            border-radius: 50%;
            transform: translate(-50%, -50%);
            cursor: pointer;
            z-index: 2;
            box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.25);
            animation: pulse-dot 2s infinite;
        }}

        @keyframes pulse-dot {{
            0%, 100% {{ box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.25); }}
            50% {{ box-shadow: 0 0 0 8px rgba(37, 99, 235, 0.1); }}
        }}

        .map-label {{
            position: absolute;
            bottom: 18px;
            left: 50%;
            transform: translateX(-50%);
            background: var(--dcm-card-bg);
            border: 1px solid var(--dcm-border);
            color: var(--dcm-text);
            padding: 0.2rem 0.5rem;
            border-radius: 4px;
            font-size: 0.7rem;
            font-weight: 600;
            white-space: nowrap;
            opacity: 0;
            transition: opacity 0.2s;
            pointer-events: none;
        }}

        .map-dot:hover .map-label {{
            opacity: 1;
        }}

        /* Filter & Search */
        .hub-controls {{
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem 2rem 0;
            display: flex;
            flex-wrap: wrap;
            gap: 1rem;
            align-items: center;
            justify-content: space-between;
        }}

        .hub-filter-group {{
            display: flex;
            gap: 0.5rem;
            flex-wrap: wrap;
        }}

        .hub-filter-btn {{
            padding: 0.5rem 1rem;
            border: 1px solid var(--dcm-border);
            border-radius: 8px;
            background: var(--dcm-card-bg);
            color: var(--dcm-text-secondary);
            font-size: 0.85rem;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
            font-family: 'Inter', sans-serif;
        }}

        .hub-filter-btn:hover {{
            border-color: var(--dcm-primary);
            color: var(--dcm-primary);
        }}

        .hub-filter-btn.active {{
            background: var(--dcm-primary);
            color: #fff;
            border-color: var(--dcm-primary);
        }}

        .hub-search {{
            position: relative;
        }}

        .hub-search input {{
            padding: 0.5rem 1rem 0.5rem 2.25rem;
            border: 1px solid var(--dcm-border);
            border-radius: 8px;
            background: var(--dcm-card-bg);
            color: var(--dcm-text);
            font-size: 0.9rem;
            width: 220px;
            font-family: 'Inter', sans-serif;
        }}

        .hub-search input:focus {{
            outline: none;
            border-color: var(--dcm-primary);
            box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
        }}

        .hub-search svg {{
            position: absolute;
            left: 0.65rem;
            top: 50%;
            transform: translateY(-50%);
            color: var(--dcm-text-secondary);
            width: 16px;
            height: 16px;
        }}

        /* City Cards Grid */
        .hub-grid-section {{
            max-width: 1200px;
            margin: 0 auto;
            padding: 1.5rem 2rem 4rem;
        }}

        .hub-city-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
            gap: 1.5rem;
            margin-top: 1.5rem;
        }}

        .hub-city-card {{
            display: block;
            background: var(--dcm-card-bg);
            border: 1px solid var(--dcm-border);
            border-radius: 16px;
            padding: 1.75rem;
            text-decoration: none;
            transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
        }}

        .hub-city-card:hover {{
            transform: translateY(-6px);
            box-shadow: 0 12px 32px rgba(0, 0, 0, 0.1);
            border-color: var(--dcm-primary);
        }}

        .hub-card-flag {{
            font-size: 2.5rem;
            margin-bottom: 0.75rem;
        }}

        .hub-card-city {{
            font-size: 1.3rem;
            font-weight: 700;
            color: var(--dcm-text);
            margin: 0 0 0.25rem;
        }}

        .hub-card-country {{
            font-size: 0.9rem;
            color: var(--dcm-text-secondary);
            margin: 0 0 1rem;
        }}

        .hub-card-stats {{
            display: flex;
            flex-direction: column;
            gap: 0.4rem;
            margin-bottom: 1rem;
        }}

        .hub-card-stat {{
            font-size: 0.85rem;
            color: var(--dcm-text-secondary);
        }}

        .hub-card-stat strong {{
            color: var(--dcm-primary);
            font-weight: 700;
        }}

        .hub-card-region-tag {{
            display: inline-block;
            background: rgba(37, 99, 235, 0.1);
            color: var(--dcm-primary);
            padding: 0.25rem 0.6rem;
            border-radius: 6px;
            font-size: 0.75rem;
            font-weight: 600;
        }}

        [data-theme="dark"] .hub-card-region-tag {{
            background: rgba(37, 99, 235, 0.2);
        }}

        .hub-no-results {{
            grid-column: 1 / -1;
            text-align: center;
            padding: 3rem;
            color: var(--dcm-text-secondary);
            font-size: 1.1rem;
            display: none;
        }}

        /* Disclaimer */
        .hub-disclaimer {{
            max-width: 900px;
            margin: 0 auto;
            padding: 1rem 1.5rem;
            text-align: center;
        }}

        .hub-disclaimer p {{
            font-size: 0.72rem;
            color: #64748b;
            font-style: italic;
            line-height: 1.6;
            margin: 0;
        }}

        .hub-disclaimer a {{ color: #8b5cf6; }}

        @media (max-width: 768px) {{
            .hub-hero {{ padding: 6rem 1.5rem 3rem; }}
            .hub-controls {{ flex-direction: column; align-items: stretch; }}
            .hub-search input {{ width: 100%; }}
            .hub-city-grid {{ grid-template-columns: 1fr; }}
            .hub-world-map {{ display: none; }}
        }}
    </style>
</head>
<body>
    <a href="#main-content" class="skip-link">Skip to main content</a>
    <!-- Navigation -->
    <nav class="navbar">
        <div class="nav-container">
            <a href="../index.html" class="nav-logo">
                <img src="../assets/profile-photo.jpg" alt="Bagus Dwi Permana" class="nav-avatar" fetchpriority="high">
            </a>
            <ul class="nav-menu">
                <li><a href="../index.html" class="nav-link">Home</a></li>
                <li class="nav-dropdown">
                    <a href="../datacenter-solutions.html" class="nav-link">
                        DC Solutions
                        <svg class="dropdown-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                    </a>
                    <ul class="dropdown-menu">
                        <li><a href="../datacenter-solutions.html" style="color: #06b6d4; font-weight: 600;">DC Solutions Hub</a></li>
                        <li style="border-bottom: 1px solid rgba(255,255,255,0.1); margin: 4px 0;"></li>
                        <li><a href="../datahallAI.html" style="color: #8b5cf6;"><i class="fas fa-lock" style="font-size:.7em;margin-right:5px;opacity:.6"></i>DC AI/HPC</a></li>
                        <li><a href="../dc-conventional.html"><i class="fas fa-lock" style="font-size:.7em;margin-right:5px;opacity:.6"></i>DC Conventional</a></li>
                        <li style="border-bottom: 1px solid rgba(255,255,255,0.1); margin: 4px 0;"></li>
                        <li><a href="../capex-calculator.html" style="color: #f59e0b;">CAPEX Calculator</a></li>
                        <li><a href="../opex-calculator.html" style="color: #10b981;">OPEX Calculator</a></li>
                        <li style="border-bottom: 1px solid rgba(255,255,255,0.1); margin: 4px 0;"></li>
                        <li><a href="../dcmoc/" style="color: #ef4444; font-weight: 600;">DC MOC</a></li>
                    </ul>
                </li>
                <li class="nav-dropdown">
                    <a href="../insights.html" class="nav-link">
                        Insights
                        <svg class="dropdown-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                    </a>
                    <ul class="dropdown-menu">
                        <li><a href="../articles.html" style="color: #06b6d4; font-weight: 600;">Engineering Journal</a></li>
                        <li><a href="../geopolitics.html" style="color: #ef4444;">Global Analysis</a></li>
                        <li><a href="../future-forward.html" style="color: #a855f7;">Future Forward</a></li>
                        <li style="border-bottom: 1px solid rgba(255,255,255,0.1); margin: 4px 0;"></li>
                        <li><a href="../insights.html" style="color: #64748b; font-size: 0.85rem;">All Insights</a></li>
                    </ul>
                </li>
                <li><a href="../index.html#contact" class="nav-link">Contact</a></li>
            </ul>
            <button class="theme-toggle" id="themeToggle" aria-label="Toggle dark mode">
                <svg class="moon-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                </svg>
                <svg class="sun-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
        <!-- Hero -->
        <section class="hub-hero">
            <h1>Global Data Center Markets</h1>
            <p>Explore infrastructure, standards, costs, and growth trends across the world's most important data center markets.</p>
            <div class="hub-hero-stats">
                <div class="hub-hero-stat">
                    <span class="stat-value">{len(cities)}</span>
                    <span class="stat-label">Key Markets</span>
                </div>
                <div class="hub-hero-stat">
                    <span class="stat-value">{total_capacity / 1000:.1f} GW</span>
                    <span class="stat-label">Combined Capacity</span>
                </div>
                <div class="hub-hero-stat">
                    <span class="stat-value">{avg_pue:.2f}</span>
                    <span class="stat-label">Avg PUE (Global)</span>
                </div>
                <div class="hub-hero-stat">
                    <span class="stat-value">{avg_growth:.0f}%</span>
                    <span class="stat-label">Avg Growth Rate</span>
                </div>
            </div>
        </section>

        <!-- Breadcrumb -->
        <div class="hub-breadcrumb">
            <nav aria-label="Breadcrumb">
                <a href="../index.html">Home</a>
                <span class="sep">/</span>
                <span>DC Markets</span>
            </nav>
        </div>

        <!-- World Map -->
        <section class="hub-map-section">
            <div class="hub-map-container">
                <h2 class="hub-map-title">Markets at a Glance</h2>
                <div class="hub-world-map">
{map_dots}                </div>
            </div>
        </section>

        <!-- Filter & Search -->
        <div class="hub-controls">
            <div class="hub-filter-group">
{region_btns}            </div>
            <div class="hub-search">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input type="text" id="hubSearchInput" placeholder="Search markets..." aria-label="Search data center markets">
            </div>
        </div>

        <!-- City Cards -->
        <section class="hub-grid-section">
            <div class="hub-city-grid" id="hubCityGrid">
{city_cards_html}                <div class="hub-no-results" id="hubNoResults">No markets found matching your search.</div>
            </div>
        </section>
    </main>

    <!-- Disclaimer -->
    <div class="hub-disclaimer">
        <p>All content on ResistanceZero is independent personal research derived from publicly available sources. This site does not represent any current or former employer. <a href="../terms.html">Terms &amp; Disclaimer</a></p>
    </div>

    <!-- Footer -->
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
                        <li><a href="../index.html">Home Dashboard</a></li>
                        <li><a href="../articles.html">Technical Journal</a></li>
                        <li><a href="../index.html#case-studies">Case Studies</a></li>
                        <li><a href="../datacenter-solutions.html">DC Solutions</a></li>
                    </ul>
                </div>
                <div class="footer-connect">
                    <h4 class="footer-heading">CONNECT</h4>
                    <ul class="footer-links">
                        <li><a href="https://www.linkedin.com/in/bagus-dwi-permana-ba90b092" target="_blank" rel="noopener">LinkedIn Profile</a></li>
                        <li><a href="../articles.html">Technical Journal</a></li>
                        <li><a href="mailto:baguspermana7@gmail.com">Direct Contact</a></li>
                        <li><a href="https://github.com/baguspermana7-cpu" target="_blank" rel="noopener">GitHub</a></li>
                    </ul>
                </div>
            </div>
        </div>
    </footer>

    <script src="../script.min.js?v=20260225"></script>
    <script src="../auth.js?v=20260228"></script>

    <!-- Cookie Consent Banner -->
    <div class="cookie-banner hidden" id="cookieBanner">
        <p>We use cookies for analytics to improve your experience. <a href="../privacy.html">Learn more</a></p>
        <div class="cookie-actions">
            <button class="cookie-accept" id="cookieAccept">Accept</button>
            <button class="cookie-decline" id="cookieDecline">Decline</button>
        </div>
    </div>

    <!-- Scroll to Top -->
    <button class="scroll-top-btn" id="scrollTopBtn" aria-label="Scroll to top">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
    </button>

    <script>
    (function(){{
        // Cookie Banner
        var cb = document.getElementById('cookieBanner');
        var consent = localStorage.getItem('rz_cookie_consent');
        if (!consent && cb) {{
            cb.classList.remove('hidden');
        }}
        var acceptBtn = document.getElementById('cookieAccept');
        var declineBtn = document.getElementById('cookieDecline');
        if (acceptBtn) acceptBtn.addEventListener('click', function() {{
            localStorage.setItem('rz_cookie_consent', 'accepted');
            if (cb) cb.classList.add('hidden');
        }});
        if (declineBtn) declineBtn.addEventListener('click', function() {{
            localStorage.setItem('rz_cookie_consent', 'declined');
            if (cb) cb.classList.add('hidden');
        }});

        // Region Filter
        var filterBtns = document.querySelectorAll('.hub-filter-btn');
        var cards = document.querySelectorAll('.hub-city-card');
        var noResults = document.getElementById('hubNoResults');
        var searchInput = document.getElementById('hubSearchInput');

        function filterCards() {{
            var activeFilter = document.querySelector('.hub-filter-btn.active');
            var region = activeFilter ? activeFilter.getAttribute('data-filter') : 'all';
            var search = searchInput ? searchInput.value.toLowerCase().trim() : '';
            var visibleCount = 0;

            cards.forEach(function(card) {{
                var cardRegion = card.getAttribute('data-region');
                var cardCity = card.getAttribute('data-city');
                var matchesRegion = (region === 'all' || cardRegion === region);
                var matchesSearch = (!search || cardCity.indexOf(search) !== -1 || cardRegion.toLowerCase().indexOf(search) !== -1);

                if (matchesRegion && matchesSearch) {{
                    card.style.display = '';
                    visibleCount++;
                }} else {{
                    card.style.display = 'none';
                }}
            }});

            if (noResults) {{
                noResults.style.display = visibleCount === 0 ? 'block' : 'none';
            }}
        }}

        filterBtns.forEach(function(btn) {{
            btn.addEventListener('click', function() {{
                filterBtns.forEach(function(b) {{ b.classList.remove('active'); }});
                this.classList.add('active');
                filterCards();
            }});
        }});

        if (searchInput) {{
            searchInput.addEventListener('input', filterCards);
        }}

        // Scroll to top
        var scrollBtn = document.getElementById('scrollTopBtn');
        if (scrollBtn) {{
            window.addEventListener('scroll', function() {{
                scrollBtn.style.display = window.scrollY > 400 ? 'flex' : 'none';
            }});
            scrollBtn.addEventListener('click', function() {{
                window.scrollTo({{ top: 0, behavior: 'smooth' }});
            }});
        }}
    }})();
    </script>
</body>
</html>"""

    return html


def main():
    cities = load_city_data()
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # Generate individual city pages
    for city in cities:
        filename = f"{city['slug']}.html"
        filepath = os.path.join(OUTPUT_DIR, filename)
        html = generate_city_page(city)
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(html)
        print(f"  Generated: dc-market/{filename}")

    # Generate hub index page
    hub_html = generate_hub_page(cities)
    hub_path = os.path.join(OUTPUT_DIR, "index.html")
    with open(hub_path, "w", encoding="utf-8") as f:
        f.write(hub_html)
    print(f"  Generated: dc-market/index.html")

    print(f"\nDone! {len(cities)} city pages + 1 hub page generated in dc-market/")


if __name__ == "__main__":
    main()
