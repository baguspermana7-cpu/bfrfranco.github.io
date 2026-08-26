import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../datahallAI.html', import.meta.url), 'utf8');
const conventional = await readFile(new URL('../dc-conventional.html', import.meta.url), 'utf8');
const operatorUi = await readFile(new URL('../js/datahall-ai/operator-ui.js', import.meta.url), 'utf8');
const designStudio = await readFile(new URL('../js/rz-design-studio.js', import.meta.url), 'utf8');

function includes(source, token, message) {
  assert.ok(source.includes(token), message);
}

includes(html, 'css/datahall-ai-operator.css', 'AI cockpit must load its responsive operator stylesheet');
includes(html, 'js/datahall-ai/alarm-query.js', 'AI cockpit must load the alarm query engine');
includes(html, 'js/datahall-ai/rack-density.js', 'AI cockpit must load the rack-density model');
includes(html, 'js/datahall-ai/electrical-topology.js', 'AI cockpit must load the electrical topology model');
includes(html, 'js/datahall-ai/fire-cause-effect.js', 'AI cockpit must load the fire cause-and-effect model');
includes(html, 'js/datahall-ai/operator-ui.js', 'AI cockpit must load the operator UI controller');

includes(html, 'data-t="alarms"', 'AI cockpit must expose Alarms & Events as a first-class tab');
includes(html, 'id="p-alarms"', 'AI cockpit must expose the alarm workspace panel');
includes(html, '.tabs{display:flex;gap:2px;padding:4px 12px;background:var(--bg1);border-bottom:1px solid var(--bd);overflow-x:auto;height:36px;position:sticky;top:44px;z-index:55}', 'desktop tab rail must remain operable below the sticky header');
includes(html, '.hdr>div:first-child{width:100%;min-width:0;max-width:100%;flex-wrap:wrap}', 'mobile header controls must wrap instead of clipping off-screen');
for (const id of [
  'alarmFrom', 'alarmTo', 'alarmPoint', 'alarmSystem', 'alarmSeverity',
  'alarmLifecycle', 'alarmQuality', 'alarmComparator', 'alarmValue',
  'alarmStateFrom', 'alarmStateTo', 'alarmText', 'alarmApply', 'alarmReset',
  'alarmSavedView', 'alarmResultsBody', 'alarmResultCount', 'alarmDetail',
]) {
  includes(html, `id="${id}"`, `alarm workspace is missing #${id}`);
}
includes(html, 'aria-live="polite"', 'dynamic alarm results must be announced without moving focus');

for (const id of [
  'rackDensitySummary', 'platformProfile', 'platformComparison',
  'electricalScenario', 'electricalPathSummary', 'fireCauseEffectBody',
]) {
  includes(html, `id="${id}"`, `operator cockpit is missing #${id}`);
}

includes(html, 'css/rz-design-studio.css', 'AI cockpit must load the shared Design Studio stylesheet');
includes(html, 'js/rz-design-studio.js', 'AI cockpit must load the shared Design Studio controller');
includes(conventional, 'css/rz-design-studio.css', 'conventional cockpit must load the shared Design Studio stylesheet');
includes(conventional, 'js/rz-design-studio.js', 'conventional cockpit must load the shared Design Studio controller');
includes(html, 'aria-haspopup="dialog"', 'AI Generate Design trigger must disclose its dialog behavior');
includes(conventional, 'aria-haspopup="dialog"', 'conventional Generate Design trigger must disclose its dialog behavior');
includes(html, 'RZDesignStudio.register', 'AI cockpit must register a Design Studio adapter');
includes(conventional, 'RZDesignStudio.register', 'conventional cockpit must register a Design Studio adapter');
includes(operatorUi, 'hallItDensityKWPerM2', 'operator comparison must render the canonical hall IT density field');
assert.equal(operatorUi.includes('.densityKWPerM2'), false, 'operator UI must not consume the retired ambiguous density field');
includes(designStudio, "configureSelect(nodes.scope, config.scopes, 'current')", 'Design Studio must default to the locked current basis');

console.log('PASS datahall AI operator UI and shared Design Studio markup contract');
