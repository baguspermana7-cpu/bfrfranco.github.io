/*!
 * rz-pid-build.js — the P&ID graph builder (resistancezero.com, R116/R117)
 *
 * Load order: rz-pid-build.js -> rz-pid-graph.js (public window.RZPid: explain, flow rank, heat balance)
 * -> rz-pid-render.js (SVG + interaction, browser only). In Node, require('js/rz-pid-graph.js').
 *
 * The graph model and its rules are a JavaScript port of PID-to-Knowledge-Graph by
 * Scott Duncan — https://github.com/ScottDuncanAI/PID-to-Knowledge-Graph
 * (skills/pid-to-kg/scripts/pidkg/{isa,build,loops,summary}.py, references/ontology.md).
 * That work is MIT licensed:
 *
 *   MIT License — Copyright (c) 2026 The pid-to-kg contributors
 *   Permission is hereby granted, free of charge, to any person obtaining a copy of this
 *   software and associated documentation files (the "Software"), to deal in the Software
 *   without restriction, including without limitation the rights to use, copy, modify,
 *   merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
 *   permit persons to whom the Software is furnished to do so, subject to the following
 *   conditions: The above copyright notice and this permission notice shall be included in
 *   all copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS",
 *   WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED.
 *
 * What is ported exactly: extraction schema v1.0 input, tag normalisation, ISA-5.1 parsing,
 * line expansion into PipeSegment chains (tees by {line, after}), off-page pairing,
 * MEASURES (in-line = upstream segment; transmitter inherits its primary element's or ISA
 * loop's location), SIGNAL_TO, loop grouping by ISA key + signal tracing through relays
 * (ACTUATES, MEMBER_OF roles, CASCADES_TO, interlocks + TRIPS), derived FEEDS, and the
 * three-part reading order (process flow, measurement, control).
 * Not ported: per-sheet tag scoping (tag_scopes), PFD/P&ID view merging, name-conflict QA.
 *
 * What is RZ (in the other two files): the explanation steps, the heat balance, the drawing, the motion.
 * Vanilla ES5, no build.
 */
