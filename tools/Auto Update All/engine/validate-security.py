#!/usr/bin/env python3
"""
validate-security.py — Security scanner for ResistanceZero
Checks: XSS vectors, hardcoded API keys, unsafe patterns
Run from: /home/baguspermana7/rz-work
"""

import os
import re
from pathlib import Path

SITE_ROOT = '/home/baguspermana7/rz-work'

SKIP_PATTERNS = ['node_modules', '.git', '.qa-screens', 'standarization', 'Article']

# Patterns that indicate hardcoded secrets
SECRET_PATTERNS = [
    (r'AIzaSy[0-9A-Za-z_-]{33}', 'Google/Firebase API key'),
    (r'sk-[a-zA-Z0-9]{32,}', 'OpenAI API key'),
    (r'eyJhbGciOiJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+', 'JWT token'),
    (r'(?:password|passwd|pwd)\s*[=:]\s*["\'][^"\']{8,}["\']', 'Hardcoded password'),
    (r'(?:secret|api_key|apikey|access_token)\s*[=:]\s*["\'][^"\']{10,}["\']', 'Hardcoded secret'),
    (r'sb-[a-zA-Z0-9]{20,}', 'Supabase key fragment'),
]

# Known false positive patterns (these are OK to have in the codebase)
FALSE_POSITIVES = [
    'AIzaSyDS0dm8JbiW9SqTvmiATwoXVZKN5tx4FWI',  # NemoClaw key (in memory, not in site files)
    'example-api-key',
    'YOUR_API_KEY',
    'REPLACE_WITH',
]

# XSS risk patterns
XSS_PATTERNS = [
    (r'innerHTML\s*=\s*(?!`[^`]*\$\{)', 'innerHTML assignment (check if user input involved)'),
    (r'document\.write\s*\(', 'document.write() usage'),
    (r'eval\s*\([^)]+\)', 'eval() usage'),
    (r'\.html\s*\([^)]*(?:location|search|hash|param)[^)]*\)', 'jQuery .html() with URL params'),
    (r'setTimeout\s*\(["\'][^"\']+["\']', 'setTimeout with string (eval risk)'),
    (r'setInterval\s*\(["\'][^"\']+["\']', 'setInterval with string (eval risk)'),
]

# PostMessage safety
POSTMESSAGE_PATTERN = r'addEventListener\s*\(\s*["\']message["\']'

def should_skip(filepath):
    rel = os.path.relpath(filepath, SITE_ROOT)
    return any(p in rel for p in SKIP_PATTERNS)

def get_all_files():
    """Get all JS and HTML files"""
    files = []
    root = Path(SITE_ROOT)
    for pattern in ['*.html', '*.js']:
        for f in root.rglob(pattern):
            parts = str(f).split(os.sep)
            if any(p.startswith('.') or p == 'node_modules' for p in parts):
                continue
            if should_skip(str(f)):
                continue
            files.append(str(f))
    return sorted(files)

def is_false_positive(match_str):
    return any(fp in match_str for fp in FALSE_POSITIVES)

def check_file(filepath):
    rel = os.path.relpath(filepath, SITE_ROOT)
    issues = []

    with open(filepath, 'r', errors='ignore') as f:
        content = f.read()
        lines = content.split('\n')

    # Check for hardcoded secrets
    for pattern, label in SECRET_PATTERNS:
        for i, line in enumerate(lines, 1):
            matches = re.findall(pattern, line)
            for m in matches:
                if not is_false_positive(m) and not is_false_positive(line):
                    # Skip minified files for some checks
                    if '.min.' in filepath and len(line) > 500:
                        continue
                    issues.append(('CRITICAL', rel, f'Line {i}: Potential {label}: {m[:30]}...'))

    # Check for XSS patterns
    for pattern, label in XSS_PATTERNS:
        for i, line in enumerate(lines, 1):
            if re.search(pattern, line, re.IGNORECASE):
                # Skip comments
                stripped = line.strip()
                if stripped.startswith('//') or stripped.startswith('*') or stripped.startswith('<!--'):
                    continue
                issues.append(('WARNING', rel, f'Line {i}: {label}'))

    # Check postMessage handlers
    if re.search(POSTMESSAGE_PATTERN, content):
        if 'event.origin' not in content and 'e.origin' not in content:
            issues.append(('WARNING', rel, 'postMessage handler without origin check'))

    # Check for unsafe inline event handlers in HTML (only for .html files)
    if filepath.endswith('.html'):
        # onclick with direct variable injection (simplified check)
        onclick_evals = re.findall(r'onclick=["\'][^"\']*\+[^"\']*["\']', content)
        for match in onclick_evals:
            issues.append(('INFO', rel, f'onclick with string concatenation (possible XSS): {match[:60]}'))

    return issues

def main():
    print("=== validate-security.py ===\n")
    files = get_all_files()
    print(f"Scanning {len(files)} files (HTML + JS)...\n")

    all_issues = {'CRITICAL': [], 'WARNING': [], 'INFO': []}

    for filepath in files:
        file_issues = check_file(filepath)
        for level, path, msg in file_issues:
            all_issues[level].append(f"{path}: {msg}")

    for level in ['CRITICAL', 'WARNING', 'INFO']:
        print(f"--- {level} ({len(all_issues[level])}) ---")
        for issue in all_issues[level][:15]:  # Cap output
            print(f"  {level}: {issue}")
        if len(all_issues[level]) > 15:
            print(f"  ... and {len(all_issues[level]) - 15} more")
        if not all_issues[level]:
            print(f"  PASS")
        print()

    total_critical = len(all_issues['CRITICAL'])
    if total_critical > 0:
        print(f"ACTION REQUIRED: {total_critical} CRITICAL security issues found.")
        print("Do NOT push until all CRITICAL issues are resolved.")
        print("If API keys were exposed: rotate them immediately at:")
        print("  Supabase: app.supabase.com → Settings → API")
        print("  Firebase: console.firebase.google.com → Project Settings")
        print("  Gemini: aistudio.google.com → API Keys")
    else:
        print("Security scan complete. No critical issues found.")

if __name__ == '__main__':
    main()
