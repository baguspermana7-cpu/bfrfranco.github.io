#!/usr/bin/env python3
"""
rollout-cookie-consent.py — replace per-page cookie-consent copies with the
shared engine js/rz-cookie-consent.js (v1.53.4).

Per page:
  1. remove the inline consent <script> IIFE (fingerprint: references
     cookieBanner AND a consent localStorage key; the head GA-gating snippet
     references the key but NOT cookieBanner, so it is untouched)
  2. remove class-based cookie CSS rules (.cookie-banner/.cookie-actions/
     .cookie-accept/.cookie-decline/.cookie-btn/.cookie-banner-actions);
     id-based #cookieBanner/#cookieAccept rules are KEPT (they also style the
     engine-injected banner — same ids)
  3. remove the static banner markup (balanced-div parse from the opening tag)
  4. insert <script src="js/rz-cookie-consent.js?v=TAG" defer></script> after
     the rz-mobile-nav.js tag; /id/ pages get ../js/ path + RZ_COOKIE_TEXT

Usage: python3 tools/rollout-cookie-consent.py [--apply]  (default: dry run)
"""
import os, re, sys, glob

TAG = '2026-07-12'
APPLY = '--apply' in sys.argv
EXCLUDE = {'ai-engineering-maintenance.html', 'cdu-mini-bms.html'}

ID_TEXT = ('<script>window.RZ_COOKIE_TEXT={msg:"Kami menggunakan cookie untuk analitik '
           'guna meningkatkan pengalaman Anda.",more:"Pelajari lebih lanjut",'
           'accept:"Terima",decline:"Tolak",policyHref:"../privacy.html"};</script>\n    ')


def remove_balanced_div(s, open_idx):
    """Remove a <div ...> ... </div> block with balanced nesting."""
    depth = 0
    i = open_idx
    while i < len(s):
        m = re.compile(r'<div\b|</div\s*>').search(s, i)
        if not m:
            return s, False
        if m.group(0).startswith('<div'):
            depth += 1
        else:
            depth -= 1
            if depth == 0:
                end = m.end()
                # eat a leading comment line if directly above
                start = open_idx
                before = s[:start]
                cm = re.search(r'<!--[^>]*Cookie[^>]*-->\s*$', before, re.I)
                if cm:
                    start = cm.start()
                return s[:start] + s[end:], True
        i = m.end()
    return s, False


def process(path):
    with open(path, encoding='utf-8') as f:
        s = f.read()
    orig = s
    is_id = path.startswith('id/') or path.startswith('id' + os.sep)
    report = []

    # 1) inline consent script IIFE(s) — manual split (regex .*? over MB pages
    #    backtracks; datahallAI-class files timed the old version out)
    removed_js = 0
    parts = s.split('</script>')
    kept = []
    for i, part in enumerate(parts):
        if i == len(parts) - 1:
            kept.append(part)
            break
        idx = part.rfind('<script')
        if idx == -1:
            kept.append(part + '</script>')
            continue
        head, block = part[:idx], part[idx:]
        opentag_end = block.find('>')
        opentag = block[:opentag_end]
        body = block[opentag_end:]
        # size guard: pure consent handlers are ~0.4-1.5KB; a big script that
        # merely CONTAINS the handler (page engine) must never be deleted
        if ('src=' not in opentag and 'cookieBanner' in body
                and ('rz_cookie_consent' in body or 'cookieConsent' in body)
                and len(body) < 3000):
            removed_js += 1
            kept.append(head)
        else:
            kept.append(part + '</script>')
    s = ''.join(kept)
    if removed_js:
        report.append('js:%d' % removed_js)

    # 2) class-based cookie CSS rules — anchored per-rule pattern (naive
    #    ([^{}]+){...} scan backtracks catastrophically on MB-sized pages)
    rule_pat = re.compile(
        r'[ \t]*[^{}\n]*\.cookie-(?:banner|actions|accept|decline|btn)'
        r'[^{}\n]*\{[^{}]*\}[ \t]*\n?')
    s, removed_css = rule_pat.subn('', s)
    if removed_css:
        report.append('css:%d' % removed_css)

    # 3) static banner markup
    removed_html = 0
    while True:
        m = re.search(r'<div[^>]*(?:class="[^"]*cookie-banner[^"]*"[^>]*|id="cookieBanner"[^>]*)>', s)
        if not m:
            break
        s2, ok = remove_balanced_div(s, m.start())
        if not ok:
            break
        s = s2
        removed_html += 1
    if removed_html:
        report.append('html:%d' % removed_html)

    # 4) engine script tag
    if 'rz-cookie-consent.js' not in s:
        js_path = '../js/rz-cookie-consent.js' if is_id else 'js/rz-cookie-consent.js'
        tag = '<script src="%s?v=%s" defer></script>' % (js_path, TAG)
        if is_id:
            tag = ID_TEXT + tag
        nav = re.search(r'[ \t]*<script src="(?:\.\./)?js/rz-mobile-nav\.js[^>]*></script>', s)
        if nav:
            indent = re.match(r'[ \t]*', nav.group(0)).group(0)
            s = s[:nav.end()] + '\n' + indent.strip('\n') + tag + s[nav.end():]
            report.append('tag+')
        else:
            report.append('NO-NAV-ANCHOR')

    if s != orig:
        if APPLY:
            with open(path, 'w', encoding='utf-8') as f:
                f.write(s)
        print(('%-46s' % path), ' '.join(report))
        return 1
    return 0


pages = sorted(glob.glob('*.html') + glob.glob('id/*.html'))
n = 0
for p in pages:
    if os.path.basename(p) in EXCLUDE:
        continue
    n += process(p)
print(('APPLIED' if APPLY else 'DRY RUN'), '- pages changed:', n)
