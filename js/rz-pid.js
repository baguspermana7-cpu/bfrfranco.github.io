/*!
 * rz-pid.js — interactive P&ID with a flow explanation (resistancezero.com, R116 mock)
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
 * What is RZ: the drawing, the step list, the motion. Vanilla ES5, no build.
 */
(function (root) {
  'use strict';
  if (root.__rzPid) return;
  root.__rzPid = true;

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
  B.node = function (id) { return this.nodes[id]; };
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

  /* ------------------------------------------------------------ explanation (summary.py + RZ) */
  function index(g) {
    var out = {}, inn = {};
    g.edges.forEach(function (e) { (out[e.source] = out[e.source] || []).push(e); (inn[e.target] = inn[e.target] || []).push(e); });
    return { out: function (id, t) { return (out[id] || []).filter(function (e) { return !t || e.type === t; }); },
      inn: function (id, t) { return (inn[id] || []).filter(function (e) { return !t || e.type === t; }); } };
  }
  function flowOrder(g, ix) {
    function byLabelInner(a, b) { var la = g.byId[a].label, lb = g.byId[b].label; return la < lb ? -1 : la > lb ? 1 : 0; }
    var byLabel = byLabelInner;
    var feedsIn = {};
    g.edges.forEach(function (e) { if (e.type === 'FEEDS') feedsIn[e.target] = (feedsIn[e.target] || 0) + 1; });
    var terminals = g.nodes.filter(function (n) { return n.type === 'Equipment' || n.type === 'Boundary'; }).map(function (n) { return n.id; });
    var starts = terminals.filter(function (t) { return !feedsIn[t]; });
    starts.sort(function (a, b) {
      var ka = (g.byId[a].type !== 'Boundary' ? 1 : 0), kb = (g.byId[b].type !== 'Boundary' ? 1 : 0);
      if (ka !== kb) return ka - kb;
      var sa = g.byId[a].sheets[0] || '', sb = g.byId[b].sheets[0] || '';
      if (sa !== sb) return sa < sb ? -1 : 1;
      return a < b ? -1 : a > b ? 1 : 0;
    });
    var order = [], seen = {};
    starts.concat(terminals).forEach(function (s) {
      if (seen[s]) return;
      var queue = [s];
      while (queue.length) {
        var cur = queue.shift(); if (seen[cur]) continue; seen[cur] = true; order.push(cur);
        /* RZ: siblings in label order so a reader meets P-01A before P-01B */
        ix.out(cur, 'FEEDS').map(function (e) { return e.target; }).sort(byLabel).forEach(function (t) { queue.push(t); });
      }
    });
    return order;
  }
  /* Everything the flow passes between `start` and the next terminal(s). stopAt(node) decides terminals. */
  function walkDown(g, ix, start, stopAt) {
    var ids = [], seen = {}, stack = [start]; seen[start] = true;
    while (stack.length) {
      var cur = stack.pop();
      ix.out(cur, 'FLOWS_TO').forEach(function (e) {
        ids.push(e.id);
        var t = e.target;
        if (seen[t]) return; seen[t] = true; ids.push(t);
        if (!stopAt(g.byId[t])) stack.push(t);
      });
    }
    return ids;
  }
  function uniq(a) { var o = [], s = {}; a.forEach(function (x) { if (!s[x]) { s[x] = 1; o.push(x); } }); return o; }
  function joinAnd(list) { if (list.length < 2) return list.join(''); return list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1]; }
  function nameOf(n) { return n.name && n.name !== n.label ? n.label + ' (' + n.name + ')' : n.label; }
  function serviceOf(g, ix, from, to) {
    // service of the first pipe segment leaving `from` on the way to `to`
    var segs = ix.out(from, 'FLOWS_TO').map(function (e) { return g.byId[e.target]; }).filter(function (n) { return n.type === 'PipeSegment'; });
    for (var i = 0; i < segs.length; i++) {
      var reach = walkDown(g, ix, segs[i].id, function (n) { return has(TERMINAL_TYPES, n.type); });
      if (reach.indexOf(to) >= 0) return segs[i].attributes.service || null;
    }
    return null;
  }
  function valueText(n) {
    var a = n.attributes || {}, parts = [];
    if (a.value !== undefined) parts.push(a.value + (a.unit ? ' ' + a.unit : ''));
    if (a.band) parts.push('normal band ' + a.band + (a.unit ? ' ' + a.unit : ''));
    return parts.join(', ');
  }
  function measuredWhere(g, ix, inst) {
    var n = g.byId[inst];
    if (n.attributes.inline) return 'in-line ' + lineWords(g, ix, inst);
    return ix.out(inst, 'MEASURES').map(function (e) { var t = g.byId[e.target]; return t.type === 'PipeSegment' ? 'on ' + lineWords(g, ix, t.id) : 'on ' + nameOf(t); }).join('; ');
  }
  function lineWords(g, ix, nid) {
    var n = g.byId[nid];
    var seg = n.type === 'PipeSegment' ? n : null;
    if (!seg) ix.inn(nid, 'FLOWS_TO').forEach(function (e) { if (!seg && g.byId[e.source].type === 'PipeSegment') seg = g.byId[e.source]; });
    var up = nearest(nid, g.byId, g.edges, true), down = nearest(nid, g.byId, g.edges, false);
    var svc = seg ? (seg.attributes.service || seg.attributes.line_number || 'the line') : 'the line';
    return svc + ' between ' + (up || '?') + ' and ' + (down || '?');
  }
  function explain(g, opts) {
    opts = opts || {};
    var ix = index(g), steps = [], sections = [];
    function add(section, s) { s.section = section; s.id = 's' + (steps.length + 1); s.ids = uniq(s.ids); steps.push(s); }
    function extra(n) { return n.attributes && n.attributes.explain ? ' ' + n.attributes.explain : ''; }

    /* 1. process flow — equipment-level FEEDS from the boundary in */
    sections.push({ id: 'flow', title: 'Process flow' });
    flowOrder(g, ix).forEach(function (nid) {
      var feeds = ix.out(nid, 'FEEDS'); if (!feeds.length) return;
      var n = g.byId[nid];
      var ids = [nid].concat(walkDown(g, ix, nid, function (x) { return has(TERMINAL_TYPES, x.type); }));
      var bySvc = {}, svcOrder = [];
      feeds.slice().sort(function (a, b) {
        var ta = g.byId[a.target], tb = g.byId[b.target], ka = ta.type === 'Equipment' ? 0 : 1, kb = tb.type === 'Equipment' ? 0 : 1;
        return ka - kb || (ta.label < tb.label ? -1 : ta.label > tb.label ? 1 : 0);
      }).forEach(function (e) {
        ids.push(e.id);
        var svc = serviceOf(g, ix, nid, e.target) || 'flow', via = (e.attributes.via_items || []).join('|');
        if (!bySvc[svc]) { bySvc[svc] = { groups: {}, order: [] }; svcOrder.push(svc); }
        var grp = bySvc[svc];
        if (!grp.groups[via]) { grp.groups[via] = { targets: [], via: e.attributes.via_items || [] }; grp.order.push(via); }
        grp.groups[via].targets.push(g.byId[e.target].label);
      });
      var clauses = svcOrder.map(function (s) {
        return s + ' ' + bySvc[s].order.map(function (v) {
          var b = bySvc[s].groups[v];
          return 'to ' + joinAnd(b.targets) + (b.via.length ? ' through ' + joinAnd(b.via) : '');
        }).join(', and ');
      });
      var verb = n.type === 'Boundary' ? 'enters as' : 'sends';
      add('flow', { kind: 'flow', flow: true, subject: nid, title: nameOf(n),
        text: nameOf(n) + ' ' + verb + ' ' + clauses.join('; and ') + '.' + extra(n), ids: ids });
    });

    /* 2. measurement — what each instrument senses, grouped by variable */
    sections.push({ id: 'measure', title: 'Measurement' });
    var groups = {}, gOrder = [];
    g.nodes.forEach(function (n) {
      if (n.type !== 'Instrument') return;
      var ms = ix.out(n.id, 'MEASURES'); if (!ms.length) return;
      var v = n.attributes.variable || 'other';
      if (!groups[v]) { groups[v] = []; gOrder.push(v); }
      groups[v].push(n.id);
    });
    var vRank = ['flow', 'temperature', 'pressure', 'differential pressure', 'level', 'analysis'];
    gOrder.sort(function (a, b) { var ra = vRank.indexOf(a), rb = vRank.indexOf(b); return (ra < 0 ? 99 : ra) - (rb < 0 ? 99 : rb); });
    gOrder.forEach(function (v) {
      var ids = [], lines = [];
      groups[v].forEach(function (iid) {
        var n = g.byId[iid], d = decodeTag(n.tag || n.label), val = valueText(n);
        ids.push(iid);
        ix.out(iid, 'MEASURES').forEach(function (e) { ids.push(e.id, e.target); });
        lines.push(n.label + (d ? ' (' + d.words.join(' ') + ')' : '') + ' reads ' + measuredWhere(g, ix, iid) + (val ? ': ' + val : '') + '.');
      });
      add('measure', { kind: 'measure', title: v.charAt(0).toUpperCase() + v.slice(1) + ' — ' + groups[v].map(function (i) { return g.byId[i].label; }).join(', '),
        text: lines.join(' '), ids: ids });
    });

    /* 3. control loops — sensor → controller → relay → final element → effect */
    sections.push({ id: 'loop', title: 'Control loops' });
    var loops = g.nodes.filter(function (n) { return n.type === 'ControlLoop'; });
    var kRank = { control: 0, interlock: 1, on_off: 2, manual: 3, monitoring: 4 };
    loops.sort(function (a, b) { return (kRank[a.kind] - kRank[b.kind]) || (a.label < b.label ? -1 : 1); });
    loops.forEach(function (L) {
      var a = L.attributes, S = a.sensors || [], C = a.controllers || [], R = a.relays || [], F = (a.final_elements || []).slice().sort();
      var memberEdges = ix.inn(L.id, 'MEMBER_OF').map(function (e) { return e.id; });
      var sig = function (from, to) { var o = []; from.forEach(function (x) { ix.out(x, 'SIGNAL_TO').forEach(function (e) { if (to.indexOf(e.target) >= 0) o.push(e.id); }); }); return o; };
      var lab = function (ids) { return joinAnd(ids.map(function (i) { return g.byId[i].label; })); };
      var stages = [], s1, s2, s3;
      if (C.length) {
        s1 = sig(S, C); s2 = R.length ? sig(C, R) : []; s3 = R.length ? sig(R, F) : [];
        s3 = s3.concat(sig(C, F));
      } else {
        // interlock / no controller: sensor → (relays) → final
        var relaysOnPath = [];
        S.forEach(function (s) { ix.out(s, 'SIGNAL_TO').forEach(function (e) { var t = g.byId[e.target]; if (t.attributes.role === 'relay') relaysOnPath.push(t.id); }); });
        relaysOnPath = uniq(relaysOnPath);
        s1 = []; s2 = sig(S, relaysOnPath.length ? relaysOnPath : F); s3 = relaysOnPath.length ? sig(relaysOnPath, F) : [];
        R = relaysOnPath;
      }
      [s1, s2, s3].forEach(function (s) { if (s.length) stages.push(s); });
      var measIds = []; S.forEach(function (s) { ix.out(s, 'MEASURES').forEach(function (e) { measIds.push(e.id, e.target); }); });
      var tripIds = []; S.forEach(function (s) { ix.out(s, 'TRIPS').forEach(function (e) { tripIds.push(e.id); }); });
      var actIds = []; S.concat(C).forEach(function (s) { ix.out(s, 'ACTUATES').forEach(function (e) { actIds.push(e.id); }); });
      var allSig = s1.concat(s2, s3);
      var title = (L.kind === 'interlock' ? 'Interlock ' : 'Loop ') + L.label + ' — ' + (a.variable || 'process');
      var ctl = C.length ? g.byId[C[0]] : null;
      add('loop', { kind: 'loop', loop: L.id, part: 'overview', title: title,
        text: a.description + (ctl ? extra(ctl) : extra(g.byId[S[0]] || L)),
        ids: [L.id].concat(S, C, R, F, allSig, measIds, tripIds, actIds, memberEdges), pulse: stages });
      if (S.length) add('loop', { kind: 'loop', loop: L.id, part: 'sensor', title: L.label + ' · sensor ' + lab(S),
        text: S.map(function (s) { var n = g.byId[s], d = decodeTag(n.tag || n.label), v = valueText(n);
          return n.label + (d ? ' (' + d.words.join(' ') + ')' : '') + ' senses ' + (a.variable || 'the process') + ' ' + measuredWhere(g, ix, s) + (v ? ' — ' + v : '') + '.'; }).join(' '),
        ids: [L.id].concat(S, measIds) });
      if (C.length) add('loop', { kind: 'loop', loop: L.id, part: 'controller', title: L.label + ' · controller ' + lab(C),
        text: C.map(function (c) { var n = g.byId[c], d = decodeTag(n.tag || n.label);
          return n.label + (d ? ' (' + d.words.join(' ') + ', ' + (LOCATION_WORD[n.attributes.location] || n.attributes.location) + ')' : '') +
            ' takes the signal from ' + lab(S) + ' and compares it with its setpoint' + (n.attributes.setpoint ? ' (' + n.attributes.setpoint + ')' : '') + '.'; }).join(' '),
        ids: [L.id].concat(S, C, s1), pulse: s1.length ? [s1] : [] });
      if (R.length) add('loop', { kind: 'loop', loop: L.id, part: 'relay', title: L.label + ' · relay ' + lab(R),
        text: lab(R) + ' ' + (R.length > 1 ? 'convert' : 'converts') + ' the ' + (C.length ? 'controller output' : 'trip signal') + ' into the command the final element needs' +
          (R.every(function (r) { return g.byId[r].name; }) ? ' (' + R.map(function (r) { return g.byId[r].name; }).join('; ') + ')' : '') + '.',
        ids: [L.id].concat(C.length ? C : S, R, s2), pulse: s2.length ? [s2] : [] });
      if (F.length) {
        var finalSig = C.length ? s3 : (R.length ? s3 : s2);
        add('loop', { kind: 'loop', loop: L.id, part: 'final', title: L.label + ' · final element ' + lab(F),
          text: (L.kind === 'interlock' ? lab(S) + ' trips ' + lab(F) + (R.length ? ' through ' + lab(R) : '') + '.' :
            lab(F) + ' ' + (F.length > 1 ? 'are' : 'is') + ' what the loop moves' + (R.length ? ', through ' + lab(R) : '') + '.'),
          ids: [L.id].concat(R, F, finalSig, tripIds, actIds), pulse: finalSig.length ? [finalSig] : [] });
        var eff = [];
        F.forEach(function (f) {
          eff.push(f);
          eff = eff.concat(walkDown(g, ix, f, function (n) { return n.type === 'Boundary' || n.kind === 'heat_exchanger'; }));
        });
        var effTerms = uniq(eff.filter(function (i) { var n = g.byId[i]; return n && (n.type === 'Boundary' || n.type === 'Equipment') && F.indexOf(i) < 0; }).map(function (i) { return g.byId[i].label; }));
        var closes = S.length ? ' The change reaches ' + lab(S) + ', which closes the loop.' : '';
        add('loop', { kind: 'loop', loop: L.id, part: 'effect', flow: true, title: L.label + ' · effect on the process',
          text: (L.kind === 'interlock' ? 'Stopping ' + lab(F) + ' stops the flow ' : 'Moving ' + lab(F) + ' changes the flow ') +
            'downstream to ' + joinAnd(effTerms) + '.' + (L.kind === 'interlock' ? '' : closes) + (g.byId[F[0]].attributes.effect ? ' ' + g.byId[F[0]].attributes.effect : ''),
          ids: [L.id].concat(eff, S) });
      }
    });

    /* node → step a click on a symbol selects */
    var nodeStep = {};
    function claim(id, step) { if (!has(nodeStep, id)) nodeStep[id] = step.id; }
    steps.forEach(function (s) { if (s.kind === 'flow') claim(s.subject, s); });
    steps.forEach(function (s) { if (s.kind === 'loop' && s.part === 'overview') s.ids.forEach(function (i) { var n = g.byId[i]; if (n && n.type === 'Instrument') claim(i, s); }); });
    steps.forEach(function (s) { if (s.kind === 'measure') s.ids.forEach(function (i) { var n = g.byId[i]; if (n && n.type === 'Instrument') claim(i, s); }); });
    steps.forEach(function (s) { s.ids.forEach(function (i) { if (g.byId[i]) claim(i, s); }); });
    return { sections: sections, steps: steps, nodeStep: nodeStep };
  }

  root.RZPid = { buildGraph: buildGraph, explain: explain, normalizeTag: normalizeTag, normalizeLabel: normalizeLabel,
    parseIsaTag: parseIsaTag, decodeTag: decodeTag, loopVariable: loopVariable, LOW_CONFIDENCE: LOW_CONFIDENCE,
    LOCATION_WORD: LOCATION_WORD };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.RZPid;
  if (typeof document === 'undefined') return;

  /* ============================================================ rendering (browser only) */
  var NS = 'http://www.w3.org/2000/svg';
  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in (attrs || {})) if (has(attrs, k) && attrs[k] !== null && attrs[k] !== undefined) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function txt(parent, x, y, s, cls, anchor, extra) {
    var t = el('text', { x: x, y: y, 'class': cls, 'text-anchor': anchor || 'middle' }, parent);
    for (var k in (extra || {})) if (has(extra, k)) t.setAttribute(k, extra[k]);
    t.textContent = s;
    return t;
  }
  function pts(list) { return list.map(function (p) { return (Math.round(p[0] * 10) / 10) + ',' + (Math.round(p[1] * 10) / 10); }).join(' '); }
  function pathD(list) { return list.map(function (p, i) { return (i ? 'L' : 'M') + (Math.round(p[0] * 10) / 10) + ' ' + (Math.round(p[1] * 10) / 10); }).join(' '); }
  function polyLen(list) { var L = 0; for (var i = 1; i < list.length; i++) L += Math.hypot(list[i][0] - list[i - 1][0], list[i][1] - list[i - 1][1]); return L; }
  function nearestOnPoly(list, p) {
    var best = null, bd = Infinity;
    for (var i = 1; i < list.length; i++) {
      var a = list[i - 1], b = list[i], dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
      var t = L2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2)) : 0;
      var q = [a[0] + t * dx, a[1] + t * dy], d = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (d < bd) { bd = d; best = q; }
    }
    return best;
  }
  function nearestOnRect(r, p) { return [Math.max(r.x0, Math.min(r.x1, p[0])), Math.max(r.y0, Math.min(r.y1, p[1]))]; }
  /* where the leg from c toward p leaves a shape */
  function exitPoint(shape, toward) {
    var c = [shape.cx, shape.cy], dx = toward[0] - c[0], dy = toward[1] - c[1], L = Math.hypot(dx, dy) || 1;
    if (shape.r) return [c[0] + dx / L * shape.r, c[1] + dy / L * shape.r];
    var hx = (shape.x1 - shape.x0) / 2, hy = (shape.y1 - shape.y0) / 2;
    var tx = dx ? hx / Math.abs(dx) : Infinity, ty = dy ? hy / Math.abs(dy) : Infinity, t = Math.min(tx, ty);
    return [c[0] + dx * t, c[1] + dy * t];
  }
  function cssVar(node, name, fallback) {
    try { var v = getComputedStyle(node).getPropertyValue(name).trim(); return v || fallback; } catch (e) { return fallback; }
  }
  function ms(v, fallback) { var m = /^([\d.]+)\s*(ms|s)?$/.exec(String(v || '').trim()); if (!m) return fallback; return parseFloat(m[1]) * (m[2] === 's' ? 1000 : 1); }

  var CSS = [
    '.rzpid-svg{display:block;font-family:"JetBrains Mono",ui-monospace,monospace}',
    '.rzpid-svg .pipe{fill:none;stroke-width:2.2;stroke-linejoin:round}',
    '.rzpid-svg .pipe.cold{stroke:var(--pid-cold,#6E8FAE)}.rzpid-svg .pipe.warm{stroke:var(--pid-warm,#A87A6A)}.rzpid-svg .pipe.plain{stroke:var(--pid-ink2,#8b929b)}',
    '.rzpid-svg .pipe.low{stroke-dasharray:7 5}',
    '.rzpid-svg .arrow{stroke:none}.rzpid-svg .arrow.cold{fill:var(--pid-cold)}.rzpid-svg .arrow.warm{fill:var(--pid-warm)}.rzpid-svg .arrow.plain{fill:var(--pid-ink2)}',
    '.rzpid-svg .flowdash{fill:none;stroke:var(--pid-bg,#121316);stroke-width:1.4;stroke-dasharray:5 13;stroke-linecap:butt;opacity:0}',
    '.rzpid-svg .sig{fill:none;stroke:var(--pid-ink2);stroke-width:1}',
    '.rzpid-svg .sig.electrical{stroke-dasharray:5 3}.rzpid-svg .sig.software{stroke-dasharray:2 3}.rzpid-svg .sig.unknown{stroke-dasharray:1 3}',
    '.rzpid-svg .sigmark{fill:none;stroke:var(--pid-ink2);stroke-width:1}.rzpid-svg .sighead{fill:var(--pid-ink2)}',
    '.rzpid-svg .conn{stroke:var(--pid-ink2);stroke-width:1;fill:none}',
    '.rzpid-svg .sym{fill:var(--pid-bg,#121316);stroke:var(--pid-ink,#e8edf5);stroke-width:1.3}',
    '.rzpid-svg .sym.low{stroke-dasharray:3 2.5}',
    '.rzpid-svg .symfill{fill:var(--pid-ink,#e8edf5);stroke:none}.rzpid-svg .symline{fill:none;stroke:var(--pid-ink);stroke-width:1}',
    '.rzpid-svg .tag{font-size:11px;fill:var(--pid-ink);font-weight:500}.rzpid-svg .bub{font-size:9.6px;fill:var(--pid-ink);font-weight:500}',
    '.rzpid-svg .sub{font-size:10px;fill:var(--pid-muted,#9aa3ad)}.rzpid-svg .flag{fill:var(--pid-bg);stroke:var(--pid-ink2);stroke-width:1}',
    '.rzpid-svg .rope{stroke:var(--pid-ink2);stroke-width:1;stroke-dasharray:2 3;fill:none}',
    '.rzpid-svg .hit{fill:transparent;stroke:none;cursor:pointer}.rzpid-svg g.node:focus{outline:none}',
    '.rzpid-svg .pulse{fill:var(--pid-accent);stroke:var(--pid-bg);stroke-width:1.5;opacity:0;pointer-events:none}',
    /* selection: lit vs dim — opacity only, on the motion tokens */
    '.rzpid-svg [data-id],.rzpid-svg [data-edge]{transition:opacity var(--rz-dur-menu,200ms) var(--rz-ease-out,cubic-bezier(.23,1,.32,1))}',
    '.rzpid-svg.has-sel [data-id]:not(.is-lit),.rzpid-svg.has-sel [data-edge]:not(.is-lit){opacity:.34}',
    '.rzpid-svg .is-lit .pipe,.rzpid-svg .is-lit.sig-g .sig,.rzpid-svg .is-lit .conn{stroke:var(--pid-accent)}',
    '.rzpid-svg .is-lit .arrow,.rzpid-svg .is-lit .sighead{fill:var(--pid-accent)}',
    '.rzpid-svg .is-lit .sym,.rzpid-svg .is-lit .flag{stroke:var(--pid-accent)}',
    '.rzpid-svg .is-lit .tag,.rzpid-svg .is-lit .bub{fill:var(--pid-accent-text,var(--pid-accent))}',
    '.rzpid-svg .is-flowing .flowdash{opacity:1;animation:rzpid-flow var(--rz-dur-explain,600ms) linear infinite}',
    /* constant-velocity fluid: linear is the physics, not a styling choice. 18 = one dash period. */
    '@keyframes rzpid-flow{from{stroke-dashoffset:18}to{stroke-dashoffset:0}}',
    '.rzpid-paused .is-flowing .flowdash{animation-play-state:paused}',
    '@media (prefers-reduced-motion:reduce){.rzpid-svg .is-flowing .flowdash{animation:none;opacity:0}.rzpid-svg [data-id],.rzpid-svg [data-edge]{transition-duration:1ms}}',
    '.rzpid-tip{position:absolute;z-index:5;max-width:280px;padding:8px 10px;background:var(--pid-panel,#191b1f);color:var(--pid-ink);border:1px solid var(--pid-line,rgba(255,255,255,.14));border-radius:3px;font:12.5px/1.45 "IBM Plex Sans",system-ui,sans-serif;pointer-events:none}',
    '.rzpid-tip b{font-family:"JetBrains Mono",monospace;font-weight:600;color:var(--pid-accent-text,var(--pid-accent))}',
    '.rzpid-tip .k{color:var(--pid-muted)}'
  ].join('\n');
  function injectCss() {
    if (document.getElementById('rzpid-css')) return;
    var s = document.createElement('style'); s.id = 'rzpid-css'; s.textContent = CSS; document.head.appendChild(s);
  }

  function render(opts) {
    injectCss();
    var doc = opts.doc, page = doc.pages[0], L = doc.layout || {}, W = L.viewBox[0], H = L.viewBox[1];
    var g = buildGraph(doc.pages, doc.plant.id, doc.plant.name);
    var ex = explain(g);
    var P = page.page;
    var items = {};
    ['equipment', 'components', 'instruments', 'boundaries'].forEach(function (grp) { (page[grp] || []).forEach(function (it) { items[it.id] = { grp: grp, it: it }; }); });
    function box(localId) {
      var b = items[localId].it.bbox; if (!b) return null;
      var r = { x0: b[0] * W, y0: b[1] * H, x1: b[2] * W, y1: b[3] * H };
      r.cx = (r.x0 + r.x1) / 2; r.cy = (r.y0 + r.y1) / 2; r.w = r.x1 - r.x0; r.h = r.y1 - r.y0;
      return r;
    }
    function anchor(localId) { var a = (L.anchors || {})[localId]; if (a) return a; var b = box(localId); return [b.cx, b.cy]; }
    function gid(localId) { return g.resolve(P, localId); }
    function low(c) { return c !== undefined && c < LOW_CONFIDENCE; }

    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, 'class': 'rzpid-svg', role: 'img', 'aria-label': doc.plant.name + ' — piping and instrumentation diagram' });
    var title = el('title', {}, svg); title.textContent = doc.plant.name + ' P&ID';
    var gPipes = el('g', {}, svg), gSig = el('g', {}, svg), gConn = el('g', {}, svg), gSym = el('g', {}, svg), gPulse = el('g', {}, svg);
    var shapes = {}; // graph id -> shape for clipping
    var minX = 0, maxX = W;
    var segPoly = {}, sigPoly = {};

    function mediaClass(service) {
      var s = String(service || '').toLowerCase();
      if (/return/.test(s)) return 'warm';
      if (/supply|bypass/.test(s)) return 'cold';
      return 'plain';
    }
    function drawArrow(parent, poly, cls) {
      var best = -1, bl = 0;
      for (var i = 1; i < poly.length; i++) { var l = Math.hypot(poly[i][0] - poly[i - 1][0], poly[i][1] - poly[i - 1][1]); if (l > bl) { bl = l; best = i; } }
      if (best < 0 || bl < 36) return;
      var a = poly[best - 1], b = poly[best], mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, ang = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;
      el('path', { d: 'M4 0 L-4 -3.6 L-4 3.6 Z', 'class': 'arrow ' + cls, transform: 'translate(' + mx.toFixed(1) + ' ' + my.toFixed(1) + ') rotate(' + ang.toFixed(1) + ')' }, parent);
    }

    /* pipes: one <g data-id> per PipeSegment, split at the line's path items */
    (page.lines || []).forEach(function (line) {
      var route = (L.routes || {})[line.id]; if (!route) return;
      var cut = [0];
      (line.path || []).forEach(function (ref) {
        var a = anchor(ref), from = cut[cut.length - 1], found = -1;
        for (var i = from; i < route.length; i++) if (Math.abs(route[i][0] - a[0]) < 0.6 && Math.abs(route[i][1] - a[1]) < 0.6) { found = i; break; }
        if (found < 0) throw new Error('rz-pid: route ' + line.id + ' does not pass ' + ref);
        cut.push(found);
      });
      cut.push(route.length - 1);
      var cls = mediaClass(line.service), lc = conf(line, 0.85);
      for (var k = 1; k < cut.length; k++) {
        var poly = route.slice(cut[k - 1], cut[k] + 1), sid = 'P' + pad2(P) + '.' + line.id + '.' + k;
        var sg = el('g', { 'data-id': sid, 'class': 'seg' }, gPipes);
        el('path', { d: pathD(poly), 'class': 'pipe ' + cls + (low(lc) ? ' low' : '') }, sg);
        el('path', { d: pathD(poly), 'class': 'flowdash' }, sg);
        drawArrow(sg, poly, cls);
        segPoly[sid] = poly;
      }
    });

    /* symbols */
    function nodeGroup(localId, extraCls) {
      var id = gid(localId);
      var grp = el('g', { 'data-id': id, 'class': 'node ' + (extraCls || ''), tabindex: '-1' }, gSym);
      return grp;
    }
    function tagAt(grp, localId, s, x, y, anchorDflt) {
      var o = (L.labels || {})[localId];
      if (o) return txt(grp, x + o[0], y + o[1], s, 'tag', o[2] || 'middle');
      return txt(grp, x, y, s, 'tag', anchorDflt || 'middle');
    }
    function rot(localId) { return ((L.rotate || {})[localId]) || 0; }

    (page.boundaries || []).forEach(function (b) {
      var r = box(b.id), id = gid(b.id), grp = nodeGroup(b.id, 'boundary'), lc = conf(b, 0.9);
      shapes[id] = r;
      if (b.direction === 'area') {
        el('line', { x1: r.x0, y1: r.cy, x2: r.x1, y2: r.cy, 'class': 'rope' }, grp);
        txt(grp, r.x1, r.cy - 6, b.name, 'sub', 'end');
        return;
      }
      var tip = (L.flagTip || {})[b.id] || 'right', d = 8;
      var need = String(b.name).length * 10 * 0.6 + 2 * d + 6;
      if (need > r.w) { if (r.cx < W / 2) r.x0 = r.x1 - need; else r.x1 = r.x0 + need; r.w = need; r.cx = (r.x0 + r.x1) / 2; }
      minX = Math.min(minX, r.x0 - 4); maxX = Math.max(maxX, r.x1 + 4);
      var poly = tip === 'right' ? [[r.x0, r.y0], [r.x1 - d, r.y0], [r.x1, r.cy], [r.x1 - d, r.y1], [r.x0, r.y1]]
                                 : [[r.x0 + d, r.y0], [r.x1, r.y0], [r.x1, r.y1], [r.x0 + d, r.y1], [r.x0, r.cy]];
      el('polygon', { points: pts(poly), 'class': 'flag' + (low(lc) ? ' sym low' : '') }, grp);
      txt(grp, r.cx + (tip === 'right' ? -d / 2 : d / 2), r.cy + 3.2, b.name, 'sub', 'middle');
      el('rect', { x: r.x0, y: r.y0, width: r.w, height: r.h, 'class': 'hit' }, grp);
    });

    (page.equipment || []).forEach(function (eq) {
      var r = box(eq.id), id = gid(eq.id), grp = nodeGroup(eq.id, 'equipment'), lc = conf(eq, 0.9), k = slug(eq.kind), cls = 'sym' + (low(lc) ? ' low' : '');
      shapes[id] = r;
      if (k === 'heat_exchanger' || k === 'cooler' || k === 'heater') {
        el('rect', { x: r.x0, y: r.y0, width: r.w, height: r.h, rx: 2, 'class': cls }, grp);
        for (var y = r.y0 + 18; y < r.y1 - 18; y += 22) if (Math.abs(y + 5 - r.cy) > 70) el('path', { d: 'M' + (r.x0 + 6) + ' ' + y + ' L' + (r.x1 - 6) + ' ' + (y + 11), 'class': 'symline' }, grp);
        txt(grp, r.cx, r.cy, eq.tag + ' · ' + (eq.name || 'heat exchanger').toUpperCase(), 'tag', 'middle', { transform: 'rotate(-90 ' + r.cx + ' ' + r.cy + ')', dy: '3' });
      } else if (/pump/.test(k)) {
        var rr = Math.min(r.w, r.h) / 2;
        el('circle', { cx: r.cx, cy: r.cy, r: rr, 'class': cls }, grp);
        var a = (rot(eq.id) || 0) * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
        var tri = [[rr * 0.62, 0], [-rr * 0.42, -rr * 0.62], [-rr * 0.42, rr * 0.62]].map(function (p) { return [r.cx + p[0] * ca - p[1] * sa, r.cy + p[0] * sa + p[1] * ca]; });
        el('polygon', { points: pts(tri), 'class': 'symline' }, grp);
        tagAt(grp, eq.id, eq.tag, r.cx, r.y1 + 12);
        shapes[id] = { cx: r.cx, cy: r.cy, r: rr };
      } else if (k === 'vessel' || k === 'tank' || k === 'pressure_vessel') {
        el('rect', { x: r.x0, y: r.y0, width: r.w, height: r.h, rx: r.w / 2, ry: Math.min(r.w / 2, 10), 'class': cls }, grp);
        el('line', { x1: r.x0 + 3, y1: r.cy + 4, x2: r.x1 - 3, y2: r.cy + 4, 'class': 'symline', 'stroke-dasharray': '3 2' }, grp);
        tagAt(grp, eq.id, eq.tag, r.x1 + 6, r.cy + 3, 'start');
      } else {
        el('rect', { x: r.x0, y: r.y0, width: r.w, height: r.h, 'class': cls }, grp);
        el('path', { d: 'M' + r.x0 + ' ' + r.y1 + ' L' + r.x1 + ' ' + r.y0, 'class': 'symline', 'stroke-dasharray': '3 2' }, grp);
        tagAt(grp, eq.id, eq.tag, r.cx, r.y0 - 6);
      }
      el('rect', { x: r.x0, y: r.y0, width: r.w, height: r.h, 'class': 'hit' }, grp);
    });

    (page.components || []).forEach(function (c) {
      var id = gid(c.id), grp = nodeGroup(c.id, 'component'), lc = conf(c, 0.9), k = slug(c.kind), cls = 'sym' + (low(lc) ? ' low' : '');
      var p = anchor(c.id), x = p[0], y = p[1], a = rot(c.id);
      var body = el('g', { transform: 'translate(' + x + ' ' + y + ') rotate(' + a + ')' }, grp);
      var bow = 'M-8 -5.5 L0 0 L-8 5.5 Z M8 -5.5 L0 0 L8 5.5 Z';
      if (k === 'relief_valve') {
        el('path', { d: 'M-5.5 8 L0 0 L5.5 8 Z M8 -5.5 L0 0 L8 5.5 Z', 'class': cls }, body);
        el('path', { d: 'M0 0 V-4 l-3 -2 l6 -3 l-6 -3 l6 -3 l-3 -2', 'class': 'symline' }, body);
      } else if (k === 'check_valve') {
        el('path', { d: 'M-8 -5.5 L0 0 L-8 5.5 Z', 'class': cls }, body);
        el('path', { d: 'M8 -5.5 L0 0 L8 5.5 Z', 'class': 'symfill' }, body);
      } else {
        el('path', { d: bow, 'class': cls }, body);
        if (k === 'three_way_valve') el('path', { d: 'M-5.5 8 L0 0 L5.5 8 Z', 'class': cls }, body);
        if (has(ACTUATED_COMPONENT_KINDS, k) || (c.actuator && c.actuator !== 'manual')) {
          el('line', { x1: 0, y1: 0, x2: 0, y2: -12, 'class': 'symline' }, body);
          el('rect', { x: -6, y: -20, width: 12, height: 8, 'class': cls }, body);
        }
      }
      var top = (has(ACTUATED_COMPONENT_KINDS, k) ? 28 : 12);
      if (c.tag) tagAt(grp, c.id, c.tag, x, y - top + 2);
      var sh = { cx: x, cy: y, x0: x - 9, x1: x + 9, y0: y - (has(ACTUATED_COMPONENT_KINDS, k) ? 21 : 7), y1: y + 9 };
      shapes[id] = sh;
      el('rect', { x: sh.x0 - 2, y: sh.y0 - 2, width: sh.x1 - sh.x0 + 4, height: sh.y1 - sh.y0 + 4, 'class': 'hit' }, grp);
    });

    var R = 15;
    (page.instruments || []).forEach(function (ins) {
      var id = gid(ins.id), grp = nodeGroup(ins.id, 'instrument'), lc = conf(ins, 0.9), cls = 'sym' + (low(lc) ? ' low' : '');
      var r = box(ins.id), x = r.cx, y = r.cy, loc = ins.location || 'unknown';
      if (g.byId[id].attributes.inline) {
        var p = anchor(ins.id);
        el('line', { x1: x, y1: y + R, x2: p[0], y2: p[1] - 4, 'class': 'conn' }, grp);
        el('rect', { x: p[0] - 5, y: p[1] - 4, width: 10, height: 8, 'class': cls }, grp);
      }
      if (loc === 'dcs' || loc === 'plc' || loc === 'scada') {
        el('rect', { x: x - R - 1, y: y - R - 1, width: 2 * R + 2, height: 2 * R + 2, 'class': cls }, grp);
        if (loc === 'plc') el('path', { d: 'M' + x + ' ' + (y - R) + ' L' + (x + R) + ' ' + y + ' L' + x + ' ' + (y + R) + ' L' + (x - R) + ' ' + y + ' Z', 'class': cls }, grp);
        else el('circle', { cx: x, cy: y, r: R, 'class': cls }, grp);
        shapes[id] = { cx: x, cy: y, x0: x - R - 1, x1: x + R + 1, y0: y - R - 1, y1: y + R + 1 };
      } else {
        el('circle', { cx: x, cy: y, r: R, 'class': cls }, grp);
        shapes[id] = { cx: x, cy: y, r: R };
      }
      if (loc === 'main_panel') el('line', { x1: x - R, y1: y, x2: x + R, y2: y, 'class': 'symline' }, grp);
      if (loc === 'behind_panel') el('line', { x1: x - R, y1: y, x2: x + R, y2: y, 'class': 'symline', 'stroke-dasharray': '2 2' }, grp);
      if (loc === 'local_panel') { el('line', { x1: x - R, y1: y - 1.5, x2: x + R, y2: y - 1.5, 'class': 'symline' }, grp); el('line', { x1: x - R, y1: y + 1.5, x2: x + R, y2: y + 1.5, 'class': 'symline' }, grp); }
      var isa = parseIsaTag(ins.tag);
      txt(grp, x, y - 1.5, isa ? isa.letters : (ins['function'] || '?'), 'bub');
      txt(grp, x, y + 8, isa ? isa.number + isa.suffix : '', 'bub');
      el('rect', { x: x - R - 2, y: y - R - 2, width: 2 * R + 4, height: 2 * R + 4, 'class': 'hit' }, grp);
    });

    /* process connections (MEASURES) — thin solid, bubble to the point it senses */
    g.edges.forEach(function (e) {
      if (e.type !== 'MEASURES' || e.attributes.inline || e.derived) return;
      var s = shapes[e.source], t = e.target, target = null;
      if (!s) return;
      if (segPoly[t]) target = nearestOnPoly(segPoly[t], [s.cx, s.cy]);
      else if (shapes[t] && shapes[t].r) target = exitPoint(shapes[t], [s.cx, s.cy]);
      else if (shapes[t]) target = g.byId[t].type === 'Boundary' && g.byId[t].attributes.direction === 'area' ? [Math.max(shapes[t].x0, Math.min(shapes[t].x1, s.cx)), shapes[t].cy] : nearestOnRect(shapes[t], [s.cx, s.cy]);
      if (!target) return;
      var start = exitPoint(s, target);
      var cg = el('g', { 'data-edge': e.id, 'class': 'conn-g' }, gConn);
      el('path', { d: pathD([start, target]), 'class': 'conn' + (low(e.confidence) ? ' low' : ''), 'stroke-dasharray': low(e.confidence) ? '3 2' : null }, cg);
    });

    /* signal lines — dashed by type, routed through layout waypoints, clipped at both shapes */
    var sigRoutes = L.signals || {};
    g.edges.forEach(function (e) {
      if (e.type !== 'SIGNAL_TO') return;
      var s = shapes[e.source], t = shapes[e.target]; if (!s || !t) return;
      var key = (g.byId[e.source].tag || e.source) + '>' + (g.byId[e.target].tag || e.target);
      var mid = sigRoutes[key] || [[t.cx, s.cy]];
      var poly = [exitPoint(s, mid[0])].concat(mid, [exitPoint(t, mid[mid.length - 1])]);
      sigPoly[e.id] = poly;
      var type = e.attributes.signal_type || 'unknown';
      var sg = el('g', { 'data-edge': e.id, 'class': 'sig-g' }, gSig);
      el('path', { d: pathD(poly), 'class': 'sig ' + type + (low(e.confidence) ? ' low' : '') }, sg);
      var len = polyLen(poly);
      if (type === 'pneumatic' || type === 'software') {
        for (var d = 14; d < len - 10; d += 22) {
          var q = along(poly, d);
          if (type === 'pneumatic') el('path', { d: 'M' + (q.p[0] - 3) + ' ' + (q.p[1] + 4) + ' l4 -8 M' + (q.p[0] + 1) + ' ' + (q.p[1] + 4) + ' l4 -8', 'class': 'sigmark', transform: 'rotate(' + q.ang + ' ' + q.p[0] + ' ' + q.p[1] + ')' }, sg);
          else el('circle', { cx: q.p[0], cy: q.p[1], r: 1.6, 'class': 'sigmark' }, sg);
        }
      }
      var end = poly[poly.length - 1], prev = poly[poly.length - 2], ang = Math.atan2(end[1] - prev[1], end[0] - prev[0]) * 180 / Math.PI;
      el('path', { d: 'M0 0 L-6 -2.6 L-6 2.6 Z', 'class': 'sighead', transform: 'translate(' + end[0].toFixed(1) + ' ' + end[1].toFixed(1) + ') rotate(' + ang.toFixed(1) + ')' }, sg);
    });
    function along(poly, dist) {
      for (var i = 1; i < poly.length; i++) {
        var a = poly[i - 1], b = poly[i], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (dist <= l) { var t = l ? dist / l : 0; return { p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], ang: Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI }; }
        dist -= l;
      }
      var z = poly[poly.length - 1]; return { p: z, ang: 0 };
    }

    /* a flag sized to its own text may reach past the authored frame: grow the frame, never clip */
    svg.setAttribute('viewBox', minX.toFixed(1) + ' 0 ' + (maxX - minX).toFixed(1) + ' ' + H);

    /* ------------------------------------------------ DOM: figure + steps */
    var host = opts.host;
    host.classList.add('rzpid');
    var fig = document.createElement('figure'); fig.className = 'rzpid-fig';
    var frame = document.createElement('div'); frame.className = 'rzpid-frame'; frame.tabIndex = 0;
    frame.setAttribute('role', 'region'); frame.setAttribute('aria-label', 'P&ID drawing — scrolls sideways on a narrow screen');
    frame.appendChild(svg); fig.appendChild(frame);
    var tip = document.createElement('div'); tip.className = 'rzpid-tip'; tip.setAttribute('role', 'tooltip'); tip.id = 'rzpid-tip'; tip.hidden = true;
    fig.appendChild(tip);
    if (opts.caption) { var fc = document.createElement('figcaption'); fc.className = 'rzpid-cap'; fc.textContent = opts.caption; fig.appendChild(fc); }
    (opts.figureHost || host).appendChild(fig);

    var list = document.createElement('div'); list.className = 'rzpid-steps';
    var stepBtns = [];
    ex.sections.forEach(function (sec) {
      var mine = ex.steps.filter(function (s) { return s.section === sec.id; }); if (!mine.length) return;
      var h = document.createElement('h3'); h.className = 'rzpid-sec'; h.textContent = sec.title; list.appendChild(h);
      var ol = document.createElement('ol'); ol.className = 'rzpid-ol';
      mine.forEach(function (s) {
        var li = document.createElement('li');
        var b = document.createElement('button'); b.type = 'button'; b.className = 'rzpid-step'; b.setAttribute('data-step', s.id);
        b.setAttribute('aria-pressed', 'false'); b.tabIndex = -1;
        var n = document.createElement('span'); n.className = 'rzpid-n'; n.textContent = pad2(ex.steps.indexOf(s) + 1);
        var t = document.createElement('span'); t.className = 'rzpid-t'; t.textContent = s.title;
        var body = document.createElement('span'); body.className = 'rzpid-b'; body.textContent = s.text;
        b.appendChild(n); b.appendChild(t); b.appendChild(body);
        li.appendChild(b); ol.appendChild(li); stepBtns.push(b);
      });
      list.appendChild(ol);
    });
    (opts.stepsHost || host).appendChild(list);

    /* ------------------------------------------------ behaviour */
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var current = -1, live = [], paused = false;
    function stopPulses() { live.forEach(function (a) { try { a.cancel(); } catch (e) { /* already gone */ } }); live = []; while (gPulse.firstChild) gPulse.removeChild(gPulse.firstChild); }
    function pulse(stages) {
      if (reduce || !stages || !stages.length || !svg.animate) return;
      var hop = ms(cssVar(svg, '--rz-dur-explain', '600ms'), 600);
      var ease = cssVar(svg, '--rz-ease-in-out', 'cubic-bezier(.77,0,.175,1)');
      stages.forEach(function (stage, si) {
        stage.forEach(function (eid) {
          var poly = sigPoly[eid]; if (!poly) return;
          var len = polyLen(poly) || 1, acc = 0, frames = [];
          for (var i = 0; i < poly.length; i++) {
            if (i) acc += Math.hypot(poly[i][0] - poly[i - 1][0], poly[i][1] - poly[i - 1][1]);
            frames.push({ transform: 'translate(' + poly[i][0].toFixed(1) + 'px,' + poly[i][1].toFixed(1) + 'px)', offset: acc / len });
          }
          frames[0].opacity = 0; frames[frames.length - 1].opacity = 0;
          for (var f = 1; f < frames.length - 1; f++) frames[f].opacity = 1;
          if (frames.length === 2) frames.splice(1, 0, { transform: frames[0].transform.replace(/translate\(([^,]+),([^)]+)\)/, function (m0, a, b) { var p0 = poly[0], p1 = poly[1]; return 'translate(' + ((p0[0] + p1[0]) / 2).toFixed(1) + 'px,' + ((p0[1] + p1[1]) / 2).toFixed(1) + 'px)'; }), opacity: 1, offset: 0.5 });
          frames[0].opacity = 0.0001;
          var dot = el('circle', { cx: 0, cy: 0, r: 3.4, 'class': 'pulse' }, gPulse);
          var anim = dot.animate(frames, { duration: hop, delay: si * hop, easing: ease, fill: 'none' });
          if (paused) anim.pause();
          anim.onfinish = function () { if (dot.parentNode) dot.parentNode.removeChild(dot); };
          live.push(anim);
        });
      });
    }
    /* narrow screen: bring the lit part of the drawing into the frame (instant — scrolling is not decoration) */
    function revealLit() {
      if (frame.scrollWidth <= frame.clientWidth + 1) return;
      var lit = svg.querySelectorAll('.is-lit'), fr = frame.getBoundingClientRect(), lo = Infinity, hi = -Infinity;
      for (var k = 0; k < lit.length; k++) { var r = lit[k].getBoundingClientRect(); if (!r.width && !r.height) continue; lo = Math.min(lo, r.left); hi = Math.max(hi, r.right); }
      if (lo === Infinity) return;
      var left = lo - fr.left + frame.scrollLeft, right = hi - fr.left + frame.scrollLeft, view = frame.clientWidth;
      if (left >= frame.scrollLeft && right <= frame.scrollLeft + view) return;
      frame.scrollLeft = right - left <= view ? Math.max(0, (left + right) / 2 - view / 2) : Math.max(0, left - 12);
    }
    function select(i, focus) {
      if (i < 0 || i >= ex.steps.length) return;
      current = i;
      var s = ex.steps[i], set = {};
      s.ids.forEach(function (x) { set[x] = 1; });
      svg.classList.add('has-sel');
      var els = svg.querySelectorAll('[data-id],[data-edge]');
      for (var k = 0; k < els.length; k++) {
        var key = els[k].getAttribute('data-id') || els[k].getAttribute('data-edge');
        var lit = !!set[key];
        els[k].classList.toggle('is-lit', lit);
        els[k].classList.toggle('is-flowing', lit && !!s.flow && !reduce && els[k].classList.contains('seg'));
      }
      stepBtns.forEach(function (b, j) { b.setAttribute('aria-pressed', j === i ? 'true' : 'false'); b.tabIndex = j === i ? 0 : -1; });
      if (focus) stepBtns[i].focus();
      revealLit();
      stopPulses();
      pulse(s.pulse);
      host.setAttribute('data-step', s.id);
    }
    stepBtns.forEach(function (b, j) {
      b.addEventListener('click', function () { select(j, false); });
      b.addEventListener('keydown', function (ev) {
        var k = ev.key, to = -1;
        if (k === 'ArrowDown' || k === 'ArrowRight') to = Math.min(stepBtns.length - 1, j + 1);
        else if (k === 'ArrowUp' || k === 'ArrowLeft') to = Math.max(0, j - 1);
        else if (k === 'Home') to = 0; else if (k === 'End') to = stepBtns.length - 1;
        if (to < 0) return;
        ev.preventDefault(); stepBtns.forEach(function (x) { x.tabIndex = -1; }); stepBtns[to].tabIndex = 0; stepBtns[to].focus();
      });
    });

    /* tag decode */
    function tipHtml(id) {
      var n = g.byId[id]; if (!n) return '';
      var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
      var out = [];
      if (n.type === 'Instrument' || (n.type === 'Component' && n.tag)) {
        var d = decodeTag(n.tag || n.label);
        out.push('<b>' + esc(n.label) + '</b>' + (d ? ' — ' + esc(d.words.join(', ')) : ''));
        if (n.type === 'Instrument') out.push('<span class="k">Mounted:</span> ' + esc(LOCATION_WORD[n.attributes.location] || n.attributes.location));
        var ix = index(g);
        if (n.type === 'Instrument') { var w = measuredWhere(g, ix, id); if (w) out.push('<span class="k">Senses:</span> ' + esc(w)); }
        if (n.name) out.push('<span class="k">Item:</span> ' + esc(n.name));
        var v = valueText(n); if (v) out.push('<span class="k">Value:</span> ' + esc(v));
        var lp = ix.out(id, 'MEMBER_OF')[0];
        if (lp) out.push('<span class="k">Loop:</span> ' + esc(g.byId[lp.target].label) + ' as ' + esc(String(lp.attributes.role).replace(/_/g, ' ')));
        else if (n.attributes.standalone) out.push('<span class="k">Loop:</span> none — ' + esc(n.attributes.standalone));
      } else {
        out.push('<b>' + esc(n.label) + '</b>' + (n.name && n.name !== n.label ? ' — ' + esc(n.name) : ''));
        if (n.kind) out.push('<span class="k">Kind:</span> ' + esc(pretty(n.kind)));
        var v2 = valueText(n); if (v2) out.push('<span class="k">Value:</span> ' + esc(v2));
      }
      if (n.confidence < LOW_CONFIDENCE) out.push('<span class="k">Low confidence:</span> ' + esc(n.attributes.basis || 'not drawn on the source page'));
      if (n.attributes.src && doc.sources && doc.sources[n.attributes.src]) out.push('<span class="k">Source:</span> ' + esc(doc.sources[n.attributes.src].ref));
      return out.join('<br>');
    }
    function showTip(groupEl) {
      var id = groupEl.getAttribute('data-id'); var html = tipHtml(id); if (!html) return;
      tip.innerHTML = html; tip.hidden = false;
      var fr = fig.getBoundingClientRect(), r = groupEl.getBoundingClientRect();
      var x = r.right - fr.left + 8, y = r.top - fr.top;
      var tw = tip.offsetWidth, th = tip.offsetHeight;
      if (x + tw > fr.width) x = Math.max(4, r.left - fr.left - tw - 8);
      if (y + th > fr.height) y = Math.max(4, fr.height - th - 4);
      tip.style.left = x + 'px'; tip.style.top = y + 'px';
      groupEl.setAttribute('aria-describedby', 'rzpid-tip');
    }
    function hideTip() { tip.hidden = true; }
    var nodes = svg.querySelectorAll('g.node');
    for (var q = 0; q < nodes.length; q++) (function (gEl) {
      gEl.addEventListener('pointerenter', function (ev) { if (ev.pointerType === 'mouse') showTip(gEl); });
      gEl.addEventListener('pointerleave', function (ev) { if (ev.pointerType === 'mouse') hideTip(); });
      gEl.addEventListener('click', function () {
        var id = gEl.getAttribute('data-id'), sid = ex.nodeStep[id];
        if (sid) { var j = ex.steps.map(function (s) { return s.id; }).indexOf(sid); select(j, false); if (opts.onSymbol) opts.onSymbol(stepBtns[j]); }
        showTip(gEl);
      });
    })(nodes[q]);
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') hideTip(); });
    frame.addEventListener('scroll', hideTip, { passive: true });

    /* pause everything off-screen */
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          paused = !en.isIntersecting;
          svg.classList.toggle('rzpid-paused', paused);
          live.forEach(function (a) { try { if (paused) a.pause(); else a.play(); } catch (e) { /* finished */ } });
        });
      }, { threshold: 0.05 }).observe(svg);
    }

    var api = { graph: g, explanation: ex, select: select, svg: svg, steps: stepBtns };
    host.__rzpid = api;
    if (opts.initial !== undefined) select(opts.initial, false);
    return api;
  }
  root.RZPid.render = render;
})(typeof window !== 'undefined' ? window : globalThis);
