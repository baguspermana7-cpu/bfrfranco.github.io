"""The "explorer" kind of the tool-shell refit: hubs, comparisons, maps and concept briefs that have no inputs, toolbar or
results panel (plan dc-hub-tools-refit.md, release R1). The shell parts are shared with the calculators
(shell.HUB nav, shell.hub_footer(), shell.asset_token()); what differs per page is the <main> body, which each page
config builds from its own original markup (tools/refit_shell/explorer_pages.py) so copy is carried over, not retyped.

Steps, in order:
  head    <html data-theme="dark" data-rz-register="tool">; page <style> blocks, styles.min.css and
          css/rz-article-dark.css go; one Plex Sans + JetBrains Mono request; Font Awesome kept (the hub nav uses it);
          css/rz-hub.css + css/rz-tool.css + css/rz-explorer.css with cache tokens; the theme pre-paint script
  body    <body class="hub tool [extra]" data-rz-page="<key>">, one skip link, the hub nav verbatim
  main    cfg['main'](src) -> the new <main id="main-content"> (header.tool-head, numbered sections, .tool-ref)
  foot    the hub footer verbatim, the hub theme/search script, then cfg['scripts'](src): the page's own scripts kept

Everything else in the old body (page nav, hero, footer-enhanced, manual-link chip, scroll-top button, page theme and
hamburger scripts) is not carried over. Idempotent: refit-tool-shell.py returns a page whose <body> already opens with
class="hub tool" unchanged.
"""
import re

from . import shell

FONTS = ('<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700'
         '&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">')
FA = ('<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" '
      'integrity="sha384-t1nt8BQoYMLFN5p42tRAtuAAFQaCQODekUVeKKZrEnEyp4H2R0RHFz0KWpmj7i8g" crossorigin="anonymous">')
THEME_INIT = ("<script>(function(){try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark')"
              "document.documentElement.setAttribute('data-theme',t);}catch(e){}})();</script>")
THEME_SCRIPT = '''<script>
(function(){
  var t=document.getElementById('themeToggle');
  function paint(){var d=document.documentElement.getAttribute('data-theme')==='dark';var i=t&&t.querySelector('i');if(i)i.className=d?'fas fa-sun':'fas fa-moon';var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content',d?'#0b0c0e':'#F5F7FA');}
  if(t){t.addEventListener('click',function(){var d=document.documentElement.getAttribute('data-theme')==='dark';var n=d?'light':'dark';document.documentElement.setAttribute('data-theme',n);try{localStorage.setItem('theme',n);}catch(e){}paint();});paint();}
  var s=document.getElementById('navSearchBtn');if(s)s.addEventListener('click',function(){if(window.__rzPalette&&window.__rzPalette.open)window.__rzPalette.open();});
})();
</script>'''


def hub_nav():
    a = shell.HUB.index('<nav class="navbar hub-nav"')
    return shell.HUB[a:shell.HUB.index('</nav>', a) + 6]


# ---------------------------------------------------------------- content helpers (used by the page configs)

def clean(html):
    """inline styles (display:none survives), Font Awesome / emoji decoration, page-only classes on links"""
    html = re.sub(r'\s+style="([^"]*)"', shell.strip_inline, html)
    html = re.sub(r'<i class="fa[a-z]? fa-[^"]*"[^>]*></i>\s*(?:&nbsp;)?\s*', '', html)
    html = html.replace('🔒 ', '')
    return re.sub(r'[ \t]+\n', '\n', html)


def text(html):
    return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', html)).strip()


def tool_head(eyebrow, h1, lede, basis, crumb):
    return '''<header class="tool-head">
  <div class="wrap">
    <p class="eyebrow">%s</p>
    <h1>%s</h1>
    <p class="lede">%s</p>
    <p class="basis">%s</p>
    <p class="crumb">%s</p>
  </div>
</header>''' % (eyebrow, h1, lede, basis, crumb)


def section(n, sid, title, inner, lead=None):
    return '''
<section class="ck-sec" id="%s">
  <h2><span class="n">%02d</span> %s</h2>
%s%s
</section>''' % (sid, n, title, ('  <p class="lead">%s</p>\n' % lead) if lead else '', inner)


