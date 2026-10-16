#!/usr/bin/env python3
"""sweep-journal-register.py — rewrite the per-page inline CSS of the journal family onto the
editorial register (ANTI_VIBECODE §A27–34, owner 2026-10-16: "audit total dan fix properly,
jangan sepotong-sepotong").

Every article page carries 500–1,500 lines of bespoke <style>. The register
(css/rz-article-dark.css) already neutralises most of it, but five families of slop sit in
literals the register cannot reach by selector. This tool rewrites them in place, page by page,
inside <style> blocks only (never JS strings, never the article text):

  R1 navy-cast background    hue 200–250°, s ≥ .25, l ≤ .20 (hex or rgb) in a background /
                             background-color declaration, or a gradient with such a stop
                             → background: var(--rz-art-panel)  (l > .09) / var(--rz-art-bg)
  R2 neon green              hue 95–170°, s ≥ .9, l .40–.65 anywhere
                             → var(--rz-art-accent) (colour/border) · var(--rz-art-panel) (background)
  R3 hover lift              transform: translateY(-N…) inside a :hover rule → declaration removed
  R4 gradient text           background-clip:text + text-fill-color:transparent + gradient
                             → the three removed, color: var(--rz-art-strong)
  R5 transition: all         → the four properties the register animates, on the motion tokens
  R6 blur                    filter: blur(≥20px) and any backdrop-filter → removed (orbs, glass)
  R7 per-page accent         <html style="--rz-art-accent:…"> → attribute removed (one accent)

The bands are the ones tools/audit-vibecode.mjs matches by hue, never a list of hex strings
(banning `#8b5cf6` by string once left 1,238 same-hue literals live). The tool is idempotent:
a second run rewrites nothing, which is what --check asserts.

Run:  python3 tools/sweep-journal-register.py            (dry run: counts per page and rule)
      python3 tools/sweep-journal-register.py --apply    (rewrite; also writes the report)
      python3 tools/sweep-journal-register.py --check    (exit 1 if anything would change)
      --report PATH   where the before→after log goes (default standarization/Audit result/journal-sweep.md)
      --pages a.html b.html   limit the scope
"""
import argparse
import colorsys
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPORT_DEFAULT = os.path.join(ROOT, 'standarization', 'Audit result', 'journal-sweep.md')
MOTION = 'color var(--rz-dur-tip,160ms) var(--rz-ease-out,ease),background-color var(--rz-dur-tip,160ms) var(--rz-ease-out,ease),border-color var(--rz-dur-tip,160ms) var(--rz-ease-out,ease),opacity var(--rz-dur-tip,160ms) var(--rz-ease-out,ease)'

HEX_RE = re.compile(r'#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b')
RGB_RE = re.compile(r'rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*[\d.]+\s*)?\)')


def family():
    out = []
    for name in sorted(os.listdir(ROOT)):
        if not name.endswith('.html') or name.startswith('plan-') or name == 'changelog.html':
            continue
        with open(os.path.join(ROOT, name), encoding='utf-8', errors='replace') as fh:
            head = fh.read(20000)
        if 'css/rz-article-dark.css' in head:
            out.append(name)
    return out


def hsl_of(tok):
    m = RGB_RE.match(tok)
    if m:
        r, g, b = (int(m.group(i)) / 255 for i in (1, 2, 3))
    else:
        h = tok[1:]
        if len(h) in (3, 4):
            h = ''.join(c + c for c in h)
        r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    hh, ll, ss = colorsys.rgb_to_hls(r, g, b)
    return hh * 360, ss, ll


def navy(tok):
    h, s, l = hsl_of(tok)
    return 200 <= h <= 250 and s >= .25 and l <= .20


def neon(tok):
    h, s, l = hsl_of(tok)
    return 95 <= h <= 170 and s >= .9 and .40 <= l <= .65


