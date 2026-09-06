#!/usr/bin/env node
/**
 * test-datahall-ai-hmi-payloads.mjs — the ONE source for every number an equipment HMI prints.
 *
 *   H1 every equipment class returns a frozen payload with the six tabs
 *   H2 every row with `basis` resolves in data/dcai-parameters.json and equals the registry value
 *      (the adapter's rounding is accepted at the printed precision); every row without `basis`
 *      carries a declared reason ≥ 40 characters; no NaN anywhere
 *   H3 determinism: the same tick → deepEqual payloads; tick+1 differs ONLY in simulated rows
 *   H4 states come from the scenario engines: 'ups_a_bypass' puts UPS-A on bypass with an alarm;
 *      'cdu-pump-fail' faults CDU pump 1; 'leak-z07' wets zone 7
 *   H5 the module sources contain no random call, and the page's HMI renderer ranges (between
 *      @rz-hmi:begin/@rz-hmi:end markers) contain none either — RED until Track A §A5 WP4 lands
 *   H6 fail-closed: a ctx without a snapshot throws in Node
 *
 * The page adapter (window.DHE) is built by an inline IIFE on datahallAI.html; this test runs that
 * IIFE in a vm sandbox on the real engine so the payload sees exactly what the browser sees.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const ROOT = process.cwd();
const page = readFileSync(`${ROOT}/datahallAI.html`, 'utf8');
const engine = require(`${ROOT}/js/dcai-engine.js`);
const model = require(`${ROOT}/js/dcai-model.js`);
const Electrical = require(`${ROOT}/js/datahall-ai/electrical-topology.js`);
const Sim = require(`${ROOT}/js/datahall-ai/sim-telemetry.js`);
const Payloads = require(`${ROOT}/js/datahall-ai/hmi-payloads.js`);
const registry = JSON.parse(readFileSync(`${ROOT}/data/dcai-parameters.json`, 'utf8'));
const registryIndex = new Map(registry.parameters.map((p) => [p.id, p]));

/* the adapter IIFE and the DH_BASIS literal, straight from the page */
const adapterSrc = page.slice(page.indexOf('var DH=(function(){'), page.indexOf('var DHE=DH;'));
const basisMap = JSON.parse(page.match(/window\.DH_BASIS=(\{[\s\S]*?\});/)[1]);
function buildAdapter() {
    const sandbox = { window: null, console, Math, Number, String, Object, Array, isFinite, DCAI_MODEL: model, DCAI_CALC: engine };
    sandbox.window = sandbox; sandbox.globalThis = sandbox;
    sandbox.RZDatahallCurrentAuthority = () => ({ calc: engine, model: model.DCAI_MODEL || model, snapshot: engine.snapshot });
    vm.runInNewContext(adapterSrc + '\nwindow.__DH = DH;', sandbox, { filename: 'datahallAI-adapter.js' });
    return sandbox.__DH;
}
const adapter = buildAdapter();
assert.ok(adapter && typeof adapter.kwPerRack === 'number', 'the page adapter builds on the engine in Node');

function ctxFor(overrides = {}) {
    return {
        snapshot: engine.snapshot, adapter, basisMap, registryIndex, registryVersion: registry.engineVersion,
        scenario: Electrical.evaluateScenario(overrides.scenarioId || 'normal'),
        cooling: { scenarioId: overrides.coolingScenarioId || 'normal' },
        tick: overrides.tick ?? 4242, hall: overrides.hall || 1, sim: Sim, fire: overrides.fire || null,
    };
}
const SAMPLE_ID = { cdu: '4', chiller: '3', 'dry-cooler': '2', crah: '7', 'fire-zone': '1', 'fire-vesda': '2', 'net-spine': '0', 'net-leaf': '1', 'net-domain': '3', room: 'ups-a', 'fire-mcp': '1', 'bms-controller': '2' };
const idFor = (classId) => SAMPLE_ID[classId] || 'dh01';
const TABS = ['live', 'capacity', 'deps', 'alarms', 'trend', 'maint'];
const rowsOf = (p) => TABS.filter((t) => Array.isArray(p.tabs[t])).flatMap((t) => p.tabs[t]);

test('H1 every class returns a frozen payload with six tabs', () => {
    assert.ok(Payloads.CLASSES.length >= 40, `expected ≥ 40 classes, got ${Payloads.CLASSES.length}`);
    for (const c of Payloads.CLASSES) {
        const p = Payloads.payload(c.classId, idFor(c.classId), ctxFor());
        assert.equal(Object.isFrozen(p), true, `${c.classId} payload frozen`);
        for (const t of TABS) assert.ok(t in p.tabs, `${c.classId} has tab ${t}`);
        assert.ok(p.tabs.live.length >= 2, `${c.classId} live tab has rows`);
        assert.ok(p.title && p.statusChip && p.provenance, `${c.classId} carries title, chip, provenance`);
        assert.equal(typeof p.v, 'function');
        if (c.tier2 === null) assert.equal(p.actions.openHmi, null, `${c.classId} has no tier-2 opener`);
        else assert.ok(p.actions.openHmi && p.actions.openHmi.opener, `${c.classId} names its tier-2 opener`);
    }
});

