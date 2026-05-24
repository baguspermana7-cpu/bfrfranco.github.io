#!/usr/bin/env python3
"""Scope maintenance lab CSS under .mdl-root for rz-work static site.
Reads src/styles.css, skips first 28 lines (replaced by scoped header),
prefixes every CSS selector with .mdl-root, and writes to
js/maintenance/styles.css.
"""
import re
import sys
import os

SRC = "/home/baguspermana7/Documents/maintenance tools/src/styles.css"
DST = "/home/baguspermana7/.config/superpowers/worktrees/rz-work/ft-phase2/js/maintenance/styles.css"

HEADER = """\
/* Maintenance Decode Lab — page-scoped styles (v1.41.0) */
/* All rules scoped under #mdl-app.mdl-root to avoid clashing with rz globals */

.mdl-root {
  color-scheme: light;
  /* Original :root variables migrated here */
  --bg: #edf1f5;
  --panel: #ffffff;
  --panel-2: #f7f9fb;
  --text: #17202a;
  --muted: #657386;
  --line: #d8e0ea;
  --line-strong: #b8c4d1;
  --blue: #1e6bb8;
  --blue-2: #0e4f8f;
  --green: #18865b;
  --amber: #a86900;
  --red: #ba2f32;
  --ink: #0b1623;
  --rail: #111d2b;
  --rail-2: #17283c;
  --cyan: #117b91;
  --shadow: 0 10px 30px rgba(14, 28, 44, 0.10);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background: var(--bg);
  color: var(--text);
  min-height: 100vh;
}

.mdl-root *, .mdl-root *::before, .mdl-root *::after { box-sizing: border-box; }
.mdl-root button, .mdl-root input, .mdl-root select { font: inherit; }
.mdl-root button { cursor: pointer; }

.mdl-error-banner {
  background: #ba2f32;
  color: #fff;
  padding: 12px 16px;
  border-radius: 6px;
  margin-bottom: 12px;
  font-weight: 700;
}
"""

DARK_MODE_SUFFIX = """
/* Dark mode overrides for maintenance lab */
[data-theme="dark"] .mdl-root {
  --bg: #0f172a;
  --panel: #1e293b;
  --panel-2: #1a2435;
  --text: #f1f5f9;
  --muted: #94a3b8;
  --line: rgba(255,255,255,0.08);
  --line-strong: rgba(255,255,255,0.16);
  --ink: #f1f5f9;
}
"""

with open(SRC, "r", encoding="utf-8") as f:
    all_lines = f.readlines()

# Skip first 28 lines (original :root and global resets)
body_lines = all_lines[28:]

SKIP_RULES = {":root", "html, body, #app", "* {", "html,", "body {", "button,", "button {"}

def looks_like_selector_line(line):
    stripped = line.rstrip()
    if not stripped:
        return False
    # Comment lines
    if stripped.strip().startswith("/*") or stripped.strip().startswith("*"):
        return False
    # Only property lines (contain : but not @)
    if stripped.strip().startswith("@"):
        return False
    # Opening brace on this line without a colon before it (selector)
    if "{" in stripped:
        before_brace = stripped[:stripped.index("{")].strip()
        # If it looks like a property (has colon near start without a quote), skip
        colon_pos = before_brace.find(":")
        if colon_pos > 0 and " " not in before_brace[:colon_pos]:
            return False
        return True
    return False

def prefix_selectors(selector_str):
    """Prefix each comma-separated selector with .mdl-root."""
    parts = selector_str.split(",")
    prefixed = []
    for part in parts:
        stripped = part.strip()
        if not stripped:
            continue
        # Don't double-prefix
        if stripped.startswith(".mdl-root"):
            prefixed.append(part)
        else:
            # Preserve leading whitespace for formatting
            leading = len(part) - len(part.lstrip())
            prefixed.append(" " * leading + ".mdl-root " + stripped)
    return ",".join(prefixed)

output_lines = [HEADER]

inside_media = False
media_depth = 0
i = 0
lines = body_lines

while i < len(lines):
    line = lines[i]
    stripped = line.strip()

    # Detect @media blocks
    if stripped.startswith("@media"):
        inside_media = True
        media_depth = 0
        output_lines.append(line)
        if "{" in line:
            media_depth += line.count("{") - line.count("}")
        i += 1
        continue

    if inside_media:
        if "{" in line or "}" in line:
            media_depth += line.count("{") - line.count("}")
        if media_depth <= 0:
            inside_media = False
            output_lines.append(line)
            i += 1
            continue
        # Inside media block: prefix selectors
        if looks_like_selector_line(line):
            output_lines.append(prefix_selectors(line.rstrip()) + "\n")
        else:
            output_lines.append(line)
        i += 1
        continue

    # Normal (non-media) lines
    if looks_like_selector_line(line):
        output_lines.append(prefix_selectors(line.rstrip()) + "\n")
    else:
        output_lines.append(line)
    i += 1

output_lines.append(DARK_MODE_SUFFIX)

os.makedirs(os.path.dirname(DST), exist_ok=True)
with open(DST, "w", encoding="utf-8") as f:
    f.writelines(output_lines)

print(f"Written {len(output_lines)} lines to {DST}")
