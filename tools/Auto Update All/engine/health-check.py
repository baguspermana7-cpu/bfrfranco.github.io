#!/usr/bin/env python3
"""
health-check.py — ResistanceZero Master Health Check Runner
Run from: /home/baguspermana7/rz-work
Usage: python3 tools/"Auto Update All"/engine/health-check.py
"""

import subprocess
import sys
import os
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENGINE_DIR = os.path.join(BASE_DIR, 'engine')
REPORT_DIR = BASE_DIR  # saves report in Auto Update All/

def run_check(script_name):
    script_path = os.path.join(ENGINE_DIR, script_name)
    print(f"\n{'='*60}")
    print(f"Running: {script_name}")
    print('='*60)
    result = subprocess.run(
        [sys.executable, script_path],
        capture_output=True, text=True
    )
    print(result.stdout)
    if result.stderr:
        print("ERRORS:", result.stderr)
    return result.stdout

def main():
    site_root = '/home/baguspermana7/rz-work'
    today = datetime.now().strftime('%Y-%m-%d')
    report_path = os.path.join(REPORT_DIR, f'HEALTH-REPORT-{today}.md')

    print(f"\nResistanceZero Health Check — {today}")
    print(f"Site root: {site_root}")
    print(f"Report: {report_path}")

    checks = [
        'validate-security.py',
        'validate-links.py',
        'validate-seo.py',
        'validate-consistency.py',
        'validate-stats.py',
    ]

    report_lines = [
        f"# Health Report — {today}\n",
        f"Site: resistancezero.com\n",
        f"Run: {datetime.now().strftime('%Y-%m-%d %H:%M')}\n\n",
        "---\n\n"
    ]

    all_output = []
    for check in checks:
        output = run_check(check)
        all_output.append(f"\n## {check}\n\n```\n{output}\n```\n")

    report_lines.extend(all_output)

    with open(report_path, 'w') as f:
        f.writelines(report_lines)

    print(f"\n\nHealth check complete. Report saved to:\n{report_path}")
    print("Review all CRITICAL items before pushing any changes.")

if __name__ == '__main__':
    main()
