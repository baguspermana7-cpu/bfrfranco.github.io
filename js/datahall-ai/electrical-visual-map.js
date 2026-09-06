/* Explicit projection from AI SLD conductors to evaluated topology edges.
 *
 * v2.0.0 — the evaluated topology aggregates racks into RPP groups, so a bank
 * line binds to an `EDGE-RPP-A-` prefix (40 group feeders) rather than to 54
 * per-rack edges, and rack counts are SUMMED from each group instead of counted
 * one node per rack. A partial bank is now two different facts: some group
 * feeders de-energized, or some individual rack cords faulted inside groups
 * that are still fed — both make the drawn line partially energized.
 */
(function (root) {
  'use strict';

  /* Only used when no engine snapshot is reachable at all; the hall count is a
     published quantity (racks_facility / racks_per_hall), never a house number. */
  var FALLBACK_HALL_COUNT = 4;
  var HALL_SCOPE = /^dh0([1-4])$/;

  function snapshotOrNull() {
    if (root && root.DCAI_CALC && root.DCAI_CALC.snapshot) { return root.DCAI_CALC.snapshot; }
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
      try { return require('../dcai-engine.js').snapshot; } catch (e) { return null; }
    }
    return null;
  }

  function resolveHallCount() {
    var snapshot = snapshotOrNull();
    var facility;
    var perHall;
    if (!snapshot || !snapshot.compute) { return FALLBACK_HALL_COUNT; }
    facility = snapshot.compute.racks_facility;
    perHall = snapshot.compute.racks_per_hall;
    if (typeof facility !== 'number' || typeof perHall !== 'number' || perHall <= 0) {
      return FALLBACK_HALL_COUNT;
    }
    return facility / perHall;
  }

  var HALL_COUNT = resolveHallCount();

  function edgeId(feed, segment) {
    return 'EDGE-' + segment.replace(/\{F\}/g, feed);
  }

  function feedFromId(lineId) {
    var id = String(lineId || '').toLowerCase();
    if (/(?:-a(?:[1-4])?(?:-|$)|-fa(?:-|$))/.test(id)) { return 'A'; }
    if (/(?:-b(?:[1-4])?(?:-|$)|-fb(?:-|$))/.test(id)) { return 'B'; }
    return '';
  }

  function hallFromId(lineId) {
    var match = String(lineId || '').match(/^dh([1-4])-/i);
    return match ? 'dh0' + match[1] : 'overview';
  }

  function knownBinding(lineId) {
    var id = String(lineId || '');
    var feed = feedFromId(id);
    if (!feed || /(?:^|-)bus-tie$/.test(id) || /-rmu-bus-tie$/.test(id)) { return null; }

    if (/^elec-(?:pln-[ab]-to-meter|meter-[ab]-to-vcb-inc-[ab]|vcb-inc-[ab]-to-bus-[ab]|bus-[ab]-drop-vert)$/.test(id)) {
      return edgeId(feed, 'UTILITY-{F}-MV-BUS-{F}');
    }
    if (/^elec-feeder-[ab][1-4]-(?:drop|exit)$/.test(id)) {
      return edgeId(feed, 'MV-BUS-{F}-RMU-{F}');
    }
    if (/^dh[1-4]-(?:pln-[ab]-to-meter|meter-[ab]-to-vcb|vcb-inc-[ab]-to-bus)$/.test(id)) {
      return edgeId(feed, 'UTILITY-{F}-MV-BUS-{F}');
    }
    if (/^dh[1-4]-(?:bus-to-f[ab]|f[ab]-to-rmu-drop|rmu-input-[ab]|rmu-meter-[ab]-to-vcb|rmu-vcb-[ab]-to-bus)$/.test(id)) {
      return edgeId(feed, 'MV-BUS-{F}-RMU-{F}');
    }
    if (/^dh[1-4]-rmu-bus-[ab]-drop$/.test(id)) {
      return edgeId(feed, 'RMU-{F}-TX-{F}');
    }
    return null;
  }

  function knownOpenTie(lineId) {
    var id = String(lineId || '');
    return /(?:^|-)bus-tie$/.test(id) || /-rmu-bus-tie$/.test(id);
  }

  function normalizeScope(scope) {
    var value = String(scope || 'dh01').toLowerCase();
    return value === 'overview' || HALL_SCOPE.test(value) ? value : 'dh01';
  }

  function indexEdges(result) {
    var index = Object.create(null);
    var edges = result && Array.isArray(result.edges) ? result.edges : [];
    edges.forEach(function (edge) { index[edge.id] = edge; });
    return index;
  }

  function unique(values) {
    return values.filter(function (value, index) { return values.indexOf(value) === index; });
  }

  function selectEdges(descriptor, result) {
    var index = indexEdges(result);
    var explicitId = descriptor.edgeId || knownBinding(descriptor.lineId);
    if (explicitId) { return index[explicitId] ? [index[explicitId]] : []; }
    if (!descriptor.edgePrefix) { return []; }
    return Object.keys(index).filter(function (id) {
      return id.indexOf(descriptor.edgePrefix) === 0;
    }).map(function (id) { return index[id]; });
  }

  function sumFaulted(edges) {
    return edges.reduce(function (total, edge) {
      return total + (typeof edge.faultedRacks === 'number' ? edge.faultedRacks : 0);
    }, 0);
  }

  function sumServed(edges) {
    return edges.reduce(function (total, edge) {
      return total + (typeof edge.servedRacks === 'number' ? edge.servedRacks : 0);
    }, 0);
  }

  function projectLine(descriptor, result, scope) {
    var safeDescriptor = descriptor || {};
    var normalizedScope = normalizeScope(scope);
    var lineHall = safeDescriptor.hall || hallFromId(safeDescriptor.lineId);
    var inScope = normalizedScope === 'overview' ? lineHall === 'overview' : lineHall === normalizedScope;
    var openTie = knownOpenTie(safeDescriptor.lineId);
    var edges = inScope ? selectEdges(safeDescriptor, result) : [];
    var activeEdges = edges.filter(function (edge) { return edge.flowActive; });
    var semanticStates = unique(edges.map(function (edge) { return edge.semanticState; }));
    var sourceIds = unique(activeEdges.reduce(function (all, edge) {
      return all.concat(edge.sourceIds || []);
    }, []));
    var faultedRacks = sumFaulted(edges);
    var active = edges.length > 0 && activeEdges.length > 0;
    /* a bank is partial when some feeders are down OR when racks inside a fed
       group have lost a cord — the aggregated topology reports the second as a count */
    var partial = active && (activeEdges.length < edges.length || faultedRacks > 0);
    return Object.freeze({
      active: active,
      partial: partial,
      mapped: openTie || edges.length > 0,
      inScope: inScope,
      semanticState: !inScope ? 'out-of-scope' : openTie ? 'open' : !edges.length ? 'unmapped' :
        partial ? 'partially-energized' : (semanticStates[0] || 'de-energized'),
      edgeIds: Object.freeze(edges.map(function (edge) { return edge.id; })),
      sourceIds: Object.freeze(sourceIds),
      faultedRacks: faultedRacks,
      servedRacks: sumServed(edges)
    });
  }

  function readCount(group, key) {
    var value = group[key];
    if (typeof value !== 'number' || !isFinite(value)) {
      throw new Error('Rack group ' + (group.id || '?') + ' has no ' + key +
        ' — the aggregated topology is required (electrical-topology.js >= 2.0.0)');
    }
    return value;
  }

  /* Counts are SUMMED from the groups: one group carries rackCount racks, and the
     per-rack buckets are published by the state engine, never re-derived here. */
  function hallCounts(racks, scope) {
    var counts = { total: 0, available: 0, twoN: 0, degraded: 0, lost: 0 };
    var source = racks && typeof racks === 'object' ? racks : {};
    var multiplier = normalizeScope(scope) === 'overview' ? HALL_COUNT : 1;
    Object.keys(source).forEach(function (id) {
      var group = source[id];
      counts.total += readCount(group, 'rackCount');
      counts.available += readCount(group, 'servedRackCount');
      counts.twoN += readCount(group, 'twoNCount');
      counts.degraded += readCount(group, 'degradedCount');
      counts.lost += readCount(group, 'lostCount');
    });
    Object.keys(counts).forEach(function (key) { counts[key] *= multiplier; });
    return Object.freeze(counts);
  }

  var API = Object.freeze({
    HALL_COUNT: HALL_COUNT,
    knownBinding: knownBinding,
    knownOpenTie: knownOpenTie,
    hallFromId: hallFromId,
    normalizeScope: normalizeScope,
    projectLine: projectLine,
    hallCounts: hallCounts,
    version: '2.0.0'
  });

  if (root) { root.RZDatahallAIElectricalVisualMap = API; }
  if (typeof module !== 'undefined' && module.exports) { module.exports = API; }
}(typeof window !== 'undefined' ? window : globalThis));
