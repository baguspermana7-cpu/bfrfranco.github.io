#!/usr/bin/env python3
"""test-glossary.py — the glossary pages stay filed and on the register.

Owner 2026-11-07 (screenshot of glossary.html): "kenapa masih ada yang ai design slop sekali" — every term card
carried a 3 px amber left rail, 20 px pill links, a hover slide, blurred bars and an aurora hero, and six article-28
terms (Shannon Entropy, Kolmogorov Complexity, …) sat under the letter A. The site sweep had recoloured the page
(blue → amber) but nothing checked its STRUCTURE.

G1  every term sits in the section of its own first letter (a leading digit files under the first letter after it)
G2  no coloured left rail on a term card (border-left wider than 1 px)
G3  no pill (radius >= 12 px) and no radius above 4 px on the term card, its links, the search or the alpha buttons
G4  no hover transform, no backdrop blur, no radial/linear gradient wash in the page CSS
Pages: glossary.html, id/glosarium.html. Exit 1 on any finding.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PAGES = ['glossary.html', 'id/glosarium.html']


def css_of(text):
    return '\n'.join(re.findall(r'<style[^>]*>(.*?)</style>', text, re.S))


def block(css, sel):
    m = re.search(r'(?:^|[}\s])' + re.escape(sel) + r'\s*\{([^}]*)\}', css)
    return m.group(1) if m else ''


def check(page):
    text = (ROOT / page).read_text(encoding='utf-8')
    css = css_of(text)
    out = []
    secs = re.split(r'<section class="letter-section" id="section-([A-Z])">', text)
    for i in range(1, len(secs), 2):
        body = secs[i + 1].split('</section>')[0]
        for name in re.findall(r'<h3 class="term-name">([^<]+)', body):
            first = next((c for c in name.upper() if c.isalpha()), '')
            if first != secs[i]:
                out.append(f'G1 "{name.strip()}" filed under {secs[i]}')
    rail = re.search(r'border-left\s*:\s*([2-9]|\d{2,})px', block(css, '.term'))
    if rail:
        out.append('G2 .term has a %spx left rail' % rail.group(1))
    for sel in ('.term', '.term-links a', '.glossary-search', '.alpha-btn'):
        r = re.search(r'border-radius\s*:\s*([^;]+)', block(css, sel))
        if r and any(int(v) > 4 for v in re.findall(r'(\d+)px', r.group(1))):
            out.append(f'G3 {sel} radius {r.group(1).strip()}')
    for m in re.finditer(r'([^{}]*:hover[^{}]*)\{([^}]*)\}', css):
        if re.search(r'transform\s*:\s*(?!none)', m.group(2)):
            out.append('G4 hover transform on ' + m.group(1).strip()[:40])
    if re.search(r'backdrop-filter\s*:\s*blur', css):
        out.append('G4 backdrop blur in page CSS')
    if re.search(r'radial-gradient|linear-gradient', css):
        out.append('G4 gradient wash in page CSS')
    return out


fail = 0
for p in PAGES:
    found = check(p)
    print(('FAIL' if found else 'PASS') + f' {p}: {len(found)} finding(s)')
    for f in found[:12]:
        print('   ', f)
    fail |= bool(found)
sys.exit(1 if fail else 0)
