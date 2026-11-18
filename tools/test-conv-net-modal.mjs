#!/usr/bin/env node
/* test-conv-net-modal.mjs — the pure laws of js/conv/net-modal.js (PRD-CONV-LIVING-PLANT §8.3). node --test
   M1 device classes: firewalls, gateways, core, access, routers, rack groups and services are told apart
   M2 connections: one row per drawn connection (uplink + peer + downlink); utilisation = traffic / capacity; a standby
      or unmetered link never shows a traffic number
   M3 firewall policy: zones >= 2, at least one allow, the LAST rule is any -> any deny; every service names a
      registered port or "any"
   M4 gateway: protocol and port from its role; a link to the subsystem cockpit that exists on disk
   M5 every payload: Overview first, Dependencies and Alarms present, no "undefined" / "NaN" anywhere; no alarm ->
      a sentence, never an empty table
   M6 the module states what it does not model instead of a number (no session, CPU or hit-count value)
   M7 no random draw and no clock read */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const M = createRequire(import.meta.url)(path.join(ROOT, 'js/conv/net-modal.js'));
const node = (id, label, sub, state = 'up', stateText) => ({ id, label, sub, layer: 1, state, stateText });
const adj = (label, state, link, kind = 'link') => ({ label, state, kind, link });
const base = (n, extra = {}) => ({ segKey: 'it', segTitle: 'IT / Data Fabric', layerName: 'Edge / Core', node: n, scenario: { label: 'Normal', note: '' }, up: [], down: [], peer: [], affected: [], alarms: [], facts: [], ...extra });
const text = (p) => JSON.stringify(p);

