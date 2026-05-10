#!/usr/bin/env python3
"""v1.10.11 — extract 699 KB inline JS from ltc-system-modelling-lab.html to external file."""
import re
from pathlib import Path

ROOT = Path("/home/baguspermana7/rz-work")
HTML_FILE = ROOT / "ltc-system-modelling-lab.html"
JS_OUT = ROOT / "js" / "ltc-system-modelling-lab.js"

content = HTML_FILE.read_text(encoding='utf-8')
print(f"Original HTML size: {len(content):,} bytes")

# Find the largest <script>...</script> WITHOUT src attribute
pattern = re.compile(r'<script(?![^>]*\bsrc=)([^>]*)>(.*?)</script>', re.DOTALL)
matches = list(pattern.finditer(content))

# Sort by inner content size, biggest first
matches.sort(key=lambda m: -len(m.group(2)))

# Take the biggest one
biggest = matches[0]
attrs = biggest.group(1).strip()
js_code = biggest.group(2)
full_match = biggest.group(0)
match_start = biggest.start()
match_end = biggest.end()

print(f"Largest inline script: {len(js_code):,} bytes ({len(js_code)/1024:.1f} KB)")
print(f"Script attrs: {attrs!r}")

# Write external JS file
JS_OUT.write_text(js_code, encoding='utf-8')
print(f"Wrote: {JS_OUT}")

# Replace inline with external reference
# Use defer so it doesn't block parsing, runs after DOMContentLoaded
replacement = f'<script src="js/ltc-system-modelling-lab.js?v=2026-05-09" defer></script>'
new_content = content[:match_start] + replacement + content[match_end:]

# Sanity check: no </script> in JS that would break tokenizer (now external, safer)
HTML_FILE.write_text(new_content, encoding='utf-8')
new_size = len(new_content)
print(f"New HTML size: {new_size:,} bytes (saved {len(content)-new_size:,} bytes / {(len(content)-new_size)/1024:.1f} KB)")
print(f"Compression ratio: {new_size/len(content)*100:.1f}%")
