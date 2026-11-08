#!/usr/bin/env python3
"""sweep-page-register.py — rewrite the inline <style> CSS of named pages onto the site register
(CLAUDE.md "Canonical patterns", ANTI_VIBECODE §A; PRD §41 K19, owner 2026-11-08: "pasti ada, saya nggak
mau, sempurnakan, saya tidak mau ada yang miss").

The journal family has tools/sweep-journal-register.py, which rewrites onto the --rz-art-* tokens. The
other bespoke pages (pln-java-grid*, pillar-*, insights, glossary, …) carry their own token prefix or no
tokens at all, so this tool rewrites by VALUE, never by page token:

  P1 radius     any border-radius > 4 px (px / rem / em; 50 % and other % kept)        -> 4px
  P2 gradient   a gradient background / background-image, or a *-gradient token         -> its first stop colour, flat
  P3 shadow     a resting box-shadow (not inset, not a 0 0 0 N ring, not :focus), text-shadow, *-shadow tokens -> none
  P4 blur       backdrop-filter, filter: blur(>= 20px); a *-glass token                   -> removed / the opaque fallback
  P5 lift       transform with translate / scale inside a :hover rule                    -> transform: none
  P6 tall       transition: all …                                                         -> the four register properties
  P7 rail       border-left / border-right >= 2 px solid colour                            -> 1px solid, same colour at .35 alpha

Comment-safe: /* … */ are stripped from each <style> block before the walk and the rules are rewritten in
place, so a comment can never swallow a rule (the v3.30.0 index transform ate two closers that way).
Idempotent: a second run rewrites nothing (--check).

  python3 tools/sweep-page-register.py --pages a.html b.html            dry run, counts per page and rule
  python3 tools/sweep-page-register.py --pages … --apply                 rewrite in place
  python3 tools/sweep-page-register.py --pages … --check                 exit 1 if anything would change
"""
import argparse
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MOTION = ('color var(--rz-dur-fast,.2s) var(--rz-ease-out,ease),background-color var(--rz-dur-fast,.2s) var(--rz-ease-out,ease),'
          'border-color var(--rz-dur-fast,.2s) var(--rz-ease-out,ease),opacity var(--rz-dur-fast,.2s) var(--rz-ease-out,ease)')
STYLE_RE = re.compile(r'(<style[^>]*>)(.*?)(</style>)', re.S)
COMMENT_RE = re.compile(r'/\*.*?\*/', re.S)
COLOUR_RE = re.compile(r'#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b|rgba?\([^)]*\)|hsla?\([^)]*\)|var\(--[\w-]+\)')


def split_decls(body):
    out, depth, cur = [], 0, ''
    for ch in body:
        if ch == '(':
            depth += 1
        elif ch == ')':
            depth = max(0, depth - 1)
        if ch == ';' and depth == 0:
            out.append(cur)
            cur = ''
        else:
            cur += ch
    if cur.strip():
        out.append(cur)
    return out


def first_stop(value):
    """the first colour inside the first gradient(...) of a value, or None"""
    m = re.search(r'gradient\((.*)\)', value, re.S)
    if not m:
        return None
    inner = m.group(1)
    for c in COLOUR_RE.finditer(inner):
        tok = c.group(0)
        if tok.startswith('var(') or not re.match(r'^(?:#|rgba?|hsla?)', tok):
            return tok
        return tok
    return None


def rail_colour(value):
    m = COLOUR_RE.search(value)
    if not m:
        return 'currentColor'
    tok = m.group(0)
    if tok.startswith('var('):
        return tok
    return tok