(function (root) {
  'use strict';
  if (root.RZPidBuild) { if (typeof module !== 'undefined' && module.exports) module.exports = root.RZPidBuild; return; }

  /* ------------------------------------------------------------ ISA-5.1 tables */
  var ISA_MEASURED = { A: 'analysis', B: 'burner/flame', C: 'conductivity', D: 'density', E: 'voltage',
    F: 'flow', G: 'gauging/position', H: 'hand', I: 'current', J: 'power', K: 'time', L: 'level',
    M: 'moisture', N: 'user-defined', O: 'user-defined', P: 'pressure', Q: 'quantity', R: 'radiation',
    S: 'speed/frequency', T: 'temperature', U: 'multivariable', V: 'vibration', W: 'weight/force',
    X: 'unclassified', Y: 'event/state', Z: 'position' };
  var ISA_VARIABLE_MODIFIERS = { D: 'differential', F: 'ratio', J: 'scan', K: 'rate of change', Q: 'integrate/totalize' };
  var ISA_FUNCTIONS = { A: 'alarm', B: "user's choice", C: 'control', D: 'differential', E: 'primary element',
    G: 'glass/gauge', H: 'high', I: 'indicate', K: 'control station', L: 'light/low', M: 'middle',
    N: "user's choice", O: 'orifice/restriction', P: 'test point', Q: 'totalize', R: 'record', S: 'switch',
    T: 'transmit', U: 'multifunction', V: 'valve/damper', W: 'well', X: 'unclassified',
    Y: 'relay/compute/convert', Z: 'driver/actuator' };
  /* Reader-facing words for the decode ("FIC = Flow, Indicating, Controller"). */
  var FN_WORD = { A: 'Alarm', C: 'Controller', E: 'Element', G: 'Gauge', H: 'High', I: 'Indicating',
    K: 'Control station', L: 'Low', M: 'Middle', O: 'Orifice', P: 'Test point', Q: 'Totalizing',
    R: 'Recording', S: 'Switch', T: 'Transmitter', U: 'Multifunction', V: 'Valve', W: 'Well',
    X: 'Unclassified', Y: 'Relay / converter', Z: 'Driver' };
  var LOCATION_WORD = { field: 'field mounted', local_panel: 'local panel', main_panel: 'main control panel',
    behind_panel: 'behind the panel', dcs: 'DCS / shared display', plc: 'PLC', scada: 'SCADA',
    sis: 'safety system', computer: 'computer function', unknown: 'location not shown' };
  var ACTUATED_COMPONENT_KINDS = { control_valve: 1, on_off_valve: 1, solenoid_valve: 1, motor_operated_valve: 1, three_way_valve: 1 };
  var RELIEF = { PSV: 1, PRV: 1, PSE: 1, TSV: 1, TSE: 1, VRV: 1, PVRV: 1, PVSV: 1 };
  var ISA_VALVE_FUNCTIONS = { V: 1, CV: 1, SV: 1, Y: 1, Z: 1, SE: 1, SO: 1, SC: 1, Q: 1 };
  var SENSOR_ROLES = { transmitter: 1, element: 1, switch: 1, gauge: 1, indicator: 1, recorder: 1, totalizer: 1, alarm: 1 };
  var READOUT_ROLES = { indicator: 1, recorder: 1, totalizer: 1, alarm: 1 };
  var PANEL_LOCATIONS = { main_panel: 1, behind_panel: 1, dcs: 1, plc: 1, scada: 1, sis: 1, computer: 1 };
  var TERMINAL_TYPES = { Equipment: 1, Boundary: 1 };
  var LOW_CONFIDENCE = 0.7;

  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function pad5(n) { var s = String(n); while (s.length < 5) s = '0' + s; return s; }
  function isEmpty(v) {
    if (v === null || v === undefined || v === '') return true;
    if (Object.prototype.toString.call(v) === '[object Array]') return v.length === 0;
    if (typeof v === 'object') { for (var k in v) if (has(v, k)) return false; return true; }
    return false;
  }
  function clean(d) { var o = {}; for (var k in d) if (has(d, k) && !isEmpty(d[k])) o[k] = d[k]; return o; }
  function copy(d) { var o = {}; for (var k in (d || {})) if (has(d, k)) o[k] = d[k]; return o; }
  function mergeList(a, b) { var out = a.slice(); for (var i = 0; i < b.length; i++) if (out.indexOf(b[i]) < 0) out.push(b[i]); return out; }
  function slug(s) { var t = String(s || 'other').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, ''); return t || 'other'; }
  function pretty(kind) { return String(kind).replace(/_/g, ' '); }

  /* ------------------------------------------------------------ tags (isa.py) */
  var DASHES = /[‐‑‒–—−]/g;
  function normalizeTag(raw) {
    if (raw === null || raw === undefined) return null;
    var s = String(raw).replace(DASHES, '-').trim().replace(/^["']+|["']+$/g, '').toUpperCase();
    if (!s) return null;
    s = s.replace(/[\s_\/]*-[\s_\/]*/g, '-');
    s = s.replace(/[\s_]+/g, '-');
    s = s.replace(/-{2,}/g, '-').replace(/^-+|-+$/g, '');
    var m = /^([A-Z]{1,6})(\d{1,6}[A-Z]{0,2})$/.exec(s);
    if (m) s = m[1] + '-' + m[2];
    return s;
  }
  function normalizeLabel(raw) {
    var s = String(raw || '').replace(DASHES, '-').toUpperCase();
    s = s.replace(/[^A-Z0-9#\-. ]+/g, ' ');
    return s.replace(/\s+/g, ' ').trim();
  }
  var ISA_TAG = /^(?:([0-9][0-9A-Z]*)-)?([A-Z]{1,6})-([A-Z]?\d{1,5})([A-Z]{0,2})(?:-([A-Z0-9]{1,4}))?$/;
  function fnRole(fn) {
    var last = fn.charAt(fn.length - 1);
    if (last === 'V' || last === 'Z') return 'final_element';
    if (fn.indexOf('Y') >= 0) return 'relay';
    if (fn.indexOf('C') >= 0 || last === 'K') return 'controller';
    if (fn.indexOf('T') >= 0) return 'transmitter';
    if (fn.indexOf('S') >= 0) return 'switch';
    if (fn.indexOf('E') >= 0) return 'element';
    if (fn.indexOf('G') >= 0) return 'gauge';
    if (fn.indexOf('I') >= 0) return 'indicator';
    if (fn.indexOf('R') >= 0) return 'recorder';
    if (fn.indexOf('Q') >= 0) return 'totalizer';
    if (fn.indexOf('A') >= 0) return 'alarm';
    return 'other';
  }
  function parseIsaTag(tag) {
    var t = normalizeTag(tag);
    if (!t) return null;
    var m = ISA_TAG.exec(t);
    if (!m) return null;
    var letters = m[2], first = letters.charAt(0), rest = letters.slice(1);
    if (!has(ISA_MEASURED, first)) return null;
    var variableCode = first, modifiers = [], state = null, functions, role;
    if ('XYZ'.indexOf(first) >= 0 && rest.length >= 2 && 'OC'.indexOf(rest.charAt(rest.length - 1)) >= 0 &&
        'IS'.indexOf(rest.charAt(rest.length - 2)) >= 0) {
      state = rest.charAt(rest.length - 1) === 'O' ? 'open' : 'closed';
      rest = rest.slice(0, -1);
    }
    if (has(RELIEF, letters)) {
      functions = ['safety', 'valve']; role = 'relief_device';
    } else {
      if (rest && has(ISA_VARIABLE_MODIFIERS, rest.charAt(0)) && rest.length > 1) {
        variableCode = first + rest.charAt(0);
        modifiers.push(ISA_VARIABLE_MODIFIERS[rest.charAt(0)]);
        rest = rest.slice(1);
      }
      functions = [];
      for (var i = 0; i < rest.length; i++) functions.push(ISA_FUNCTIONS[rest.charAt(i)] || rest.charAt(i));
      if (state) functions.push(state);
      role = fnRole(rest);
      if (first === 'H' && (role === 'switch' || role === 'controller' || role === 'indicator' || role === 'other')) role = 'hand_switch';
    }
    var variable = ISA_MEASURED[first];
    if (modifiers.length) variable = modifiers[0] + ' ' + variable;
    var prefix = m[1] || null, number = m[3];
    var base = variableCode.charAt(0) + '-' + number;
    return { tag: t, prefix: prefix, letters: letters, number: number, suffix: m[4] || '',
      variableCode: variableCode, variable: variable, modifiers: modifiers, functions: functions,
      role: role, loopKey: prefix ? prefix + '-' + base : base, fnLetters: rest };
  }
  function loopVariable(key) {
    var core = String(key).split('@')[0].split('#')[0];
    var parts = core.split('-');
    var code = parts.length >= 2 ? parts[parts.length - 2] : '';
    if (!code || !has(ISA_MEASURED, code.charAt(0))) return null;
    var v = ISA_MEASURED[code.charAt(0)];
    if (code.length > 1 && has(ISA_VARIABLE_MODIFIERS, code.charAt(1))) v = ISA_VARIABLE_MODIFIERS[code.charAt(1)] + ' ' + v;
    return v;
  }
  function isaValveTag(isa) {
    if (isa.role === 'relief_device') return true;
    var rest = isa.letters.slice(isa.variableCode.length);
    return has(ISA_VALVE_FUNCTIONS, rest) || /CV$/.test(rest);
  }
  /* "FIC" -> "Flow, Indicating, Controller" */
  function decodeTag(tag) {
    var isa = parseIsaTag(tag);
    if (!isa) return null;
    var words = [];
    var v = ISA_MEASURED[isa.letters.charAt(0)];
    if (isa.modifiers.length) v = isa.modifiers[0] + ' ' + v;
    words.push(v.charAt(0).toUpperCase() + v.slice(1));
    if (isa.role === 'relief_device') words.push('Safety', 'Valve');
    else for (var i = 0; i < isa.fnLetters.length; i++) words.push(FN_WORD[isa.fnLetters.charAt(i)] || isa.fnLetters.charAt(i));
    return { letters: isa.letters, words: words, text: isa.letters + ' = ' + words.join(', ') };
  }

  /* ------------------------------------------------------------ graph (build.py) */
  function Builder(plantId, plantName) {
    this.plant = { id: plantId, name: plantName, sheets: [] };
    this.nodes = {}; this.order = []; this.edges = []; this.edgeKeys = {}; this.issues = [];
    this.local = {}; this.byTag = {}; this.segments = {}; this.linePaths = {};
    this.sheetOfPage = {}; this.pageIds = {}; this.drawingOfSheet = {};
  }
  var B = Builder.prototype;
  B.issue = function (severity, code, message, extra) {
    var o = { severity: severity, code: code, message: message };
    for (var k in (extra || {})) if (has(extra, k) && extra[k] !== null && extra[k] !== undefined) o[k] = extra[k];
    this.issues.push(o);
  };
  B.upsert = function (n) {
    n.sheets = n.sheets || []; n.attributes = n.attributes || {};
    if (n.confidence === undefined) n.confidence = 1.0;
    var ex = this.nodes[n.id];
    if (!ex) { this.nodes[n.id] = n; this.order.push(n.id); return n.id; }
    if (ex.type !== n.type) {
      if ((ex.type === 'Component' && n.type === 'Instrument') || (ex.type === 'Instrument' && n.type === 'Component')) {
        var keep = ex.type === 'Component' ? ex : n, other = keep === ex ? n : ex;
        var a = copy(other.attributes); for (var k0 in keep.attributes) if (has(keep.attributes, k0)) a[k0] = keep.attributes[k0];
        keep.attributes = a; keep.sheets = mergeList(ex.sheets, n.sheets);
        this.nodes[n.id] = keep; return n.id;
      }
      this.issue('warning', 'type_conflict', "'" + n.id + "' read as " + ex.type + ' and as ' + n.type + '; kept ' + ex.type, { node: n.id });
    }
    ex.sheets = mergeList(ex.sheets, n.sheets);
    ex.confidence = Math.max(ex.confidence, n.confidence);
    var fields = ['name', 'kind', 'status', 'tag'];
    for (var i = 0; i < fields.length; i++) {
      var f = fields[i], cur = ex[f];
      if ((cur === null || cur === undefined || cur === '' || cur === 'other' || cur === 'unknown') && n[f]) ex[f] = n[f];
    }
    for (var k in n.attributes) if (has(n.attributes, k)) {
      var c = ex.attributes[k];
      if (!has(ex.attributes, k) || c === null || c === '' || c === 'unknown') ex.attributes[k] = n.attributes[k];
    }
    return n.id;
  };
  B.edge = function (source, target, type, opts, attrs) {
    if (source === target) return null;
    attrs = attrs || {}; opts = opts || {};
    var key = source + '\u0000' + target + '\u0000' + type + '\u0000' + (attrs.role || '');
    if (this.edgeKeys[key]) return null;
    this.edgeKeys[key] = true;
    var a = {};
    for (var k in attrs) if (has(attrs, k)) {
      var v = attrs[k];
      if (v === null || v === undefined || v === '' || (Object.prototype.toString.call(v) === '[object Array]' && !v.length)) continue;
      a[k] = v;
    }
    var e = { id: 'E' + pad5(this.edges.length + 1), source: source, target: target, type: type,
      confidence: Math.round((opts.confidence === undefined ? 1 : opts.confidence) * 1000) / 1000,
      derived: !!opts.derived, sheet: opts.sheet || null, attributes: a };
    this.edges.push(e);
    return e;
  };
  B.register = function (page, localId, tag, gid) {
    var L = this.local[page] || (this.local[page] = {});
    L[localId] = gid;
    var nt = normalizeTag(tag); if (nt && !has(L, nt)) L[nt] = gid;
    var nl = normalizeTag(localId); if (nl && !has(L, nl)) L[nl] = gid;
  };
  B.resolve = function (page, ref) {
    var L = this.local[page] || {};
    if (has(L, ref)) return L[ref];
    var nt = normalizeTag(ref);
    if (nt && has(L, nt)) return L[nt];
    if (nt && has(this.byTag, nt)) return this.byTag[nt];
    if (nt && has(this.nodes, nt)) return nt;
    return null;
  };
  B.unique = function (page, gid, localId, sheetId) {
    var seen = this.pageIds[page] || (this.pageIds[page] = {});
    var base = gid, n = 1;
    while (has(seen, gid) && seen[gid] !== localId) { n++; gid = base + '#' + n; }
    if (n > 1) this.issue('warning', 'duplicate_tag', "tag '" + base + "' is used by more than one item on this sheet; the copy '" + localId + "' was kept separate as '" + gid + "'", { sheet: sheetId, page: page, node: gid });
    seen[gid] = localId;
    return gid;
  };
  B.addInstrument = function (tag, page, sheetId, o) {
    var ntag = normalizeTag(tag), nodeId = o.nodeId || ntag, isa = parseIsaTag(ntag);
    var attrs = copy(o.attributes); attrs.location = o.location || 'unknown';
    if (isa) {
      attrs.isa_letters = isa.letters; attrs.variable = isa.variable; attrs.functions = isa.functions; attrs.role = isa.role;
      attrs.loop_key = normalizeTag(o.loop) || (o.untagged ? null : isa.loopKey);
    } else {
      attrs.role = 'other'; attrs.loop_key = normalizeTag(o.loop);
      this.issue('info', 'non_isa_tag', "instrument tag '" + tag + "' does not parse as ISA-5.1", { sheet: sheetId, page: page, node: ntag });
    }
    if (o.untagged) { attrs.untagged = true; ntag = null; }
    var label = o.untagged && isa ? isa.letters + ' (untagged)' : nodeId;
    this.upsert({ id: nodeId, type: 'Instrument', label: label, tag: ntag, kind: attrs.role, name: o.name || null,
      status: o.status || null, sheets: [sheetId], confidence: o.confidence === undefined ? 0.9 : o.confidence,
      attributes: clean(attrs) });
    if (!o.scoped && ntag && !has(this.byTag, ntag)) this.byTag[ntag] = nodeId;
    return nodeId;
  };
  function conf(item, dflt) { return item.confidence === undefined ? dflt : item.confidence; }
  B.addItems = function (ext) {
    var page = ext.page, sheet = ext.sheet || {}, dn = sheet.drawing_number || null, self = this;
    var sheetId = dn ? 'SHEET:' + normalizeTag(dn) : 'SHEET:P' + pad2(page);
    if (has(this.nodes, sheetId)) sheetId = sheetId + '#P' + pad2(page);
    this.sheetOfPage[page] = sheetId; this.drawingOfSheet[sheetId] = dn; this.plant.sheets.push(sheetId);
    this.upsert({ id: sheetId, type: 'Sheet', label: dn || 'Page ' + page, name: sheet.title || null, sheets: [sheetId],
      attributes: clean({ page: page, drawing_number: dn, title: sheet.title, revision: sheet.revision,
        drawing_type: sheet.drawing_type || 'pid', notes: sheet.legend_notes, tiles_reviewed: ext.tiles_reviewed, unreadable: ext.unreadable }) });
    var P = 'P' + pad2(page) + '.';
    (ext.equipment || []).forEach(function (eq) {
      var tag = normalizeTag(eq.tag);
      var gid = self.unique(page, tag || P + eq.id, eq.id, sheetId);
      var kind = slug(eq.kind);
      self.upsert({ id: gid, type: 'Equipment', label: tag || eq.name || kind, tag: tag, kind: kind, name: eq.name || null,
        status: eq.status || null, sheets: [sheetId], confidence: conf(eq, 0.9), attributes: clean(copy(eq.attributes)) });
      self.register(page, eq.id, eq.tag, gid);
      if (tag) self.byTag[tag] = gid;
    });
    (ext.components || []).forEach(function (c) {
      var tag = normalizeTag(c.tag);
      var gid = self.unique(page, tag || P + c.id, c.id, sheetId);
      var kind = slug(c.kind);
      var attrs = copy(c.attributes);
      attrs.actuator = c.actuator; attrs.fail_position = c.fail_position; attrs.normal_position = c.normal_position;
      attrs.size = c.size; attrs.loop = normalizeTag(c.loop);
      attrs = clean(attrs);
      var isa = tag ? parseIsaTag(tag) : null;
      var actuated = has(ACTUATED_COMPONENT_KINDS, kind) || (c.actuator && ['manual', 'none', 'self'].indexOf(c.actuator) < 0);
      if (isa && !isaValveTag(isa)) isa = null;
      if (isa && (actuated || kind === 'relief_valve')) {
        attrs.isa_letters = isa.letters; attrs.variable = isa.variable; attrs.role = isa.role;
        attrs.loop_key = normalizeTag(c.loop) || isa.loopKey;
      } else if (c.loop) {
        attrs.loop_key = normalizeTag(c.loop); attrs.role = 'final_element';
      }
      self.upsert({ id: gid, type: 'Component', label: tag || (kind === 'other' && c.name ? c.name : pretty(kind)), tag: tag,
        kind: kind, name: c.name || null, status: c.status || null, sheets: [sheetId], confidence: conf(c, 0.9), attributes: attrs });
      self.register(page, c.id, c.tag, gid);
      if (tag) self.byTag[tag] = gid;
    });
    (ext.instruments || []).forEach(function (ins) {
      var o = { location: ins.location || 'unknown', name: ins.name, status: ins.status, confidence: conf(ins, 0.9),
        attributes: ins.attributes, loop: ins.loop };
      if (!ins.tag) {
        o.nodeId = P + ins.id; o.scoped = true; o.untagged = true;
        var g0 = self.addInstrument(ins['function'] + '-0', page, sheetId, o);
        self.register(page, ins.id, null, g0);
        return;
      }
      var ntag = normalizeTag(ins.tag);
      var gid = self.unique(page, ntag, ins.id, sheetId);
      var dup = gid.slice(ntag.length);
      if (dup) {
        var isa = parseIsaTag(ntag), key = normalizeTag(ins.loop) || (isa ? isa.loopKey : null);
        o.loop = key ? key + dup : null;
      }
      o.nodeId = gid;
      gid = self.addInstrument(ins.tag, page, sheetId, o);
      self.register(page, ins.id, ins.tag, gid);
    });
    (ext.equipment || []).forEach(function (eq) {
      if (!eq.part_of) return;
      var child = self.resolve(page, eq.id), parent = self.resolve(page, eq.part_of);
      if (parent) { self.edge(child, parent, 'PART_OF', { confidence: conf(eq, 0.9), sheet: sheetId }); self.nodes[child].attributes.part_of = parent; }
      else self.issue('error', 'unresolved_reference', 'equipment ' + eq.id + " 'part_of': '" + eq.part_of + "' is not defined", { sheet: sheetId, page: page });
    });
    (ext.off_page_connectors || []).forEach(function (o) {
      var gid = P + o.id;
      self.upsert({ id: gid, type: 'OffPageConnector', label: o.name || o.other_item || o.id, tag: normalizeTag(o.tag),
        name: o.name || null, sheets: [sheetId], confidence: conf(o, 0.9),
        attributes: clean((function () { var a = copy(o.attributes); a.direction = o.direction; a.other_drawing = o.other_drawing;
          a.other_item = o.other_item; a.line_number = o.line_number; return a; })()) });
      self.register(page, o.id, null, gid);
    });
    (ext.boundaries || []).forEach(function (b) {
      var label = b.name || b.tag || b.id, gid = 'BOUNDARY:' + normalizeLabel(label);
      var a = copy(b.attributes); a.direction = b.direction;
      self.upsert({ id: gid, type: 'Boundary', label: label, name: b.name || null, sheets: [sheetId], confidence: conf(b, 0.9), attributes: clean(a) });
      self.register(page, b.id, null, gid);
    });
  };
  B.resolveEndpoint = function (page, ep, sheetId, what) {
    if (typeof ep === 'string') ep = { item: ep };
    if (ep.item) {
      var gid = this.resolve(page, ep.item);
      if (gid === null) this.issue('error', 'unresolved_reference', what + ": '" + ep.item + "' is not defined", { sheet: sheetId, page: page });
      return gid;
    }
    var key = page + '|' + ep.line;
    if (!has(this.segments, key)) {
      this.issue('error', 'unresolved_reference', what + ": line '" + ep.line + "' is not defined", { sheet: sheetId, page: page });
      return null;
    }
    var segs = this.segments[key], path = this.linePaths[key];
    if (!ep.after) return segs[0];
    var after = this.resolve(page, ep.after), at = path.indexOf(after);
    if (at >= 0) return segs[at + 1];
    this.issue('warning', 'tap_position', what + ": '" + ep.after + "' is not on line '" + ep.line + "'; attached to the first segment", { sheet: sheetId, page: page });
    return segs[0];
  };
  B.resolveSignalEnd = function (page, ref, sheetId) {
    var gid = this.resolve(page, ref);
    if (gid) return gid;
    if (parseIsaTag(ref)) {
      gid = this.addInstrument(ref, page, sheetId, { confidence: 0.5 });
      this.register(page, ref, ref, gid);
      this.issue('info', 'implicit_instrument', "'" + ref + "' appears only as a signal endpoint; created as an instrument", { sheet: sheetId, page: page, node: gid });
      return gid;
    }
    this.issue('error', 'unresolved_reference', "signal endpoint '" + ref + "' is not defined", { sheet: sheetId, page: page });
    return null;
  };
  B.addConnectivity = function (ext) {
    var page = ext.page, sheetId = this.sheetOfPage[page], self = this;
    var view = ext.sheet && ext.sheet.drawing_type === 'pfd' ? 'pfd' : null;
    var lines = ext.lines || [];
    lines.forEach(function (line) {
      var key = page + '|' + line.id, pathIds = [];
      (line.path || []).forEach(function (ref) {
        var gid = self.resolve(page, ref);
        if (gid === null) { self.issue('error', 'unresolved_reference', 'line ' + line.id + ": path item '" + ref + "' is not defined on this page", { sheet: sheetId, page: page }); return; }
        pathIds.push(gid);
      });
      var segs = [], n = pathIds.length + 1, lc = conf(line, 0.85);
      for (var k = 1; k <= n; k++) {
        var sid = 'P' + pad2(page) + '.' + line.id + '.' + k, label = line.line_number || line.id;
        self.upsert({ id: sid, type: 'PipeSegment', label: n > 1 ? label + ' [' + k + '/' + n + ']' : label,
          tag: normalizeTag(line.line_number), sheets: [sheetId], confidence: lc,
          attributes: clean({ line_id: line.id, line_number: line.line_number, size: line.size, service: line.service,
            segment: k, segments: n, flow_direction: line.flow_direction || 'shown' }) });
        segs.push(sid);
      }
      self.segments[key] = segs; self.linePaths[key] = pathIds;
      var at = { flow_direction: line.flow_direction || 'shown', line_number: line.line_number, drawing_type: view };
      for (var i = 0; i < pathIds.length; i++) {
        self.edge(segs[i], pathIds[i], 'FLOWS_TO', { confidence: lc, sheet: sheetId }, at);
        self.edge(pathIds[i], segs[i + 1], 'FLOWS_TO', { confidence: lc, sheet: sheetId }, at);
        var nd = self.nodes[pathIds[i]];
        if (nd.type === 'Instrument') nd.attributes.inline = true;
      }
    });
    lines.forEach(function (line) {
      var segs = self.segments[page + '|' + line.id], lc = conf(line, 0.85);
      var src = self.resolveEndpoint(page, line.from, sheetId, 'line ' + line.id + " 'from'");
      var dst = self.resolveEndpoint(page, line.to, sheetId, 'line ' + line.id + " 'to'");
      var at = { flow_direction: line.flow_direction || 'shown', line_number: line.line_number, drawing_type: view };
      if (src) self.edge(src, segs[0], 'FLOWS_TO', { confidence: lc, sheet: sheetId }, at);
      if (dst) self.edge(segs[segs.length - 1], dst, 'FLOWS_TO', { confidence: lc, sheet: sheetId }, at);
    });
    (ext.instruments || []).forEach(function (ins) {
      var gid = self.resolve(page, ins.id), ic = conf(ins, 0.9);
      if (ins.measures !== undefined && ins.measures !== null) {
        var t = self.resolveEndpoint(page, ins.measures, sheetId, 'instrument ' + ins.tag + " 'measures'");
        if (t) self.edge(gid, t, 'MEASURES', { confidence: ic, sheet: sheetId });
      } else if (self.nodes[gid].attributes.inline) {
        for (var i = 0; i < self.edges.length; i++) {
          var e = self.edges[i];
          if (e.type === 'FLOWS_TO' && e.target === gid && self.nodes[e.source].type === 'PipeSegment') {
            self.edge(gid, e.source, 'MEASURES', { confidence: ic, sheet: sheetId }, { inline: true });
            break;
          }
        }
      }
    });
    (ext.signals || []).forEach(function (sig) {
      var a = self.resolveSignalEnd(page, sig.from, sheetId), b = self.resolveSignalEnd(page, sig.to, sheetId);
      if (a && b) self.edge(a, b, 'SIGNAL_TO', { confidence: conf(sig, 0.85), sheet: sheetId },
        { signal_type: sig.type || 'unknown', purpose: sig.purpose || 'unknown' });
    });
  };

  /* off-page pairing */
  function sameDrawing(a, b) {
    if (!a || !b) return false;
    var na = normalizeTag(a), nb = normalizeTag(b);
    if (na === nb || na.slice(-nb.length) === nb || nb.slice(-na.length) === na) return true;
    return na.indexOf(nb + '-') === 0 || nb.indexOf(na + '-') === 0;
  }
  function tokens() {
    var words = {}, stop = { TO: 1, FROM: 1, DWG: 1, THE: 1, AND: 1 };
    for (var i = 0; i < arguments.length; i++) {
      var w = normalizeLabel(arguments[i]).split(' ');
      for (var j = 0; j < w.length; j++) if (w[j].length > 1 && !stop[w[j]]) words[w[j]] = 1;
    }
    return words;
  }
  function jaccard(a, b) {
    var ka = Object.keys(a), kb = Object.keys(b); if (!ka.length || !kb.length) return 0;
    var inter = 0, uni = {}; ka.forEach(function (k) { uni[k] = 1; if (b[k]) inter++; }); kb.forEach(function (k) { uni[k] = 1; });
    return inter / Object.keys(uni).length;
  }
  B.opcScore = function (out, inn) {
    var outDn = this.drawingOfSheet[out.sheets[0]], inDn = this.drawingOfSheet[inn.sheets[0]];
    var outTo = out.attributes.other_drawing, inFrom = inn.attributes.other_drawing;
    var lo = out.attributes.line_number, li = inn.attributes.line_number;
    var sameLine = !!(lo && li && normalizeTag(lo) === normalizeTag(li));
    var contradiction = (outTo && inDn && !sameDrawing(outTo, inDn)) || (inFrom && outDn && !sameDrawing(inFrom, outDn));
    if (contradiction && !sameLine) return -Infinity;
    var score = contradiction ? -1 : 0;
    if (outTo && sameDrawing(outTo, inDn)) score += 3;
    if (inFrom && sameDrawing(inFrom, outDn)) score += 3;
    if (lo && li) score += sameLine ? 4 : -1;
    score += 2 * jaccard(tokens(out.label, out.attributes.other_item), tokens(inn.label, inn.attributes.other_item));
    return score;
  };
  B.linkOffPage = function () {
    var self = this, opcs = this.order.map(function (id) { return self.nodes[id]; }).filter(function (n) { return n.type === 'OffPageConnector'; });
    var outs = opcs.filter(function (n) { return n.attributes.direction === 'out'; });
    var ins = opcs.filter(function (n) { return n.attributes.direction === 'in'; });
    var pairs = [];
    outs.forEach(function (o) { ins.forEach(function (i) { if (i.sheets[0] !== o.sheets[0]) pairs.push([self.opcScore(o, i), o.id, i.id]); }); });
    pairs.sort(function (a, b) { if (a[0] !== b[0]) return b[0] - a[0]; if (a[1] !== b[1]) return a[1] < b[1] ? 1 : -1; return a[2] < b[2] ? 1 : a[2] > b[2] ? -1 : 0; });
    var used = {};
    pairs.forEach(function (p) {
      if (p[0] < 3 || used[p[1]] || used[p[2]]) return;
      used[p[1]] = used[p[2]] = true;
      var o = self.nodes[p[1]], i = self.nodes[p[2]];
      self.edge(o.id, i.id, 'FLOWS_TO', { confidence: Math.min(o.confidence, 0.9) }, { off_page: true, match_score: Math.round(p[0] * 100) / 100 });
      o.attributes.linked_to = i.id; i.attributes.linked_from = o.id;
    });
    outs.concat(ins).forEach(function (n) {
      if (used[n.id] || self.linkOpcByItem(n)) return;
      self.issue('warning', 'unmatched_off_page', "off-page connector '" + n.label + "' has no matching connector or item", { sheet: n.sheets[0], node: n.id });
    });
  };
  B.linkOpcByItem = function (opc) {
    var t = normalizeTag(opc.attributes.other_item), gid = t ? this.byTag[t] : null;
    if (!gid || ['Equipment', 'Component', 'Instrument'].indexOf(this.nodes[gid].type) < 0) return false;
    if (opc.attributes.direction === 'out') this.edge(opc.id, gid, 'FLOWS_TO', { confidence: 0.7, derived: true }, { off_page: true, linked_by: 'other_item' });
    else this.edge(gid, opc.id, 'FLOWS_TO', { confidence: 0.7, derived: true }, { off_page: true, linked_by: 'other_item' });
    opc.attributes.linked_item = gid;
    return true;
  };
  B.inheritMeasurements = function () {
    var self = this, located = {}, sigIn = {}, byLoop = {};
    this.order.forEach(function (id) { var n = self.nodes[id]; if (n.type === 'Instrument' && n.attributes.inline) located[id] = id; });
    this.edges.forEach(function (e) { if (e.type === 'MEASURES' && !has(located, e.source)) located[e.source] = e.target; });
    this.edges.forEach(function (e) { if (e.type === 'SIGNAL_TO') (sigIn[e.target] = sigIn[e.target] || []).push(e.source); });
    this.order.forEach(function (id) { var n = self.nodes[id]; if (n.type === 'Instrument' && n.attributes.loop_key) (byLoop[n.attributes.loop_key] = byLoop[n.attributes.loop_key] || []).push(id); });
    this.order.slice().forEach(function (id) {
      var n = self.nodes[id];
      if (n.type !== 'Instrument' || has(located, id)) return;
      var role = n.attributes.role;
      if (['transmitter', 'switch', 'gauge', 'indicator', 'recorder', 'totalizer', 'element'].indexOf(role) < 0) return;
      if (role !== 'transmitter' && ['field', 'unknown', 'local_panel'].indexOf(n.attributes.location) < 0) return;
      var source = null, how = 'signal from primary element', list = sigIn[id] || [], i;
      for (i = 0; i < list.length; i++) {
        var s = list[i];
        if (has(located, s) && self.nodes[s].type === 'Instrument' && ['field', 'unknown'].indexOf(self.nodes[s].attributes.location) >= 0) { source = s; break; }
      }
      if (source === null) {
        how = 'same loop as primary element';
        var mem = byLoop[n.attributes.loop_key] || [];
        for (i = 0; i < mem.length; i++) if (mem[i] !== id && has(located, mem[i]) && self.nodes[mem[i]].attributes.role === 'element') { source = mem[i]; break; }
      }
      if (source !== null) self.edge(id, located[source], 'MEASURES', { derived: true, confidence: Math.min(n.confidence, self.nodes[source].confidence) }, { via: source, inferred_from: how });
    });
  };

  /* ------------------------------------------------------------ loops (loops.py) */
  function nodeRole(n) {
    if (n.type === 'Component') return (n.kind === 'relief_valve' || n.attributes.role === 'relief_device') ? 'relief_device' : 'final_element';
    if (n.type === 'Equipment') return 'final_element';
    return n.attributes.role || 'other';
  }
  function memberRole(n) {
    var r = nodeRole(n);
    if (has(READOUT_ROLES, r) && has(PANEL_LOCATIONS, n.attributes.location || '')) return 'readout';
    return r;
  }
  function isFinal(n) {
    if (n.type === 'Component') return has(ACTUATED_COMPONENT_KINDS, n.kind) || n.attributes.role === 'final_element' ||
      (n.attributes.actuator !== undefined && ['manual', 'none', 'self'].indexOf(n.attributes.actuator) < 0);
    if (n.type === 'Equipment') return true;
    return n.attributes.role === 'final_element';
  }
  function traceOutputs(start, sigOut, nodes) {
    var results = [], stack = (sigOut[start] || []).map(function (t) { return [t, []]; }), seen = {};
    seen[start] = true;
    while (stack.length) {
      var top = stack.pop(), nid = top[0], via = top[1];
      if (seen[nid] || via.length > 4) continue;
      seen[nid] = true;
      var n = nodes[nid];
      if (n.type === 'Instrument' && (n.attributes.role === 'relay' || n.attributes.role === 'other') && (sigOut[nid] || []).length) {
        sigOut[nid].forEach(function (t) { stack.push([t, via.concat([nid])]); });
        continue;
      }
      results.push([nid, via]);
    }
    return results;
  }
  function nearest(start, nodes, edges, upstream) {
    var adj = {};
    edges.forEach(function (e) { if (e.type !== 'FLOWS_TO') return; var a = upstream ? e.target : e.source, b = upstream ? e.source : e.target; (adj[a] = adj[a] || []).push(b); });
    var frontier = [start], seen = {}; seen[start] = true;
    for (var step = 0; step < 50; step++) {
      var nxt = [];
      for (var i = 0; i < frontier.length; i++) {
        var list = adj[frontier[i]] || [];
        for (var j = 0; j < list.length; j++) {
          var o = list[j]; if (seen[o]) continue; seen[o] = true;
          if (['Equipment', 'Boundary', 'Component', 'Instrument', 'OffPageConnector'].indexOf(nodes[o].type) >= 0) return nodes[o].label;
          nxt.push(o);
        }
      }
      if (!nxt.length) return null;
      frontier = nxt;
    }
    return null;
  }
  function pointLabel(nid, nodes, edges) {
    var n = nodes[nid], inline = n.type === 'Instrument' && n.attributes.inline;
    if (n.type !== 'PipeSegment' && !inline) return n.label;
    var up = nearest(nid, nodes, edges, true), down = nearest(nid, nodes, edges, false);
    var line = n.attributes.line_number || null;
    if (!line) for (var i = 0; i < edges.length; i++) { var e = edges[i]; if (e.type === 'FLOWS_TO' && e.target === nid && nodes[e.source].type === 'PipeSegment') { line = nodes[e.source].attributes.line_number || null; break; } }
    var where = (line || 'line') + ' (' + (up || '?') + ' -> ' + (down || '?') + ')';
    return inline ? 'in-line on ' + where : where;
  }
  function sensedPoints(nid, nodes, edges) {
    if (nodes[nid].attributes.inline) return [pointLabel(nid, nodes, edges)];
    return edges.filter(function (e) { return e.type === 'MEASURES' && e.source === nid; }).map(function (e) { return pointLabel(e.target, nodes, edges); });
  }
  function loopType(members, nodes, sigPurpose) {
    var roles = {}, m; for (m in members) roles[members[m]] = 1;
    for (var k in sigPurpose) if (sigPurpose[k] === 'trip' && has(members, k.split('\u0000')[0])) return 'interlock';
    if (roles.controller) return 'control';
    var variables = {}; for (m in members) variables[nodes[m].attributes.variable] = 1;
    if (roles.final_element) {
      if (variables.hand || roles.hand_switch) return 'manual';
      for (m in members) {
        var r = members[m], v = nodes[m].attributes.variable;
        if ((r === 'switch' || r === 'alarm') && ['event/state', 'unclassified', 'position', 'hand'].indexOf(v) < 0) return 'interlock';
      }
      if (roles.transmitter || roles.element || roles.sensor_input) return 'control';
      return 'on_off';
    }
    return 'monitoring';
  }
  function describeLoop(loop, b) {
    var a = loop.attributes, lbl = function (ids) { return ids.map(function (i) { return b.nodes[i].label; }).join(', '); };
    var parts = [loop.kind.replace(/_/g, ' ').replace(/^./, function (c) { return c.toUpperCase(); }) + ' loop ' + loop.label + ' (' + (a.variable || 'process') + ').'];
    if (a.sensors) parts.push('Sensed by ' + lbl(a.sensors) + (a.measured_at ? ' (' + a.measured_at.join('; ') + ')' : '') + '.');
    if (a.controllers) {
      var locs = {}; a.controllers.forEach(function (c) { locs[b.nodes[c].attributes.location || 'unknown'] = 1; });
      parts.push('Controlled by ' + lbl(a.controllers) + ' (' + Object.keys(locs).sort().join(', ') + ').');
    }
    if (a.final_elements) {
      var placed = {}; (a.manipulated_at || []).forEach(function (m) { placed[m.split(' on ')[0]] = m; });
      parts.push('Acts on ' + a.final_elements.map(function (f) { var l = b.nodes[f].label; return placed[l] || l; }).join('; ') + '.');
    }
    if (a.cascade_slaves) parts.push('Cascade master: sets the setpoint of ' + lbl(a.cascade_slaves) + '.');
    if (a.cascade_master) parts.push('Cascade slave of ' + b.nodes[a.cascade_master].label + '.');
    return parts.join(' ');
  }
  B.deriveLoops = function () {
    var self = this, nodes = this.nodes, sigOut = {}, sigIn = {}, sigPurpose = {};
    this.edges.forEach(function (e) {
      if (e.type !== 'SIGNAL_TO') return;
      (sigOut[e.source] = sigOut[e.source] || []).push(e.target);
      (sigIn[e.target] = sigIn[e.target] || []).push(e.source);
      sigPurpose[e.source + '\u0000' + e.target] = e.attributes.purpose || 'unknown';
    });
    var groups = {}, groupOrder = [];
    this.order.forEach(function (id) {
      var n = nodes[id], key = n.attributes.loop_key;
      if (key && (n.type === 'Instrument' || n.type === 'Component')) {
        if (!groups[key]) { groups[key] = {}; groupOrder.push(key); }
        groups[key][id] = memberRole(n);
      }
    });
    var cascades = {}, loopOf = {};
    groupOrder.forEach(function (key) { for (var nid in groups[key]) loopOf[nid] = key; });
    groupOrder.forEach(function (key) {
      var members = groups[key], nid;
      var controllers = []; for (nid in members) if (members[nid] === 'controller') controllers.push(nid);
      controllers.forEach(function (cid) {
        traceOutputs(cid, sigOut, nodes).forEach(function (r) {
          var target = r[0], via = r[1], tn = nodes[target];
          if (tn.type === 'Instrument' && tn.attributes.role === 'controller') {
            var other = loopOf[target]; if (other && other !== key) cascades[key + '\u0000' + other] = [key, other];
            return;
          }
          if (isFinal(tn)) {
            if (!has(members, target)) members[target] = 'final_element';
            via.forEach(function (v) { if (!has(members, v)) members[v] = 'relay'; });
            self.edge(cid, target, 'ACTUATES', { derived: true }, { via: via.length ? via.map(function (v) { return nodes[v].label; }) : null });
          }
        });
        (sigIn[cid] || []).forEach(function (src) {
          var sn = nodes[src];
          if (sn.type === 'Instrument' && has(SENSOR_ROLES, sn.attributes.role) && !has(members, src)) members[src] = 'sensor_input';
        });
      });
      var switches = []; for (nid in members) if (['switch', 'hand_switch', 'transmitter', 'alarm', 'other'].indexOf(members[nid]) >= 0) switches.push(nid);
      switches.forEach(function (sid) {
        traceOutputs(sid, sigOut, nodes).forEach(function (r) {
          if (isFinal(nodes[r[0]]) && !has(members, r[0])) {
            members[r[0]] = 'final_element';
            self.edge(sid, r[0], 'ACTUATES', { derived: true }, { via: r[1].length ? r[1].map(function (v) { return nodes[v].label; }) : null });
          }
        });
      });
    });
    var loopIds = {};
    groupOrder.slice().sort().forEach(function (key) {
      var members = groups[key], ids = Object.keys(members), roles = {};
      ids.forEach(function (m) { roles[members[m]] = 1; });
      if (ids.length < 2 && !roles.controller) return;
      var lid = 'LOOP:' + key; loopIds[key] = lid;
      var lt = loopType(members, nodes, sigPurpose);
      var variable = loopVariable(key);
      if (!variable) for (var i = 0; i < ids.length; i++) if (nodes[ids[i]].attributes.variable) { variable = nodes[ids[i]].attributes.variable; break; }
      var sheets = []; ids.forEach(function (m) { sheets = mergeList(sheets, nodes[m].sheets); });
      var pick = function (fn) { return ids.filter(function (m) { return fn(members[m]); }); };
      var sensors = pick(function (r) { return has(SENSOR_ROLES, r) || r === 'sensor_input'; });
      var finals = pick(function (r) { return r === 'final_element'; });
      var measuredAt = []; sensors.forEach(function (s) { measuredAt = mergeList(measuredAt, sensedPoints(s, nodes, self.edges)); });
      var manipulatedAt = [];
      finals.forEach(function (f) {
        var n = nodes[f]; if (n.type === 'Equipment') return;
        var lines = {}; self.edges.forEach(function (e) { if (e.type === 'FLOWS_TO' && e.target === f && nodes[e.source].type === 'PipeSegment' && nodes[e.source].attributes.line_number) lines[nodes[e.source].attributes.line_number] = 1; });
        var ls = Object.keys(lines).sort(); if (ls.length) manipulatedAt.push(n.label + ' on ' + ls.join(', '));
      });
      var minConf = 1; ids.forEach(function (m) { minConf = Math.min(minConf, nodes[m].confidence); });
      var node = { id: lid, type: 'ControlLoop', label: key, kind: lt, sheets: sheets, confidence: minConf,
        attributes: clean({ variable: variable, loop_type: lt, sensors: sensors, controllers: pick(function (r) { return r === 'controller'; }),
          final_elements: finals, relays: pick(function (r) { return r === 'relay'; }), readouts: pick(function (r) { return r === 'readout'; }),
          measured_at: measuredAt, manipulated_at: manipulatedAt }) };
      node.attributes.description = describeLoop(node, self);
      self.upsert(node);
      ids.forEach(function (m) { self.edge(m, lid, 'MEMBER_OF', { derived: true }, { role: members[m] }); });
      if (lt === 'interlock') sensors.forEach(function (s) { finals.forEach(function (f) { self.edge(s, f, 'TRIPS', { derived: true }, { loop: lid }); }); });
    });
    Object.keys(cascades).sort().forEach(function (k) {
      var ms = cascades[k], master = ms[0], slave = ms[1];
      if (!loopIds[master] || !loopIds[slave]) return;
      self.edge(loopIds[master], loopIds[slave], 'CASCADES_TO', { derived: true });
      var mn = nodes[loopIds[master]]; (mn.attributes.cascade_slaves = mn.attributes.cascade_slaves || []).push(loopIds[slave]);
      nodes[loopIds[slave]].attributes.cascade_master = loopIds[master];
    });
    Object.keys(loopIds).forEach(function (key) {
      var ln = nodes[loopIds[key]];
      if (ln.attributes.cascade_slaves || ln.attributes.cascade_master) ln.attributes.description = describeLoop(ln, self);
      var a = ln.attributes;
      if (ln.kind === 'control') {
        if (!a.final_elements && !a.cascade_slaves) self.issue('warning', 'loop_no_final_element', 'control loop ' + key + ' has a controller but no final element', { node: ln.id });
        if (!a.sensors) self.issue('info', 'loop_no_sensor', 'control loop ' + key + ' has a controller but no sensor', { node: ln.id });
      }
      (a.controllers || []).forEach(function (c) {
        if (!(sigIn[c] || []).length && !(sigOut[c] || []).length) self.issue('info', 'loop_no_signals', 'controller ' + c + ' has no signal lines; loop ' + key + ' built from tag numbers only', { node: c });
      });
    });
  };
  B.deriveFeeds = function () {
    var self = this, outAdj = {};
    this.edges.forEach(function (e) { if (e.type === 'FLOWS_TO') (outAdj[e.source] = outAdj[e.source] || []).push(e.target); });
    var starts = this.order.filter(function (id) { return has(TERMINAL_TYPES, self.nodes[id].type); });
    starts.forEach(function (start) {
      var seen = {}; seen[start] = true;
      var stack = (outAdj[start] || []).map(function (t) { return [t, [t]]; });
      while (stack.length) {
        var top = stack.pop(), nid = top[0], via = top[1];
        if (seen[nid]) continue; seen[nid] = true;
        var node = self.nodes[nid];
        if (has(TERMINAL_TYPES, node.type)) {
          var inner = via.slice(0, -1), lines = [], comps = [], off = false;
          inner.forEach(function (v) {
            var n = self.nodes[v];
            if (n.type === 'PipeSegment' && n.attributes.line_number && lines.indexOf(n.attributes.line_number) < 0) lines.push(n.attributes.line_number);
            if (n.type === 'Component' || n.type === 'Instrument' || n.type === 'Equipment') comps.push(n.label);
          });
          via.forEach(function (v) { if (self.nodes[v].type === 'OffPageConnector') off = true; });
          self.edge(start, nid, 'FEEDS', { derived: true }, { via_lines: lines, via_items: comps, off_page: off || null });
          continue;
        }
        (outAdj[nid] || []).forEach(function (t) { stack.push([t, via.concat([t])]); });
      }
    });
  };
  B.finalize = function () {
    var self = this, pid = 'PLANT:' + this.plant.id;
    this.upsert({ id: pid, type: 'Plant', label: this.plant.name, name: this.plant.name, attributes: {} });
    this.plant.sheets.forEach(function (s) { self.edge(s, pid, 'PART_OF'); });
    var nodes = this.order.map(function (id) { return self.nodes[id]; });
    var byType = {}, eType = {}, loops = {}, sev = {};
    nodes.forEach(function (n) { byType[n.type] = (byType[n.type] || 0) + 1; if (n.type === 'ControlLoop') loops[n.kind] = (loops[n.kind] || 0) + 1; });
    this.edges.forEach(function (e) { eType[e.type] = (eType[e.type] || 0) + 1; });
    this.issues.forEach(function (i) { sev[i.severity] = (sev[i.severity] || 0) + 1; });
    var g = { plant: this.plant, nodes: nodes, edges: this.edges, issues: this.issues,
      stats: { nodes: nodes.length, edges: this.edges.length, nodes_by_type: byType, edges_by_type: eType, loops_by_type: loops, issues_by_severity: sev } };
    g.byId = this.nodes;
    g.resolve = function (page, ref) { return self.resolve(page, ref); };
    return g;
  };

  function buildGraph(pages, plantId, plantName) {
    var b = new Builder(plantId, plantName || plantId);
    var ps = pages.slice().sort(function (a, c) { return a.page - c.page; });
    ps.slice().sort(function (a, c) {
      var pa = (a.sheet && a.sheet.drawing_type === 'pfd') ? 1 : 0, pc = (c.sheet && c.sheet.drawing_type === 'pfd') ? 1 : 0;
      return pa - pc || a.page - c.page;
    }).forEach(function (p) { b.addItems(p); });
    ps.forEach(function (p) { b.addConnectivity(p); });
    b.linkOffPage();
    b.inheritMeasurements();
    b.deriveLoops();
    b.deriveFeeds();
    return b.finalize();
  }

  /* Public members are re-exported by rz-pid-graph.js as window.RZPid; `_` is shared with the other two
     modules only, so the rules live in one place. */
  root.RZPidBuild = { buildGraph: buildGraph, normalizeTag: normalizeTag, normalizeLabel: normalizeLabel,
    parseIsaTag: parseIsaTag, decodeTag: decodeTag, loopVariable: loopVariable, LOW_CONFIDENCE: LOW_CONFIDENCE,
    LOCATION_WORD: LOCATION_WORD,
    _: { has: has, pad2: pad2, slug: slug, pretty: pretty, conf: conf, nearest: nearest,
      TERMINAL_TYPES: TERMINAL_TYPES, ACTUATED_COMPONENT_KINDS: ACTUATED_COMPONENT_KINDS } };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.RZPidBuild;
})(typeof window !== 'undefined' ? window : globalThis);
