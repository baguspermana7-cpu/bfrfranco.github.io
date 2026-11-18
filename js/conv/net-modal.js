/*
 * net-modal.js — window.RZNetModal: the deep modal of a network block on ict.html
 * (PRD-CONV-LIVING-PLANT §8.3, owner comment C4: "kasih modal firewall dan lain2, yang block2 itu").
 *
 *   build(input) -> payload      pure, Node-tested (tools/test-conv-net-modal.mjs)
 *     input = { segKey, segTitle, layerName, node:{id,label,sub,state,stateText}, scenario:{label,note},
 *               up:[adj], down:[adj], peer:[adj], affected:[label], alarms:[{sev,dev,msg}], facts:[[k,v]] }
 *     adj   = { label, state, kind, link: null | { tag, role, capGbps, trafficGbps, state, redundancy } }
 *   open(payload, trigger)       renders the dialog; Escape / backdrop / Close return focus to the trigger
 *   close(), isOpen()
 *
 * What it shows is the AUTHORED architecture of the page plus design policy per device class. It does not invent
 * telemetry: session counts, CPU, rule hit counters and optical levels are not modelled on this page, and the modal
 * says so instead of drawing a number. Policy tables are a design intent (IEC 62443-3-2 zones and conduits, default
 * deny), not a rule base read from a device. Service ports are the registered ones (BACnet/IP UDP 47808, Modbus TCP
 * 502, SNMP UDP 161/162, NTP UDP 123, syslog UDP 514, HTTPS TCP 443, SSH TCP 22, RTSP TCP 554, BGP TCP 179).
 */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && root.document) root.RZNetModal = api;
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';

  var KIND_LABEL = { firewall: 'Firewall', core: 'Core / spine switch', access: 'Access switch', gateway: 'OT gateway', router: 'Router / WAN', racks: 'Rack group', service: 'Service' };

  function classify(id, label, sub) {
    var s = (id + ' ' + label + ' ' + (sub || '')).toLowerCase();
    if (/(^|[^a-z])(otfw|secfw|oobfw)\b|firewall/.test(s)) return 'firewall';
    if (/-gw\b|-gw-|gateway/.test(s) && !/notification/.test(s)) return 'gateway';
    if (/sw-core|spine/.test(s)) return 'core';
    if (/^tor-|\btor\b|otacc|sw-sec|sw-mgmt|access pair/.test(s)) return 'access';
    if (/^rtr|router|^isp|transit|^dci|dci |lambda|^vrf|^sby01|^mks$/.test(s)) return 'router';
    if (/^hall-|racks/.test(s)) return 'racks';
    return 'service';
  }

  /* Design policy per firewall: zones (IEC 62443 zone / Purdue level) and conduit rules. Authored design intent. */
  var FIREWALL = {
    OTFW: {
      zones: [['Enterprise IT', 'Purdue level 4'], ['Industrial DMZ', 'level 3.5 · historian mirror, patch relay'], ['OT operations', 'level 3 · BMS server, polling master'], ['Control and field', 'levels 2 to 0 · gateways, controllers, devices']],
      rules: [
        ['Industrial DMZ', 'OT operations', 'historian replication, read only', 'HTTPS TCP 443', 'allow'],
        ['OT operations', 'Control and field', 'BACnet/IP UDP 47808 · Modbus TCP 502 · SNMP UDP 161', 'polling master only', 'allow'],
        ['OT operations', 'Industrial DMZ', 'NTP UDP 123 · syslog UDP 514', 'time and logs', 'allow'],
        ['Enterprise IT', 'OT operations', 'any', 'no direct path; through the DMZ only', 'deny'],
        ['Control and field', 'Enterprise IT', 'any', 'no outbound path', 'deny'],
        ['any', 'any', 'any', 'default', 'deny']
      ]
    },
    SECFW: {
      zones: [['Enterprise IT', 'corporate network'], ['Security zone', 'CCTV, access control, intrusion']],
      rules: [
        ['Security zone', 'SOC off-site', 'encrypted video and event feed', 'HTTPS TCP 443', 'allow'],
        ['Security zone', 'Security zone', 'camera streams to recorders', 'RTSP TCP 554', 'allow'],
        ['Enterprise IT', 'Security zone', 'any', 'no direct path', 'deny'],
        ['Security zone', 'Enterprise IT', 'any', 'no direct path', 'deny'],
        ['any', 'any', 'any', 'default', 'deny']
      ]
    },
    OOBFW: {
      zones: [['Remote access', 'MFA gateway'], ['Out-of-band management', 'jump host, consoles, BMC']],
      rules: [
        ['Remote access', 'Jump host', 'administration session after MFA', 'SSH TCP 22 · HTTPS TCP 443', 'allow'],
        ['Jump host', 'Out-of-band management', 'console and BMC access', 'SSH TCP 22 · HTTPS TCP 443', 'allow'],
        ['Out-of-band management', 'production networks', 'any', 'the management plane does not route to production', 'deny'],
        ['any', 'any', 'any', 'default', 'deny']
      ]
    }
  };
  var PROTOCOL = [
    [/bacnet/i, 'BACnet/IP', 'UDP 47808'], [/modbus/i, 'Modbus TCP', 'TCP 502'], [/iec/i, 'IEC 61850 / IEC 60870-5-104 (as integrated)', 'TCP 102 / TCP 2404'],
    [/supervised/i, 'Supervised fire-panel interface (monitor only)', 'panel vendor interface'], [/polling/i, 'Polling master for the facility gateways', 'BACnet/IP UDP 47808 · Modbus TCP 502 · SNMP UDP 161']
  ];
  var GATEWAY_PAGE = { 'EPMS-GW': ['EPMS_Telemetry.html', 'Electrical (EPMS)'], 'CHILLER-GW': ['chiller-plant.html', 'Chiller plant'], 'DATAHALL-GW': ['datahall.html', 'Data hall'],
    'FIRE-GW': ['fire-system.html', 'Fire system'], 'FUEL-GW': ['fuel-system.html', 'Fuel system'], 'WATER-GW': ['water-system.html', 'Water system'] };

  function stateWord(st) { return st === 'up' ? 'UP' : st === 'stby' ? 'STANDBY' : st === 'bad' ? 'FAULT' : st === 'warn' ? 'WARNING' : String(st || '').toUpperCase(); }
  function linkRows(list, dir) {
    return (list || []).map(function (a) {
      var l = a.link, up = l && l.state === 'up';
      return [a.label, dir, l ? l.tag : '—', l ? l.capGbps + ' Gbps' : 'not metered', l ? (up ? l.trafficGbps.toFixed(2) + ' Gbps' : 'standby') : '—',
        l && up && l.capGbps > 0 ? (Math.round(l.trafficGbps / l.capGbps * 1000) / 10) + ' %' : '—', stateWord(a.state)];
    });
  }

  function build(inp) {
    var n = inp.node, kind = classify(n.id, n.label, n.sub), tabs = [];
    var up = inp.up || [], down = inp.down || [], peer = inp.peer || [];
    var overview = [['Device', n.label], ['Class', KIND_LABEL[kind]], ['Role', n.sub], ['Segment', inp.segTitle], ['Layer', inp.layerName], ['State', n.stateText || stateWord(n.state)],
      ['Scenario', inp.scenario ? inp.scenario.label : '—']].concat(inp.facts || []);
    var blocks = [{ type: 'kv', rows: overview }];
    if (inp.scenario && inp.scenario.note) blocks.push({ type: 'note', text: 'Scenario effect: ' + inp.scenario.note });
    blocks.push({ type: 'note', text: 'Source: the authored architecture of this page. Simulated; no device is polled.' });
    tabs.push({ id: 'overview', label: 'Overview', blocks: blocks });

    var ports = linkRows(up, 'uplink').concat(linkRows(peer, 'peer')).concat(linkRows(down, 'downlink'));
    var HEAD = ['Neighbour', 'Direction', 'Link', 'Capacity', 'Traffic', 'Utilisation', 'State'];

    if (kind === 'firewall') {
      var fw = FIREWALL[n.id];
      if (fw) {
        tabs.push({ id: 'zones', label: 'Zones', blocks: [{ type: 'zones', zones: fw.zones, device: n.label },
          { type: 'note', text: 'Zones and conduits after IEC 62443-3-2. The firewall is the only conduit between the zones shown.' }] });
        tabs.push({ id: 'policy', label: 'Policy', blocks: [{ type: 'table', head: ['Source zone', 'Destination zone', 'Service', 'Condition', 'Action'], rows: fw.rules, actionCol: 4 },
          { type: 'note', text: 'Design policy, default deny. This is the intended rule set of the architecture, not a rule base read from a device; hit counters, sessions and CPU are not modelled.' }] });
      }
      tabs.push({ id: 'interfaces', label: 'Interfaces', blocks: [{ type: 'table', head: HEAD, rows: ports, stateCol: 6 }] });
    } else if (kind === 'core' || kind === 'access') {
      var upN = up.length, upLive = up.filter(function (a) { return a.state === 'up'; }).length;
      tabs.push({ id: 'ports', label: 'Ports', blocks: [
        { type: 'portmap', ports: up.map(function (a) { return ['U', a.label, a.state]; }).concat(peer.map(function (a) { return ['P', a.label, a.state]; })).concat(down.map(function (a) { return ['D', a.label, a.state]; })) },
        { type: 'table', head: HEAD, rows: ports, stateCol: 6 },
        { type: 'kv', rows: [['Uplinks live', upLive + ' of ' + upN], ['Peer link', peer.length ? peer.map(function (a) { return a.label + ' ' + stateWord(a.state); }).join(', ') : 'none drawn'],
          ['Redundancy role', n.stateText || stateWord(n.state)]] },
        { type: 'note', text: 'One cell per drawn connection (U uplink, P peer, D downlink). Per-port counters, VLAN tables, spanning-tree roles and optical levels are not modelled.' }] });
    } else if (kind === 'gateway') {
      var pr = null; PROTOCOL.forEach(function (p) { if (!pr && p[0].test(n.sub || '')) pr = p; });
      var pg = GATEWAY_PAGE[n.id];
      var rows = [['Protocol', pr ? pr[1] : (n.sub || '—')], ['Service port', pr ? pr[2] : '—'], ['Polled by', up.length ? up.map(function (a) { return a.label; }).join(', ') : '—'],
        ['Polling state', n.stateText || stateWord(n.state)]];
      var gb = [{ type: 'kv', rows: rows }];
      if (pg) gb.push({ type: 'link', href: pg[0], text: 'Open the ' + pg[1] + ' cockpit', hint: 'The points this gateway serves are shown there.' });
      gb.push({ type: 'note', text: 'Point counts, poll rate and failed-poll counters are not modelled on this page.' });
      tabs.push({ id: 'protocol', label: 'Protocol', blocks: gb });
      if (ports.length) tabs.push({ id: 'links', label: 'Connections', blocks: [{ type: 'table', head: HEAD, rows: ports, stateCol: 6 }] });
    } else if (kind === 'router') {
      tabs.push({ id: 'circuits', label: 'Circuits', blocks: [{ type: 'table', head: HEAD, rows: ports, stateCol: 6 },
        { type: 'kv', rows: [['Routing', /bgp|transit|as-path/i.test((n.sub || '') + ' ' + (n.stateText || '')) ? 'BGP (TCP 179)' : 'as drawn'], ['Path state', n.stateText || stateWord(n.state)]] },
        { type: 'note', text: 'Latency, loss and jitter of a metered link are in the link inspector (click the link). Route tables and BGP timers are not modelled.' }] });
    } else if (ports.length) {
      tabs.push({ id: 'links', label: 'Connections', blocks: [{ type: 'table', head: HEAD, rows: ports, stateCol: 6 }] });
    }

    tabs.push({ id: 'deps', label: 'Dependencies', blocks: [{ type: 'kv', rows: [
      ['Upstream', up.length ? up.map(function (a) { return a.label; }).join(', ') : 'none'], ['Peer', peer.length ? peer.map(function (a) { return a.label; }).join(', ') : 'none'],
      ['Downstream', down.length ? down.map(function (a) { return a.label; }).join(', ') : 'none'],
      ['Fault domain', (inp.affected || []).length ? inp.affected.length + ' downstream: ' + inp.affected.join(', ') : 'local (no downstream dependency)']] }] });
    var al = inp.alarms || [];
    tabs.push({ id: 'alarms', label: 'Alarms', blocks: al.length
      ? [{ type: 'table', head: ['Severity', 'Device', 'Message'], rows: al.map(function (a) { return [String(a.sev || '').toUpperCase(), a.dev || '', a.msg || '']; }) }]
      : [{ type: 'note', text: 'No alarm in the authored register names this device.' }] });
    return { id: n.id, kind: kind, kindLabel: KIND_LABEL[kind], title: n.label, role: n.sub, state: n.state, stateText: n.stateText || stateWord(n.state), segment: inp.segTitle, tabs: tabs };
  }

  /* ---- DOM ------------------------------------------------------------------------------------------ */
  var el = null, trigger = null;
  var BASIS = 'Network block detail restates the authored architecture of this page (devices, links, states, TRAFFIC_SCENARIO capacities and traffic) and a design policy per device class; it is explicitly outside the Conventional engine, which has no network model. Simulated; no device is polled.';
  var CSS = '.rz-nm{position:fixed;inset:0;z-index:2147482000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(5,6,8,.62)}.rz-nm[hidden]{display:none}'
    + '.rz-nm-panel{--nm-bg:#121316;--nm-panel:#191b1f;--nm-line:rgba(255,255,255,.12);--nm-text:#e8edf5;--nm-mute:#9aa4b2;--nm-acc:#E8B563;--nm-ok:#3fb950;--nm-warn:#e8b563;--nm-bad:#f85149;'
    + 'background:var(--nm-bg);color:var(--nm-text);border:1px solid var(--nm-line);border-radius:4px;width:min(880px,100%);max-height:calc(100vh - 32px);overflow:auto;font:13px/1.45 IBM Plex Sans,system-ui,sans-serif}'
    + '[data-theme="light"] .rz-nm-panel{--nm-bg:#ffffff;--nm-panel:#f5f7fa;--nm-line:rgba(15,23,42,.14);--nm-text:#1b2430;--nm-mute:#4b5563;--nm-acc:#7A4800;--nm-ok:#1a7f37;--nm-warn:#8a5300;--nm-bad:#b42318}'
    + '.rz-nm-head{display:flex;gap:12px;align-items:flex-start;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--nm-line);position:sticky;top:0;background:var(--nm-bg);z-index:1}'
    + '.rz-nm-kind{font:600 11px/1.3 JetBrains Mono,monospace;letter-spacing:.05em;text-transform:uppercase;color:var(--nm-mute)}.rz-nm-title{margin:4px 0 0;font-size:16px;font-weight:600}.rz-nm-role{margin:4px 0 0;color:var(--nm-mute)}'
    + '.rz-nm-st{display:inline-block;margin-top:4px;padding:0 8px;border:1px solid var(--nm-line);border-radius:3px;font:600 11px/1.8 JetBrains Mono,monospace}'
    + '.rz-nm-st[data-st="up"]{color:var(--nm-ok)}.rz-nm-st[data-st="warn"]{color:var(--nm-warn)}.rz-nm-st[data-st="bad"]{color:var(--nm-bad)}.rz-nm-st[data-st="stby"]{color:var(--nm-mute)}'
    + '.rz-nm-x{min-width:44px;min-height:44px;border:1px solid var(--nm-line);border-radius:3px;background:transparent;color:var(--nm-text);font:inherit;cursor:pointer}'
    + '.rz-nm-tabs{display:flex;flex-wrap:wrap;gap:4px;padding:8px 16px 0;border-bottom:1px solid var(--nm-line)}'
    + '.rz-nm-tab{padding:8px 12px;border:0;border-bottom:2px solid transparent;background:transparent;color:var(--nm-mute);font:600 13px IBM Plex Sans,system-ui,sans-serif;cursor:pointer}'
    + '.rz-nm-tab[aria-selected="true"]{color:var(--nm-text);border-bottom-color:var(--nm-acc)}.rz-nm-tab:focus-visible,.rz-nm-x:focus-visible,.rz-nm-link:focus-visible{outline:2px solid var(--nm-acc);outline-offset:1px}'
    + '.rz-nm-body{padding:12px 16px 16px}.rz-nm-kv{display:grid;grid-template-columns:minmax(120px,200px) 1fr;gap:4px 16px;margin:0 0 12px}.rz-nm-kv dt{color:var(--nm-mute)}.rz-nm-kv dd{margin:0}'
    + '.rz-nm-scroll{overflow-x:auto;margin:0 0 12px}.rz-nm-tbl{width:100%;border-collapse:collapse;font-size:13px}.rz-nm-tbl th{text-align:left;font:600 11px/1.4 JetBrains Mono,monospace;letter-spacing:.04em;text-transform:uppercase;color:var(--nm-mute);padding:4px 8px;border-bottom:1px solid var(--nm-line);white-space:nowrap}'
    + '.rz-nm-tbl td{padding:4px 8px;border-bottom:1px solid var(--nm-line);vertical-align:top}.rz-nm-tbl td[data-v="allow"],.rz-nm-tbl td[data-v="UP"]{color:var(--nm-ok)}.rz-nm-tbl td[data-v="deny"],.rz-nm-tbl td[data-v="FAULT"]{color:var(--nm-bad)}.rz-nm-tbl td[data-v="WARNING"]{color:var(--nm-warn)}.rz-nm-tbl td[data-v="STANDBY"]{color:var(--nm-mute)}'
    + '.rz-nm-note{margin:0 0 12px;color:var(--nm-mute);font-size:13px}'
    + '.rz-nm-zones{display:flex;flex-wrap:wrap;align-items:stretch;gap:0;margin:0 0 12px}.rz-nm-zone{flex:1 1 140px;border:1px solid var(--nm-line);border-radius:3px;padding:8px;background:var(--nm-panel)}'
    + '.rz-nm-zone b{display:block;font-weight:600}.rz-nm-zone span{color:var(--nm-mute);font-size:13px}.rz-nm-conduit{flex:0 0 auto;align-self:center;padding:0 8px;font:600 11px JetBrains Mono,monospace;color:var(--nm-acc);white-space:nowrap}'
    + '.rz-nm-ports{display:flex;flex-wrap:wrap;gap:4px;margin:0 0 12px}.rz-nm-port{min-width:44px;padding:4px 8px;border:1px solid var(--nm-line);border-radius:3px;background:var(--nm-panel);font:600 11px/1.4 JetBrains Mono,monospace}'
    + '.rz-nm-port i{display:block;font-style:normal;font-weight:400;color:var(--nm-mute);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
    + '.rz-nm-port[data-st="up"]{border-color:var(--nm-ok)}.rz-nm-port[data-st="warn"]{border-color:var(--nm-warn);border-style:dashed}.rz-nm-port[data-st="bad"]{border-color:var(--nm-bad);border-style:dotted}.rz-nm-port[data-st="stby"]{border-style:dashed}'
    + '.rz-nm-link{display:inline-block;margin:0 0 4px;padding:8px 12px;border:1px solid var(--nm-acc);border-radius:3px;color:var(--nm-text);text-decoration:none;font-weight:600}'
    + '@media (max-width:560px){.rz-nm{padding:0;align-items:flex-end}.rz-nm-panel{max-height:92vh;border-radius:4px 4px 0 0}.rz-nm-kv{grid-template-columns:1fr}.rz-nm-kv dt{margin-top:4px}.rz-nm-conduit{flex-basis:100%;text-align:center;padding:4px 0}}';

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  function block(b) {
    if (b.type === 'kv') return '<dl class="rz-nm-kv">' + b.rows.map(function (r) { return '<dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd>'; }).join('') + '</dl>';
    if (b.type === 'note') return '<p class="rz-nm-note">' + esc(b.text) + '</p>';
    if (b.type === 'link') return '<p class="rz-nm-note"><a class="rz-nm-link" href="' + esc(b.href) + '">' + esc(b.text) + '</a><br>' + esc(b.hint) + '</p>';
    if (b.type === 'table') {
      if (!b.rows.length) return '<p class="rz-nm-note">No connection is drawn for this device.</p>';
      return '<div class="rz-nm-scroll"><table class="rz-nm-tbl"><thead><tr>' + b.head.map(function (h) { return '<th scope="col">' + esc(h) + '</th>'; }).join('') + '</tr></thead><tbody>'
        + b.rows.map(function (r) { return '<tr>' + r.map(function (c, i) { return '<td' + ((i === b.actionCol || i === b.stateCol) ? ' data-v="' + esc(c) + '"' : '') + '>' + esc(c) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
    }
    if (b.type === 'zones') return '<div class="rz-nm-zones">' + b.zones.map(function (z, i) {
      return (i ? '<span class="rz-nm-conduit" aria-label="conduit through ' + esc(b.device) + '">◂ ' + esc(b.device) + ' ▸</span>' : '') + '<div class="rz-nm-zone"><b>' + esc(z[0]) + '</b><span>' + esc(z[1]) + '</span></div>'; }).join('') + '</div>';
    if (b.type === 'portmap') return '<div class="rz-nm-ports">' + b.ports.map(function (p) { return '<span class="rz-nm-port" data-st="' + esc(p[2]) + '" title="' + esc(p[1] + ' · ' + stateWord(p[2])) + '">' + esc(p[0]) + ' · ' + esc(stateWord(p[2])) + '<i>' + esc(p[1]) + '</i></span>'; }).join('') + '</div>';
    return '';
  }
  function show(id) {
    if (!el) return;
    Array.prototype.forEach.call(el.querySelectorAll('.rz-nm-tab'), function (t) { var on = t.getAttribute('data-tab') === id; t.setAttribute('aria-selected', on ? 'true' : 'false'); t.tabIndex = on ? 0 : -1; });
    Array.prototype.forEach.call(el.querySelectorAll('.rz-nm-pane'), function (p) { p.hidden = p.getAttribute('data-pane') !== id; });
  }
  function close() {
    if (!el) return;
    root.document.removeEventListener('keydown', onKey, true);
    el.parentNode.removeChild(el); el = null;
    if (trigger && trigger.focus) trigger.focus();
    trigger = null;
  }
  function onKey(ev) {
    if (!el) return;
    if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); close(); return; }
    if (ev.key === 'Tab') {
      var f = Array.prototype.filter.call(el.querySelectorAll('button,a[href],[tabindex="0"]'), function (x) { return !x.hidden && x.getClientRects().length; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1], a = root.document.activeElement;
      if (ev.shiftKey && a === first) { ev.preventDefault(); last.focus(); } else if (!ev.shiftKey && a === last) { ev.preventDefault(); first.focus(); }
    }
    if ((ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') && root.document.activeElement && root.document.activeElement.classList.contains('rz-nm-tab')) {
      var tabs = Array.prototype.slice.call(el.querySelectorAll('.rz-nm-tab')), i = tabs.indexOf(root.document.activeElement), j = (i + (ev.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length;
      show(tabs[j].getAttribute('data-tab')); tabs[j].focus();
    }
  }
  function open(p, trig) {
    var doc = root.document; close();
    if (!doc.getElementById('rz-nm-css')) { var st = doc.createElement('style'); st.id = 'rz-nm-css'; st.textContent = CSS; doc.head.appendChild(st); }
    trigger = trig || doc.activeElement;
    el = doc.createElement('div'); el.className = 'rz-nm'; el.setAttribute('data-rz-authored-basis', BASIS);
    el.innerHTML = '<div class="rz-nm-panel" role="dialog" aria-modal="true" aria-labelledby="rz-nm-title" data-node="' + esc(p.id) + '" data-kind="' + esc(p.kind) + '">'
      + '<div class="rz-nm-head"><div><div class="rz-nm-kind">' + esc(p.kindLabel) + ' · ' + esc(p.segment) + ' · simulated</div><h2 class="rz-nm-title" id="rz-nm-title">' + esc(p.title) + '</h2>'
      + '<p class="rz-nm-role">' + esc(p.role) + '</p><span class="rz-nm-st" data-st="' + esc(p.state) + '">' + esc(p.stateText) + '</span></div><button type="button" class="rz-nm-x" aria-label="Close">Close</button></div>'
      + '<div class="rz-nm-tabs" role="tablist" aria-label="Device detail">' + p.tabs.map(function (t) { return '<button type="button" class="rz-nm-tab" role="tab" data-tab="' + t.id + '" aria-controls="rz-nm-pane-' + t.id + '">' + esc(t.label) + '</button>'; }).join('') + '</div>'
      + '<div class="rz-nm-body">' + p.tabs.map(function (t) { return '<div class="rz-nm-pane" role="tabpanel" id="rz-nm-pane-' + t.id + '" data-pane="' + t.id + '">' + t.blocks.map(block).join('') + '</div>'; }).join('') + '</div></div>';
    doc.body.appendChild(el);
    el.addEventListener('click', function (ev) {
      if (ev.target === el || (ev.target.closest && ev.target.closest('.rz-nm-x'))) { close(); return; }
      var t = ev.target.closest && ev.target.closest('.rz-nm-tab'); if (t) show(t.getAttribute('data-tab'));
    });
    doc.addEventListener('keydown', onKey, true);
    show(p.tabs[0].id);
    el.querySelector('.rz-nm-tab').focus();
  }

  return { build: build, classify: classify, open: open, close: close, isOpen: function () { return !!el; }, FIREWALL: FIREWALL };
});