def colours(value):
    """every colour literal in a declaration value, with its span"""
    return [(m.start(), m.end(), m.group(0)) for m in re.finditer(r'rgba?\([^)]*\)|#[0-9a-fA-F]{3,8}\b', value)
            if HEX_RE.fullmatch(m.group(0)) or RGB_RE.match(m.group(0))]


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


def rewrite_rule(selector, body, log, page):
    decls = split_decls(body)
    hover = ':hover' in selector
    props = {}
    parsed = []
    for d in decls:
        if ':' not in d:
            parsed.append((None, d, d))
            continue
        name, _, value = d.partition(':')
        key = name.strip().lower()
        parsed.append((key, value, d))
        props[key] = value
    gradient_text = ('-webkit-background-clip' in props and 'text' in props.get('-webkit-background-clip', '')) or \
                    ('background-clip' in props and 'text' in props.get('background-clip', ''))
    gradient_text = gradient_text and 'transparent' in (props.get('-webkit-text-fill-color', '') + props.get('color', ''))
    out = []
    changed = False

    def note(rule, before, after):
        log.append((page, rule, selector.strip()[:80], before.strip()[:90], after.strip()[:90]))

    for key, value, raw in parsed:
        if key is None:
            out.append(raw)
            continue
        lead = raw[:len(raw) - len(raw.lstrip())]
        v = value.strip()
        imp = ' !important' if v.endswith('!important') else ''
        v0 = v[:-len('!important')].rstrip() if imp else v
        if gradient_text and key in ('-webkit-background-clip', 'background-clip', '-webkit-text-fill-color', 'background', 'background-image'):
            if key in ('background', 'background-image'):
                # a flat colour clipped to text was coloured text: keep it coloured, in the accent;
                # a gradient clipped to text becomes the heading colour
                flat = 'gradient(' not in v0
                themed = '[data-theme' in selector or re.search(r'article-title|article-hero|highlight|\bh1\b', selector)
                # a theme-scoped rule or the page's own hero text follows the tokens; an unscoped rule
                # inside an embedded panel (dark in both themes) gets the dark-surface literals, or the
                # a11y gate reads #1a1d23 on #0e0f12 in light mode (article-13 .calculator-title)
                new = ('color: var(--rz-art-accent)' if flat else 'color: var(--rz-art-strong)') if themed else ('color: #E8B563' if flat else 'color: #F6F7F9')
                out.append(lead + new + imp)
                note('R4 gradient-text', raw, new)
            else:
                note('R4 gradient-text', raw, '(removed)')
            changed = True
            continue
        if key == 'transform' and hover and re.search(r'translate(?:Y|3d)?\(\s*-\d', v0):
            note('R3 hover-lift', raw, '(removed)')
            changed = True
            continue
        if key == 'transition' and re.match(r'all\b', v0):
            out.append(lead + 'transition: ' + MOTION + imp)
            note('R5 transition-all', raw, 'transition: <register properties>')
            changed = True
            continue
        if key == 'filter' and re.search(r'blur\(\s*(\d+)px', v0) and int(re.search(r'blur\(\s*(\d+)px', v0).group(1)) >= 20:
            note('R6 blur', raw, '(removed)')
            changed = True
            continue
        if key in ('backdrop-filter', '-webkit-backdrop-filter'):
            note('R6 blur', raw, '(removed)')
            changed = True
            continue
        if key == 'font-family' and re.search(r'\b(Fraunces|Playfair|Newsreader|Instrument Serif|Cormorant|Lora|Merriweather|DM Serif)\b', v0):
            out.append(lead + 'font-family: var(--rz-art-sans)' + imp)
            note('R8 serif-face', raw, 'font-family: var(--rz-art-sans)')
            changed = True
            continue
        cols = colours(v0)
        if cols and key in ('background', 'background-color') and '[data-theme' not in selector and 'color' not in props \
                and 'gradient(' not in v0 and all(darkbg(c[2]) and not navy(c[2]) for c in cols) and not re.search(r'rgba?\(', v0):
            out.append(lead + 'color: #CFD3DA')
            out.append(lead + raw.strip())
            note('R13 dark-container-text', raw, 'color: #CFD3DA (light text on the dark container)')
            changed = True
            continue
        if cols and key.startswith('--') and 'bg' in key and any(navy(c[2]) for c in cols):
            # a page token holding a navy surface (--bg-dark: #0f172a) feeds every background that reads it
            darkest = min((hsl_of(c[2])[2] for c in cols if navy(c[2])))
            new = 'var(--rz-art-bg)' if darkest <= .12 else 'var(--rz-art-panel)'
            out.append(lead + key + ': ' + new + imp)
            note('R1 navy-background', raw, key + ': ' + new)
            changed = True
            continue
        if key == 'color' and cols and '[data-theme' not in selector:
            bg = props.get('background', props.get('background-color', ''))
            on_dark = re.search(r'rgba\(\s*255\s*,\s*255\s*,\s*255\s*,', bg) or any(navy(c[2]) for c in colours(bg)) or re.search(r'#(0e0f12|121316)\b', bg, re.I)
            h, s_, l = hsl_of(cols[0][2])
            last = selector.strip().split(',')[-1].strip().split()[-1] if selector.strip() else ''
            under_dark = any(('.' + c) in selector.rsplit(' ', 1)[0] for c in DARK_CTX) if ' ' in selector.strip() else False
            under_dark = under_dark or any(('.' + c) == last or ('.' + c + ':') in last or ('.' + c + '.') in last for c in DESC_CTX)
            if (on_dark or under_dark) and s_ < .35 and .35 <= l <= .58:
                # slate grey (#64748b) on a dark surface reads 3.7:1; the register's muted grey reads 5.1:1
                out.append(lead + 'color: #9aa3ad' + imp)
                note('R12 grey-on-dark', raw, 'color: #9aa3ad')
                changed = True
                continue
        if cols:
            is_bg = key in ('background', 'background-color', 'background-image')
            if is_bg and any(navy(c[2]) for c in cols):
                darkest = min((hsl_of(c[2])[2] for c in cols if navy(c[2])))
                # the page canvas (body, the reading column, the hero) takes the base surface;
                # anything else dark enough is the base too, a lighter navy is a panel
                canvas = re.search(r'(^|[\s,>+~])(html|body|main|\.article-body|\.article-content|\.article-hero|\.container)\s*$', selector.strip().split(',')[-1].strip())
                deep = canvas or darkest <= .12
                if '[data-theme' in selector:
                    # a dark-theme rule follows the theme token
                    new = 'var(--rz-art-bg)' if deep else 'var(--rz-art-panel)'
                else:
                    # a rule with no theme scope was dark in BOTH themes: an embedded instrument panel
                    # with light text on it. Keep it dark, in graphite, so the text stays readable in
                    # light mode (the first pass mapped these to the theme token and the runtime then
                    # flattened 90 translucent cards that had lost their dark surface).
                    new = '#0E0F12' if deep else '#121316'
                    if 'color' not in props:
                        out.append(lead + 'color: #CFD3DA')
                        note('R1 navy-background', raw, 'color: #CFD3DA (light text on the dark container)')
                out.append(lead + 'background' + ('-color' if key == 'background-color' else '') + ': ' + new + imp)
                note('R1 navy-background', raw, 'background: ' + new)
                changed = True
                continue
            if any(neon(c[2]) for c in cols):
                nv = v0
                themed = '[data-theme' in selector
                for s, e, tok in reversed(cols):
                    if neon(tok):
                        nv = nv[:s] + (('var(--rz-art-panel)' if themed else '#121316') if is_bg else ('var(--rz-art-accent)' if themed else '#E8B563')) + nv[e:]
                out.append(lead + key + ': ' + nv + imp)
                note('R2 neon-green', raw, key + ': ' + nv)
                changed = True
                continue
        out.append(raw)
    if not changed:
        return body, False
    return ';'.join(out) + (';' if body.rstrip().endswith(';') else ''), True