test('M1 device classes', () => {
  const want = { OTFW: 'firewall', SECFW: 'firewall', OOBFW: 'firewall', 'EPMS-GW': 'gateway', 'BMS-GW-01': 'gateway', 'FIRE-GW': 'gateway', 'SW-CORE-A': 'core', SPINE: 'core',
    'TOR-A': 'access', OTACC: 'access', 'SW-SEC-A': 'access', 'SW-MGMT-B': 'access', 'RTR-BKS01': 'router', 'ISP-1': 'router', DCI: 'router', VRF: 'router', 'HALL-A': 'racks', NTP: 'service', JUMP: 'service', RELAY: 'service', MONSRV: 'service' };
  const labels = { OTFW: 'OT firewall pair', SECFW: 'Security firewall', OOBFW: 'OOB firewall', OTACC: 'OT access pair', SPINE: 'SPINE 1-4', 'TOR-A': 'ToR 01-05 · Hall A', DCI: 'DCI BKS01-MKS', VRF: 'Transit VRF', 'HALL-A': 'Hall A racks', NTP: 'NTP Stratum-1', JUMP: 'Jump host', RELAY: 'Notification relay', MONSRV: 'Monitoring server' };
  for (const [id, kind] of Object.entries(want)) assert.equal(M.classify(id, labels[id] || id, ''), kind, id);
});
test('M2 connections', () => {
  const p = M.build(base(node('SW-CORE-A', 'SW-CORE-A', 'core · DUTY', 'up', 'DUTY'), {
    up: [adj('RTR-BKS01', 'up', { tag: 'L1', role: 'edge', capGbps: 40, trafficGbps: 14.2, state: 'up', redundancy: 'N+1' })],
    peer: [adj('SW-CORE-B', 'up', null, 'peer')],
    down: [adj('SPINE 1-4', 'up', { tag: 'L3', role: 'fabric', capGbps: 100, trafficGbps: 25.6, state: 'up' }), adj('Customer L3 edge', 'stby', { tag: 'L4', role: 'cust', capGbps: 10, trafficGbps: 7.8, state: 'stby' })] }));
  const tab = p.tabs.find((t) => t.id === 'ports'), tbl = tab.blocks.find((b) => b.type === 'table');
  assert.equal(tbl.rows.length, 4);
  assert.equal(tbl.rows[0][5], '35.5 %');
  assert.equal(tbl.rows[1][3], 'not metered'); assert.equal(tbl.rows[1][4], '—');
  assert.equal(tbl.rows[3][4], 'standby'); assert.equal(tbl.rows[3][5], '—');
  assert.equal(tab.blocks.find((b) => b.type === 'portmap').ports.length, 4);
});
test('M3 firewall policy', () => {
  const PORT = /(TCP|UDP) \d+|^any$|read only|feed|streams|session|access/;
  for (const id of ['OTFW', 'SECFW', 'OOBFW']) {
    const p = M.build(base(node(id, id === 'OTFW' ? 'OT firewall pair' : id, 'policy enforcement')));
    assert.equal(p.kind, 'firewall');
    const zones = p.tabs.find((t) => t.id === 'zones').blocks[0].zones, rules = p.tabs.find((t) => t.id === 'policy').blocks[0].rows;
    assert.ok(zones.length >= 2, id + ' zones');
    assert.ok(rules.some((r) => r[4] === 'allow'), id + ' has no allow');
    assert.deepEqual(rules[rules.length - 1].slice(0, 3).concat(rules[rules.length - 1][4]), ['any', 'any', 'any', 'deny'], id + ' last rule');
    rules.forEach((r) => { assert.ok(r[4] === 'allow' || r[4] === 'deny'); assert.ok(PORT.test(r[2]) || PORT.test(r[3]), id + ' service: ' + r[2] + ' / ' + r[3]); });
    rules.filter((r) => r[4] === 'allow').forEach((r) => assert.ok(/(TCP|UDP) \d+/.test(r[2] + ' ' + r[3]), id + ' allow rule names no port: ' + r.join(' | ')));
  }
});
test('M4 gateway', () => {
  for (const [id, sub, proto, port] of [['EPMS-GW', 'Modbus / IEC', 'Modbus TCP', 'TCP 502'], ['CHILLER-GW', 'BACnet', 'BACnet/IP', 'UDP 47808'], ['WATER-GW', 'Modbus', 'Modbus TCP', 'TCP 502']]) {
    const p = M.build(base(node(id, id, sub), { up: [adj('OT access pair', 'up', null)] }));
    const b = p.tabs.find((t) => t.id === 'protocol').blocks, kv = Object.fromEntries(b[0].rows);
    assert.equal(kv.Protocol, proto); assert.equal(kv['Service port'], port); assert.equal(kv['Polled by'], 'OT access pair');
    const link = b.find((x) => x.type === 'link'); assert.ok(link && fs.existsSync(path.join(ROOT, link.href)), id + ' cockpit link');
  }
});
test('M5 payload shape', () => {
  const cases = [node('NTP', 'NTP Stratum-1', 'locked', 'up', 'LOCKED'), node('HALL-A', 'Hall A racks', 'study 500 racks'), node('ISP-2', 'ISP-2', 'transit · standby', 'stby'), node('OTFW', 'OT firewall pair', 'policy')];
  for (const n of cases) {
    const p = M.build(base(n));
    assert.equal(p.tabs[0].id, 'overview'); assert.ok(p.tabs.some((t) => t.id === 'deps') && p.tabs.some((t) => t.id === 'alarms'));
    assert.ok(!/undefined|NaN/.test(text(p)), n.id);
    assert.equal(p.tabs.find((t) => t.id === 'alarms').blocks[0].type, 'note');
    assert.equal(p.title, n.label);
  }
  const withAlarm = M.build(base(node('VMS', 'VMS core', 'retention'), { alarms: [{ sev: 'warn', dev: 'VMS-01', msg: 'Video retention below target.' }] }));
  assert.deepEqual(withAlarm.tabs.find((t) => t.id === 'alarms').blocks[0].rows[0], ['WARN', 'VMS-01', 'Video retention below target.']);
});
test('M6 states what is not modelled', () => {
  const fw = text(M.build(base(node('OTFW', 'OT firewall pair', 'policy')))), sw = text(M.build(base(node('SW-CORE-A', 'SW-CORE-A', 'core'))));
  assert.ok(/not modelled/.test(fw) && /not modelled/.test(sw));
  assert.ok(!/\d+\s*(sessions|hits|% CPU)/i.test(fw + sw));
});
test('M7 no random, no clock', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js/conv/net-modal.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!/Math\.random|Date\.now|new Date/.test(src));
});
