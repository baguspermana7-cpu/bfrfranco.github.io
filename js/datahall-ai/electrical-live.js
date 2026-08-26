/* ============================================================================
 * datahall-ai/electrical-live.js
 * Engine-bound four-second electrical telemetry renderer.
 * Basis values and source status are deterministic; presentation jitter belongs
 * only to instrument-level values that do not change the engineering scenario.
 * ==========================================================================*/
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  if (root) { root.RZDatahallAIElectricalLive = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var INTERVAL_MS = 4000;
  var FALLBACK_HALL_COUNT = 4;
  var FALLBACK_GENERATOR_COUNT = 8;
  var MAX_RENDERED_EQUIPMENT = 64;
  var REQUIRED_NUMBERS = [
    'halls', 'itHall', 'itFacilityMW', 'pb_aux', 'pb_cooling',
    'pb_facility', 'facTotalMW', 'pue', 'reqCurrentA',
    'gensetFacN', 'gensetFacNplus1'
  ];

  function finiteNumber(value) {
    return typeof value === 'number' && isFinite(value);
  }

  function validateBasis(basis) {
    var i;
    if (!basis || typeof basis !== 'object') {
      throw new Error('Invalid electrical live basis: object required');
    }
    for (i = 0; i < REQUIRED_NUMBERS.length; i += 1) {
      if (!finiteNumber(basis[REQUIRED_NUMBERS[i]])) {
        throw new Error('Invalid electrical live basis: ' + REQUIRED_NUMBERS[i]);
      }
    }
    if (basis.halls < 1 || basis.gensetFacN < 1 ||
        basis.gensetFacN >= basis.gensetFacNplus1 ||
        Math.floor(basis.gensetFacN) !== basis.gensetFacN ||
        Math.floor(basis.gensetFacNplus1) !== basis.gensetFacNplus1) {
      throw new Error('Invalid electrical live basis: positive equipment counts required');
    }
  }

  function integerText(value) {
    return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function generatorDisplay(state) {
    if (state === 'running') { return 'RUNNING'; }
    if (state === 'failed' || state === 'unavailable') { return 'FAILED'; }
    return 'STANDBY';
  }

  function generatorStates(sourceState, runningCount, installedCount) {
    var states = [];
    var i;
    for (i = 0; i < installedCount; i += 1) {
      states.push(sourceState === 'running' && i >= runningCount ?
        'STANDBY' : generatorDisplay(sourceState));
    }
    return Object.freeze ? Object.freeze(states) : states;
  }

  function generatorHeading(states) {
    var runningCount = 0;
    var standbyCount = 0;
    var failedCount = 0;
    var failedText;
    var i;
    for (i = 0; i < states.length; i += 1) {
      if (states[i] === 'RUNNING') { runningCount += 1; }
      if (states[i] === 'STANDBY') { standbyCount += 1; }
      if (states[i] === 'FAILED') { failedCount += 1; }
    }
    failedText = failedCount ? ' / ' + failedCount + ' FAILED' : '';
    return {
      runningCount: runningCount,
      standbyCount: standbyCount,
      failedCount: failedCount,
      text: 'GENERATOR POOL STATUS (' + runningCount + ' RUN / ' +
        standbyCount + ' STANDBY' + failedText + ')'
    };
  }

  function snapshot(basis, electricalApi, scenarioId) {
    var result;
    var source;
    var states;
    var heading;
    var value;
    validateBasis(basis);
    if (!electricalApi || typeof electricalApi.evaluateScenario !== 'function') {
      throw new Error('Electrical semantic engine unavailable');
    }
    result = electricalApi.evaluateScenario(scenarioId || 'normal');
    source = result.state.sources['SRC-GENSET-POOL'];
    states = generatorStates(source.state, basis.gensetFacN, basis.gensetFacNplus1);
    heading = generatorHeading(states);
    value = {
      scenarioId: result.scenarioId,
      itPerHallKW: basis.itHall,
      facilityPerHallKW: basis.pb_facility,
      auxiliaryPerHallKW: basis.pb_aux,
      coolingPerHallKW: basis.pb_cooling,
      itFacilityMW: basis.itFacilityMW,
      facilityMW: basis.facTotalMW,
      pue: basis.pue,
      halls: basis.halls,
      requiredCurrentA: basis.reqCurrentA,
      generatorCount: basis.gensetFacNplus1,
      generatorState: generatorDisplay(source.state),
      generatorStates: states,
      generatorRunningCount: heading.runningCount,
      generatorStandbyCount: heading.standbyCount,
      generatorFailedCount: heading.failedCount,
      generatorHeading: heading.text
    };
    return Object.freeze ? Object.freeze(value) : value;
  }

  function setText(document, id, value) {
    var element = document.getElementById(id);
    if (element) { element.textContent = value; }
  }

  function renderHall(document, value, hall) {
    setText(document, 'eOvIT' + hall, integerText(value.itPerHallKW) + ' kW');
    setText(document, 'eDH' + hall + 'Live',
      'IT: ' + integerText(value.itPerHallKW) + ' kW | Facility: ' +
      integerText(value.facilityPerHallKW) + ' kW | PUE: ' + value.pue.toFixed(2));
    setText(document, 'eNC' + hall, integerText(value.auxiliaryPerHallKW) + ' kW');
    setText(document, 'eCool' + hall, integerText(value.coolingPerHallKW) + ' kW');
  }

  function render(document, value) {
    var i;
    for (i = 1; i <= value.halls; i += 1) { renderHall(document, value, i); }
    for (i = 1; i <= value.generatorCount; i += 1) {
      setText(document, 'eOvGen' + i, value.generatorStates[i - 1]);
    }
    setText(document, 'eOvGenPoolTitle', value.generatorHeading);
    setText(document, 'eOvNC', integerText(value.auxiliaryPerHallKW * value.halls) + ' kW facility');
    setText(document, 'eOvCool', integerText(value.coolingPerHallKW * value.halls) + ' kW facility');
    setText(document, 'eLive',
      'IT: ' + value.itFacilityMW.toFixed(2) + ' MW | Facility: ' +
      value.facilityMW.toFixed(2) + ' MW | PUE: ' + value.pue.toFixed(2) +
      ' | ' + value.halls + ' DH Online');
    return value;
  }

  function scenarioFrom(document) {
    var selector = document.getElementById('electricalScenario');
    return selector && selector.value ? selector.value : 'normal';
  }

  function renderCount(value, fallback) {
    return finiteNumber(value) && value > 0 && value <= MAX_RENDERED_EQUIPMENT &&
      Math.floor(value) === value ? value : fallback;
  }

  function invalidateHall(document, hall) {
    setText(document, 'eOvIT' + hall, 'UNAVAILABLE');
    setText(document, 'eDH' + hall + 'Live', 'UNAVAILABLE');
    setText(document, 'eNC' + hall, 'UNAVAILABLE');
    setText(document, 'eCool' + hall, 'UNAVAILABLE');
  }

  function renderFailure(document, lastValue, basis) {
    var source = lastValue || basis || {};
    var hallCount = renderCount(source.halls, FALLBACK_HALL_COUNT);
    var generatorCount = renderCount(
      source.generatorCount || source.gensetFacNplus1,
      FALLBACK_GENERATOR_COUNT
    );
    var i;
    for (i = 1; i <= hallCount; i += 1) { invalidateHall(document, i); }
    for (i = 1; i <= generatorCount; i += 1) {
      setText(document, 'eOvGen' + i, 'UNAVAILABLE');
    }
    setText(document, 'eOvNC', 'UNAVAILABLE');
    setText(document, 'eOvCool', 'UNAVAILABLE');
    setText(document, 'eOvGenPoolTitle', 'GENERATOR POOL STATUS (UNAVAILABLE)');
    setText(document, 'eLive', 'Electrical telemetry unavailable — values invalidated');
  }

  function start(options) {
    var config = options || {};
    var interval = config.setIntervalFn || (typeof setInterval === 'function' ? setInterval : null);
    var lastValue = null;
    var tick;
    if (!config.document || !interval) {
      throw new Error('Electrical live updater requires a document and interval scheduler');
    }
    tick = function () {
      try {
        lastValue = snapshot(
          config.basis,
          config.electricalApi,
          scenarioFrom(config.document)
        );
        render(config.document, lastValue);
      } catch (error) {
        renderFailure(config.document, lastValue, config.basis);
      }
    };
    tick();
    return interval(tick, config.intervalMs || INTERVAL_MS);
  }

  return Object.freeze({
    INTERVAL_MS: INTERVAL_MS,
    snapshot: snapshot,
    render: render,
    start: start
  });
}));
