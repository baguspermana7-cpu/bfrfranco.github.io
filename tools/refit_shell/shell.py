"""Shared steps of the tool-shell refit (plan Phase 2, steps 1-8). Page specifics live in one module per page
(pue.py, capex.py) as a config dict plus small hook functions; refit() runs the steps in a fixed order.

Hooks a page config may carry (all optional except where noted):
  toolbar(s, cfg)      -> s   step 4: build the .tool-bar (required)
  pre_clean(main, cfg) -> main  runs on the <main> markup BEFORE icons / inline styles are stripped
  results(main, cfg)   -> main  step 5: results markup, AFTER the strip (required)
  js(s, cfg)           -> s   inline-JS edits (colours the page wrote into the DOM, templates)
  post(s)              -> s   last page step before the PDF ink and series palette
Plain keys: eyebrow h1 lede basis crumb manual formulas against links full_title full_desc (head, .tool-full, .tool-ref),
  keep_register (keep html[data-rz-register="tool"]: the page is still on tools/apply-tool-register.py's list),
  head_drop (regexes removed from <head>), hero_drop (regexes removed after the hero), shell (str replacements, once each),
  fig_start (FIG. numbers already used inside the results), series_primary (hex that becomes the amber series).
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
HUB = (ROOT / 'datacenter-solutions.html').read_text(encoding='utf-8')


def balanced(s, start, tag='div'):
    """index just past the closing tag that balances the opening <tag at s[start]"""
    depth, i = 0, start
    pat = re.compile(r'<(/?)%s\b[^>]*?(/?)>' % tag, re.I)
    for m in pat.finditer(s, start):
        if m.group(2) == '/':
            continue
        depth += -1 if m.group(1) else 1
        if depth == 0:
            return m.end()
    raise ValueError('unbalanced <%s> at %d' % (tag, start))


def cut_block(s, anchor, tag='div'):
    """(start, end) of the element that opens at the first `anchor` (an exact substring starting with '<tag')"""
    a = s.index(anchor)
    return a, balanced(s, a, tag)


def strip_inline(m):
    keep = [d.strip() for d in m.group(1).split(';') if re.match(r'\s*display\s*:\s*none', d)]
    return ' style="%s"' % (';'.join(keep) + ';') if keep else ''


def hub_nav():
    a = HUB.index('<nav class="navbar hub-nav"')
    nav = HUB[a:HUB.index('</nav>', a) + 6]
    auth = '''      <div class="nav-auth-wrap" id="navAuthWrap">
        <button class="nav-login-btn" id="navLoginBtn" onclick="handlePremiumTab()"><span class="nav-login-text">Login</span></button>
        <button class="nav-user-btn" id="navUserBtn" style="display:none;" onclick="toggleUserDropdown()"><span class="nav-user-avatar" id="navUserAvatar">U</span><span class="nav-user-email" id="navUserEmail"></span></button>
        <div class="nav-user-dropdown" id="navUserDropdown">
          <div class="nav-dd-header"><div class="nav-dd-tier-badge pro" id="navDdTierBadge">FULL</div><div class="nav-dd-email" id="navDdEmail"></div></div>
          <a class="nav-dd-link" href="account.html">My account and saved scenarios</a>
          <button class="nav-dd-logout" onclick="logoutPremium()">Logout</button>
        </div>
      </div>
'''
    theme = '<button class="nav-icon theme-toggle" id="navThemeBtn" onclick="toggleCalcTheme()" aria-label="Toggle dark mode" title="Toggle dark/light mode"><i id="themeIcon" class="fas fa-moon"></i></button>'
    nav = re.sub(r'<button class="nav-icon theme-toggle" id="themeToggle".*?</button>', lambda _: auth + '    ' + theme, nav, flags=re.S)
    assert 'navAuthWrap' in nav
    return nav


def hub_footer():
    c = HUB.index('<footer class="hub-foot">')
    return HUB[c:HUB.index('</footer>', c) + 9]


# ---------------------------------------------------------------- steps

def step_head(s, cfg, noindex):
    """1 head: drop styles.min.css and every page <style>, load rz-hub.css + rz-tool.css, drop the register attribute
    (unless the page is still listed for the register: keep_register)"""
    head_end = s.index('</head>')
    head, body = s[:head_end], s[head_end:]
    if not cfg.get('keep_register'):
        head = head.replace(' data-rz-register="tool"', '', 1)
    head = re.sub(r'\s*<link rel="stylesheet" href="styles\.min\.css[^>]*>', '', head)
    head = re.sub(r'\s*<link rel="stylesheet" href="css/rz-tool\.css[^>]*>', '', head)
    head = re.sub(r'\s*<style\b[^>]*>.*?</style>', '', head, flags=re.S)
    for pat in cfg.get('head_drop', ()):
        head = re.sub(pat, '', head, flags=re.S)
    head += '\n    <link rel="stylesheet" href="css/rz-hub.css">\n    <link rel="stylesheet" href="css/rz-tool.css">\n'
    if noindex:
        head = re.sub(r'<meta name="robots" content="[^"]*">', '<meta name="robots" content="noindex, nofollow">', head)
    desc = re.search(r'<meta name="description" content="([^"]*)"', head).group(1)
    return head + body, desc


def step_body_open(s):
    s = re.sub(r'<body data-rz-calc="([a-z0-9-]+)">', r'<body class="hub tool" data-rz-calc="\1" data-rz-account-pill="off">', s, count=1)
    return s.replace('<div class="page-background"></div>', '')


def step_disclaimers(s, markers=('<!-- Independence Disclaimer -->', '<!-- Calculator Disclaimer -->')):
    """the disclaimers become .notice paragraphs in .tool-ref; taken from the ORIGINAL markup before any style is stripped"""
    notes = []
    for marker in markers:
        a = s.index(marker)
        b = s.index('<div', a)
        e = balanced(s, b)
        block = s[b:e]
        for p in re.findall(r'<p\b[^>]*>(.*?)</p>', block, flags=re.S):
            p = re.sub(r'\s*style="[^"]*"', '', p).strip()
            if p:
                notes.append(p)
        s = s[:a] + s[e:]
    return s, notes


def step_chrome(s):
    """7 footer + manual link + scroll-top + fab + hero-fit"""
    s = re.sub(r'<!-- Footer -->.*?</footer>', '', s, flags=re.S)
    s = re.sub(r'<!-- Scroll to Top -->\s*<button class="scroll-top-btn".*?</button>', '', s, flags=re.S)
    s = re.sub(r'\s*<script src="js/rz-manual-fab\.js[^>]*></script>', '', s)
    return re.sub(r'\s*<script src="js/rz-hero-fit\.js[^>]*></script>', '', s)


def step_nav(s):
    """2 nav: hub nav, auth ids kept"""
    return re.sub(r'<!-- Navigation -->\s*<nav class="navbar">.*?</nav>', lambda _: hub_nav(), s, count=1, flags=re.S)


def step_hero(s, cfg, desc):
    """3 hero -> header.tool-head (hero image, badge, explainer, chips go; hero_drop removes what follows the hero)"""
    head_html = '''<header class="tool-head">
            <div class="wrap">
                <p class="eyebrow">%s</p>
                <h1>%s</h1>
                <p class="lede">%s</p>
                <p class="basis">%s</p>
                <p class="crumb">%s</p>
            </div>
        </header>''' % (cfg['eyebrow'], cfg['h1'], cfg.get('lede', desc), cfg['basis'], cfg['crumb'])
    s = re.sub(r'<!-- Hero -->\s*<section class="hero">.*?</section>', lambda _: head_html, s, count=1, flags=re.S)
    for pat in cfg.get('hero_drop', ()):
        s, n = re.subn(pat, '', s, count=1, flags=re.S)
        assert n == 1, 'hero_drop did not match: ' + pat[:60]
    return s


def step_shell(s, cfg):
    for old, new in cfg.get('shell', ()):
        assert old in s, 'shell anchor missing: ' + old
        s = s.replace(old, new, 1)
    return s


def step_tool_full(s, cfg):
    """6 pro: .pro-overlay becomes a .tool-full row (before the global style strip so the overlay text is intact)"""
    def tool_full(m):
        title = cfg.get('full_title') or re.sub(r'<[^>]+>', '', m.group(1)).strip()
        desc_ = cfg.get('full_desc') or re.sub(r'<[^>]+>', '', m.group(2) or '').strip()
        return ('<div class="pro-overlay tool-full" onclick="handlePremiumTab()"><p><b>%s</b>%s</p>'
                '<button class="pro-overlay-btn">Sign in</button></div>') % (title, (' — ' + desc_) if desc_ else '')
    s = re.sub(r'<div class="pro-overlay" onclick="handlePremiumTab\(\)">\s*(?:<i[^>]*></i>\s*)?<div class="pro-overlay-title">(.*?)</div>'
               r'(?:\s*<div class="pro-overlay-desc">(.*?)</div>)?\s*<button class="pro-overlay-btn">.*?</button>\s*</div>', tool_full, s, flags=re.S)
    return re.sub(r'\s*<span class="pro-badge">.*?</span>', '', s, flags=re.S)


def step_main_clean(main):
    """main region: page <style> blocks, icons and inline styles go (display:none survives)"""
    main = re.sub(r'\s*<style\b[^>]*>.*?</style>', '', main, flags=re.S)
    main = re.sub(r'<div class="section-icon"[^>]*>\s*<i[^>]*></i>\s*</div>', '', main)
    main = re.sub(r'<i class="fas?s? [^"]*"[^>]*></i>\s*', '', main)
    main = re.sub(r'<i class="fa[a-z]? fa-[^"]*"[^>]*></i>\s*', '', main)
    return re.sub(r'\s+style="([^"]*)"', strip_inline, main)


def step_figs(main, cfg):
    """charts -> .fig with a mono FIG. n caption"""
    n = [cfg.get('fig_start', 0)]

    def fig(m):
        n[0] += 1
        title = re.sub(r'<[^>]+>', '', m.group(1)).strip()
        return ('<figure class="fig chart-card">%s<figcaption><b>FIG. %d</b> %s · computed from the inputs above</figcaption></figure>'
                % (m.group(2), n[0], title))
    return re.sub(r'<div class="chart-card">\s*<div class="chart-title">(.*?)</div>\s*(<div class="chart-container"><canvas id="[^"]+"></canvas></div>)\s*</div>', fig, main, flags=re.S)


def ref_section(cfg, notes):
    """.tool-ref: method (formulas), computed against, read further, the disclaimers as notices"""
    manual_href, manual_text = cfg['manual']
    return '''
        <section class="tool-ref" aria-labelledby="ref-h">
            <div class="wrap">
                <p class="eyebrow" id="ref-h">02 / Reference</p>
                <div class="ref-grid">
                    <div>
                        <h3>Method</h3>
                        <ul class="formulas">
%s
                        </ul>
                    </div>
                    <div>
                        <h3>Computed against</h3>
                        <p class="against">%s</p>
                        <h3>Read further</h3>
                        <p class="links"><a href="%s">%s</a>%s</p>
                    </div>
                </div>
%s
            </div>
        </section>
''' % ('\n'.join('                            <li><span>%s</span><code>%s</code></li>' % f for f in cfg['formulas']),
       ''.join('<span>%s</span>' % a for a in cfg['against']),
       manual_href, manual_text, ''.join('<a href="%s">%s</a>' % l for l in cfg['links']),
       merge_notices(notes))


def merge_notices(notes):
    """the template's five disclaimer boxes repeat each other; one notice keeps every distinct sentence once.
    The 'methodology sources' box is dropped: COMPUTED AGAINST already lists the same sources."""
    seen, out = set(), []
    for n in notes:
        if 'methodology sources' in n.lower():
            continue
        for sent in re.split(r'(?<=\.)\s+(?=[A-Z<])', n):
            key = re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', sent)).strip().lower()
            if re.fullmatch(r'\s*<a\b[^>]*>[^<]*</a>\s*', sent):
                continue  # a bare link between sentences; the Terms link is kept in its own sentence
            if key and not any(k.startswith(key.rstrip('.')) for k in seen):
                seen.add(key)
                out.append(sent.strip())
    return '                <p class="notice">%s</p>' % ' '.join(out)


PDF_INK = {'#06b6d4': '#8A5A00', '#1e3a5f': '#111827', '#ecfeff': '#F7F4EC', '#10b981': '#374151', '#3b82f6': '#4B5563', '#f97316': '#6B7280'}


def pdf_palette(s, ink=PDF_INK):
    """The PDF export is a sheet of paper: dark amber rules + graphite ink, no cyan rails or navy headings.
    On-page result strings that colour a figure green ('savings') take the text colour; the figure carries the meaning."""
    a = s.find('function exportPDF')
    if a >= 0:
        e = s.find('\n    function ', a + 20)
        e = len(s) if e < 0 else e
        blk = s[a:e]
        for k, v in ink.items():
            blk = re.sub(re.escape(k), v, blk, flags=re.I)
        s = s[:a] + blk + s[e:]
    return re.sub(r'color:#10b981', 'color:var(--rzt-text)', s, flags=re.I)


SERIES_AMBER = '#D49A2A'   # reads on both themes (hue 38, inside the T19 amber band)
SERIES_GREYS = ['#A0AEC0', '#7D8794', '#5E6673', '#C9CFD8', '#4A5160', '#8C96A3']


def _hue_sat(hexv):
    r, g, b = (int(hexv[i:i + 2], 16) / 255 for i in (0, 2, 4))
    mx, mn = max(r, g, b), min(r, g, b)
    l = (mx + mn) / 2
    if mx == mn:
        return 0.0, 0.0
    d = mx - mn
    sat = d / (2 - mx - mn) if l > .5 else d / (mx + mn)
    h = ((g - b) / d + (6 if g < b else 0)) if mx == r else ((b - r) / d + 2) if mx == g else ((r - g) / d + 4)
    return h * 60, sat


def series_palette(s, primary='06b6d4'):
    """Step 8: chart series in the page's inline JS go amber (the page's primary series) + a grey ramp.
    Red stays (state colour); greys stay. Same input -> same output (ramp assigned in order of first appearance)."""
    assigned, ramp = {primary.lower(): SERIES_AMBER}, iter(SERIES_GREYS * 4)

    def recolor(js):
        def one(m):
            hv = m.group(2).lower()
            h, sat = _hue_sat(hv)
            if sat < 0.30 or h < 15 or h >= 340:
                return m.group(0)
            if hv not in assigned:
                assigned[hv] = next(ramp)
            return m.group(1) + assigned[hv] + m.group(1)
        js = re.sub(r"(['\"])#([0-9a-fA-F]{6})\1", one, js)
        return js.replace('rgba(6,182,212,', 'rgba(212,154,42,').replace('rgba(6, 182, 212,', 'rgba(212, 154, 42,')

    def block(m):
        if 'application/ld+json' in m.group(1) or 'src=' in m.group(1):
            return m.group(0)
        return '<script' + m.group(1) + '>' + recolor(m.group(2)) + '</script>'
    s = re.sub(r'<script\b([^>]*)>([\s\S]*?)</script>', block, s)
    return re.sub(r'<meta name="theme-color" content="#[0-9a-fA-F]{6}">', '<meta name="theme-color" content="#0b0c0e">', s)


def js_replace(s, pairs, where=None):
    """exact replacements in the page's inline JS; every old string must be present (a stale page fails loudly)"""
    for old, new in pairs:
        assert old in s, 'js anchor missing: ' + old[:80]
        s = s.replace(old, new) if where == 'all' else s.replace(old, new, 1)
    return s


