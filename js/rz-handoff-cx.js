/**
 * rz-handoff-cx.js — RFS readiness gap → Cx issue register hand-off (PRD-P13 part B). DOM-free, ES5, Node + browser.
 *
 *   RZHandoffCx.fromGap(gap)            -> queue item draft { gap_id, title, system, gate, severity, evidence_ids, source_url }
 *                                          gap = { unitId, reqId, title, discipline, blockerClass, evidenceIds }
 *   RZHandoffCx.queue(storage, now)     -> { load(), send(item), remove(ids), clear(), has(gap_id) }   key rz_handoff_cx
 *                                          load() drops items older than 7 days and reports how many it dropped
 *   RZHandoffCx.intake(queue, register, sources, now) -> { added:[{gap_id, id}], refused:[{gap_id, code}] }
 *                                          register = RZCxIssues.store(); refused items stay in the queue
 *   RZHandoffCx.sources(storage)        -> { get(issueId), all(), put(issueId, rec) }   key rz-cx-issue-sources
 *   RZHandoffCx.safeUrl(url)            -> url when it is a same-origin RFS anchor, else null
 * The Tier 1 issue schema has no source field, so the RFS link lives in the side map (FR-P13-7).
 * Duplicate guard (FR-P13-8): a gap_id already in the queue or already intaken is refused with code DUP.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RZHandoffCx = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var KEY = 'rz_handoff_cx', SRC_KEY = 'rz-cx-issue-sources', MAX = 100, TTL_MS = 7 * 24 * 3600 * 1000, SUFFIX = ' (RFS)';
  var GATES = ['L1', 'L2', 'L3', 'L4', 'L5'], SEV = ['A', 'B', 'C'];
  // rfs discipline → Cx system pre-selected in the send form (the user can change it); null = the user must pick
  var SYSTEM_MAP = { electrical: 'lv_busway', mechanical: 'chillers', fire: 'fire', controls: 'bms',
                     operations: null, management: null, commercial: null, regulatory: null, security: null };
  var SEVERITY_MAP = { hard: 'A', soft: 'B', info: 'C' };
  var PAGE = 'rfs-readiness-workbench.html';

  function txt(s, n) { return String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n); }
  function safeUrl(u) {
    var s = String(u == null ? '' : u);
    return s.indexOf(PAGE + '#') === 0 && /^[\w.-]+#[\w:.-]{1,120}$/.test(s) ? s : null;
  }
  function gapId(unitId, reqId) { return txt(unitId, 40) + ':' + txt(reqId, 60); }

  function fromGap(g) {
    g = g || {};
    var id = gapId(g.unitId, g.reqId);
    return {
      gap_id: id,
      title: txt(g.title, 120 - SUFFIX.length),
      system: SYSTEM_MAP[g.discipline] || null,
      gate: 'L3',
      severity: SEVERITY_MAP[g.blockerClass] || 'C',
      evidence_ids: (g.evidenceIds || []).slice(0, 20).map(function (x) { return txt(x, 60); }),
      source_url: PAGE + '#gap-' + id.replace(/[^\w:.-]/g, '-')
    };
  }

  function valid(it) {
    return !!(it && typeof it.gap_id === 'string' && it.gap_id && txt(it.title, 120) && it.system &&
      GATES.indexOf(it.gate) >= 0 && SEV.indexOf(it.severity) >= 0 && safeUrl(it.source_url));
  }

  function sources(storage) {
    function read() { try { var o = JSON.parse(storage && storage.getItem(SRC_KEY) || '{}'); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; } }
    return {
      all: read,
      get: function (id) { return read()[id] || null; },
      put: function (id, rec) { var o = read(); o[id] = { gap_id: rec.gap_id, url: safeUrl(rec.url) }; try { storage.setItem(SRC_KEY, JSON.stringify(o)); return true; } catch (e) { return false; } }
    };
  }

  function queue(storage, now) {
    now = now || function () { return Date.now(); };
    var dropped = 0;
    function read() {
      var items = [];
      try {
        var o = JSON.parse(storage && storage.getItem(KEY) || 'null');
        if (o && o.v === 1 && o.items && typeof o.items.length === 'number') items = o.items;
      } catch (e) { items = []; }
      var t = now(), keep = [];
      dropped = 0;
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        if (!valid(it) || typeof it.at !== 'number') continue;
        if (t - it.at > TTL_MS) { dropped++; continue; }
        keep.push(it);
      }
      return keep;
    }
    function write(items) { try { storage.setItem(KEY, JSON.stringify({ v: 1, items: items })); return true; } catch (e) { return false; } }
    function inSources(gid) { var all = sources(storage).all(); for (var k in all) if (all[k] && all[k].gap_id === gid) return true; return false; }
    var api = {
      load: function () { var items = read(); if (dropped) write(items); return { items: items, expired: dropped }; },
      has: function (gid) { var items = read(); for (var i = 0; i < items.length; i++) if (items[i].gap_id === gid) return true; return inSources(gid); },
      send: function (item) {
        var it = JSON.parse(JSON.stringify(item || {}));
        it.title = txt(it.title, 120 - SUFFIX.length);
        if (!valid(it)) return { ok: false, code: 'INVALID' };
        if (api.has(it.gap_id)) return { ok: false, code: 'DUP' };
        var items = read();
        if (items.length >= MAX) return { ok: false, code: 'FULL' };
        it.at = now(); items.push(it);
        return write(items) ? { ok: true } : { ok: false, code: 'STORAGE' };
      },
      remove: function (ids) { var items = read().filter(function (x) { return ids.indexOf(x.gap_id) < 0; }); write(items); },
      clear: function () { write([]); }
    };
    return api;
  }

  function intake(q, register, src) {
    var added = [], refused = [], done = [];
    q.load().items.forEach(function (it) {
      var r = register.add({ title: it.title + SUFFIX, severity: it.severity, system: it.system, gate: it.gate });
      if (r && r.ok) { src.put(r.issue.id, { gap_id: it.gap_id, url: it.source_url }); added.push({ gap_id: it.gap_id, id: r.issue.id }); done.push(it.gap_id); }
      else refused.push({ gap_id: it.gap_id, code: (r && r.code) || 'ERROR' });
    });
    if (done.length) q.remove(done);
    return { added: added, refused: refused };
  }

  return { KEY: KEY, SRC_KEY: SRC_KEY, MAX: MAX, TTL_MS: TTL_MS, SYSTEM_MAP: SYSTEM_MAP, SEVERITY_MAP: SEVERITY_MAP,
           fromGap: fromGap, queue: queue, intake: intake, sources: sources, safeUrl: safeUrl };
});
