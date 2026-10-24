/* The TIA-942 manual prints counts and a worked score that come from the checklist's ITEMS array (v3.24.24).
   It said "79 items in the array" while the page held 85, Tier 3 counts from an older list, and a worked example
   (all W3 items met, Tier 3 Enterprise) of "48-55 %, Grade D" where the page's own formula gives 43.2 %, grade F.
   This recomputes every figure from the page and requires the manual to print it.
   Run: node tools/test-tia942-manual.mjs */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const page = readFileSync(resolve(ROOT, 'tia-942-checklist.html'), 'utf8');
const man = readFileSync(resolve(ROOT, 'manual', 'tia-942-checklist.html'), 'utf8');
let fail = 0;
const ok = (name, cond, info = '') => { console.log((cond ? '  ✓ ' : '  ✗ ') + name + (cond ? '' : ' — ' + info)); if (!cond) fail++; };

const cut = (start, end) => { const a = page.indexOf(start); return page.slice(a, page.indexOf(end, a) + end.length); };
const CATEGORIES = new Function(cut('const CATEGORIES = [', '];') + ';return CATEGORIES')();
const ITEMS = new Function(cut("const DC_ALL = [", '];') + cut('const ITEMS = [', '\n    ];') + ';return ITEMS')();

ok('manual: total item count', man.includes('<strong>' + ITEMS.length + ' items</strong>'), 'page has ' + ITEMS.length);
const NAMES = { ent: 'Enterprise', colo: 'Colo', hyper: 'Hyperscale', edge: 'Edge', mod: 'Modular' };
for (const t of Object.keys(NAMES)) {
    const n = ITEMS.filter((i) => i.tiers.includes(3) && i.dcTypes.includes(t)).length;
    ok('manual: Tier 3 ' + NAMES[t] + ' = ' + n, man.includes(NAMES[t] + ' ' + n + ' items'));
}
const e3 = ITEMS.filter((i) => i.tiers.includes(3) && i.dcTypes.includes('ent'));
ok('manual: W3 count at Tier 3 Enterprise', man.includes(': ' + e3.filter((i) => i.w === 3).length + ' items across all domains'));
ok('manual: gap list count', man.includes('— ' + e3.filter((i) => i.w < 3).length + ' items to close'));
let tw = 0, tm = 0;
for (const c of CATEGORIES) {
    const it = e3.filter((i) => i.cat === c.id), T = it.reduce((a, i) => a + i.w, 0), C = it.filter((i) => i.w === 3).reduce((a, i) => a + i.w, 0);
    tw += (T ? C / T * 100 : 0) * c.weight; tm += 100 * c.weight;
}
const overall = (tw / tm * 100).toFixed(1);
ok('manual: worked example overall = ' + overall + ' %', man.includes('overall = ' + overall + ' %'));
ok('page and manual cite TIA-942-C', /TIA-942-C/.test(page) && /TIA-942-C/.test(man));
/* Chart.js loads with defer: a top-level Chart.register threw while the inline block parsed and the DOMContentLoaded
   init below it never ran, so the checklist rendered no items for months (v3.24.24) */
ok('page: no top-level Chart.* call before the deferred library loads', !/^\s{0,4}Chart\.(register|defaults)/m.test(page));
console.log(fail ? `TIA-942 MANUAL — ${fail} failed` : 'TIA-942 MANUAL — all figures match the checklist');
process.exit(fail ? 1 : 0);