def table(headers, rows, cls=''):
    head = ''.join('<th scope="col">%s</th>' % h for h in headers)
    body = '\n'.join('      <tr>%s</tr>' % ''.join('<td>%s</td>' % c for c in r) for r in rows)
    return ('  <div class="ck-tbl-wrap"><table class="ck-tbl%s">\n    <thead><tr>%s</tr></thead>\n    <tbody>\n%s\n    </tbody>\n'
            '  </table></div>') % ((' ' + cls) if cls else '', head, body)


def reference(n, links, notice=None, against=None):
    """.tool-ref: what the page is computed / written against, where to read further, one notice"""
    return '''
<section class="tool-ref" aria-labelledby="ref-h">
  <div class="wrap">
    <p class="eyebrow" id="ref-h">%02d / Reference</p>
%s    <h3>Read further</h3>
    <p class="links">%s</p>
%s  </div>
</section>''' % (n, ('    <h3>Written against</h3>\n    <p class="against">%s</p>\n' % ''.join('<span>%s</span>' % a for a in against)) if against else '',
                 ''.join('<a href="%s">%s</a>' % l for l in links),
                 ('    <p class="notice">%s</p>\n' % notice) if notice else '')


def manual_href(src):
    m = re.search(r'<div class="rz-manual-link".*?<a href="([^"]+)"', src, flags=re.S)
    return m.group(1) if m else None


def keep_scripts(src, *patterns):
    """the page's own <script> tags matching each pattern, in page order, verbatim"""
    out = []
    for m in re.finditer(r'<script\b[^>]*>[\s\S]*?</script>', src):
        tag = m.group(0)
        if any(re.search(p, tag) for p in patterns):
            out.append(tag)
    return '\n'.join(out)


# ---------------------------------------------------------------- pipeline

def step_head(src, cfg):
    end = src.index('</head>')
    head = src[:end]
    head = re.sub(r'<html\b[^>]*>', '<html lang="en" data-theme="dark" data-rz-register="tool">', head, count=1)
    head = re.sub(r'\s*<style\b[^>]*>.*?</style>', '', head, flags=re.S)
    head = re.sub(r'\s*<link rel="stylesheet" href="(?:styles\.min\.css|css/rz-article-dark\.css)[^>]*>', '', head)
    gf = r'<link\b[^>]*href="https://fonts\.googleapis\.com/css2\?[^"]*"[^>]*>'
    head, n = re.subn(gf + r'(?:<noscript>.*?</noscript>)?', lambda _: FONTS, head, count=1, flags=re.S)
    head = head[:head.index(FONTS) + len(FONTS)] + re.sub(r'\s*' + gf, '', head[head.index(FONTS) + len(FONTS):]) if n else head
    if not n:
        head += '    ' + FONTS + '\n'
    head = re.sub(r'<meta name="theme-color" content="#[0-9a-fA-F]{3,6}">', '<meta name="theme-color" content="#0b0c0e">', head)
    for pat in cfg.get('head_drop', ()):
        head = re.sub(pat, '', head, flags=re.S)
    for tag in cfg.get('head_add', ()):
        head += '    ' + tag + '\n'
    if 'font-awesome' not in head:
        head += '    ' + FA + '\n'
    head = head.rstrip() + '\n'
    head += ''.join('    <link rel="stylesheet" href="%s?v=%s">\n' % (c, shell.asset_token(c))
                    for c in ('css/rz-hub.css', 'css/rz-tool.css', 'css/rz-explorer.css'))
    return head + '    ' + THEME_INIT + '\n'


def refit(src, cfg):
    head = step_head(src, cfg)
    body_cls = ' '.join(['hub', 'tool'] + cfg.get('body_extra', []))
    main = cfg['main'](src)
    scripts = cfg['scripts'](src) if cfg.get('scripts') else ''
    out = (head + '</head>\n<body class="%s" data-rz-page="%s">\n    <a href="#main-content" class="skip-link">Skip to content</a>\n\n'
           % (body_cls, cfg['key']) + hub_nav() + '\n\n' + main.strip() + '\n\n' + shell.hub_footer() + '\n\n'
           + THEME_SCRIPT + ('\n' + scripts if scripts else '') + '\n</body>\n</html>\n')
    assert out.count('<main') == 1 and 'id="main-content"' in out, 'explorer: one <main id="main-content">'
    return out
