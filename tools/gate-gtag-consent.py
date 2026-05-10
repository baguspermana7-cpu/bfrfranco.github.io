#!/usr/bin/env python3
"""v1.10.15 — gate gtag behind GDPR cookie consent + interaction defer.

Replaces eager gtag patterns with the index.html deferred pattern that:
1. Queues gtag commands (cheap, no network).
2. Loads the actual GA script only on first user interaction.
3. Respects ga-disable-* flag set by cookie banner on decline.
"""
import re
import glob
from pathlib import Path

ROOT = Path("/home/baguspermana7/rz-work")
GA_ID = "G-GED7FX8RTV"

# The canonical deferred + consent-aware pattern (matches index.html)
NEW_BLOCK = '''<!-- Google tag (gtag.js) - deferred until user interaction + consent-aware -->
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  // Default-deny until consent: respect existing decline + default to deny on first visit
  if (localStorage.getItem('rz_cookie_consent') === 'declined') {
    window['ga-disable-G-GED7FX8RTV'] = true;
  }
  gtag('js', new Date());
  gtag('config', 'G-GED7FX8RTV');
  (function(){
    var loaded=false;
    function loadGtag(){
      if(loaded)return;loaded=true;
      if(window['ga-disable-G-GED7FX8RTV'])return;
      var s=document.createElement('script');
      s.src='https://www.googletagmanager.com/gtag/js?id=G-GED7FX8RTV';
      s.async=true;document.head.appendChild(s);
    }
    ['scroll','click','keydown','touchstart'].forEach(function(e){
      document.addEventListener(e,loadGtag,{once:true,passive:true});
    });
  })();
</script>'''


def fix_page(path: Path) -> bool:
    content = path.read_text(encoding='utf-8')

    # Match the eager gtag block: <script async src="...gtag/js?id=...">...</script><script>...gtag('config'...)...</script>
    # Common patterns:
    pattern = re.compile(
        r'<script\s+async\s+src="https://www\.googletagmanager\.com/gtag/js\?id=' + re.escape(GA_ID) + r'"></script>\s*'
        r'<script>[^<]*gtag\([^)]*\)[^<]*gtag\([^)]*\)[^<]*</script>',
        re.DOTALL
    )
    m = pattern.search(content)
    if not m:
        return False

    # Replace with the deferred consent-aware block
    new_content = content[:m.start()] + NEW_BLOCK + content[m.end():]
    path.write_text(new_content, encoding='utf-8')
    return True


def main():
    pages = sorted(glob.glob(str(ROOT / '*.html')))
    fixed = 0
    for p in pages:
        path = Path(p)
        if fix_page(path):
            fixed += 1
            print(f"[gate] {path.name}: applied deferred + consent-aware gtag pattern")
    print(f"\nDone. {fixed} pages migrated to deferred + consent-aware GA loading.")


if __name__ == '__main__':
    main()
