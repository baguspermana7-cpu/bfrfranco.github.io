/**
 * test-datahall-ai-fire-points.mjs — the Fire & Safety workstation's content (Track A §A6)
 *
 * Node-only. Asserts js/datahall-ai/fire-points.js: the inventory is a formula of hall geometry
 * (never literals) and deterministic; the isolation state machine refuses exactly what it must
 * and derives zone impairment, release inhibit and fire watch from the two-means rule; every
 * record it emits is a valid alarm-query record even when concatenated with the workspace
 * fixture; expiry is tick-based; the module contains no clock and no die roll; evaluate() is
 * pure; its outputs plug into the cause-and-effect engine (ROW_INHIBITED / release interlocks).
 *
 *   node --test tools/test-datahall-ai-fire-points.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FP = require(join(ROOT, 'js/datahall-ai/fire-points.js'));
const CE = require(join(ROOT, 'js/datahall-ai/fire-cause-effect.js'));
const AQ = require(join(ROOT, 'js/datahall-ai/alarm-query.js'));
const SIM = require(join(ROOT, 'js/datahall-ai/sim-telemetry.js'));

const GEO = { halls: 4, hallLengthM: 62, hallWidthM: 31, rackRows: 10, leakZonesPerHall: 24 };
const inv = FP.buildInventory(GEO);
const T = 4242;
const Z12 = 'DH-01-Z12';
const pointsOf = (zoneId, means) => inv.points.filter((p) => p.zoneIds.includes(zoneId) && (!means || p.means === means));
const REQ = (pointId, extra) => ({ pointId, owner: 'shift-a', reason: 'quarterly sensitivity test on this loop', expiryId: '8h', tick: T, ...extra });

function isDeepFrozen(o, seen = new Set()) {
  if (!o || typeof o !== 'object' || seen.has(o)) return true;
  seen.add(o);
  if (!Object.isFrozen(o)) return false;
  return Object.keys(o).every((k) => isDeepFrozen(o[k], seen));
}

test('F1 inventory is a formula of geometry, deterministic, four halls', () => {
  const area = GEO.hallLengthM * GEO.hallWidthM;
  const spots = (a) => Math.max(1, Math.ceil(a / (9.1 * 9.1)));
  let expectedSpots = 0;
  for (const t of FP.ZONE_TEMPLATE) {
    const a = Number.isFinite(t.areaM2) ? t.areaM2 : Math.round(area * t.areaShare * 10) / 10;
    expectedSpots += 2 * spots(a);
  }
  assert.equal(inv.counts.byType.smoke_spot, 4 * expectedSpots, 'spot smoke = 2 loops × ceil(area / 9.1²) per zone, per hall');
  assert.equal(inv.counts.byType.vesda, 16, 'one aspirating unit per three zones per hall');
  assert.equal(inv.counts.byType.mcp, 12); assert.equal(inv.counts.byType.epo, 12, 'EPO only in the three electrical-room zones (Tech Spec §6.9)');
  assert.equal(inv.counts.byType.leak_rope, 96); assert.equal(inv.zones.length, 48);
  assert.deepEqual(FP.buildInventory(GEO), inv, 'same geometry → identical inventory');
  const small = FP.buildInventory({ ...GEO, hallLengthM: 31 });
  assert.ok(small.counts.byType.smoke_spot < inv.counts.byType.smoke_spot, 'a smaller hall carries fewer spot detectors');
  assert.throws(() => FP.buildInventory({ halls: 4 }), /hallLengthM/);
  assert.ok(inv.declared.length >= 40 && /NFPA 72/.test(inv.declared));
  const vd = inv.byId['DH-01-VD-1']; assert.equal(vd.zoneIds.length, 3, 'a VESDA unit serves three zones');
  assert.ok(inv.points.every((p) => /^\d{4}-\d{2}-\d{2}$/.test(p.lastTestAt)));
});

test('F2 everything the module returns is deeply frozen', () => {
  assert.ok(isDeepFrozen(inv)); assert.ok(isDeepFrozen(FP.createRegister()));
  const r = FP.isolate(inv, FP.createRegister(), REQ('DH-01-Z05-SD1-01'), {});
  assert.ok(isDeepFrozen(r)); assert.ok(isDeepFrozen(FP.evaluate(inv, r.register, null, T)));
});

test('F3 every refusal code', () => {
  const reg = FP.createRegister();
  const code = (res) => { assert.equal(res.ok, false); return res.code; };
  assert.equal(code(FP.isolate(inv, reg, REQ('nope'), {})), 'UNKNOWN_POINT');
  assert.equal(code(FP.isolate(inv, reg, REQ('DH-01-MCP-N'), {})), 'LIFE_SAFETY_POINT');
  assert.equal(code(FP.isolate(inv, reg, REQ('DH-01-Z09-EPO'), {})), 'LIFE_SAFETY_POINT');
  assert.equal(code(FP.isolate(inv, reg, REQ('DH-01-Z05-REL'), {})), 'LIFE_SAFETY_POINT');
  assert.equal(code(FP.isolate(inv, reg, REQ('DH-01-Z05-ABORT'), {})), 'LIFE_SAFETY_POINT');
  assert.equal(code(FP.isolate(inv, reg, REQ('DH-01-Z05-SD1-01'), { fire: { eventId: 'confirmed_fire', zoneId: 'DH-01-Z05', startedAtTick: T } })), 'FACP_IN_ALARM');
  assert.equal(FP.isolate(inv, reg, REQ('DH-01-Z05-SD1-01'), { fire: { eventId: 'vesda_alert', zoneId: 'DH-01-Z05', startedAtTick: T } }).ok, true, 'a pre-alarm does not block isolation');
  assert.equal(code(FP.isolate(inv, reg, REQ('DH-01-Z05-SD1-01', { owner: '' }), {})), 'OWNER_REQUIRED');
  assert.equal(code(FP.isolate(inv, reg, REQ('DH-01-Z05-SD1-01', { reason: 'short' }), {})), 'REASON_TOO_SHORT');
  assert.equal(code(FP.isolate(inv, reg, REQ('DH-01-Z05-SD1-01', { expiryId: '5m' }), {})), 'EXPIRY_REQUIRED');
  const one = FP.isolate(inv, reg, REQ('DH-01-Z05-SD1-01'), {});
  assert.equal(code(FP.isolate(inv, one.register, REQ('DH-01-Z05-SD1-01'), {})), 'ALREADY_ISOLATED');
  assert.equal(code(FP.restore(inv, reg, { pointId: 'DH-01-Z05-SD1-02', owner: 'shift-a', tick: T })), 'NOT_ISOLATED');
  const e1 = FP.extend(inv, one.register, { pointId: 'DH-01-Z05-SD1-01', owner: 'shift-b', expiryId: '2h', tick: T + 10 });
  const e2 = FP.extend(inv, e1.register, { pointId: 'DH-01-Z05-SD1-01', owner: 'shift-b', expiryId: '2h', tick: T + 20 });
  assert.equal(code(FP.extend(inv, e2.register, { pointId: 'DH-01-Z05-SD1-01', owner: 'shift-b', expiryId: '2h', tick: T + 30 })), 'EXTEND_LIMIT');
  const refused = FP.isolate(inv, reg, REQ('DH-01-MCP-N'), {});
  assert.equal(refused.records[0].event, 'isolation-refused'); assert.match(refused.records[0].message, /LIFE_SAFETY_POINT/);
  assert.equal(refused.register.sequence, reg.sequence + 1, 'a refusal is logged and consumes a sequence');
});

test('F4 the two-means rule: consequence must be acknowledged, then IMPAIRED + release inhibited + fire watch; restore clears', () => {
  let reg = FP.createRegister();
  const z = inv.zoneById[Z12]; assert.deepEqual(z.means, ['vesda', 'smoke_l1', 'smoke_l2']);
  const vd = inv.points.find((p) => p.type === 'vesda' && p.zoneIds.includes(Z12));
  let r = FP.isolate(inv, reg, REQ(vd.id), {}); assert.equal(r.ok, true); reg = r.register;
  assert.equal(FP.meansOf(inv, reg, Z12).count, 2, 'two means remain after the aspirating unit is isolated');
  assert.equal(FP.evaluate(inv, reg, null, T).zones.find((x) => x.id === Z12).impaired, false);
  const l1 = pointsOf(Z12, 'smoke_l1');
  for (let i = 0; i < l1.length - 1; i++) { r = FP.isolate(inv, reg, REQ(l1[i].id, { tick: T + i }), {}); assert.equal(r.ok, true, 'loop 1 spot ' + i); reg = r.register; }
  const last = l1[l1.length - 1];
  const pre = FP.previewIsolate(inv, reg, REQ(last.id), {});
  assert.equal(pre.ok, true); assert.equal(pre.consequence.zoneImpaired, true); assert.match(pre.consequence.text, /IMPAIRED/);
  const refused = FP.isolate(inv, reg, REQ(last.id), {}); assert.equal(refused.code, 'CONSEQUENCE_NOT_ACKNOWLEDGED');
  r = FP.isolate(inv, reg, REQ(last.id, { acknowledged: true, tick: T + 5 }), {}); assert.equal(r.ok, true); reg = r.register;
  const snap = FP.evaluate(inv, reg, null, T + 6);
  const zone = snap.zones.find((x) => x.id === Z12);
  assert.equal(zone.meansAvailable, 1); assert.equal(zone.impaired, true); assert.equal(zone.releaseInhibited, true); assert.equal(zone.fireWatch, true);
  assert.equal(snap.summary.fireWatch, true); assert.deepEqual(snap.summary.impairedZones, [Z12]); assert.deepEqual(snap.summary.releaseInhibitedZones, [Z12]);
  assert.equal(snap.points.find((p) => p.id === Z12 + '-REL').state, 'inhibited', 'the release circuit of an impaired zone reads inhibited');
  const events = snap.derivedRecords.map((x) => x.event);
  assert.ok(events.includes('zone-impaired') && events.includes('release-inhibited') && events.includes('fire-watch-raised'));
  assert.equal(snap.summary.disabled, 1 + l1.length); assert.equal(snap.summary.smokeOk, snap.summary.smokeTotal - l1.length);
  const other = snap.zones.find((x) => x.id === 'DH-01-Z11'); assert.equal(other.impaired, false, 'a neighbouring zone served by the same VESDA still has ≥ 2 means');
  const rs = FP.restore(inv, reg, { pointId: last.id, owner: 'shift-b', tick: T + 10 }); assert.equal(rs.ok, true); assert.equal(rs.records[0].event, 'point-restored');
  const after = FP.evaluate(inv, rs.register, null, T + 11);
  assert.equal(after.zones.find((x) => x.id === Z12).impaired, false); assert.equal(after.summary.fireWatch, false); assert.equal(after.derivedRecords.length, 0);
});

test('F5 every record is a valid alarm-query record, alone and with the workspace fixture', () => {
  let reg = FP.createRegister(); const all = [];
  const push = (res) => { all.push(...res.records); reg = res.register; };
  push(FP.isolate(inv, reg, REQ('DH-01-MCP-S'), {}));
  push(FP.isolate(inv, reg, REQ('DH-01-Z12-SD1-01'), {}));
  push(FP.extend(inv, reg, { pointId: 'DH-01-Z12-SD1-01', owner: 'contractor', expiryId: '24h', tick: T + 1, reason: 'works overrun' }));
  const l1 = pointsOf(Z12, 'smoke_l1'); for (const p of l1) { const r = FP.isolate(inv, reg, REQ(p.id, { acknowledged: true, tick: T + 2 }), {}); if (r.ok) push(r); }
  push(FP.isolate(inv, reg, REQ('DH-01-VD-4', { acknowledged: true, tick: T + 3 }), {}));
  const snap = FP.evaluate(inv, reg, { eventId: 'confirmed_fire', zoneId: 'DH-02-Z05', startedAtTick: T }, T + 30000);
  all.push(...snap.derivedRecords);
  assert.ok(all.length >= 8);
  const v = AQ.validateEvents(all); assert.equal(v.valid, true, JSON.stringify(v.errors));
  const both = AQ.validateEvents(AQ.createFixture().concat(all)); assert.equal(both.valid, true, JSON.stringify(both.errors));
  assert.ok(all.every((r) => r.quality === 'simulated' && r.system === 'fire' && r.scenario === 'training'));
  assert.ok(new Set(all.map((r) => r.id)).size === all.length, 'ids unique');
  const inhibited = AQ.query(all, { system: 'fire', lifecycle: ['inhibited'] }).records.map((r) => r.event);
  assert.ok(inhibited.length >= 4 && inhibited.every((e) => ['point-isolated', 'isolation-extended', 'release-inhibited'].includes(e)), JSON.stringify(inhibited));
  push(FP.restore(inv, reg, { pointId: 'DH-01-Z12-SD1-01', owner: 'shift-a', tick: T + 40 }));
  assert.equal(AQ.validateEvents(all).valid, true);
});

test('F6 expiry is tick-based: expired stays isolated, flagged, one record; extend clears it', () => {
  let reg = FP.createRegister();
  const r = FP.isolate(inv, reg, REQ('DH-01-Z05-HD-01', { expiryId: '2h' }), {}); reg = r.register;
  const exp = FP.EXPIRY_OPTIONS.find((o) => o.id === '2h').ticks;
  const before = FP.evaluate(inv, reg, null, T + exp - 1); const p1 = before.points.find((p) => p.id === 'DH-01-Z05-HD-01');
  assert.equal(p1.state, 'isolated'); assert.equal(p1.isolation.expired, false); assert.equal(before.derivedRecords.length, 0);
  const at = FP.evaluate(inv, reg, null, T + exp); const p2 = at.points.find((p) => p.id === 'DH-01-Z05-HD-01');
  assert.equal(p2.state, 'isolated'); assert.equal(p2.isolation.expired, true);
  assert.deepEqual(at.derivedRecords.map((x) => x.event).sort(), ['fire-watch-raised', 'isolation-expired']);
  assert.deepEqual(at.summary.expiredIsolations, ['DH-01-Z05-HD-01']); assert.equal(at.summary.fireWatch, true);
  const later = FP.evaluate(inv, reg, null, T + exp + 500);
  assert.equal(later.derivedRecords.find((x) => x.event === 'isolation-expired').id, at.derivedRecords.find((x) => x.event === 'isolation-expired').id, 'idempotent id across ticks');
  const ext = FP.extend(inv, reg, { pointId: 'DH-01-Z05-HD-01', owner: 'shift-a', expiryId: '8h', tick: T + exp + 10 });
  assert.equal(ext.ok, true);
  assert.equal(FP.evaluate(inv, ext.register, null, T + exp + 11).summary.expiredIsolations.length, 0);
});

test('F7 no clock and no die roll in the new modules; tick law matches sim-telemetry', () => {
  for (const f of ['js/datahall-ai/fire-points.js', 'js/datahall-ai/fire-workstation.js']) {
    let src; try { src = readFileSync(join(ROOT, f), 'utf8'); } catch (e) { if (f.includes('workstation')) continue; throw e; }
    assert.doesNotMatch(src, /Math\.random\s*\(/, f + ' rolls a die');
    assert.doesNotMatch(src, /Date\.now\s*\(/, f + ' reads the clock');
    assert.doesNotMatch(src, /new Date\(\s*\)/, f + ' reads the clock');
  }
  assert.equal(FP.TICK_MS, SIM.TICK_MS); assert.equal(FP.EPOCH, SIM.EPOCH);
  assert.equal(FP.isoFromTick(0), new Date(SIM.EPOCH).toISOString());
});

test('F8 evaluate is pure and does not mutate its inputs', () => {
  let reg = FP.createRegister(); reg = FP.isolate(inv, reg, REQ('DH-03-Z07-SD2-01'), {}).register;
  const fire = { eventId: 'vesda_action', zoneId: 'DH-03-Z07', startedAtTick: T };
  const a = FP.evaluate(inv, reg, fire, T + 3), b = FP.evaluate(inv, reg, fire, T + 3);
  assert.deepEqual(a, b);
  assert.deepEqual(fire, { eventId: 'vesda_action', zoneId: 'DH-03-Z07', startedAtTick: T });
  assert.notDeepEqual(FP.evaluate(inv, reg, fire, T + 4).tick, a.tick);
});

test('F9 ctxFire carries per-zone and per-point state for the equipment payloads', () => {
  const snap = FP.evaluate(inv, FP.createRegister(), { eventId: 'confirmed_fire', zoneId: 'DH-01-Z05', startedAtTick: T }, T + 1);
  assert.equal(snap.ctxFire.zones['DH-01-Z05'].state, 'confirmed'); assert.equal(snap.ctxFire.zones['DH-01-Z06'].state, 'normal');
  assert.equal(snap.ctxFire.points['DH-01-Z05-SD1-01'].state, 'alarm'); assert.equal(snap.ctxFire.points['DH-01-Z06-SD1-01'].state, 'normal');
  assert.equal(snap.ctxFire.points['DH-01-VD-2'].state, 'alarm', 'the aspirating unit serving the zone alarms too');
  assert.equal(snap.summary.fire, 'ALARM Z05 DH-01'); assert.ok(snap.summary.inAlarm > 0);
});

test('F10 an impaired zone reaches the cause-and-effect engine: ROW_INHIBITED on the armed row, release blocked by the inhibit interlock', () => {
  let reg = FP.createRegister();
  for (const p of pointsOf(Z12, 'smoke_l1').concat(pointsOf(Z12, 'smoke_l2'))) { reg = FP.isolate(inv, reg, REQ(p.id, { acknowledged: true }), {}).register; }
  const snap = FP.evaluate(inv, reg, { eventId: 'suppression_release', zoneId: Z12, startedAtTick: T }, T + 20);
  assert.equal(snap.zones.find((z) => z.id === Z12).impaired, true);
  const rows = CE.applyRuntime(CE.BASE_ROWS, snap.runtimeUpdates);
  const armed = CE.evaluateEvent({ eventId: 'suppression_armed', zoneId: Z12, elapsedSeconds: 0, runtimeRows: rows });
  assert.ok(armed.blocked.some((b) => b.reason === 'ROW_INHIBITED'), JSON.stringify(armed.blocked));
  const release = CE.evaluateEvent({ eventId: 'suppression_release', zoneId: Z12, elapsedSeconds: snap.elapsedSeconds, runtimeRows: rows, interlocks: snap.interlocks });
  assert.equal(release.commands.length, 0); assert.ok(release.blocked.length > 0, 'release is blocked while the zone is impaired');
  const clean = FP.evaluate(inv, FP.createRegister(), { eventId: 'suppression_release', zoneId: Z12, startedAtTick: T }, T + 20);
  const ok = CE.evaluateEvent({ eventId: 'suppression_release', zoneId: Z12, elapsedSeconds: clean.elapsedSeconds, runtimeRows: CE.applyRuntime(CE.BASE_ROWS, clean.runtimeUpdates), interlocks: clean.interlocks });
  assert.ok(ok.commands.length > 0, 'with every proof true and no impairment the release row issues');
  assert.equal(CE.evaluateEvent({ eventId: 'suppression_release', zoneId: Z12, elapsedSeconds: 0, interlocks: clean.interlocks }).pending.length > 0, true, 'before the 30 s delay it is pending');
});

test('F11 stage model: release discharges after 30 s, lockout after 300 s, EPO leaves FIRE normal, leak is its own state', () => {
  const run = (eventId, s) => FP.evaluate(inv, FP.createRegister(), { eventId, zoneId: 'DH-02-Z09', startedAtTick: T }, T + Math.ceil(s / 4));
  assert.equal(run('suppression_release', 0).stage, 'suppression_armed'); assert.equal(run('suppression_release', 32).stage, 'discharged');
  assert.equal(run('suppression_discharged', 0).stage, 'discharged'); assert.equal(run('suppression_discharged', 300).stage, 'lockout');
  const epo = run('epo', 0); assert.equal(epo.stage, 'epo_active'); assert.equal(epo.summary.fire, 'NORMAL'); assert.match(epo.summary.epo, /ACTIVE/);
  assert.equal(epo.points.find((p) => p.id === 'DH-02-Z09-EPO').state, 'active');
  const leak = run('water_leak', 0); assert.match(leak.summary.leak, /WET/); assert.equal(leak.summary.fire, 'NORMAL');
  assert.equal(FP.facpInAlarm({ eventId: 'vesda_alert', zoneId: 'x', startedAtTick: T }, T), false);
  assert.equal(FP.facpInAlarm({ eventId: 'manual_call_point', zoneId: 'x', startedAtTick: T }, T), true);
  for (const id of Object.keys(FP.STAGE_OF_EVENT)) { assert.ok(CE.BASE_ROWS.some((r) => r.initiatingEvent.id === id), 'stage map names a real C&E event: ' + id); }
  assert.equal(Object.keys(FP.STAGE_OF_EVENT).length, CE.BASE_ROWS.length, 'every C&E event has a stage');
});

test('F12 serialize / deserialize: round trip, foreign versions and malformed stores are rejected', () => {
  let reg = FP.createRegister(); reg = FP.isolate(inv, reg, REQ('DH-04-Z01-SD1-01'), {}).register;
  const back = FP.deserialize(FP.serialize(reg), inv);
  assert.deepEqual(back, reg);
  assert.equal(FP.deserialize('{"version":2,"sequence":1000,"entries":{}}', inv), null);
  assert.equal(FP.deserialize('not json', inv), null);
  assert.equal(FP.deserialize('{"version":1,"sequence":1000,"entries":{"ghost":{"pointId":"ghost","owner":"shift-a","reason":"x","isolatedAtTick":1,"expiryId":"2h","expiresAtTick":2}}}', inv), null, 'a point not in the inventory fails closed');
  assert.equal(FP.deserialize('{"version":1,"sequence":1000,"entries":{"DH-01-Z05-SD1-01":{"pointId":"DH-01-Z05-SD1-01","owner":"nobody","reason":"x","isolatedAtTick":1,"expiryId":"2h","expiresAtTick":2}}}', inv), null, 'an unknown owner fails closed');
});