def walk_css(css, log, page):
    """rewrite every rule in a stylesheet string, recursing into @media / @supports blocks"""
    out, i, n = [], 0, len(css)
    while i < n:
        j = css.find('{', i)
        if j < 0:
            out.append(css[i:])
            break
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
        elif selector.strip().startswith('@'):
            out.append(selector + '{' + body + '}')
        else:
            nb, _ = rewrite_rule(selector, body, log, page)
            out.append(selector + '{' + nb + '}')
        i = k
    return ''.join(out)


STYLE_RE = re.compile(r'(<style[^>]*>)(.*?)(</style>)', re.S)
HTML_STYLE_RE = re.compile(r'(<html\b[^>]*?)\s+style="[^"]*--rz-art-accent[^"]*"([^>]*>)')
FONT_LINK_RE = re.compile(r'(<link[^>]*href="https://fonts\.googleapis\.com/css2\?)([^"]*)(")')
SERIF_FAMILY_RE = re.compile(r'family=(?:Fraunces|Playfair\+Display|Newsreader|Instrument\+Serif|Cormorant[^&"]*|Lora|Merriweather|DM\+Serif[^&"]*)(?::[^&"]*)?&?')
TILE_RE = re.compile(r'class="[^"]*\b(?:stat|stats|metric|kpi|evidence|figure|number)[-_]?(?:item|card|tile|box|block|cell)\b[^"]*"', re.I)
STYLE_ATTR_RE = re.compile(r'(\sstyle=")([^"]*)(")')
TAG_RE = re.compile(r'<(/?)([a-zA-Z][a-zA-Z0-9-]*)([^<>]*?)(/?)>')
VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'}


