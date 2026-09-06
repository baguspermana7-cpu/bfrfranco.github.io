/**
 * Ship gate — datahallAI.html's engine pin equals the version js/dcai-engine.js publishes.
 *
 * The AI cockpit fails CLOSED on an engine it does not recognise (correct), by comparing
 * DATAHALL_CURRENT_ASSET_VERSION and the ?v= tokens on three tagged script tags against
 * DCAI_CALC.snapshot.meta.version, and DATAHALL_CURRENT_SPEC_VERSION against
 * DCAI_MODEL.specVersion. Bumping the engine without moving the pins would blank the whole
 * page with no error — the exact failure v1.134.23 produced on eight Conventional cockpits
 * (memory: feedback_engine_version_pin_blanks_cockpits). Four things must agree:
 *
 *   V1  page pin            == engine meta.version
 *   V2  page spec pin       == model specVersion
 *   V3  ?v= on model / engine / registry script tags == engine meta.version
 *   V4  registry header engineVersion == engine meta.version (the page validates against it)
 *
 * Run: node tools/test-dcai-engine-version-pin.mjs
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const ROOT = process.cwd();
const require = createRequire(import.meta.url);
const calc = require(join(ROOT, 'js', 'dcai-engine.js'));
const model = require(join(ROOT, 'js', 'dcai-model.js'));
const published = calc.snapshot.meta.version;
const spec = model.specVersion;
const html = await readFile(join(ROOT, 'datahallAI.html'), 'utf8');
const registry = JSON.parse(await readFile(join(ROOT, 'data', 'dcai-parameters.json'), 'utf8'));

const pin = html.match(/var DATAHALL_CURRENT_ASSET_VERSION='([^']+)'/);
assert.ok(pin, 'datahallAI.html pins no DATAHALL_CURRENT_ASSET_VERSION');
assert.equal(pin[1], published, `page pins engine ${pin[1]} but the engine publishes ${published} — the page would render UNAVAILABLE everywhere, silently`);

const specPin = html.match(/var DATAHALL_CURRENT_SPEC_VERSION='([^']+)'/);
assert.ok(specPin, 'datahallAI.html pins no DATAHALL_CURRENT_SPEC_VERSION');
assert.equal(specPin[1], spec, `page pins spec ${specPin[1]} but the model declares ${spec}`);

for (const [attr, file] of [['data-datahall-model-authority', 'dcai-model.js'], ['data-datahall-calc-authority', 'dcai-engine.js'], ['data-datahall-registry', 'dcai-parameters.js']]) {
  const tag = html.match(new RegExp(`<script src="js/${file.replace('.', '\\.')}\\?v=([^"&]+)"[^>]*${attr}`));
  assert.ok(tag, `datahallAI.html has no <script src="js/${file}?v=…" ${attr}> tag`);
  assert.equal(tag[1], published, `${file} is requested as ?v=${tag[1]} but the engine publishes ${published}`);
}
assert.ok(!/js\/datahall-(model|calculations)\.js\?v=/.test(html), 'the retired GB200 pair must not be loaded by the page');
assert.equal(registry.engineVersion, published, 'data/dcai-parameters.json header disagrees with the engine version');

console.log(`PASS DC AI engine pin — page ${pin[1]} · spec ${specPin[1]} · three ?v= tokens · registry ${registry.engineVersion} all equal engine ${published}`);