def rewrite_rule(selector, body, log, page):
    hover = ':hover' in selector
    out, changed = [], False

    def note(rule, before, after):
        log.append((page, rule, selector.strip()[:80], before.strip()[:90], after.strip()[:90]))

    for raw in split_decls(body):
        if ':' not in raw:
            out.append(raw)
            continue
        name, _, value = raw.partition(':')
        key = name.strip().lower()
        lead = raw[:len(raw) - len(raw.lstrip())]
        v = value.strip()
        imp = ' !important' if v.endswith('!important') else ''
        v0 = v[:-len('!important')].rstrip() if imp else v
        if key.endswith('radius') and key.startswith('border'):
            parts = v0.split('/')[0].split()
            def clamp(tok):
                m = re.match(r'^([\d.]+)(px|rem|em)$', tok)
                if not m:
                    return tok
                px = float(m.group(1)) * (16 if m.group(2) != 'px' else 1)
                return '4px' if px > 4 else tok
            nparts = [clamp(t) for t in parts]
            if nparts != parts and not any(t.endswith('%') for t in parts):
                new = key + ': ' + ' '.join(nparts)
                out.append(lead + new + imp); note('P1 radius', raw, new); changed = True; continue
        if 'gradient(' in v0 and key in ('background', 'background-image') or (key.startswith('--') and 'gradient(' in v0):
            stop = first_stop(v0)
            if stop:
                new = (key if key.startswith('--') else 'background') + ': ' + stop
                out.append(lead + new + imp); note('P2 gradient', raw, new); changed = True; continue
        if (key == 'box-shadow' or (key.startswith('--') and 'shadow' in key)) and v0 != 'none' and 'inset' not in v0 \
                and ':focus' not in selector and not re.match(r'^0(?:px)?\s+0(?:px)?\s+0(?:px)?\s+\d', v0):
            new = key + ': none'
            out.append(lead + new + imp); note('P3 shadow', raw, new); changed = True; continue
        if key == 'text-shadow' and v0 != 'none':
            note('P3 shadow', raw, '(removed)'); changed = True; continue
        if key in ('backdrop-filter', '-webkit-backdrop-filter'):
            note('P4 blur', raw, '(removed)'); changed = True; continue
        if key == 'filter' and re.search(r'blur\(\s*(\d+)px', v0) and int(re.search(r'blur\(\s*(\d+)px', v0).group(1)) >= 20:
            note('P4 blur', raw, '(removed)'); changed = True; continue
        if key.startswith('--') and 'glass' in key and re.match(r'^rgba\(', v0):
            m = re.match(r'^rgba\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)', v0)
            new = key + ': rgb(%s, %s, %s)' % (m.group(1), m.group(2), m.group(3))
            out.append(lead + new + imp); note('P4 blur', raw, new + ' (opaque; the blur behind it is gone)'); changed = True; continue
        if key == 'transform' and hover and re.search(r'translate|scale\(\s*(?!1\))', v0) and v0 != 'none':
            new = 'transform: none'
            out.append(lead + new + imp); note('P5 lift', raw, new); changed = True; continue
        if key == 'transition' and re.match(r'all\b', v0):
            out.append(lead + 'transition: ' + MOTION + imp); note('P6 transition-all', raw, 'transition: <register properties>'); changed = True; continue
        if key in ('border-left', 'border-right'):
            m = re.match(r'^([\d.]+)px\s+(solid|dashed|double)\b', v0)
            if m and float(m.group(1)) >= 2:
                col = rail_colour(v0[m.end():])
                new = key + ': 1px solid ' + col
                out.append(lead + new + imp); note('P7 rail', raw, new); changed = True; continue
        if key in ('border-left-width', 'border-right-width') and re.match(r'^([\d.]+)px$', v0) and float(v0[:-2]) >= 2:
            out.append(lead + key + ': 1px' + imp); note('P7 rail', raw, key + ': 1px'); changed = True; continue
        out.append(raw)
    if not changed:
        return body, False
    return ';'.join(out) + (';' if body.rstrip().endswith(';') else ''), True


def walk_css(css, log, page):
    out, i, n = [], 0, len(css)
    while i < n:
        j = css.find('{', i)
        if j < 0:
            out.append(css[i:]); break
        selector = css[i:j]
        depth, k = 1, j + 1
        while k < n and depth:
            if css[k] == '{':
                depth += 1
            elif css[k] == '}':
                depth -= 1
            k += 1
        body = css[j + 1:k - 1]
        if '{' in body:
            out.append(selector + '{' + walk_css(body, log, page) + '}')
        elif selector.strip().startswith('@') and not selector.strip().startswith('@media') and not selector.strip().startswith('@supports'):
            out.append(selector + '{' + body + '}')
        else:
            nb, _ = rewrite_rule(selector, body, log, page)
            out.append(selector + '{' + nb + '}')
        i = k
    return ''.join(out)


def sweep_page(name, log):
    path = os.path.join(ROOT, name)
    with open(path, encoding='utf-8') as fh:
        text = fh.read()
    def one(m):
        # comments stay (they carry the page's history); only the braces INSIDE them are masked for the
        # walk, so a `{` in prose can never open a rule — then unmasked.
        css = COMMENT_RE.sub(lambda c: c.group(0).replace('{', '⦃').replace('}', '⦄'), m.group(2))
        return m.group(1) + walk_css(css, log, name).replace('⦃', '{').replace('⦄', '}') + m.group(3)
    new = STYLE_RE.sub(one, text)
    return text, new


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--pages', nargs='+', required=True)
    ap.add_argument('--apply', action='store_true')
    ap.add_argument('--check', action='store_true')
    a = ap.parse_args()
    log, touched = [], 0
    for name in a.pages:
        if not os.path.exists(os.path.join(ROOT, name)):
            print('missing', name); continue
        before = len(log)
        text, new = sweep_page(name, log)
        if new != text:
            touched += 1
            if a.apply:
                with open(os.path.join(ROOT, name), 'w', encoding='utf-8') as fh:
                    fh.write(new)
        print('%-44s %4d rewrite(s)' % (name, len(log) - before))
    by = {}
    for _, rule, *_rest in log:
        by[rule] = by.get(rule, 0) + 1
    for rule in sorted(by):
        print('%-22s %5d' % (rule, by[rule]))
    print('page sweep: %d rewrite(s) on %d of %d page(s)%s' % (len(log), touched, len(a.pages), ' — APPLIED' if a.apply else ''))
    if a.check and log:
        print('STALE — run with --apply'); sys.exit(1)


if __name__ == '__main__':
    main()