def fact_lists(text, log, name):
    """R9: a parent holding three or more stat/metric/kpi tiles gets data-rz-fact-list, which the
    register renders as one fact per row (mono number, label, sub-text, hairline) — never a strip of
    tiles. The detector in audit-vibecode then counts only tiles outside such a parent. Scripts and
    styles are skipped; markup is otherwise untouched."""
    stack, parents, i = [], {}, 0
    skip_to = 0
    for m in TAG_RE.finditer(text):
        if m.start() < skip_to:
            continue
        closing, tag, attrs, selfclose = m.group(1), m.group(2).lower(), m.group(3), m.group(4)
        if tag in ('script', 'style') and not closing:
            end = text.find('</' + tag, m.end())
            skip_to = end if end > 0 else len(text)
            continue
        if closing:
            while stack and stack[-1][0] != tag:
                stack.pop()
            if stack:
                stack.pop()
            continue
        if TILE_RE.search(attrs) and stack:
            pid = stack[-1][1]
            parents.setdefault(pid, []).append(m.start())
        if not selfclose and tag not in VOID:
            stack.append((tag, m.start()))
    hits = [(pid, n) for pid, n in parents.items() if len(n) >= 3]
    for pid, n in sorted(hits, reverse=True):
        head = TAG_RE.match(text, pid)
        if not head or 'data-rz-fact-list' in head.group(3):
            continue
        insert = head.start() + 1 + len(head.group(2))
        text = text[:insert] + ' data-rz-fact-list' + text[insert:]
        log.append((name, 'R9 fact-list', '<' + head.group(2) + '>', '%d stat tiles in a strip' % len(n), 'data-rz-fact-list'))
    return text


DARK_CTX = set()
DESC_CTX = set()


