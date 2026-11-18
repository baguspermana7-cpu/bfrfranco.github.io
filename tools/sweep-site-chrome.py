#!/usr/bin/env python3
"""sweep-site-chrome.py — refit a page to the one bar and the one theme button
(standarization/SITE_CHROME_STANDARD.md, PRD documentation/prd/PRD_SITE_CHROME.md).

Per page, idempotent:
  1. the head snippet (theme before first paint) — one string, identical on every page, stamped here only
  2. no `data-theme` literal on <html>; `data-rz-kind="app"` on app pages (tools/site-chrome.config.json)
  3. `data-rz-bar` on the bar; `data-rz-slot` on search and sign-in
  4. the theme button replaced by the canonical markup (old id kept as an alias), placed before sign-in
  5. the page's own toggle code, icon code and one-line `.navbar { … }` rules removed
  6. css/rz-chrome.css and js/rz-chrome.js loaded last in <head>

Anything it could not remove safely is REPORTED per page, never guessed at.

  python3 tools/sweep-site-chrome.py --apply a.html b.html   refit these pages
  python3 tools/sweep-site-chrome.py --check                 every refitted page is a fixed point (exit 1 if not)
After --apply: node tools/test-asset-cache-tokens.mjs --fix css/rz-chrome.css js/rz-chrome.js
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CFG = json.loads((ROOT / 'tools/site-chrome.config.json').read_text(encoding='utf8'))
APP = set(CFG['app'])
# pages that must not be swept yet, with the reason
HOLD = {'index.html': 'its toggle is a three-way day / dark / rainbow cycle and its head script restores rainbow; port that first (phase N4)'}

HEAD = ("<script data-rz-chrome-head>(function(){var d=document.documentElement,t=null;"
        "try{t=localStorage.getItem('theme')}catch(e){}"
        "if(t!=='light'&&t!=='dark')t=d.getAttribute('data-rz-kind')==='app'?'dark':'light';"
        "d.setAttribute('data-theme',t)})();</script>")
ICONS = ('<svg class="rz-i-moon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" '
         'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>'
         '<svg class="rz-i-sun" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" '
         'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/>'
         '<path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>')
CSS_RE = re.compile(r'[ \t]*<link rel="stylesheet" href="css/rz-chrome\.css[^"]*">\n?')
JS_RE = re.compile(r'[ \t]*<script src="js/rz-chrome\.js[^"]*" defer></script>\n?')
OLD_HEAD = re.compile(r"[ \t]*<script>\s*\(function\s*\(\)\s*\{[^<]{0,400}?getItem\('theme'\)[^<]{0,400}?\}\)\(\);\s*</script>\n?")
BTN = re.compile(r'<button\b[^>]*(?:id="(?:themeToggle|navThemeBtn)"|class="[^"]*\b(?:theme-toggle|rz-theme-btn)\b[^"]*")[^>]*>.*?</button>', re.S)
BAR = re.compile(r'<(?:nav|header)\b[^>]*class="[^"]*\bnavbar\b[^"]*"[^>]*>')


def button(old):
    m = re.search(r'\bid="([^"]+)"', old.split('>', 1)[0])
    ident = f' id="{m.group(1)}"' if m else ''
    return (f'<button type="button" class="rz-theme-btn"{ident} data-rz-theme-toggle data-rz-slot="theme" '
            f'aria-label="Switch to dark theme" aria-pressed="false">{ICONS}</button>')


def cut_function(s, m):
    """Remove `function name() { … }` starting at match m, by brace matching."""
    i = s.index('{', m.start())
    stop = s.find('</script>', i)
    stop = len(s) if stop < 0 else stop
    depth, j = 0, i
    while j < stop:
        if s[j] == '{':
            depth += 1
        elif s[j] == '}':
            depth -= 1
            if depth == 0:
                break
        j += 1
    if j >= stop:   # braces never balanced inside this <script> (a brace in a string or a regex): leave it for a person
        return None
    start = s.rfind('\n', 0, m.start()) + 1
    end = j + 1
    if s[end:end + 1] == '\n':
        end += 1
    return s[:start] + s[end:]


def refit(name, s):
    notes = []
    original = s
    # 2. <html>
    def html_tag(m):
        t = re.sub(r'\sdata-theme="(?:dark|light)"', '', m.group(0))
        if name in APP and 'data-rz-kind=' not in t:
            t = t[:-1] + ' data-rz-kind="app">'
        return t
    s = re.sub(r'<html\b[^>]*>', html_tag, s, count=1)

    # 1. head snippet
    cut = s.find('</head>')
    if cut < 0:
        return s, ['no </head>']
    head, rest = s[:cut], s[cut:]
    # only a script that does nothing but apply the stored theme: one storage read, no class change (the homepage's
    # also restores its rainbow mode — that one stays and is reported)
    def old_head(m):
        t = m.group(0)
        return '' if t.count('getItem(') == 1 and 'classList' not in t else t
    head = OLD_HEAD.sub(old_head, head)
    head = re.sub(r'[ \t]*' + re.escape(HEAD) + r'\n?', '', head)
    m = re.search(r'<meta charset[^>]*>\n?', head) or re.search(r'<head[^>]*>\n?', head)
    head = head[:m.end()] + '    ' + HEAD + '\n' + head[m.end():]
    # 6. assets, last in <head>
    head = JS_RE.sub('', CSS_RE.sub('', head)).rstrip() + '\n'
    head += '    <link rel="stylesheet" href="css/rz-chrome.css?v=0">\n    <script src="js/rz-chrome.js?v=0" defer></script>\n'
    old = re.search(r'css/rz-chrome\.css\?v=([^"]+)"', s), re.search(r'js/rz-chrome\.js\?v=([^"]+)"', s)
    if old[0]:
        head = head.replace('css/rz-chrome.css?v=0', 'css/rz-chrome.css?v=' + old[0].group(1))
    if old[1]:
        head = head.replace('js/rz-chrome.js?v=0', 'js/rz-chrome.js?v=' + old[1].group(1))
    s = head + rest

    # 3. bar
    bar = BAR.search(s)
    if not bar:
        return original, ['no .navbar bar found — nothing stamped']
    if 'data-rz-bar' not in bar.group(0):
        s = s[:bar.end() - 1] + ' data-rz-bar>' + s[bar.end():]
        bar = BAR.search(s)
    end = min([x for x in (s.find('</nav>', bar.end()), s.find('</header>', bar.end())) if x > 0] or [len(s)])
    nav = s[bar.end():end]
    nav = re.sub(r'(<button\b(?![^>]*data-rz-slot)[^>]*\bid="navSearchBtn")', r'\1 data-rz-slot="search"', nav)
    nav = re.sub(r'(<div\b(?![^>]*data-rz-slot)[^>]*\bclass="nav-auth-wrap"(?:\s+id="[^"]*")?)', r'\1 data-rz-slot="signin"', nav)
    # 4. theme button
    b = BTN.search(nav)
    if not b:
        notes.append('no theme button in the bar')
    else:
        new = button(b.group(0))
        auth = re.search(r'[ \t]*<div\b[^>]*data-rz-slot="signin"', nav)
        if auth and not (b.end() <= auth.start() and nav[b.end():auth.start()].strip() == ''):   # not already directly before sign-in
            line_start = nav.rfind('\n', 0, b.start()) + 1
            line_end = b.end() + (1 if nav[b.end():b.end() + 1] == '\n' else 0)
            whole_line = nav[line_start:b.start()].strip() == ''
            nav = nav[:line_start if whole_line else b.start()] + nav[line_end if whole_line else b.end():]
            auth = re.search(r'[ \t]*<div\b[^>]*data-rz-slot="signin"', nav)
            nav = nav[:auth.start()] + '    ' + new + '\n' + nav[auth.start():]
        else:
            nav = nav[:b.start()] + new + nav[b.end():]
    s = s[:bar.end()] + nav + s[end:]

    # 5. the page's own code
    while True:
        m = re.search(r'function\s+toggle\w*Theme\w*\s*\(\s*\)\s*\{', s)
        if not m:
            break
        cut = cut_function(s, m)
        if cut is None:
            notes.append('toggle function not removed: unbalanced braces')
            break
        s = cut
    # an icon-only IIFE: it must START a line (never a `setTimeout(function () {` further up) and hold no nested one
    s = re.sub(r"(?m)^[ \t]*(?://[^\n]*\n[ \t]*)?\(function\s*\(\)\s*\{(?:(?!\}\)\(\);|\(function)[\s\S]){0,400}?(?:themeIcon|#themeToggle i)(?:(?!\}\)\(\);|\(function)[\s\S]){0,400}?\}\)\(\);\n?", '', s)
    s = re.sub(r"[ \t]*window\.toggle\w*Theme\w*\s*=\s*toggle\w*Theme\w*;\n?", '', s)
    s = re.sub(r"[ \t]*function paint\(\)\{var d=document\.documentElement\.getAttribute\('data-theme'\)==='dark';var i=t(?:&&t)?\.querySelector\('i'\);[^\n]*\n", '', s)
    s = re.sub(r"[ \t]*if\(t\)\{t\.addEventListener\('click',function\(\)\{var d=document\.documentElement\.getAttribute\('data-theme'\)==='dark';[^\n]*paint\(\);\}\n", '', s)
    s = re.sub(r"[ \t]*var t=document\.getElementById\('themeToggle'\);\n(?=\s*var s=document\.getElementById\('navSearchBtn'\))", '', s)
    s = re.sub(r"[ \t]*(?://\s*[─\-]+\s*(?:Dark Mode Toggle|THEME TOGGLE)\s*[─\-]+|/\* =+\s*\n\s*DARK MODE TOGGLE\s*\n\s*=+ \*/)[ \t]*\n(?=\s*(?:</script>|\n|/\*))", '', s)
    s = re.sub(r'(?m)^[ \t]*\.navbar\s*\{[^{}\n]*\}[ \t]*\n', lambda m: m.group(0) if re.search(r'display\s*:\s*none', m.group(0)) else '', s)

    left = sorted(set(re.findall(r'toggle\w*Theme\w*\s*\(|themeIcon|getElementById\(\'themeToggle\'\)', s)))
    if left:
        notes.append('left for hand review: ' + ', '.join(left))
    if re.search(r'(?m)(^|[\s}])\.navbar\s*\{(?!\s*display\s*:\s*none\b[^{}]*\})', '\n'.join(re.findall(r'<style[^>]*>([\s\S]*?)</style>', s))):
        notes.append('a multi-line .navbar rule is still in the page')
    return s, notes


def main():
    apply, check = '--apply' in sys.argv, '--check' in sys.argv
    files = [a for a in sys.argv[1:] if a.endswith('.html')]
    if check and not files:
        files = sorted(p.name for p in ROOT.glob('*.html') if 'data-rz-chrome-head' in p.read_text(encoding='utf8', errors='replace'))
    stale = 0
    for f in files:
        p = (ROOT / f).resolve()
        f = p.relative_to(ROOT).as_posix()
        if '/' in f:
            print(f'skip  {f} — only root pages: the stamped asset paths are relative to the root')
            continue
        if f in HOLD:
            print(f'skip  {f} — {HOLD[f]}')
            continue
        if not p.exists():
            print(f'skip  {f} — no such file')
            continue
        src = p.read_text(encoding='utf8')
        out, notes = refit(f, src)
        again, _ = refit(f, out)
        if again != out:
            notes.append('NOT idempotent')
        changed = out != src
        if check and changed:
            stale += 1
        if apply and changed:
            p.write_text(out, encoding='utf8')
        if changed or notes:
            print(f"{'refit ' if apply and changed else 'stale ' if changed else 'ok    '}{f}" + (' — ' + '; '.join(notes) if notes else ''))
    print(f"site chrome sweep: {len(files)} page(s), {stale} stale" if check else f"site chrome sweep: {len(files)} page(s) processed")
    sys.exit(1 if check and stale else 0)


if __name__ == '__main__':
    main()
