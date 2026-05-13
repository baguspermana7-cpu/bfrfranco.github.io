#!/usr/bin/env python3
"""
audit-onclick-handlers.py
Walks HTML file(s), extracts inline onclick="X(...)" handler names,
checks each name has a matching window.X = or window.X= assignment.
Reports missing exports. --strict exits 1 on any miss.

Usage:
  python3 tools/audit-onclick-handlers.py [--strict] [file.html ...]
  If no files are given, scans spares-readiness-calculator.html.
"""
import re
import sys
import os

def extract_handlers(html):
    """Return sorted unique function names from inline event handlers.
    v1.16.3: cover ALL inline event attributes (not just onclick) — oninput, onchange,
    onkeyup, onfocus, onblur, onsubmit, etc. — because v1.16.2 only checked onclick
    and let 19 input-bound calc handlers slip through unexposed."""
    events = ('onclick','oninput','onchange','onkeyup','onkeydown','onfocus','onblur',
              'onsubmit','onmouseover','onmouseout','ondblclick')
    names = set()
    for ev in events:
        # Standard form: ev="fname(...)" or ev='fname(...)'
        for m in re.finditer(rf'''{ev}=["']([^"']+)["']''', html):
            code = m.group(1)
            # Function names called inside the expression (may be multi-call: "a();b()")
            for n in re.finditer(r'(?:^|[\s;,(])([a-zA-Z_$][\w$]*)\s*\(', code):
                names.add(n.group(1))
    # Skip JS built-ins / DOM API surface
    BUILTINS = {'if','for','while','return','function','typeof','new','document','window',
                'setTimeout','setInterval','parseInt','parseFloat','Math','Array','Object',
                'JSON','console','localStorage','sessionStorage','event','this','alert',
                'confirm','prompt','encodeURIComponent','decodeURIComponent','Number','String',
                'Boolean','Date','RegExp','Promise','Error'}
    return sorted(names - BUILTINS)

def check_window_exposure(html, name):
    """Return True if window.NAME is assigned anywhere in the file."""
    # Match: window.NAME = ... or window.NAME=...
    pattern = re.compile(
        r'window\.' + re.escape(name) + r'\s*=',
        re.MULTILINE
    )
    return bool(pattern.search(html))

def audit_file(filepath, strict=False):
    with open(filepath, encoding='utf-8') as f:
        html = f.read()

    handlers = extract_handlers(html)
    missing = []
    exposed = []

    for name in handlers:
        if check_window_exposure(html, name):
            exposed.append(name)
        else:
            missing.append(name)

    print(f"\n[audit-onclick-handlers] {os.path.basename(filepath)}")
    print(f"  Total onclick handlers found : {len(handlers)}")
    print(f"  Exposed on window            : {len(exposed)}")
    print(f"  Missing window exposure      : {len(missing)}")

    if missing:
        print("\n  MISSING (not exposed on window):")
        for name in missing:
            print(f"    - {name}")
    else:
        print("  All handlers are exposed on window. OK")

    return missing

def main():
    args = sys.argv[1:]
    strict = '--strict' in args
    files = [a for a in args if not a.startswith('--')]

    if not files:
        # Default: scan spares-readiness-calculator.html relative to repo root
        script_dir = os.path.dirname(os.path.abspath(__file__))
        repo_root = os.path.dirname(script_dir)
        default = os.path.join(repo_root, 'spares-readiness-calculator.html')
        if os.path.exists(default):
            files = [default]
        else:
            print("No file specified and spares-readiness-calculator.html not found.")
            sys.exit(2)

    any_missing = False
    for filepath in files:
        if not os.path.exists(filepath):
            print(f"File not found: {filepath}")
            sys.exit(2)
        missing = audit_file(filepath, strict=strict)
        if missing:
            any_missing = True

    if strict and any_missing:
        print("\n[STRICT] Missing window exports detected. Exiting 1.")
        sys.exit(1)
    elif not any_missing:
        print("\n[OK] No missing exports.")
        sys.exit(0)
    else:
        sys.exit(0)

if __name__ == '__main__':
    main()
