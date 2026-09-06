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
  /* The SLD overview draws a BANK of generator glyphs, not one glyph per machine: at the
     GB300 basis the pool is 171 x 4 MW, and 171 ids would silently exceed
     MAX_RENDERED_EQUIPMENT and truncate. `generatorCount` is the real machine count and
     stays whole; `generatorGlyphCount` is only how many glyphs the drawing owns. */
  var FALLBACK_GENERATOR_GLYPHS = 8;
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
    if (basis.gensetGlyphCount !== undefined && !validGlyphCount(basis.gensetGlyphCount)) {
      throw new Error('Invalid electrical live basis: gensetGlyphCount');
    }
  }

  function validGlyphCount(value) {
    return finiteNumber(value) && value > 0 && value <= MAX_RENDERED_EQUIPMENT &&
      Math.floor(value) === value;
  }

  function glyphCountFor(basis) {
    return basis && validGlyphCount(basis.gensetGlyphCount) ?
      basis.gensetGlyphCount : FALLBACK_GENERATOR_GLYPHS;
  }

  /* Each drawn glyph stands for a BANK of machines. The bank reports the worst state it
     contains: any failed machine makes the bank FAILED, any running machine makes it
     RUNNING, and only an all-standby bank reads STANDBY. The headline counts still come
     from the full machine list, so the chip never disagrees with the pool. */
  function generatorGlyphStates(states, glyphCount) {
    var perGlyph = Math.ceil(states.length / glyphCount);
    var glyphs = [];
    var i;
    var j;
    var slice;
    for (i = 0; i < glyphCount; i += 1) {
      slice = states.slice(i * perGlyph, (i + 1) * perGlyph);
      if (!slice.length) { glyphs.push(states[states.length - 1]); continue; }
      glyphs.push('STANDBY');
      for (j = 0; j < slice.length; j += 1) {
        if (slice[j] === 'FAILED') { glyphs[i] = 'FAILED'; break; }
        if (slice[j] === 'RUNNING') { glyphs[i] = 'RUNNING'; }
      }
    }
    return Object.freeze ? Object.freeze(glyphs) : glyphs;
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
    var glyphCount;
    var value;
    validateBasis(basis);
    if (!electricalApi || typeof electricalApi.evaluateScenario !== 'function') {
      throw new Error('Electrical semantic engine unavailable');
    }
    result = electricalApi.evaluateScenario(scenarioId || 'normal');
    source = result.state.sources['SRC-GENSET-POOL'];
    states = generatorStates(source.state, basis.gensetFacN, basis.gensetFacNplus1);
    heading = generatorHeading(states);
    glyphCount = glyphCountFor(basis);
    value = {
      scenarioId: result.scenarioId,
      itPerHallKW: basis.itHall,
      facilityPerHallKW: basis.pb_facility,
      auxiliaryPerHallKW: basis.pb_aux,
      coolingPerHallKW: basis.pb_cooling,
      /* facility terms come from the engine when the basis publishes them (pbF_*); a rounded
         per-hall slice multiplied back up is off by the rounding and fails the traceability gate */
      auxiliaryFacilityKW: finiteNumber(basis.pbF_aux) ? basis.pbF_aux : basis.pb_aux * basis.halls,
      coolingFacilityKW: finiteNumber(basis.pbF_cooling) ? basis.pbF_cooling : basis.pb_cooling * basis.halls,
      itFacilityMW: basis.itFacilityMW,
      facilityMW: basis.facTotalMW,
      pue: basis.pue,
      halls: basis.halls,
      requiredCurrentA: basis.reqCurrentA,
      generatorCount: basis.gensetFacNplus1,
      generatorDutyCount: basis.gensetFacN,
      generatorGlyphCount: glyphCount,
      generatorState: generatorDisplay(source.state),
      generatorStates: states,
      generatorGlyphStates: generatorGlyphStates(states, glyphCount),
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
    for (i = 1; i <= value.generatorGlyphCount; i += 1) {
      setText(document, 'eOvGen' + i, value.generatorGlyphStates[i - 1]);
    }
    setText(document, 'eOvGenPoolTitle', value.generatorHeading);
    setText(document, 'eOvNC', integerText(value.auxiliaryFacilityKW) + ' kW facility');
    setText(document, 'eOvCool', integerText(value.coolingFacilityKW) + ' kW facility');
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
    return validGlyphCount(value) ? value : fallback;
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
    /* invalidate the GLYPHS the drawing owns — the machine count is not a glyph count */
    var glyphCount = renderCount(
      source.generatorGlyphCount || source.gensetGlyphCount,
      FALLBACK_GENERATOR_GLYPHS
    );
    var i;
    for (i = 1; i <= hallCount; i += 1) { invalidateHall(document, i); }
    for (i = 1; i <= glyphCount; i += 1) {
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