def dark_descendants(text):
    """R14: every element whose class is a dark context gets data-rz-dark-panel (the register then keeps
    its headings light in light mode); the classes of everything inside such an element are collected
    so R12 can lift slate-grey text that sits on the dark surface without a background of its own."""
    desc, stack, inserts, edits, skip_to = set(), [], [], [], 0
    for m in TAG_RE.finditer(text):
        if m.start() < skip_to:
            continue
        closing, tag, attrs, selfclose = m.group(1), m.group(2).lower(), m.group(3), m.group(4)
        if tag in ('script', 'style') and not closing:
            end = text.find('</' + tag, m.end())
            skip_to = end if end > 0 else len(text)
            continue
        if closing:
            while stack and stack[-1][0] != tag:
                stack.pop()
            if stack:
                stack.pop()
            continue
        cm = re.search(r'class="([^"]*)"', attrs)
        classes = set(cm.group(1).split()) if cm else set()
        own_dark = bool(classes & DARK_CTX)
        inside = any(s[1] for s in stack)
        if inside or own_dark:
            desc.update(classes)
        if own_dark and 'data-rz-dark-panel' not in attrs:
            inserts.append(m.start() + 1 + len(m.group(2)))
        if inside or own_dark:
            # an inline style="…color:#64748b…" on an element inside a dark panel: R12 by DOM position
            sm = re.search(r'style="([^"]*)"', attrs)
            if sm:
                cm2 = re.search(r'(?<![-a-z])color\s*:\s*(#[0-9a-fA-F]{3,8})\b', sm.group(1))
                if cm2:
                    h, s_, l = hsl_of(cm2.group(1))
                    if s_ < .35 and .35 <= l <= .58:
                        a0 = m.start(3)  # where the attributes begin
                        edits.append((a0 + sm.start(1) + cm2.start(1), a0 + sm.start(1) + cm2.end(1)))
        if not selfclose and tag not in VOID:
            stack.append((tag, own_dark or inside))
    ops = [(pos, 'ins') for pos in inserts] + [(a, 'grey', b) for a, b in edits]
    for op in sorted(ops, key=lambda o: o[0], reverse=True):
        if op[1] == 'ins':
            text = text[:op[0]] + ' data-rz-dark-panel' + text[op[0]:]
        else:
            text = text[:op[0]] + '#9aa3ad' + text[op[2]:]
    return text, desc, len(inserts), len(edits)
RULE_RE = re.compile(r'([^{}]+)\{([^{}]*)\}')


def darkbg(tok):
    return hsl_of(tok)[2] <= .20


def dark_contexts(text):
    """class tokens of rules that were dark in BOTH themes (an unscoped navy background):
    text inside them must stay light, whatever theme variable the page used for it"""
    out = set()
    for m in STYLE_RE.finditer(text):
        for r in RULE_RE.finditer(m.group(2)):
            sel, body = r.group(1), r.group(2)
            if '[data-theme' in sel or '@' in sel:
                continue
            # the register owns the page canvas and the hero (their surfaces follow the theme), so a dark
            # literal on them is not a dark panel: marking the hero made article-13's h1 white on white
            if re.search(r'(^|[\s,>+~])(html|body|main|\.container|\.article-(?:hero|header|body|content|title|wrap|wrapper))\b', sel):
                continue
            for d in re.finditer(r'(?:background(?:-color)?|--[a-z0-9-]*bg[a-z0-9-]*)\s*:\s*([^;]+)', body):
                if any(darkbg(c[2]) for c in colours(d.group(1))):
                    out.update(re.findall(r'\.([A-Za-z0-9_-]+)', sel))
    return out


