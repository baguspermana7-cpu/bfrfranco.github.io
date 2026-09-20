#!/usr/bin/env node
/**
 * The IEC 62443 zone ladder, checked as a ladder.
 *
 * WHY THIS GATE EXISTS
 *
 * The Security Network view (§A7) is page-authored and says so: the zone list, the target security
 * levels, the conduit protocols and directions, the firewall and IDS placement, the 802.1X scope
 * and the SIEM sizing are a design, not engine quantities. Like the WAN study beside it, that
 * declaration is honest and it is not a check — `tools/test-dcai-wan-study.mjs` covers the WAN
 * sheet's arithmetic, and this covers the one structural claim this sheet makes.
 *
 * The claim is the ladder. The view draws eight zones from the carrier edge down to life safety,
 * with one conduit between each neighbouring pair, and states a target security level on each. In
 * IEC 62443 terms that is the whole design: a zone nearer the process must never be EASIER to
 * reach than the one outside it, and the innermost zone — life safety, the FACP and EPO — is
 * monitor-only, with no path that writes into it.
 *
 * Those are exactly the properties that break silently when a zone or a conduit is added later.
 * Adding a ninth zone without a conduit leaves a gap the drawing renders as a straight line;
 * giving a new inner zone a lower SL-T than its outer neighbour inverts the design and nothing on
 * the page looks wrong.
 *
 * THE INVARIANTS
 *
 *   S1  one conduit per adjacent pair — conduits = zones - 1
 *   S2  SL-T never DECREASES going inward: the ladder may hold a level, never step down
 *   S3  the innermost zone is life safety and carries the highest SL-T on the sheet
 *   S4  the conduit into life safety is monitor-only and says it does not write
 *   S5  every zone states an SL-T as a TARGET; no zone may claim a verified achieved level
 *
 * S5 exists because SL-A is a claim about a commissioned system. This is a simulated teaching
 * model, and a sheet that printed SL-A would be asserting an audit that never happened.
 *
 * HOW FAR EACH ONE IS PROVEN. S1, S2, S4 and S5 were each triggered on their own by injecting the
 * matching fault — a zone with no conduit, an inner zone made easier to reach than its neighbour,
 * a life-safety conduit that writes, and an SL-A claim in the prose. **S3 could NOT be violated
 * independently:** every way of moving life safety off the inner end, or of putting a higher SL-T
 * outside it, also trips S1 or S2 first. It is kept because it states the ladder's endpoint
 * explicitly and costs nothing — but it is a redundant guard, not an independent check, and
 * saying otherwise would overstate what this gate has been shown to catch.
 *
 * Usage: node tools/test-dcai-security-zones.mjs [--json]
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = readFileSync(resolve(ROOT, 'datahallAI.html'), 'utf8');

const start = SRC.indexOf("const el=$('secC')");
if (start < 0) {
  console.log('FAIL — the security view builder was not found in datahallAI.html.');
  console.log('If the view was renamed or removed, update this gate in the same commit.');
  process.exit(1);
}
const SEC = SRC.slice(start, start + 12000);

/* zones: ['Z0','Life safety','SL-T 4','FACP, EPO — monitor only','var(--pk)'] */
const zones = [...SEC.matchAll(/\n \['(Z[^']*)','([^']*)','SL-T (\d)','([^']*)','([^']*)'\]/g)]
  .map((m) => ({ id: m[1], name: m[2], slt: Number(m[3]), note: m[4], colour: m[5] }));
const conduitBlock = SEC.match(/const conduits=\[([\s\S]*?)\];/);
const conduits = conduitBlock
  ? [...conduitBlock[1].matchAll(/'([^']+)'/g)].map((m) => m[1])
  : [];

if (zones.length < 2 || conduits.length === 0) {
  console.log(`FAIL — could not read the ladder (${zones.length} zone(s), ${conduits.length} conduit(s)).`);
  console.log('The zone and conduit lists must stay readable as literal arrays, or the design');
  console.log('becomes unverifiable prose again.');
  process.exit(1);
}

const findings = [];
const check = (id, ok, detail) => findings.push({ id, ok, detail });

check('S1 one conduit per adjacent pair',
  conduits.length === zones.length - 1,
  `${zones.length} zones, ${conduits.length} conduits (expected ${zones.length - 1})`);

/* The list is drawn outermost-first, so index order IS inward order. */
const steps = [];
let monotonic = true;
for (let i = 1; i < zones.length; i += 1) {
  if (zones[i].slt < zones[i - 1].slt) {
    monotonic = false;
    steps.push(`${zones[i - 1].id} SL-T ${zones[i - 1].slt} -> ${zones[i].id} SL-T ${zones[i].slt}`);
  }
}
check('S2 SL-T never decreases going inward',
  monotonic,
  monotonic
    ? zones.map((z) => `${z.id}:${z.slt}`).join(' -> ')
    : `steps down: ${steps.join(', ')}`);

const inner = zones[zones.length - 1];
const maxSlt = Math.max(...zones.map((z) => z.slt));
check('S3 the innermost zone is life safety at the highest SL-T',
  /life safety/i.test(inner.name) && inner.slt === maxSlt,
  `innermost ${inner.id} "${inner.name}" SL-T ${inner.slt}, highest on sheet ${maxSlt}`);

const lastConduit = conduits[conduits.length - 1] || '';
check('S4 the conduit into life safety does not write',
  /monitor only/i.test(lastConduit) && /NO write/i.test(lastConduit),
  `"${lastConduit}"`);

/* An SL-A claim is an audit result; this model has never been audited. */
const slaClaims = [...SEC.matchAll(/SL-A\s*\d/g)].map((m) => m[0]);
check('S5 no zone claims a verified achieved level',
  slaClaims.length === 0,
  slaClaims.length ? `found ${slaClaims.join(', ')}` : `${zones.length} zones, all stated as SL-T targets`);

const failed = findings.filter((f) => !f.ok);
if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ zones, conduits, findings }, null, 2));
  process.exit(failed.length ? 1 : 0);
}

console.log('── SECURITY ZONE LADDER ──');
for (const f of findings) console.log(`  ${f.ok ? '✓' : '✗'} ${f.id}\n      ${f.detail}`);
if (failed.length) {
  console.log(`\nFAIL — ${failed.length} invariant(s) of the zone ladder do not hold.`);
  console.log('The zoning is a design selection and may change; a ladder that lets an inner zone');
  console.log('be easier to reach than its outer neighbour may not ship.');
  process.exit(1);
}
console.log(`\nPASS — ${zones.length} zones, ${conduits.length} conduits; the ladder holds inward and life safety is monitor-only.`);
