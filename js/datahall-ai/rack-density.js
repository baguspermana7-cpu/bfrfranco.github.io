/* ============================================================================
 * rack-density.js — DC AI rack-density reconciliation and reference studies
 * ----------------------------------------------------------------------------
 * Scenario A remains the locked operating basis. Named architecture references
 * can be studied, but this pure module never promotes a study into the BoD.
 * Zero-build, ES5-compatible, deterministic, and side-effect free.
 * ==========================================================================*/
(function (root) {
  'use strict';

  var REQUIRED_NUMERIC = [
    'halls', 'logicalDomainKW', 'rackPositionsPerDomain',
    'logicalDomainsPerHall', 'hallAreaM2'
  ];
  var INTEGER_FIELDS = {
    halls: true, rackPositionsPerDomain: true, logicalDomainsPerHall: true
  };
  var CLAIM_FIELDS = [
    'claimedRackPositionKW', 'claimedRackPositionsPerHall',
    'claimedItPerHallKW', 'claimedHallItDensityKWPerM2', 'claimedItPerFacilityKW'
  ];
  var MAX_SAFE_INTEGER = 9007199254740991;

  function isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function finitePositive(value) {
    return typeof value === 'number' && isFinite(value) && value > 0;
  }

  function safePositiveInteger(value) {
    return finitePositive(value) && Math.floor(value) === value && value <= MAX_SAFE_INTEGER;
  }

  function copy(value) {
    var result;
    var keys;
    var i;
    if (Array.isArray(value)) {
      result = [];
      for (i = 0; i < value.length; i++) { result.push(copy(value[i])); }
      return result;
    }
    if (isObject(value)) {
      result = {};
      keys = Object.keys(value);
      for (i = 0; i < keys.length; i++) { result[keys[i]] = copy(value[keys[i]]); }
      return result;
    }
    return value;
  }

  function deepFreeze(value) {
    var keys;
    var i;
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) { return value; }
    keys = Object.keys(value);
    for (i = 0; i < keys.length; i++) { deepFreeze(value[keys[i]]); }
    return Object.freeze(value);
  }

  function immutableCopy(value) { return deepFreeze(copy(value)); }

  function validationError(field, code, message) {
    return { field: field, code: code, message: message };
  }

  function validateInput(input) {
    var errors = [];
    var i;
    var field;
    if (!isObject(input)) {
      return immutableCopy({ valid: false, errors: [validationError('$', 'INPUT_TYPE', 'Input must be an object')] });
    }
    if (typeof input.architectureId !== 'string' || input.architectureId.length === 0) {
      errors.push(validationError('architectureId', 'ID_VALUE', 'architectureId must be a non-empty string'));
    }
    for (i = 0; i < REQUIRED_NUMERIC.length; i++) {
      field = REQUIRED_NUMERIC[i];
      if (!finitePositive(input[field])) {
        errors.push(validationError(field, 'POSITIVE_NUMBER', field + ' must be a finite positive number'));
      } else if (INTEGER_FIELDS[field] && !safePositiveInteger(input[field])) {
        errors.push(validationError(field, 'INTEGER_VALUE', field + ' must be a safe integer'));
      }
    }
    for (i = 0; i < CLAIM_FIELDS.length; i++) {
      field = CLAIM_FIELDS[i];
      if (input[field] !== undefined && !finitePositive(input[field])) {
        errors.push(validationError(field, 'CLAIM_VALUE', field + ' must be a finite positive number'));
      }
    }
    return immutableCopy({ valid: errors.length === 0, errors: errors });
  }

  function check(name, formula, expected, actual) {
    return {
      name: name,
      formula: formula,
      expected: expected,
      actual: actual,
      pass: Math.abs(Number(expected) - Number(actual)) < 0.000000001
    };
  }

  function assertFiniteDerived(values) {
    var keys = Object.keys(values);
    var i;
    for (i = 0; i < keys.length; i++) {
      if (!isFinite(values[keys[i]]) || Math.abs(values[keys[i]]) > MAX_SAFE_INTEGER) {
        throw new RangeError('non-finite derived value: ' + keys[i]);
      }
    }
  }

  function reconcile(input) {
    var validation = validateInput(input);
    var rackPositionKW;
    var rackPositionsPerHall;
    var itPerHallKW;
    var hallItDensityKWPerM2;
    var itPerFacilityKW;
    var checks;
    var allChecksPass = true;
    var i;
    if (!validation.valid) {
      throw new TypeError('Invalid rack density input: ' + validation.errors[0].field + ' — ' + validation.errors[0].message);
    }
    rackPositionKW = input.logicalDomainKW / input.rackPositionsPerDomain;
    rackPositionsPerHall = input.logicalDomainsPerHall * input.rackPositionsPerDomain;
    itPerHallKW = input.logicalDomainsPerHall * input.logicalDomainKW;
    hallItDensityKWPerM2 = itPerHallKW / input.hallAreaM2;
    itPerFacilityKW = itPerHallKW * input.halls;
    assertFiniteDerived({
      rackPositionKW: rackPositionKW,
      rackPositionsPerHall: rackPositionsPerHall,
      itPerHallKW: itPerHallKW,
      hallItDensityKWPerM2: hallItDensityKWPerM2,
      itPerFacilityKW: itPerFacilityKW
    });
    checks = [
      check('rack-position power', 'logicalDomainKW / rackPositionsPerDomain', rackPositionKW,
        input.claimedRackPositionKW === undefined ? rackPositionKW : input.claimedRackPositionKW),
      check('rack positions per hall', 'logicalDomainsPerHall * rackPositionsPerDomain', rackPositionsPerHall,
        input.claimedRackPositionsPerHall === undefined ? rackPositionsPerHall : input.claimedRackPositionsPerHall),
      check('IT load per hall', 'logicalDomainsPerHall * logicalDomainKW', itPerHallKW,
        input.claimedItPerHallKW === undefined ? itPerHallKW : input.claimedItPerHallKW),
      check('hall IT area density', 'itPerHallKW / hallAreaM2', hallItDensityKWPerM2,
        input.claimedHallItDensityKWPerM2 === undefined ? hallItDensityKWPerM2 : input.claimedHallItDensityKWPerM2),
      check('facility IT load', 'itPerHallKW * halls', itPerFacilityKW,
        input.claimedItPerFacilityKW === undefined ? itPerFacilityKW : input.claimedItPerFacilityKW)
    ];
    for (i = 0; i < checks.length; i++) { if (!checks[i].pass) { allChecksPass = false; } }
    return immutableCopy({
      architectureId: input.architectureId,
      halls: input.halls,
      logicalDomainKW: input.logicalDomainKW,
      rackPositionsPerDomain: input.rackPositionsPerDomain,
      rackPositionKW: rackPositionKW,
      logicalDomainsPerHall: input.logicalDomainsPerHall,
      rackPositionsPerHall: rackPositionsPerHall,
      itPerHallKW: itPerHallKW,
      hallAreaM2: input.hallAreaM2,
      hallItDensityKWPerM2: hallItDensityKWPerM2,
      itPerFacilityKW: itPerFacilityKW,
      allChecksPass: allChecksPass,
      checks: checks
    });
  }

  function resolveCanonicalModel() {
    var model;
    /* v2.0.0 — canonical basis is the GB300 model (js/dcai-model.js). The GB200 model this
       module was written against is retired; it survives below as a named REFERENCE study
       so the platform selector can still teach the split-domain comparison. */
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
      model = require('../dcai-model.js');
    } else if (root) {
      model = root.DCAI_MODEL;
    }
    if (!isObject(model) || !isObject(model.facility) ||
        !isObject(model.gb300) || !isObject(model.geometry)) {
      throw new TypeError('DCAI_MODEL with facility, gb300, and geometry is required');
    }
    return model;
  }

  function buildBaselineInput(model) {
    var hallAreaM2 = model.geometry.lengthM * model.geometry.widthM;
    var itPerHallKW = model.facility.racksPerHall * model.facility.rackItKw;
    /* One GB300 NVL72 rack IS the logical domain (racksPerDomain 1, PUBLISHED from the
       reference architecture), so domain kW = rack kW and domains/hall = racks/hall. The
       "claimed" values are the same arithmetic stated independently, so reconcile() has
       something to check rather than an identity with itself. */
    return {
      architectureId: 'gb300-nvl72-one-rack-one-domain',
      halls: model.facility.halls,
      logicalDomainKW: model.facility.rackItKw * model.gb300.racksPerDomain,
      rackPositionsPerDomain: model.gb300.racksPerDomain,
      logicalDomainsPerHall: model.facility.racksPerHall / model.gb300.racksPerDomain,
      hallAreaM2: hallAreaM2,
      claimedRackPositionKW: model.facility.rackItKw,
      claimedRackPositionsPerHall: model.facility.racksPerHall,
      claimedItPerHallKW: itPerHallKW,
      claimedHallItDensityKWPerM2: itPerHallKW / hallAreaM2,
      claimedItPerFacilityKW: itPerHallKW * model.facility.halls
    };
  }

  var CANONICAL_MODEL = resolveCanonicalModel();
  var BASELINE_INPUT = deepFreeze(buildBaselineInput(CANONICAL_MODEL));

  var baselineValues = reconcile(BASELINE_INPUT);
  if (!baselineValues.allChecksPass) {
    throw new RangeError('DCAI_MODEL rack-density identities do not reconcile');
  }
  var BASELINE = deepFreeze({
    architectureId: baselineValues.architectureId,
    architectureName: 'GB300 NVL72 — one rack, one domain (adopted 2026-09-05)',
    halls: baselineValues.halls,
    logicalDomainKW: baselineValues.logicalDomainKW,
    rackPositionsPerDomain: baselineValues.rackPositionsPerDomain,
    rackPositionKW: baselineValues.rackPositionKW,
    logicalDomainsPerHall: baselineValues.logicalDomainsPerHall,
    rackPositionsPerHall: baselineValues.rackPositionsPerHall,
    itPerHallKW: baselineValues.itPerHallKW,
    hallAreaM2: baselineValues.hallAreaM2,
    hallItDensityKWPerM2: baselineValues.hallItDensityKWPerM2,
    itPerFacilityKW: baselineValues.itPerFacilityKW,
    modelSpecVersion: CANONICAL_MODEL.specVersion,
    status: 'ADOPTED',
    basis: CANONICAL_MODEL.authority || 'DCAI_MODEL adopted GB300 basis'
  });

  /* The retired GB200 basis, kept as a REFERENCE so the platform comparison still shows the
     split-domain topology it replaced. A study may carry its OWN domain count and hall area:
     the GB200 project hall was 32 x 20 m with 27 domains; applying 880 domains to it would
     describe a plant nobody designed. */
  var REFERENCES = deepFreeze({
    'gb200-nvl72-split-domain-retired': {
      id: 'gb200-nvl72-split-domain-retired',
      name: 'Project GB200 NVL72 split-domain basis (retired 2026-09-06)',
      referenceKW: 132,
      rackPositionsPerDomain: 2,
      logicalDomainsPerHall: 27,
      hallAreaM2: 640,
      referenceScope: 'retired project basis — js/datahall-model.js, frozen and still tested',
      adoptionStatus: 'RETIRED_REFERENCE',
      baselineImpact: 'NONE',
      provenance: {
        authority: 'BASELINE-DECISION.md (locked 2026-05-17), superseded by owner decision 2026-09-05',
        asOf: '2026-09-06',
        verification: 'tools/test-datahall-calc.mjs keeps the retired engine at 57/57'
      }
    }
  });

  function requireReferenceId(referenceId) {
    if (typeof referenceId !== 'string' || referenceId.length === 0) {
      throw new TypeError('referenceId must be a non-empty string');
    }
  }

  function getBaseline() { return BASELINE; }

  function getReference(referenceId) {
    requireReferenceId(referenceId);
    if (!Object.prototype.hasOwnProperty.call(REFERENCES, referenceId)) {
      throw new RangeError('Unknown rack architecture reference: ' + referenceId);
    }
    return REFERENCES[referenceId];
  }

  function studyReference(referenceId) {
    var reference = getReference(referenceId);
    var study = reconcile({
      architectureId: reference.id,
      halls: BASELINE.halls,
      logicalDomainKW: reference.referenceKW,
      rackPositionsPerDomain: reference.rackPositionsPerDomain,
      logicalDomainsPerHall: reference.logicalDomainsPerHall || BASELINE.logicalDomainsPerHall,
      hallAreaM2: reference.hallAreaM2 || BASELINE.hallAreaM2
    });
    var deltaKW = study.itPerHallKW - BASELINE.itPerHallKW;
    return immutableCopy({
      reference: reference,
      architectureId: study.architectureId,
      logicalDomainKW: study.logicalDomainKW,
      rackPositionsPerDomain: study.rackPositionsPerDomain,
      rackPositionKW: study.rackPositionKW,
      logicalDomainsPerHall: study.logicalDomainsPerHall,
      rackPositionsPerHall: study.rackPositionsPerHall,
      itPerHallKW: study.itPerHallKW,
      hallAreaM2: study.hallAreaM2,
      hallItDensityKWPerM2: study.hallItDensityKWPerM2,
      itPerFacilityKW: study.itPerFacilityKW,
      deltaVsBaselineKWPerHall: deltaKW,
      deltaVsBaselinePct: deltaKW / BASELINE.itPerHallKW * 100,
      baselineChanged: false,
      adoptionStatus: reference.adoptionStatus
    });
  }

  var API = deepFreeze({
    BASELINE: BASELINE,
    REFERENCES: REFERENCES,
    validateInput: validateInput,
    reconcile: reconcile,
    getBaseline: getBaseline,
    getReference: getReference,
    studyReference: studyReference,
    version: '2.0.0'
  });

  if (root) { root.RZDataHallRackDensity = API; }
  if (typeof module !== 'undefined' && module.exports) { module.exports = API; }

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
