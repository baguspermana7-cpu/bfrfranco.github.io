/* Gate for the RZExplain knowledge DB — every entry well-formed, aliases sane,
   rel-links resolve, deterministic build. Run: node tools/test-explain-db.mjs */
import fs from 'node:fs';
import { execSync } from 'node:child_process';

let pass = 0, fail = 0; const fails = [];
const ok = (n, c, d) => { if (c) pass++; else { fail++; fails.push(n + (d ? ' — ' + d : '')); } };

const src = fs.readFileSync(new URL('../js/rz-explain-db.js', import.meta.url), 'utf8');
const DB = JSON.parse(src.slice(src.indexOf('{', src.indexOf('RZ_EXPLAIN_DB')), src.lastIndexOf('}') + 1));
const E = DB.entries;

ok('DB has version + counts', !!DB.version && !!DB.counts);
ok('>= 354 glossary terms', DB.counts.glossary >= 354, '' + DB.counts.glossary);
ok('>= 100 curated entries', DB.counts.curated >= 100, '' + DB.counts.curated);
ok('total = glossary + curated - collisions (sane)', DB.counts.total >= Math.max(DB.counts.glossary, DB.counts.curated));

const keys = Object.keys(E);
ok('every entry has t + d', keys.every(k => E[k].t && E[k].d), keys.filter(k => !E[k].t || !E[k].d).slice(0, 5).join(','));
ok('every d >= 40 chars (super-detail mandate)', keys.filter(k => E[k].d.length < 40).length === 0,
   keys.filter(k => E[k].d.length < 40).slice(0, 5).join(','));

// rel links resolve
const badRel = [];
keys.forEach(k => (E[k].rel || []).forEach(r => { if (!E[r]) badRel.push(k + '->' + r); }));
ok('all rel keys resolve', badRel.length === 0, badRel.slice(0, 5).join(','));

// alias sanity: no empty aliases; no alias mapping to 2+ keys with different targets
const aliasMap = {}; const dupes = [];
keys.forEach(k => (E[k].aliases || []).forEach(a => {
  const low = String(a).toLowerCase();
  if (aliasMap[low] && aliasMap[low] !== k) dupes.push(low + ':' + aliasMap[low] + '/' + k);
  aliasMap[low] = k;
}));
ok('no cross-key duplicate aliases', dupes.length === 0, dupes.slice(0, 5).join(','));

// priority keys the UIs wire to (curated must include these)
const REQUIRED = ['dscr', 'pue', 'wue', 'deep-sea-water-cooling', 'refrigerant', 'gwp',
  'equity-irr', 'exit-ev-ebitda-multiple', 'debt-ratio-leverage', 'occupancy-ramp',
  'white-space', 'redundancy', 'it-load', 'trim-chiller'];
const missing = REQUIRED.filter(k => !E[k]);
ok('priority UI keys present', missing.length === 0, missing.join(','));

// determinism: rebuild → identical file
const before = src;
execSync('python3 tools/build-explain-db.py', { cwd: new URL('..', import.meta.url).pathname, stdio: 'pipe' });
const after = fs.readFileSync(new URL('../js/rz-explain-db.js', import.meta.url), 'utf8');
ok('builder deterministic (rebuild identical)', before === after);

console.log(`\nEXPLAIN-DB GATE — ${pass} passed, ${fail} failed`);
if (fail) { fails.forEach(f => console.log('  ✗ ' + f)); process.exit(1); }
console.log('ALL GREEN');
