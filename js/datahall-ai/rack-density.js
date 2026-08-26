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
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
      model = require('../datahall-model.js');
    } else if (root) {
      model = root.DATAHALL_MODEL;
    }
    if (!isObject(model) || !isObject(model.facility) ||
        !isObject(model.locked) || !isObject(model.geometry)) {
      throw new TypeError('DATAHALL_MODEL with facility, locked, and geometry is required');
    }
    return model;
  }

  function buildBaselineInput(model) {
    var hallAreaM2 = model.geometry.lengthM * model.geometry.widthM;
    return {
      architectureId: 'project-gb200-nvl72-split-domain',
      halls: model.facility.halls,
      logicalDomainKW: model.locked.kwPerNVL72,
      rackPositionsPerDomain: model.facility.racksPerNVL72,
      logicalDomainsPerHall: model.facility.nvl72PerHall,
      hallAreaM2: hallAreaM2,
      claimedRackPositionKW: model.locked.kwPerRack,
      claimedRackPositionsPerHall: model.facility.racksPerHall,
      claimedItPerHallKW: model.locked.itPerHall_kW,
      claimedHallItDensityKWPerM2: model.locked.itPerHall_kW / hallAreaM2,
      claimedItPerFacilityKW: model.locked.itPerFacility_kW
    };
  }

  var CANONICAL_MODEL = resolveCanonicalModel();
  var BASELINE_INPUT = deepFreeze(buildBaselineInput(CANONICAL_MODEL));

  var baselineValues = reconcile(BASELINE_INPUT);
  if (!baselineValues.allChecksPass) {
    throw new RangeError('DATAHALL_MODEL rack-density identities do not reconcile');
  }
  var BASELINE = deepFreeze({
    architectureId: baselineValues.architectureId,
    architectureName: 'Project GB200 NVL72 split-domain basis',
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
    status: 'BOD_LOCKED',
    basis: CANONICAL_MODEL.authority || 'DATAHALL_MODEL locked Scenario A'
  });

  var REFERENCES = deepFreeze({
    'gb300-nvl72-142kw-study': {
      id: 'gb300-nvl72-142kw-study',
      name: 'NVIDIA GB300 NVL72 reference study',
      referenceKW: 142,
      rackPositionsPerDomain: 1,
      referenceScope: 'logical NVL72 system planning study',
      adoptionStatus: 'REFERENCE_STUDY',
      baselineImpact: 'NONE',
      provenance: {
        authority: 'owner planning input',
        asOf: '2026-08-26',
        verification: 'confirm vendor configuration and project BoD before adoption'
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
      logicalDomainsPerHall: BASELINE.logicalDomainsPerHall,
      hallAreaM2: BASELINE.hallAreaM2
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
    version: '1.1.0'
  });

  if (root) { root.RZDataHallRackDensity = API; }
  if (typeof module !== 'undefined' && module.exports) { module.exports = API; }

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
