import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../ict.html', import.meta.url), 'utf8');
const manual = await readFile(new URL('../manual/ict.html', import.meta.url), 'utf8');

function includes(token, message) {
  assert.ok(html.includes(token), message);
}

assert.equal(
  html.includes('GBPS_PER_KW'),
  false,
  'network capacity must not be inferred from an IT-kW multiplier',
);
includes('var NETWORK_CAPACITY_BASIS', 'ICT must define an explicit authored network capacity basis');
for (const token of ['installedGbps', 'usableGbps', 'survivableGbps']) {
  includes(token, `ICT capacity basis is missing ${token}`);
}
includes('class="network-topology"', 'ICT must expose an operator topology workspace');
for (const layer of ['External / DCI', 'Edge / Core', 'Fabric / Access', 'Racks / Services']) {
  includes(layer, `ICT topology is missing the ${layer} layer`);
}
includes('N+1 survivable', 'ICT must label degraded survivable capacity explicitly');
includes('traffic scenario independent of IT power', 'ICT must disclose traffic and power as independent bases');
includes('js/conv-design-basis.js', 'ICT must load the governed four-hall study instead of duplicating it');
includes('var STUDY_ACCESS_GROUPS', 'ICT must derive study access groups from the governed rack basis');
includes('max 12 racks/group · physical switch topology pending', 'study grouping must expose its assumption and open design dependency');
includes('rack-equivalents @ 8 kW (not physical inventory)', 'current power equivalence must not masquerade as a physical rack count');
assert.equal(html.includes('active racks @ 8 kW/rack'), false, 'ICT must not relabel rack-equivalent power as installed racks');
assert.equal(manual.includes('IT_kW × 0.00768'), false, 'manual must not restore a power-to-bandwidth heuristic');
assert.match(manual, /42 logical access groups per hall/);
assert.match(manual, /not a Tier certification result/);
assert.match(manual, /rack-equivalents at 8 kW/);

for (const id of [
  'alarm-filter-toggle', 'alarm-filter-panel', 'alarm-filter-from', 'alarm-filter-to',
  'alarm-filter-severity', 'alarm-filter-segment', 'alarm-filter-state',
  'alarm-filter-search', 'alarm-filter-apply', 'alarm-filter-reset', 'alarm-result-count',
]) {
  includes(`id="${id}"`, `ICT alarm query affordance is missing #${id}`);
}
includes('function applyAlarmFilters()', 'ICT alarm filter controls must drive deterministic filtering');
assert.doesNotMatch(
  html,
  /@media \(max-width: 1200px\)\s*\{\s*\.inspector\s*\{\s*display:\s*none/,
  'tablet hierarchy must not discard the inspector and alarm workspace',
);

console.log('PASS ICT operator architecture, authored capacity, alarm-query, and responsive contracts');
