#!/usr/bin/env python3
"""refit-tool-shell — move a template-family calculator onto the tool shell (css/rz-hub.css + css/rz-tool.css).

usage:
    python3 tools/refit-tool-shell.py --page pue-calculator.html --out pue-calculator1.html [--noindex]   # mockup
    python3 tools/refit-tool-shell.py --page capex-calculator.html                                       # in place
    python3 tools/refit-tool-shell.py --page <page> --check     # exit 0 when a re-run changes nothing

Shared steps live in tools/refit_shell/shell.py (head, nav, tool-head, toolbar slot, results slot, .tool-full, inline
style strip, .fig captions, .tool-ref with formulas / standards / disclaimers, hub footer, PDF ink, series palette).
Each page is a module in tools/refit_shell/ with its strings and small hooks (pre, toolbar, results, js, post).
Idempotent: a page that already carries <body class="hub tool"> is returned unchanged.
"""
import argparse, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from refit_shell import shell, pue, capex, carbon, tia, tco  # noqa: E402
from refit_shell import opex, roi, tier  # noqa: E402

ROOT = shell.ROOT
CONFIG = {
    'pue-calculator.html': pue.CONFIG,
    'capex-calculator.html': capex.CONFIG,
    'opex-calculator.html': opex.CONFIG,
    'roi-calculator.html': roi.CONFIG,
    'tier-advisor.html': tier.CONFIG,
    'carbon-footprint.html': carbon.CONFIG,
    'tia-942-checklist.html': tia.CONFIG,
    'tco-calculator.html': tco.CONFIG,
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--page', required=True)
    ap.add_argument('--out')
    ap.add_argument('--noindex', action='store_true')
    ap.add_argument('--check', action='store_true')
    a = ap.parse_args()
    src = (ROOT / a.page).read_text(encoding='utf-8')
    if '<body class="hub tool"' in src:
        out = src
    else:
        if a.page not in CONFIG:
            sys.exit('no refit config for %s (have: %s)' % (a.page, ', '.join(CONFIG)))
        cfg = CONFIG[a.page]
        # pre: a page whose markup predates the template comments is first normalised onto the anchors shell.refit() expects
        out = shell.refit(cfg['pre'](src) if cfg.get('pre') else src, cfg, a.noindex)
    if a.check:
        sys.exit(0 if out == src else 1)
    (ROOT / (a.out or a.page)).write_text(out, encoding='utf-8')
    print('refit-tool-shell: %s -> %s (%d lines)' % (a.page, a.out or a.page, out.count('\n')))


if __name__ == '__main__':
    main()