test('H2 every row is hooked at parity or declared; no NaN', () => {
    let hooked = 0, declared = 0;
    for (const c of Payloads.CLASSES) {
        const p = Payloads.payload(c.classId, idFor(c.classId), ctxFor());
        for (const r of rowsOf(p)) {
            assert.ok(!(typeof r.value === 'number' && Number.isNaN(r.value)), `${c.classId}.${r.point} NaN`);
            assert.ok(!/NaN|undefined/.test(r.text), `${c.classId}.${r.point} text ${r.text}`);
            if (r.basis) {
                const rec = registryIndex.get(r.basis);
                assert.ok(rec, `${c.classId}.${r.point} basis ${r.basis} resolves`);
                assert.ok(!r.declared, `${c.classId}.${r.point} basis XOR declared`);
                if (typeof r.value === 'number' && typeof rec.value === 'number') {
                    /* the adapter rounds at the precision it prints; parity holds at that precision */
                    const decimals = (String(r.text).split('.')[1] || '').length;
                    assert.ok(Math.abs(r.value - rec.value) <= 0.5 * 10 ** -decimals + 1e-9, `${c.classId}.${r.point}=${r.value} vs ${r.basis}=${rec.value}`);
                }
                hooked++;
            } else {
                assert.ok(typeof r.declared === 'string' && r.declared.length >= 40, `${c.classId}.${r.point} declared ≥ 40 chars`);
                declared++;
            }
        }
        if (p.tabs.trend) assert.ok(p.tabs.trend.series.length >= 10 && p.tabs.trend.declared.length >= 40, `${c.classId} trend declared`);
    }
    console.log(`  rows hooked ${hooked} · declared ${declared}`);
    assert.ok(hooked > 100 && declared > 100);
});

test('H3 determinism per tick', () => {
    for (const c of Payloads.CLASSES) {
        const a = Payloads.payload(c.classId, idFor(c.classId), ctxFor({ tick: 777 }));
        const b = Payloads.payload(c.classId, idFor(c.classId), ctxFor({ tick: 777 }));
        assert.deepEqual(rowsOf(a).map((r) => r.text), rowsOf(b).map((r) => r.text), `${c.classId} identical at the same tick`);
        const n = Payloads.payload(c.classId, idFor(c.classId), ctxFor({ tick: 778 }));
        rowsOf(a).forEach((r, i) => { if (r.quality !== 'simulated') assert.equal(rowsOf(n)[i].text, r.text, `${c.classId}.${r.point} moved between ticks but is not simulated`); });
    }
});

test('H4 states come from the scenario engines', () => {
    const ups = Payloads.payload('sld-ups-a', 'dh01', ctxFor({ scenarioId: 'ups_a_bypass' }));
    assert.equal(ups.state('mode'), 'bypass'); assert.ok(ups.tabs.alarms.length >= 1 && ups.tabs.alarms[0].quality === 'simulated');
    const cdu = Payloads.payload('cdu', '4', ctxFor({ coolingScenarioId: 'cdu-pump-fail' }));
    assert.equal(cdu.state('pump_state_1'), 'fault'); assert.equal(cdu.state('pump_state_3'), 'run');
    const leak = Payloads.payload('leak', 'dh01', ctxFor({ coolingScenarioId: 'leak-z07' }));
    assert.equal(leak.state('zone_7'), 'wet'); assert.equal(leak.state('zone_8'), 'dry'); assert.equal(leak.statusChip.label, 'LEAK');
    const normal = Payloads.payload('leak', 'dh01', ctxFor());
    assert.ok(normal.tabs.live.every((r) => r.state !== 'wet'));
});

test('H5 no random call in the modules or the HMI renderer ranges', () => {
    for (const f of ['js/datahall-ai/sim-telemetry.js', 'js/datahall-ai/hmi-payloads.js']) {
        assert.doesNotMatch(readFileSync(`${ROOT}/${f}`, 'utf8'), /Math\.random\s*\(/, `${f} rolls no dice`);
    }
    const blocks = [...page.matchAll(/\/\* @rz-hmi:begin (\w+) \*\/([\s\S]*?)\/\* @rz-hmi:end \1 \*\//g)];
    assert.ok(blocks.length >= 22, `HMI renderers must be marker-delimited (found ${blocks.length}, need the 22 renderers + populateResults)`);
    for (const [, name, body] of blocks) {
        const rolls = (body.match(/Math\.random\s*\(|(?<![\w.])RI?\(/g) || []).length;
        assert.equal(rolls, 0, `${name} still rolls ${rolls} dice`);
    }
});

test('H6 fail-closed', () => {
    assert.throws(() => Payloads.payload('cdu', '1', { adapter, basisMap, registryIndex }), /snapshot/);
    const safe = Payloads.safePayload('cdu', '1', {});
    assert.equal(safe.unavailable, true);
    assert.throws(() => Payloads.payload('no-such-class', '1', ctxFor()), /unknown equipment class/);
});
