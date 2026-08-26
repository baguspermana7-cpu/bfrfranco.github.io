/* ============================================================================
 * datahall-ai/electrical-topology.js
 * Pure state engine for the DC AI 2N electrical topology.
 *
 * ES5-compatible, zero-build, and UI-agnostic. Visual classes and colours never
 * determine electrical truth; renderers consume semanticState/sourceIds and may
 * animate only when flowActive is true.
 * ==========================================================================*/
(function (root) {
  'use strict';

  var RACK_COUNT = 54;
  var RACK_LOAD_KW = 66;
  var VALID_SOURCE_STATES = {
    online: true, unavailable: true, standby: true, running: true, failed: true
  };
  var VALID_BREAKER_STATES = {
    closed: true, open: true, tripped: true, maintenance: true,
    racked_out: true, test: true, disabled: true
  };
  var VALID_ATS_STATES = { normal: true, transfer_failed: true, maintenance: true };
  var VALID_UPS_STATES = { online: true, bypass: true, fault: true, maintenance: true };
  var VALID_BUSWAY_STATES = { normal: true, tripped: true, maintenance: true };
  var VALID_RACK_FEED_STATES = { online: true, fault: true, open: true, maintenance: true };

  function deepFreeze(value) {
    var keys;
    var i;
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) { return value; }
    keys = Object.keys(value);
    for (i = 0; i < keys.length; i += 1) { deepFreeze(value[keys[i]]); }
    return Object.freeze(value);
  }

  function clone(value) {
    var result;
    var keys;
    var i;
    if (value === null || typeof value !== 'object') { return value; }
    if (Object.prototype.toString.call(value) === '[object Array]') {
      result = [];
      for (i = 0; i < value.length; i += 1) { result.push(clone(value[i])); }
      return result;
    }
    result = {};
    keys = Object.keys(value);
    for (i = 0; i < keys.length; i += 1) { result[keys[i]] = clone(value[keys[i]]); }
    return result;
  }

  function merge(base, patch) {
    var result = clone(base);
    var keys;
    var i;
    var key;
    if (!patch || typeof patch !== 'object') { return result; }
    keys = Object.keys(patch);
    for (i = 0; i < keys.length; i += 1) {
      key = keys[i];
      if (patch[key] && typeof patch[key] === 'object' &&
          Object.prototype.toString.call(patch[key]) !== '[object Array]' &&
          result[key] && typeof result[key] === 'object') {
        result[key] = merge(result[key], patch[key]);
      } else {
        result[key] = clone(patch[key]);
      }
    }
    return result;
  }

  function rackId(index) {
    return 'RACK-' + (index < 10 ? '0' : '') + index;
  }

  function addTopologyEdge(edges, id, from, to, feed, controller, role, selector) {
    var item = {
      id: id,
      from: from,
      to: to,
      feed: feed,
      controller: controller,
      redundancyRole: role
    };
    if (selector) { item.selector = selector; }
    edges.push(item);
  }

  function addFeedNodes(nodes, feed, suffix) {
    nodes.push({ id: 'MV-BUS' + suffix, type: 'mv_bus', feed: feed });
    nodes.push({ id: 'RMU' + suffix, type: 'ring_main_unit', feed: feed });
    nodes.push({ id: 'TX' + suffix, type: 'transformer', feed: feed });
    nodes.push({ id: 'ATS' + suffix, type: 'ats', feed: feed });
    nodes.push({ id: 'MSB' + suffix, type: 'main_switchboard', feed: feed });
    nodes.push({ id: 'UPS' + suffix, type: 'ups', feed: feed });
    nodes.push({ id: 'BUSWAY' + suffix, type: 'busway', feed: feed });
    nodes.push({ id: 'RPP' + suffix, type: 'rpp', feed: feed });
  }

  function addFeedEdges(edges, feed, suffix) {
    var role = feed === 'A' ? 'redundant_a' : 'redundant_b';
    addTopologyEdge(edges, 'EDGE-UTILITY' + suffix + '-MV-BUS' + suffix, 'SRC-UTILITY' + suffix, 'MV-BUS' + suffix, feed, 'BR-UTILITY' + suffix, role);
    addTopologyEdge(edges, 'EDGE-MV-BUS' + suffix + '-RMU' + suffix, 'MV-BUS' + suffix, 'RMU' + suffix, feed, 'BR-RMU' + suffix, role);
    addTopologyEdge(edges, 'EDGE-RMU' + suffix + '-TX' + suffix, 'RMU' + suffix, 'TX' + suffix, feed, 'BR-TX' + suffix, role);
    addTopologyEdge(edges, 'EDGE-TX' + suffix + '-ATS' + suffix, 'TX' + suffix, 'ATS' + suffix, feed, 'BR-ATS-NORMAL' + suffix, role, 'utility');
    addTopologyEdge(edges, 'EDGE-GEN-BUS-ATS' + suffix, 'GEN-BUS', 'ATS' + suffix, feed, 'BR-GEN' + suffix, 'standby', 'generator');
    addTopologyEdge(edges, 'EDGE-ATS' + suffix + '-MSB' + suffix, 'ATS' + suffix, 'MSB' + suffix, feed, 'BR-MSB' + suffix, role);
    addTopologyEdge(edges, 'EDGE-MSB' + suffix + '-UPS' + suffix, 'MSB' + suffix, 'UPS' + suffix, feed, 'BR-UPS' + suffix, role);
    addTopologyEdge(edges, 'EDGE-UPS' + suffix + '-BUSWAY' + suffix, 'UPS' + suffix, 'BUSWAY' + suffix, feed, 'BR-BUSWAY' + suffix, role);
    addTopologyEdge(edges, 'EDGE-BUSWAY' + suffix + '-RPP' + suffix, 'BUSWAY' + suffix, 'RPP' + suffix, feed, 'BR-RPP' + suffix, role);
  }

  function addFeed(nodes, edges, feed) {
    var suffix = '-' + feed;
    addFeedNodes(nodes, feed, suffix);
    addFeedEdges(edges, feed, suffix);
  }

  function buildTopology() {
    var nodes = [
      { id: 'SRC-UTILITY-A', type: 'source', sourceType: 'utility', feed: 'A' },
      { id: 'SRC-UTILITY-B', type: 'source', sourceType: 'utility', feed: 'B' },
      { id: 'SRC-GENSET-POOL', type: 'source', sourceType: 'generator', feed: 'common' },
      { id: 'GEN-BUS', type: 'generator_bus', feed: 'common' }
    ];
    var edges = [];
    var i;
    var id;

    edges.push({
      id: 'EDGE-GENSET-GEN-BUS',
      from: 'SRC-GENSET-POOL',
      to: 'GEN-BUS',
      feed: 'common',
      controller: 'BR-GEN-MAIN',
      redundancyRole: 'standby'
    });
    addFeed(nodes, edges, 'A');
    addFeed(nodes, edges, 'B');
    for (i = 1; i <= RACK_COUNT; i += 1) {
      id = rackId(i);
      nodes.push({ id: id, type: 'rack', loadKW: RACK_LOAD_KW, dualCorded: true });
      edges.push({
        id: 'EDGE-RPP-A-' + id,
        from: 'RPP-A',
        to: id,
        feed: 'A',
        controller: 'BR-' + id + '-A',
        rackFeed: 'feedA',
        redundancyRole: 'redundant_a'
      });
      edges.push({
        id: 'EDGE-RPP-B-' + id,
        from: 'RPP-B',
        to: id,
        feed: 'B',
        controller: 'BR-' + id + '-B',
        rackFeed: 'feedB',
        redundancyRole: 'redundant_b'
      });
    }
    return deepFreeze({ nodes: nodes, edges: edges });
  }

  var BASE_TOPOLOGY = buildTopology();

  function buildDefaultState() {
    var breakers = {};
    var racks = {};
    var i;
    var edge;
    var id;
    for (i = 0; i < BASE_TOPOLOGY.edges.length; i += 1) {
      edge = BASE_TOPOLOGY.edges[i];
      breakers[edge.controller] = 'closed';
    }
    for (i = 1; i <= RACK_COUNT; i += 1) {
      id = rackId(i);
      racks[id] = { feedA: 'online', feedB: 'online' };
    }
    return {
      scenarioId: 'normal',
      sources: {
        'SRC-UTILITY-A': { state: 'online' },
        'SRC-UTILITY-B': { state: 'online' },
        'SRC-GENSET-POOL': { state: 'standby' }
      },
      breakers: breakers,
      ats: {
        'ATS-A': { state: 'normal', selectedSource: 'utility' },
        'ATS-B': { state: 'normal', selectedSource: 'utility' }
      },
      ups: { 'UPS-A': 'online', 'UPS-B': 'online' },
      busways: { 'BUSWAY-A': 'normal', 'BUSWAY-B': 'normal' },
      racks: racks
    };
  }

  var DEFAULT_STATE = deepFreeze(buildDefaultState());

  var SCENARIOS = deepFreeze({
    normal: {
      label: 'Normal 2N operation',
      patch: {},
      timeline: [{ offsetSeconds: 0, code: 'NORMAL', message: 'Both utility paths available' }]
    },
    utility_a_fail: {
      label: 'Utility A failure with successful generator transfer',
      patch: {
        sources: {
          'SRC-UTILITY-A': { state: 'unavailable' },
          'SRC-GENSET-POOL': { state: 'running' }
        },
        ats: { 'ATS-A': { state: 'normal', selectedSource: 'generator' } }
      },
      timeline: [
        { offsetSeconds: 0, code: 'UTILITY_A_LOSS', message: 'Utility A unavailable' },
        { offsetSeconds: 1, code: 'ATS_A_SENSE', message: 'ATS A validates source loss' },
        { offsetSeconds: 10, code: 'GENSET_RUNNING', message: 'Generator pool reaches stable output' },
        { offsetSeconds: 15, code: 'ATS_A_TRANSFER', message: 'ATS A transfers to generator' }
      ]
    },
    utility_b_fail: {
      label: 'Utility B failure with successful generator transfer',
      patch: {
        sources: {
          'SRC-UTILITY-B': { state: 'unavailable' },
          'SRC-GENSET-POOL': { state: 'running' }
        },
        ats: { 'ATS-B': { state: 'normal', selectedSource: 'generator' } }
      },
      timeline: [
        { offsetSeconds: 0, code: 'UTILITY_B_LOSS', message: 'Utility B unavailable' },
        { offsetSeconds: 1, code: 'ATS_B_SENSE', message: 'ATS B validates source loss' },
        { offsetSeconds: 10, code: 'GENSET_RUNNING', message: 'Generator pool reaches stable output' },
        { offsetSeconds: 15, code: 'ATS_B_TRANSFER', message: 'ATS B transfers to generator' }
      ]
    },
    ups_a_bypass: {
      label: 'UPS A static bypass',
      patch: { ups: { 'UPS-A': 'bypass' } },
      timeline: [
        { offsetSeconds: 0, code: 'UPS_A_BYPASS', message: 'UPS A enters bypass' },
        { offsetSeconds: 1, code: 'REDUNDANCY_DEGRADED', message: 'Feed A remains conductive without conditioning' }
      ]
    },
    busway_a_trip: {
      label: 'Busway A feeder trip',
      patch: { breakers: { 'BR-BUSWAY-A': 'tripped' } },
      timeline: [
        { offsetSeconds: 0, code: 'BUSWAY_A_TRIP', message: 'Busway A upstream breaker trips' },
        { offsetSeconds: 1, code: 'RACKS_ON_B', message: 'Rack loads remain available on feed B' }
      ]
    },
    genset_pool_start_failure: {
      label: 'Utility A loss with generator start failure',
      patch: {
        sources: {
          'SRC-UTILITY-A': { state: 'unavailable' },
          'SRC-GENSET-POOL': { state: 'failed' }
        },
        ats: { 'ATS-A': { state: 'normal', selectedSource: 'generator' } }
      },
      timeline: [
        { offsetSeconds: 0, code: 'UTILITY_A_LOSS', message: 'Utility A unavailable' },
        { offsetSeconds: 1, code: 'GENSET_START_COMMAND', message: 'Generator start requested' },
        { offsetSeconds: 15, code: 'GENSET_FAIL_TO_RUN', message: 'Generator proof not received' }
      ]
    },
    rack_psu_a_loss: {
      label: 'Rack 01 PSU A input loss',
      patch: { racks: { 'RACK-01': { feedA: 'fault' } } },
      timeline: [
        { offsetSeconds: 0, code: 'RACK_01_PSU_A_LOSS', message: 'Rack 01 feed A input fails' },
        { offsetSeconds: 1, code: 'RACK_01_ON_B', message: 'Rack 01 remains available on feed B' }
      ]
    },
    transfer_failure: {
      label: 'ATS A transfer failure',
      patch: {
        sources: {
          'SRC-UTILITY-A': { state: 'unavailable' },
          'SRC-GENSET-POOL': { state: 'running' }
        },
        ats: { 'ATS-A': { state: 'transfer_failed', selectedSource: 'utility' } }
      },
      timeline: [
        { offsetSeconds: 0, code: 'UTILITY_A_LOSS', message: 'Utility A unavailable' },
        { offsetSeconds: 10, code: 'GENSET_RUNNING', message: 'Generator pool stable' },
        { offsetSeconds: 15, code: 'ATS_A_TRANSFER_FAIL', message: 'ATS A failed to transfer' }
      ]
    }
  });

  function ensureKnownKeys(actual, expected, label) {
    var keys = Object.keys(actual);
    var i;
    for (i = 0; i < keys.length; i += 1) {
      if (!Object.prototype.hasOwnProperty.call(expected, keys[i])) {
        throw new Error('Unknown ' + label + ': ' + keys[i]);
      }
    }
  }

  function ensureExactKeys(actual, expected, label) {
    var keys;
    var i;
    ensureKnownKeys(actual, expected, label);
    keys = Object.keys(expected);
    for (i = 0; i < keys.length; i += 1) {
      if (!Object.prototype.hasOwnProperty.call(actual, keys[i])) {
        throw new Error('Missing ' + label + ': ' + keys[i]);
      }
    }
  }

  function ensureObjectMap(value, label) {
    if (!value || typeof value !== 'object' ||
        Object.prototype.toString.call(value) === '[object Array]') {
      throw new Error(label + ' must be an object');
    }
  }

  function validateMapValues(actual, valid, label) {
    var keys = Object.keys(actual);
    var i;
    for (i = 0; i < keys.length; i += 1) {
      if (!valid[actual[keys[i]]]) {
        throw new Error('Invalid ' + label + ' state for ' + keys[i] + ': ' + actual[keys[i]]);
      }
    }
  }

  function validateState(state) {
    var sourceIds;
    var rackIds;
    var i;
    ensureObjectMap(state, 'state');
    ensureExactKeys(state, DEFAULT_STATE, 'state section');
    ensureObjectMap(state.sources, 'sources');
    ensureObjectMap(state.breakers, 'breakers');
    ensureObjectMap(state.ats, 'ats');
    ensureObjectMap(state.ups, 'ups');
    ensureObjectMap(state.busways, 'busways');
    ensureObjectMap(state.racks, 'racks');
    ensureExactKeys(state.sources, DEFAULT_STATE.sources, 'source');
    ensureExactKeys(state.breakers, DEFAULT_STATE.breakers, 'breaker');
    ensureExactKeys(state.ats, DEFAULT_STATE.ats, 'ATS');
    ensureExactKeys(state.ups, DEFAULT_STATE.ups, 'UPS');
    ensureExactKeys(state.busways, DEFAULT_STATE.busways, 'busway');
    ensureExactKeys(state.racks, DEFAULT_STATE.racks, 'rack');
    validateMapValues(state.breakers, VALID_BREAKER_STATES, 'breaker');
    validateMapValues(state.ups, VALID_UPS_STATES, 'UPS');
    validateMapValues(state.busways, VALID_BUSWAY_STATES, 'busway');

    sourceIds = Object.keys(state.sources);
    for (i = 0; i < sourceIds.length; i += 1) {
      ensureObjectMap(state.sources[sourceIds[i]], sourceIds[i]);
      ensureExactKeys(state.sources[sourceIds[i]], DEFAULT_STATE.sources[sourceIds[i]], sourceIds[i] + ' field');
      if (!VALID_SOURCE_STATES[state.sources[sourceIds[i]].state]) {
        throw new Error('Invalid source state for ' + sourceIds[i]);
      }
    }
    sourceIds = Object.keys(state.ats);
    for (i = 0; i < sourceIds.length; i += 1) {
      ensureObjectMap(state.ats[sourceIds[i]], sourceIds[i]);
      ensureExactKeys(state.ats[sourceIds[i]], DEFAULT_STATE.ats[sourceIds[i]], sourceIds[i] + ' field');
      if (!VALID_ATS_STATES[state.ats[sourceIds[i]].state]) {
        throw new Error('Invalid ATS state for ' + sourceIds[i]);
      }
      if (state.ats[sourceIds[i]].selectedSource !== 'utility' &&
          state.ats[sourceIds[i]].selectedSource !== 'generator') {
        throw new Error('Invalid ATS source for ' + sourceIds[i]);
      }
    }
    rackIds = Object.keys(state.racks);
    for (i = 0; i < rackIds.length; i += 1) {
      ensureObjectMap(state.racks[rackIds[i]], rackIds[i]);
      ensureExactKeys(state.racks[rackIds[i]], DEFAULT_STATE.racks[rackIds[i]], rackIds[i] + ' field');
      if (!VALID_RACK_FEED_STATES[state.racks[rackIds[i]].feedA] ||
          !VALID_RACK_FEED_STATES[state.racks[rackIds[i]].feedB]) {
        throw new Error('Invalid rack feed state for ' + rackIds[i]);
      }
    }
  }

  function createState(scenarioId, overrides) {
    var scenario = SCENARIOS[scenarioId];
    var state;
    if (!scenario) { throw new Error('Unknown electrical scenario: ' + scenarioId); }
    state = merge(DEFAULT_STATE, scenario.patch);
    state = merge(state, overrides || {});
    state.scenarioId = scenarioId;
    validateState(state);
    return deepFreeze(state);
  }

  function sourceIsActive(source) {
    return source.state === 'online' || source.state === 'running';
  }

  function edgeDeviceState(edge, state) {
    var breaker = state.breakers[edge.controller];
    var ats;
    var rack;
    var feedState;
    if (breaker === 'tripped') { return 'fault'; }
    if (breaker === 'maintenance' || breaker === 'racked_out' ||
        breaker === 'test' || breaker === 'disabled') { return 'maintenance'; }
    if (edge.selector) {
      ats = state.ats[edge.to];
      if (ats.state === 'transfer_failed') { return 'fault'; }
      if (ats.state === 'maintenance') { return 'maintenance'; }
    }
    if (edge.from.indexOf('UPS-') === 0 || edge.to.indexOf('UPS-') === 0) {
      if (state.ups['UPS-' + edge.feed] === 'fault') { return 'fault'; }
      if (state.ups['UPS-' + edge.feed] === 'maintenance') { return 'maintenance'; }
    }
    if (edge.from.indexOf('BUSWAY-') === 0 || edge.to.indexOf('BUSWAY-') === 0) {
      if (state.busways['BUSWAY-' + edge.feed] === 'tripped') { return 'fault'; }
      if (state.busways['BUSWAY-' + edge.feed] === 'maintenance') { return 'maintenance'; }
    }
    if (edge.rackFeed) {
      rack = state.racks[edge.to];
      feedState = rack[edge.rackFeed];
      if (feedState === 'fault') { return 'fault'; }
      if (feedState === 'maintenance') { return 'maintenance'; }
    }
    return 'normal';
  }

  function edgeIsConductive(edge, state) {
    var ats;
    var ups;
    var busway;
    var rack;
    if (state.breakers[edge.controller] !== 'closed') { return false; }
    if (edge.selector) {
      ats = state.ats[edge.to];
      if (ats.state !== 'normal' || ats.selectedSource !== edge.selector) { return false; }
    }
    if (edge.from.indexOf('UPS-') === 0 || edge.to.indexOf('UPS-') === 0) {
      ups = state.ups['UPS-' + edge.feed];
      if (ups !== 'online' && ups !== 'bypass') { return false; }
    }
    if (edge.from.indexOf('BUSWAY-') === 0 || edge.to.indexOf('BUSWAY-') === 0) {
      busway = state.busways['BUSWAY-' + edge.feed];
      if (busway !== 'normal') { return false; }
    }
    if (edge.rackFeed) {
      rack = state.racks[edge.to];
      if (rack[edge.rackFeed] !== 'online') { return false; }
    }
    return true;
  }

  function addUnique(target, values) {
    var changed = false;
    var i;
    for (i = 0; i < values.length; i += 1) {
      if (target.indexOf(values[i]) === -1) {
        target.push(values[i]);
        changed = true;
      }
    }
    target.sort();
    return changed;
  }

  function sourceReach(state) {
    var reach = {};
    var nodes = BASE_TOPOLOGY.nodes;
    var edges = BASE_TOPOLOGY.edges;
    var i;
    var changed = true;
    var iterations = 0;
    var fromSources;
    for (i = 0; i < nodes.length; i += 1) { reach[nodes[i].id] = []; }
    Object.keys(state.sources).forEach(function (id) {
      if (sourceIsActive(state.sources[id])) { reach[id] = [id]; }
    });
    while (changed && iterations <= nodes.length) {
      changed = false;
      iterations += 1;
      for (i = 0; i < edges.length; i += 1) {
        if (edgeIsConductive(edges[i], state)) {
          fromSources = reach[edges[i].from];
          if (fromSources.length && addUnique(reach[edges[i].to], fromSources)) { changed = true; }
        }
      }
    }
    return reach;
  }

  function downstreamLoads(state) {
    var reachesLoad = {};
    var nodes = BASE_TOPOLOGY.nodes;
    var edges = BASE_TOPOLOGY.edges;
    var i;
    var changed = true;
    var iterations = 0;
    for (i = 0; i < nodes.length; i += 1) {
      reachesLoad[nodes[i].id] = nodes[i].type === 'rack';
    }
    while (changed && iterations <= nodes.length) {
      changed = false;
      iterations += 1;
      for (i = edges.length - 1; i >= 0; i -= 1) {
        if (edgeIsConductive(edges[i], state) && reachesLoad[edges[i].to] &&
            !reachesLoad[edges[i].from]) {
          reachesLoad[edges[i].from] = true;
          changed = true;
        }
      }
    }
    return reachesLoad;
  }

  function semanticEdge(edge, state, reach, reachesLoad) {
    var deviceState = edgeDeviceState(edge, state);
    var conductive = edgeIsConductive(edge, state);
    var sourceIds = conductive ? reach[edge.from].slice() : [];
    var semanticState;
    var sourceState;
    if (deviceState === 'fault') {
      semanticState = 'fault';
    } else if (deviceState === 'maintenance') {
      semanticState = 'maintenance';
    } else if (sourceIds.length) {
      semanticState = 'energized';
    } else if (edge.redundancyRole === 'standby') {
      sourceState = state.sources[edge.from];
      semanticState = sourceState && sourceState.state === 'standby' ? 'standby' : 'de-energized';
    } else {
      semanticState = 'de-energized';
    }
    return {
      id: edge.id,
      from: edge.from,
      to: edge.to,
      feed: edge.feed,
      controller: edge.controller,
      redundancyRole: edge.redundancyRole,
      semanticState: semanticState,
      sourceIds: sourceIds,
      loaded: Boolean(reachesLoad[edge.to]),
      flowActive: semanticState === 'energized' && Boolean(reachesLoad[edge.to])
    };
  }

  function rackResults(state, edgeResults) {
    var byId = {};
    var result = {};
    var i;
    var id;
    var edgeA;
    var edgeB;
    var feedA;
    var feedB;
    var sourceDiversity;
    for (i = 0; i < edgeResults.length; i += 1) { byId[edgeResults[i].id] = edgeResults[i]; }
    for (i = 1; i <= RACK_COUNT; i += 1) {
      id = rackId(i);
      edgeA = byId['EDGE-RPP-A-' + id];
      edgeB = byId['EDGE-RPP-B-' + id];
      feedA = edgeA.semanticState === 'energized';
      feedB = edgeB.semanticState === 'energized';
      sourceDiversity = feedA && feedB &&
        edgeA.sourceIds.every(function (sourceId) {
          return edgeB.sourceIds.indexOf(sourceId) === -1;
        });
      result[id] = {
        id: id,
        loadKW: RACK_LOAD_KW,
        feedA: {
          available: feedA,
          semanticState: edgeA.semanticState,
          sourceIds: edgeA.sourceIds.slice()
        },
        feedB: {
          available: feedB,
          semanticState: edgeB.semanticState,
          sourceIds: edgeB.sourceIds.slice()
        },
        dualCordContinuity: feedA && feedB,
        sourceDiversity: sourceDiversity,
        serviceAvailable: feedA || feedB,
        redundancyState: feedA && feedB ?
          (sourceDiversity ? '2N' : 'COMMON_SOURCE') :
          (feedA || feedB ? 'DEGRADED' : 'LOST')
      };
    }
    return result;
  }

  function sourceToRack(racks) {
    var result = {
      'SRC-UTILITY-A': [],
      'SRC-UTILITY-B': [],
      'SRC-GENSET-POOL': []
    };
    Object.keys(racks).forEach(function (id) {
      ['A', 'B'].forEach(function (feed) {
        var feedResult = racks[id]['feed' + feed];
        feedResult.sourceIds.forEach(function (sourceId) {
          result[sourceId].push({ rackId: id, feed: feed });
        });
      });
    });
    return result;
  }

  function healthFor(state, racks) {
    var ids = Object.keys(racks);
    var i;
    for (i = 0; i < ids.length; i += 1) {
      if (!racks[ids[i]].serviceAvailable) { return 'CRITICAL'; }
    }
    for (i = 0; i < ids.length; i += 1) {
      if (racks[ids[i]].redundancyState !== '2N') { return 'DEGRADED'; }
    }
    if (state.ups['UPS-A'] === 'bypass' || state.ups['UPS-B'] === 'bypass' ||
        state.sources['SRC-UTILITY-A'].state !== 'online' ||
        state.sources['SRC-UTILITY-B'].state !== 'online') {
      return 'DEGRADED';
    }
    return 'NORMAL';
  }

  function evaluate(state) {
    var reach;
    var reachesLoad;
    var edges;
    var racks;
    var scenario;
    validateState(state);
    scenario = SCENARIOS[state.scenarioId];
    if (!scenario) { throw new Error('Unknown electrical scenario: ' + state.scenarioId); }
    reach = sourceReach(state);
    reachesLoad = downstreamLoads(state);
    edges = BASE_TOPOLOGY.edges.map(function (edge) {
      return semanticEdge(edge, state, reach, reachesLoad);
    });
    racks = rackResults(state, edges);
    return deepFreeze({
      scenarioId: state.scenarioId,
      scenarioLabel: scenario.label,
      state: clone(state),
      nodes: clone(BASE_TOPOLOGY.nodes),
      edges: edges,
      racks: racks,
      sourceReachability: sourceToRack(racks),
      timeline: clone(scenario.timeline),
      health: healthFor(state, racks)
    });
  }

  function evaluateScenario(scenarioId, overrides) {
    return evaluate(createState(scenarioId, overrides));
  }

  var API = deepFreeze({
    BASE_TOPOLOGY: BASE_TOPOLOGY,
    SCENARIOS: SCENARIOS,
    createState: createState,
    evaluate: evaluate,
    evaluateScenario: evaluateScenario,
    version: '1.0.0'
  });

  if (root) { root.RZDatahallAIElectrical = API; }
  if (typeof module !== 'undefined' && module.exports) { module.exports = API; }
}(typeof window !== 'undefined' ? window :
  (typeof globalThis !== 'undefined' ? globalThis : this)));