def sweep_page(name):
    global DARK_CTX
    path = os.path.join(ROOT, name)
    text = open(path, encoding='utf-8').read()
    global DESC_CTX
    DARK_CTX = dark_contexts(text)
    text2, DESC_CTX, marked, greyed = dark_descendants(text)
    log = []
    if marked:
        log.append((name, 'R14 dark-panel', '<markup>', '%d dark container(s)' % marked, 'data-rz-dark-panel'))
    if greyed:
        log.append((name, 'R12 grey-on-dark', '<style attribute>', '%d inline slate-grey text(s) inside a dark panel' % greyed, 'color: #9aa3ad'))
    new = STYLE_RE.sub(lambda m: m.group(1) + walk_css(m.group(2), log, name) + m.group(3), text2)
    if HTML_STYLE_RE.search(new):
        new = HTML_STYLE_RE.sub(r'\1\2', new, count=1)
        log.append((name, 'R7 page-accent', '<html style>', '--rz-art-accent override', '(removed)'))

    def fonts(m):
        q = SERIF_FAMILY_RE.sub('', m.group(2)).rstrip('&')
        if q != m.group(2):
            log.append((name, 'R8 serif-face', '<link fonts>', m.group(2)[:80], q[:80]))
        return m.group(1) + q + m.group(3)
    new = FONT_LINK_RE.sub(fonts, new)
    new = fact_lists(new, log, name)

    # R10: inline style="…" attributes outside <script>/<style> go through the same declaration rules
    def attr(m):
        body, changed = rewrite_rule('style-attribute', m.group(2), log, name)
        return m.group(1) + body + m.group(3) if changed else m.group(0)
    parts, pos = [], 0
    for sm in re.finditer(r'<(script|style)\b[^>]*>[\s\S]*?</\1>', new):
        parts.append(STYLE_ATTR_RE.sub(attr, new[pos:sm.start()]))
        parts.append(sm.group(0))
        pos = sm.end()
    parts.append(STYLE_ATTR_RE.sub(attr, new[pos:]))
    new = ''.join(parts)

    # R11: a navy surface literal inside a JS string (an exported SVG, a print template) becomes the
    # register's graphite literal — a var() cannot resolve in a downloaded file
    def js_navy(m):
        tok = m.group(2)
        if navy(tok):
            log.append((name, 'R11 script-navy', '<script>', m.group(0)[:60], m.group(1) + '#0E0F12'))
            return m.group(1) + '#0E0F12'
        return m.group(0)
    new = re.sub(r'(<script\b[^>]*>)([\s\S]*?)(</script>)',
                 lambda s: s.group(1) + re.sub(r'(background(?:-color)?\s*:\s*)(#[0-9a-fA-F]{3,8})\b', js_navy, s.group(2)) + s.group(3), new)
    return text, new, log


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--apply', action='store_true')
    ap.add_argument('--check', action='store_true')
    ap.add_argument('--report', default=REPORT_DEFAULT)
    ap.add_argument('--pages', nargs='*')
    args = ap.parse_args()
    pages = args.pages or family()
    total, by_rule, changed_pages, full_log = 0, {}, [], []
    for name in pages:
        old, new, log = sweep_page(name)
        if log:
            changed_pages.append(name)
            full_log.extend(log)
            for row in log:
                by_rule[row[1]] = by_rule.get(row[1], 0) + 1
            total += len(log)
            if args.apply:
                open(os.path.join(ROOT, name), 'w', encoding='utf-8').write(new)
    for rule in sorted(by_rule):
        print('%-22s %4d' % (rule, by_rule[rule]))
    print('journal sweep: %d rewrite(s) on %d of %d page(s)%s' % (total, len(changed_pages), len(pages), ' — APPLIED' if args.apply else ''))
    if args.apply and full_log:
        os.makedirs(os.path.dirname(args.report), exist_ok=True)
        with open(args.report, 'w', encoding='utf-8') as fh:
            fh.write('# Journal register sweep — before → after\n\nGenerated by tools/sweep-journal-register.py --apply. One row per rewritten declaration.\n\n| page | rule | selector | before | after |\n|---|---|---|---|---|\n')
            for row in full_log:
                fh.write('| ' + ' | '.join(c.replace('|', '\\|') for c in row) + ' |\n')
        print('report: ' + os.path.relpath(args.report, ROOT))
    if args.check and total:
        print('STALE — run: python3 tools/sweep-journal-register.py --apply')
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