def js_swap_between(s, start, end, new, include_end=False):
    """replace s[start .. end) (both exact substrings, end searched after start) with new"""
    a = s.index(start)
    b = s.index(end, a + len(start))
    if include_end:
        b += len(end)
    return s[:a] + new + s[b:]


# ---------------------------------------------------------------- pipeline

def refit(src, cfg, noindex):
    s, desc = step_head(src, cfg, noindex)
    s = step_body_open(s)
    s, notes = step_disclaimers(s)
    s = step_chrome(s)
    s = step_nav(s)
    s = step_hero(s, cfg, desc)
    s = cfg['toolbar'](s, cfg)
    s = step_shell(s, cfg)
    s = step_tool_full(s, cfg)

    m0, m1 = s.index('<main'), s.index('</main>')
    main = s[m0:m1]
    if cfg.get('pre_clean'):
        main = cfg['pre_clean'](main, cfg)
    main = step_main_clean(main)
    main = cfg['results'](main, cfg)
    main = step_figs(main, cfg)
    s = s[:m0] + main + ref_section(cfg, notes) + s[m1:]
    s = s.replace('</main>', '</main>\n' + hub_footer(), 1)

    if cfg.get('js'):
        s = cfg['js'](s, cfg)
    if cfg.get('post'):
        s = cfg['post'](s)
    return series_palette(pdf_palette(s, cfg.get('pdf_ink', PDF_INK)), cfg.get('series_primary', '06b6d4'))
