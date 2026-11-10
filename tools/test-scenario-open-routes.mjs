#!/usr/bin/env node
// Every calculator id a page declares (body data-rz-calc) must open, via rzScenario.openInCalc,
// a page that exists AND declares that same id — otherwise "Open" on a saved scenario lands on 404
// or on a page whose autoRestore ignores the scenario. Unknown ids must not navigate at all.
// RED before v3.35.10: 'carbon' built carbon-calculator.html (404); also tia/tier/spares/rfs/cx relied on a guess.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const src = fs.readFileSync(path.join(root, 'js/rz-scenario.js'), 'utf8');
const declared = new Map();
for (const f of fs.readdirSync(root).filter((n) => n.endsWith('.html'))) {
  const m = fs.readFileSync(path.join(root, f), 'utf8').match(/<body[^>]*\sdata-rz-calc="([^"]+)"/);
  if (m) declared.set(m[1], f);
}

function hrefFor(calc) {
  const win = { location: { href: 'START' }, localStorage: { setItem() {}, getItem() { return null; } },
    addEventListener() {} };
  const doc = { readyState: 'complete', body: null, getElementById() { return null; }, querySelector() { return null; } };
  vm.runInNewContext(src, { window: win, document: doc });
  win.rzScenario.openInCalc(calc, {});
  return win.location.href;
}

const fails = [];
if (declared.size < 11) fails.push(`only ${declared.size} pages declare data-rz-calc (expected >= 11)`);
for (const [calc, page] of declared) {
  const href = hrefFor(calc);
  if (href !== page) fails.push(`${calc}: opens ${href}, but the page declaring it is ${page}`);
}
for (const bad of ['nope', 'carbon-x', '../x']) {
  if (hrefFor(bad) !== 'START') fails.push(`unknown id '${bad}' navigated to ${hrefFor(bad)}`);
}
if (fails.length) { console.log('FAIL test-scenario-open-routes\n  ' + fails.join('\n  ')); process.exit(1); }
console.log(`PASS test-scenario-open-routes — ${declared.size} calculators open their own page; unknown ids stay put`);
