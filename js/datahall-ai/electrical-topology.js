/* ============================================================================
 * datahall-ai/electrical-topology.js
 * Pure state engine for the DC AI 2N electrical topology.
 *
 * ES5-compatible, zero-build, and UI-agnostic. Visual classes and colours never
 * determine electrical truth; renderers consume semanticState/sourceIds and may
 * animate only when flowActive is true.
 *
 * v2.0.0 — AGGREGATED TO THE GB300 BASIS (880 racks per hall).
 * ---------------------------------------------------------------------------
 * The 54-rack version modelled one node and two edges per rack. At 880 racks
 * that is 1,760 rack edges nobody can read and nobody can draw. The physical
 * grouping the engine publishes is used instead: a hall is 10 rows x 88 racks,
 * and the LV grouping unit is a quarter row of 22 racks (3.12 MW ~ 4.7 kA at
 * 400 V / PF 0.96, which the declared 5,000 A busway trunk carries). So the
 * topology carries 40 RPP groups per feed and 40 rack_group loads, and a rack
 * fault is an integer COUNT inside its group rather than a node of its own.
 *
 * NO COUNT IS TYPED HERE. Every number comes from DCAI_CALC.snapshot (the same
 * authority the cockpit binds to); if the snapshot is missing the module fails
 * closed and never registers, so a renderer gets nothing rather than a stale
 * constant that looks plausible.
 * ==========================================================================*/
