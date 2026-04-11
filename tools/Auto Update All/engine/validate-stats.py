#!/usr/bin/env python3
"""
validate-stats.py — Statistics freshness checker for ResistanceZero
Flags statistics and data points that may be >12 months old
Run from: /home/baguspermana7/rz-work
"""

import os
import re
from pathlib import Path
from datetime import datetime, timedelta

SITE_ROOT = '/home/baguspermana7/rz-work'
TODAY = datetime.now()
STALE_THRESHOLD_MONTHS = 12

SKIP_PATTERNS = ['node_modules', '.git', '.qa-screens', 'dcmoc', 'email-signature']

# Patterns that suggest dated statistics
STAT_PATTERNS = [
    # Year references in statistics context
    (r'(?:in|as of|by|since|through)\s+20(2[0-3])\b', 'Year reference (may be outdated)'),
    # Common DC industry stat patterns
    (r'(\d+\.?\d*)\s*%\s+of\s+(?:data centers|operators|enterprises)', 'Percentage statistic'),
    (r'(?:average|global|industry)\s+PUE\s+(?:of\s+)?(\d+\.?\d+)', 'PUE statistic'),
    (r'(?:Uptime Institute|IDC|Gartner|CBRE|JLL)\s+(?:report|survey|study|found|says|estimates)', 'Industry report citation'),
    (r'(?:by|in)\s+(2024|2025|2026)\s*,', 'Near-term prediction'),
    (r'\$[\d,]+(?:\.\d+)?\s*(?:billion|trillion|million)\s+(?:market|industry|investment)', 'Market size figure'),
    (r'(\d+)\s+(?:GW|MW)\s+(?:of\s+)?(?:capacity|power|demand)', 'Power capacity figure'),
]

# Specific statistics known to need annual updates
KNOWN_ANNUAL_STATS = [
    ('global average PUE', 'Uptime Institute Annual Report (April each year)'),
    ('engineer shortage', 'Uptime Institute Talent Gap Report'),
    ('data center outage', 'Uptime Outage Analysis'),
    ('energy consumption', 'IEA Data Centers Report'),
    ('carbon footprint', 'IEA/national grid data'),
    ('market size', 'IDC/CBRE/JLL quarterly report'),
    ('colocation pricing', 'CBRE DC market report'),
]

def should_skip(filepath):
    rel = os.path.relpath(filepath, SITE_ROOT)
    return any(p in rel for p in SKIP_PATTERNS)

def get_article_files():
    """Focus on article files where stats are most likely to appear"""
    files = []
    root = Path(SITE_ROOT)
    for f in root.glob('article-*.html'):
        files.append(str(f))
    for f in root.glob('FF-*.html'):
        files.append(str(f))
    for f in root.glob('geopolitics-*.html'):
        files.append(str(f))
    for f in root.glob('asean-*.html'):
        files.append(str(f))
    # Also check pillar pages
    for f in root.glob('pillar-*.html'):
        files.append(str(f))
    return sorted(files)

def extract_article_date(content):
    """Try to find the article publish date"""
    # Try <time datetime="...">
    match = re.search(r'<time[^>]*datetime=["\'](\d{4}-\d{2}-\d{2})["\']', content)
    if match:
        try:
            return datetime.strptime(match.group(1), '%Y-%m-%d')
        except ValueError:
            pass
    # Try meta date
    match = re.search(r'<meta[^>]*name=["\']date["\'][^>]*content=["\'](\d{4}-\d{2}-\d{2})["\']', content)
    if match:
        try:
            return datetime.strptime(match.group(1), '%Y-%m-%d')
        except ValueError:
            pass
    return None

def check_stale_year_references(content, filepath):
    """Find year references that are definitely stale"""
    issues = []
    rel = os.path.relpath(filepath, SITE_ROOT)

    # Find all year references like "in 2023" or "as of 2022"
    matches = re.finditer(r'\b(202[0-3])\b', content)
    years_found = set()
    for m in matches:
        year = int(m.group(1))
        if year < TODAY.year - 1:  # More than 1 year ago
            years_found.add(year)

    if years_found:
        for year in sorted(years_found):
            issues.append(('WARNING', rel, f'Contains references to {year} — statistics may be stale'))

    return issues

def check_known_stats(content, filepath):
    """Check for known statistics that need annual updates"""
    issues = []
    rel = os.path.relpath(filepath, SITE_ROOT)
    content_lower = content.lower()

    article_date = extract_article_date(content)
    if article_date:
        age_months = (TODAY - article_date).days / 30
        if age_months > STALE_THRESHOLD_MONTHS:
            issues.append(('WARNING', rel, f'Article is {int(age_months)} months old — all statistics may need refresh'))

    for stat_phrase, source in KNOWN_ANNUAL_STATS:
        if stat_phrase.lower() in content_lower:
            # Check if the nearby context has a recent year
            idx = content_lower.find(stat_phrase.lower())
            context = content[max(0, idx-100):idx+200]
            has_recent_year = bool(re.search(r'202[5-6]', context))
            if not has_recent_year:
                issues.append(('INFO', rel, f"Stat '{stat_phrase}' found — verify against: {source}"))

    return issues

def main():
    print("=== validate-stats.py ===\n")
    print(f"Today: {TODAY.strftime('%Y-%m-%d')}")
    print(f"Flagging statistics potentially older than {STALE_THRESHOLD_MONTHS} months\n")

    article_files = get_article_files()
    print(f"Scanning {len(article_files)} article/report files...\n")

    all_issues = {'CRITICAL': [], 'WARNING': [], 'INFO': []}

    for filepath in article_files:
        if should_skip(filepath):
            continue
        with open(filepath, 'r', errors='ignore') as f:
            content = f.read()

        issues = []
        issues.extend(check_stale_year_references(content, filepath))
        issues.extend(check_known_stats(content, filepath))

        for level, path, msg in issues:
            all_issues[level].append(f"{path}: {msg}")

    for level in ['CRITICAL', 'WARNING', 'INFO']:
        print(f"--- {level} ({len(all_issues[level])}) ---")
        for issue in all_issues[level][:20]:  # Cap at 20 per level
            print(f"  {level}: {issue}")
        if len(all_issues[level]) > 20:
            print(f"  ... and {len(all_issues[level]) - 20} more")
        if not all_issues[level]:
            print(f"  PASS")
        print()

    print("\nAnnual update schedule:")
    print("  April: Uptime Institute Annual Report (PUE, staffing, outages)")
    print("  Q1/Q2: IDC/CBRE market size reports")
    print("  Quarterly: Energy pricing, colocation costs")
    print("  As-needed: Regulatory changes, standards revisions")

if __name__ == '__main__':
    main()
