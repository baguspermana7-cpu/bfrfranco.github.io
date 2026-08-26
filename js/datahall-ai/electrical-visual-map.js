/* Explicit projection from AI SLD conductors to evaluated topology edges. */
(function (root) {
  'use strict';

  var HALL_COUNT = 4;
  var HALL_SCOPE = /^dh0([1-4])$/;

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
    var active = edges.length > 0 && activeEdges.length > 0;
    var partial = active && activeEdges.length < edges.length;
    return Object.freeze({
      active: active,
      partial: partial,
      mapped: openTie || edges.length > 0,
      inScope: inScope,
      semanticState: !inScope ? 'out-of-scope' : openTie ? 'open' : !edges.length ? 'unmapped' :
        partial ? 'partially-energized' : (semanticStates[0] || 'de-energized'),
      edgeIds: Object.freeze(edges.map(function (edge) { return edge.id; })),
      sourceIds: Object.freeze(sourceIds)
    });
  }

  function hallCounts(racks, scope) {
    var counts = { total: 0, available: 0, twoN: 0, degraded: 0, lost: 0 };
    var source = racks && typeof racks === 'object' ? racks : {};
    Object.keys(source).forEach(function (id) {
      counts.total += 1;
      if (source[id].serviceAvailable) { counts.available += 1; }
      if (source[id].redundancyState === '2N') { counts.twoN += 1; }
      if (source[id].redundancyState === 'DEGRADED') { counts.degraded += 1; }
      if (source[id].redundancyState === 'LOST') { counts.lost += 1; }
    });
    var multiplier = normalizeScope(scope) === 'overview' ? HALL_COUNT : 1;
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
    version: '1.0.0'
  });

  if (root) { root.RZDatahallAIElectricalVisualMap = API; }
  if (typeof module !== 'undefined' && module.exports) { module.exports = API; }
}(typeof window !== 'undefined' ? window : globalThis));