(function (root) {
  'use strict';

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

  /* ------------------------------------------------------------------------
   * BASIS — every count is read from the engine snapshot, none is typed
   * ----------------------------------------------------------------------*/
  function resolveBasis(injected) {
    if (injected) { return injected; }
    if (root && root.DCAI_CALC && root.DCAI_CALC.snapshot) { return root.DCAI_CALC.snapshot; }
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
      try { return require('../dcai-engine.js').snapshot; } catch (e) { /* fall through */ }
    }
    throw new Error('DCAI_CALC.snapshot not available — electrical topology fails closed');
  }

  function readNumber(snapshot, path) {
    var parts = path.split('.');
    var node = snapshot;
    var i;
    for (i = 0; i < parts.length; i += 1) {
      if (!node || typeof node !== 'object') { node = null; break; }
      node = node[parts[i]];
    }
    if (typeof node !== 'number' || !isFinite(node)) {
      throw new Error('Electrical basis missing a finite ' + path);
    }
    return node;
  }

  function readPositiveInteger(snapshot, path) {
    var value = readNumber(snapshot, path);
    if (value <= 0 || Math.floor(value) !== value) {
      throw new Error('Electrical basis expects a positive integer ' + path + ': ' + value);
    }
    return value;
  }

  function readBasis(snapshot) {
    var racksPerHall = readPositiveInteger(snapshot, 'compute.racks_per_hall');
    var groupCount = readPositiveInteger(snapshot, 'geometry.rack_groups_per_hall');
    var racksPerGroup = readPositiveInteger(snapshot, 'geometry.racks_per_group');
    var groupsPerRow = readPositiveInteger(snapshot, 'geometry.rack_groups_per_row');
    var basis;
    if (groupCount * racksPerGroup !== racksPerHall) {
      throw new Error('Electrical basis is not integer: ' + groupCount + ' groups x ' +
        racksPerGroup + ' racks != ' + racksPerHall + ' racks per hall');
    }
    basis = {
      halls: readPositiveInteger(snapshot, 'compute.racks_facility') / racksPerHall,
      racksPerHall: racksPerHall,
      racksPerGroup: racksPerGroup,
      groupCount: groupCount,
      groupsPerRow: groupsPerRow,
      rowCount: readPositiveInteger(snapshot, 'geometry.rack_rows'),
      racksPerRow: readPositiveInteger(snapshot, 'geometry.racks_per_row'),
      rackLoadKW: readNumber(snapshot, 'power.rack_it_kw'),
      groupKW: readNumber(snapshot, 'distribution.group_kw'),
      groupCurrentA: readNumber(snapshot, 'distribution.group_current_a'),
      rackFeedCurrentA: readNumber(snapshot, 'distribution.rack_feed_current_a'),
      buswayTrunkA: readNumber(snapshot, 'distribution.busway_trunk_a'),
      buswayLoadingPct: readNumber(snapshot, 'distribution.busway_loading_pct'),
      rppPerHall: readPositiveInteger(snapshot, 'distribution.rpp_per_hall'),
      transformerCount: readPositiveInteger(snapshot, 'equipment.transformers_per_hall_per_feed'),
      transformerUnitMva: readNumber(snapshot, 'equipment.transformer_unit_mva'),
      upsFrameCount: readPositiveInteger(snapshot, 'equipment.ups_frames_per_hall_per_feed'),
      upsFrameKw: readNumber(snapshot, 'equipment.ups_frame_kw'),
      upsLoadingPct: readNumber(snapshot, 'equipment.ups_loading_pct'),
      gensetsInstalled: readPositiveInteger(snapshot, 'equipment.gensets_installed'),
      gensetsDuty: readPositiveInteger(snapshot, 'equipment.gensets_duty'),
      gensetUnitKw: readNumber(snapshot, 'equipment.generator_unit_kw'),
      gensetsFacilityShared: snapshot.equipment.gensets_facility_shared === true
    };
    return deepFreeze(basis);
  }

  /* ------------------------------------------------------------------------
   * ID FORMATS — physical rack ids are 4-digit at this basis (880 per hall)
   * ----------------------------------------------------------------------*/
  function pad(value, width) {
    var text = String(value);
    while (text.length < width) { text = '0' + text; }
    return text;
  }

  function rackId(index) { return 'RACK-' + pad(index, 4); }
  function groupId(index) { return 'RG-' + pad(index, 2); }
  function rppId(feed, index) { return 'RPP-' + feed + '-' + pad(index, 2); }

  function rackRangeFor(index, racksPerGroup) {
    var first = ((index - 1) * racksPerGroup) + 1;
    return rackId(first) + '..' + rackId(first + racksPerGroup - 1);
  }

  function createApi(snapshot) {
    var BASIS = readBasis(snapshot);

    function addTopologyEdge(edges, id, from, to, feed, controller, role, selector, rackFeed) {
      var item = {
        id: id,
        from: from,
        to: to,
        feed: feed,
        controller: controller,
        redundancyRole: role
      };
      if (selector) { item.selector = selector; }
      if (rackFeed) { item.rackFeed = rackFeed; }
      edges.push(item);
    }

    function addFeedNodes(nodes, feed, suffix) {
      var i;
      nodes.push({ id: 'MV-BUS' + suffix, type: 'mv_bus', feed: feed });
      nodes.push({ id: 'RMU' + suffix, type: 'ring_main_unit', feed: feed });
      nodes.push({
        id: 'TX' + suffix, type: 'transformer', feed: feed,
        unitCount: BASIS.transformerCount, unitMva: BASIS.transformerUnitMva
      });
      nodes.push({ id: 'ATS' + suffix, type: 'ats', feed: feed });
      nodes.push({ id: 'MSB' + suffix, type: 'main_switchboard', feed: feed });
      nodes.push({
        id: 'UPS' + suffix, type: 'ups', feed: feed,
        frameCount: BASIS.upsFrameCount, frameKw: BASIS.upsFrameKw, loadingPct: BASIS.upsLoadingPct
      });
      nodes.push({
        id: 'BUSWAY' + suffix, type: 'busway', feed: feed,
        trunkA: BASIS.buswayTrunkA, groupCount: BASIS.groupCount, loadingPct: BASIS.buswayLoadingPct
      });
      for (i = 1; i <= BASIS.groupCount; i += 1) {
        nodes.push({
          id: rppId(feed, i), type: 'rpp', feed: feed,
          group: i, groupId: groupId(i), groupCurrentA: BASIS.groupCurrentA
        });
      }
    }

    function addFeedEdges(edges, feed, suffix) {
      var role = feed === 'A' ? 'redundant_a' : 'redundant_b';
      var rackFeed = 'feed' + feed;
      var i;
      addTopologyEdge(edges, 'EDGE-UTILITY' + suffix + '-MV-BUS' + suffix, 'SRC-UTILITY' + suffix, 'MV-BUS' + suffix, feed, 'BR-UTILITY' + suffix, role);
      addTopologyEdge(edges, 'EDGE-MV-BUS' + suffix + '-RMU' + suffix, 'MV-BUS' + suffix, 'RMU' + suffix, feed, 'BR-RMU' + suffix, role);
      addTopologyEdge(edges, 'EDGE-RMU' + suffix + '-TX' + suffix, 'RMU' + suffix, 'TX' + suffix, feed, 'BR-TX' + suffix, role);
      addTopologyEdge(edges, 'EDGE-TX' + suffix + '-ATS' + suffix, 'TX' + suffix, 'ATS' + suffix, feed, 'BR-ATS-NORMAL' + suffix, role, 'utility');
      addTopologyEdge(edges, 'EDGE-GEN-BUS-ATS' + suffix, 'GEN-BUS', 'ATS' + suffix, feed, 'BR-GEN' + suffix, 'standby', 'generator');
      addTopologyEdge(edges, 'EDGE-ATS' + suffix + '-MSB' + suffix, 'ATS' + suffix, 'MSB' + suffix, feed, 'BR-MSB' + suffix, role);
      addTopologyEdge(edges, 'EDGE-MSB' + suffix + '-UPS' + suffix, 'MSB' + suffix, 'UPS' + suffix, feed, 'BR-UPS' + suffix, role);
      addTopologyEdge(edges, 'EDGE-UPS' + suffix + '-BUSWAY' + suffix, 'UPS' + suffix, 'BUSWAY' + suffix, feed, 'BR-BUSWAY' + suffix, role);
      for (i = 1; i <= BASIS.groupCount; i += 1) {
        addTopologyEdge(
          edges,
          'EDGE-BUSWAY' + suffix + '-' + rppId(feed, i),
          'BUSWAY' + suffix, rppId(feed, i), feed,
          'BR-' + rppId(feed, i), role
        );
        addTopologyEdge(
          edges,
          'EDGE-' + rppId(feed, i) + '-' + groupId(i),
          rppId(feed, i), groupId(i), feed,
          'BR-' + groupId(i) + '-' + feed, role, null, rackFeed
        );
      }
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
        {
          id: 'SRC-GENSET-POOL', type: 'source', sourceType: 'generator', feed: 'common',
          installed: BASIS.gensetsInstalled, duty: BASIS.gensetsDuty,
          unitKw: BASIS.gensetUnitKw, facilityShared: BASIS.gensetsFacilityShared
        },
        { id: 'GEN-BUS', type: 'generator_bus', feed: 'common' }
      ];
      var edges = [];
      var i;

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
      for (i = 1; i <= BASIS.groupCount; i += 1) {
        nodes.push({
          id: groupId(i),
          type: 'rack_group',
          rackCount: BASIS.racksPerGroup,
          rackLoadKW: BASIS.rackLoadKW,
          loadKW: BASIS.groupKW,
          groupCurrentA: BASIS.groupCurrentA,
          rackFeedCurrentA: BASIS.rackFeedCurrentA,
          rackIdRange: rackRangeFor(i, BASIS.racksPerGroup),
          dualCorded: true,
          row: Math.ceil(i / BASIS.groupsPerRow),
          positionInRow: ((i - 1) % BASIS.groupsPerRow) + 1
        });
      }
      return deepFreeze({ nodes: nodes, edges: edges });
    }

    var BASE_TOPOLOGY = buildTopology();

    function buildDefaultState() {
      var breakers = {};
      var racks = {};
      var i;
      for (i = 0; i < BASE_TOPOLOGY.edges.length; i += 1) {
        breakers[BASE_TOPOLOGY.edges[i].controller] = 'closed';
      }
      for (i = 1; i <= BASIS.groupCount; i += 1) {
        racks[groupId(i)] = {
          feedA: 'online', feedB: 'online', faultedRacksA: 0, faultedRacksB: 0
        };
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

    /* the single-rack PSU scenario names the FIRST physical rack of the first group */
    var FIRST_GROUP = groupId(1);
    var FIRST_RACK = rackId(1);
    var FIRST_RACK_LABEL = 'Rack ' + pad(1, 4);
    var FIRST_RACK_PATCH = {};
    FIRST_RACK_PATCH[FIRST_GROUP] = { faultedRacksA: 1 };

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
        label: FIRST_RACK_LABEL + ' PSU A input loss',
        patch: { racks: FIRST_RACK_PATCH },
        timeline: [
          {
            offsetSeconds: 0, code: 'RACK_0001_PSU_A_LOSS',
            message: FIRST_RACK_LABEL + ' feed A input fails (1 of ' + BASIS.racksPerGroup +
              ' racks in ' + FIRST_GROUP + ')'
          },
          {
            offsetSeconds: 1, code: 'RACK_0001_ON_B',
            message: FIRST_RACK_LABEL + ' remains available on feed B'
          }
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

    function validateFaultedCount(value, id, field) {
      if (typeof value !== 'number' || !isFinite(value) ||
          Math.floor(value) !== value || value < 0 || value > BASIS.racksPerGroup) {
        throw new Error('Invalid ' + field + ' for ' + id + ': ' + value);
      }
    }

    function validateState(state) {
      var ids;
      var group;
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
      ensureExactKeys(state.racks, DEFAULT_STATE.racks, 'rack group');
      validateMapValues(state.breakers, VALID_BREAKER_STATES, 'breaker');
      validateMapValues(state.ups, VALID_UPS_STATES, 'UPS');
      validateMapValues(state.busways, VALID_BUSWAY_STATES, 'busway');

      ids = Object.keys(state.sources);
      for (i = 0; i < ids.length; i += 1) {
        ensureObjectMap(state.sources[ids[i]], ids[i]);
        ensureExactKeys(state.sources[ids[i]], DEFAULT_STATE.sources[ids[i]], ids[i] + ' field');
        if (!VALID_SOURCE_STATES[state.sources[ids[i]].state]) {
          throw new Error('Invalid source state for ' + ids[i]);
        }
      }
      ids = Object.keys(state.ats);
      for (i = 0; i < ids.length; i += 1) {
        ensureObjectMap(state.ats[ids[i]], ids[i]);
        ensureExactKeys(state.ats[ids[i]], DEFAULT_STATE.ats[ids[i]], ids[i] + ' field');
        if (!VALID_ATS_STATES[state.ats[ids[i]].state]) {
          throw new Error('Invalid ATS state for ' + ids[i]);
        }
        if (state.ats[ids[i]].selectedSource !== 'utility' &&
            state.ats[ids[i]].selectedSource !== 'generator') {
          throw new Error('Invalid ATS source for ' + ids[i]);
        }
      }
      ids = Object.keys(state.racks);
      for (i = 0; i < ids.length; i += 1) {
        group = state.racks[ids[i]];
        ensureObjectMap(group, ids[i]);
        ensureExactKeys(group, DEFAULT_STATE.racks[ids[i]], ids[i] + ' field');
        if (!VALID_RACK_FEED_STATES[group.feedA] || !VALID_RACK_FEED_STATES[group.feedB]) {
          throw new Error('Invalid rack feed state for ' + ids[i]);
        }
        validateFaultedCount(group.faultedRacksA, ids[i], 'faultedRacksA');
        validateFaultedCount(group.faultedRacksB, ids[i], 'faultedRacksB');
        if (group.faultedRacksA + group.faultedRacksB > BASIS.racksPerGroup) {
          throw new Error('Invalid faulted rack total for ' + ids[i] + ': more faults than racks');
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
      var group;
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
        group = state.racks[edge.to];
        feedState = group[edge.rackFeed];
        if (feedState === 'fault') { return 'fault'; }
        if (feedState === 'maintenance') { return 'maintenance'; }
      }
      return 'normal';
    }

    function edgeIsConductive(edge, state) {
      var ats;
      var ups;
      var busway;
      var group;
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
        group = state.racks[edge.to];
        if (group[edge.rackFeed] !== 'online') { return false; }
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
        reachesLoad[nodes[i].id] = nodes[i].type === 'rack_group';
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
      var group;
      var result;
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
      result = {
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
      if (edge.rackFeed) {
        group = state.racks[edge.to];
        result.rackFeed = edge.rackFeed;
        result.faultedRacks = edge.rackFeed === 'feedA' ? group.faultedRacksA : group.faultedRacksB;
        result.servedRacks = BASIS.racksPerGroup - result.faultedRacks;
      }
      return result;
    }

    /* Per-group rack accounting. Faults are integer counts inside a group, and a rack
       faulted on A is a DIFFERENT rack from one faulted on B (validated: the two counts
       cannot exceed the group). Every rack in the group lands in exactly one bucket. */
    function groupCounts(feedA, feedB, diversity, faultedA, faultedB) {
      var n = BASIS.racksPerGroup;
      if (feedA && feedB) {
        return {
          available: n,
          twoN: diversity ? n - faultedA - faultedB : 0,
          commonSource: diversity ? 0 : n - faultedA - faultedB,
          degraded: faultedA + faultedB,
          lost: 0
        };
      }
      if (feedA) {
        return { available: n - faultedA, twoN: 0, commonSource: 0, degraded: n - faultedA, lost: faultedA };
      }
      if (feedB) {
        return { available: n - faultedB, twoN: 0, commonSource: 0, degraded: n - faultedB, lost: faultedB };
      }
      return { available: 0, twoN: 0, commonSource: 0, degraded: 0, lost: n };
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
      var counts;
      var sourceDiversity;
      var group;
      for (i = 0; i < edgeResults.length; i += 1) { byId[edgeResults[i].id] = edgeResults[i]; }
      for (i = 1; i <= BASIS.groupCount; i += 1) {
        id = groupId(i);
        group = state.racks[id];
        edgeA = byId['EDGE-' + rppId('A', i) + '-' + id];
        edgeB = byId['EDGE-' + rppId('B', i) + '-' + id];
        feedA = edgeA.semanticState === 'energized';
        feedB = edgeB.semanticState === 'energized';
        sourceDiversity = feedA && feedB &&
          edgeA.sourceIds.every(function (sourceId) {
            return edgeB.sourceIds.indexOf(sourceId) === -1;
          });
        counts = groupCounts(feedA, feedB, sourceDiversity, group.faultedRacksA, group.faultedRacksB);
        result[id] = {
          id: id,
          rackCount: BASIS.racksPerGroup,
          rackLoadKW: BASIS.rackLoadKW,
          loadKW: BASIS.groupKW,
          rackIdRange: rackRangeFor(i, BASIS.racksPerGroup),
          faultedRacksA: group.faultedRacksA,
          faultedRacksB: group.faultedRacksB,
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
            (feedA || feedB ? 'DEGRADED' : 'LOST'),
          servedRackCount: counts.available,
          twoNCount: counts.twoN,
          commonSourceCount: counts.commonSource,
          degradedCount: counts.degraded,
          lostCount: counts.lost
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
            result[sourceId].push({ groupId: id, rackCount: racks[id].rackCount, feed: feed });
          });
        });
      });
      return result;
    }

    function healthFor(state, racks) {
      var ids = Object.keys(racks);
      var i;
      for (i = 0; i < ids.length; i += 1) {
        if (!racks[ids[i]].serviceAvailable || racks[ids[i]].lostCount > 0) { return 'CRITICAL'; }
      }
      for (i = 0; i < ids.length; i += 1) {
        if (racks[ids[i]].redundancyState !== '2N') { return 'DEGRADED'; }
        /* a single rack cord inside an otherwise 2N group is still a lost redundancy */
        if (racks[ids[i]].faultedRacksA > 0 || racks[ids[i]].faultedRacksB > 0) { return 'DEGRADED'; }
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

    return deepFreeze({
      BASIS: BASIS,
      BASE_TOPOLOGY: BASE_TOPOLOGY,
      SCENARIOS: SCENARIOS,
      createState: createState,
      evaluate: evaluate,
      evaluateScenario: evaluateScenario,
      rackId: rackId,
      groupId: groupId,
      rppId: rppId,
      build: build,
      version: '2.0.0'
    });
  }

  function build(snapshot) {
    return createApi(snapshot || resolveBasis(null));
  }

  /* If the engine authority is not loaded the module registers a STUB whose every entry
     point throws the basis error. It does not throw at parse time: an uncaught module
     error is a page error, and the cockpit already fails closed on missing authority —
     the renderers must get "unavailable", not a stale topology and not a broken page. */
  function unavailableApi(reason) {
    function fail() { throw new Error(reason); }
    return deepFreeze({
      unavailable: true,
      basisError: reason,
      BASIS: null,
      BASE_TOPOLOGY: { nodes: [], edges: [] },
      SCENARIOS: {},
      createState: fail,
      evaluate: fail,
      evaluateScenario: fail,
      rackId: rackId,
      groupId: groupId,
      rppId: rppId,
      build: build,
      version: '2.0.0'
    });
  }

  var API;
  try {
    API = createApi(resolveBasis(null));
  } catch (basisError) {
    API = unavailableApi(basisError && basisError.message ? basisError.message :
      'DCAI_CALC.snapshot not available — electrical topology fails closed');
  }

  if (root) { root.RZDatahallAIElectrical = API; }
  if (typeof module !== 'undefined' && module.exports) { module.exports = API; }
}(typeof window !== 'undefined' ? window :
  (typeof globalThis !== 'undefined' ? globalThis : this)));
