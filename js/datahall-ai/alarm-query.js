/* ============================================================================
 * alarm-query.js — deterministic DC AI alarm history query core
 * ----------------------------------------------------------------------------
 * Pure ES5-compatible data logic for the operator alarm-history workspace.
 * It validates every boundary, never reads the clock, and never mutates caller
 * data. UI rendering, persistence, and real control outputs are intentionally
 * outside this module.
 * ==========================================================================*/
(function (root) {
  'use strict';

  var SEVERITIES = {
    critical: true, high: true, medium: true, low: true, info: true
  };
  var LIFECYCLES = {
    active_unack: true, active_ack: true, returned_unack: true,
    returned_ack: true, shelved: true, suppressed: true, inhibited: true,
    out_of_service: true, maintenance: true, disabled: true, normal: true
  };
  var QUALITIES = {
    good: true, uncertain: true, bad: true, stale: true,
    manual: true, simulated: true, substituted: true, comms_loss: true
  };
  var KINDS = { analog: true, discrete: true, event: true };
  var ANALOG_OPERATORS = {
    eq: true, ne: true, gt: true, gte: true, lt: true, lte: true,
    between: true, outside: true
  };
  var SELECTOR_OPERATORS = {
    exact: true, prefix: true, contains: true, wildcard: true
  };
  var SELECTOR_FIELDS = { operator: true, value: true };
  var ANALOG_FIELDS = { operator: true, value: true, min: true, max: true };
  var DISCRETE_FIELDS = { current: true, previous: true };
  var TEXT_QUERY_FIELDS = { operator: true, value: true, fields: true };
  var SIMPLE_FILTERS = {
    tag: true, point: true, location: true, system: true, severity: true,
    lifecycle: true, quality: true, event: true, action: true, scenario: true,
    operator: true, asset: true, source: true, runId: true, trigger: true,
    reset: true
  };
  var FILTER_FIELDS = {
    from: true, to: true, tag: true, point: true, location: true, system: true,
    severity: true, lifecycle: true, analog: true, discrete: true, quality: true,
    event: true, action: true, scenario: true, operator: true, text: true,
    asset: true, source: true, runId: true, trigger: true, reset: true,
    and: true, or: true
  };
  var GROUP_FIELDS = {
    incidentId: true, tag: true, point: true, location: true, system: true,
    severity: true, lifecycle: true, quality: true, event: true, action: true,
    scenario: true, operator: true, asset: true, source: true, runId: true
  };
  var EXPORT_FIELDS = {
    id: true, timestamp: true, sequence: true, tag: true, point: true,
    location: true, system: true, severity: true, lifecycle: true, kind: true,
    value: true, unit: true, previousState: true, currentState: true,
    quality: true, event: true, action: true, scenario: true, operator: true,
    message: true, incidentId: true, asset: true, source: true, runId: true,
    trigger: true, reset: true
  };
  var EVENT_FIELDS = EXPORT_FIELDS;
  var TEXT_FIELDS = {
    id: true, tag: true, point: true, location: true, system: true,
    event: true, action: true, scenario: true, operator: true, message: true,
    incidentId: true, asset: true, source: true, runId: true, trigger: true,
    reset: true
  };
  var DEFAULT_EXPORT_FIELDS = [
    'timestamp', 'tag', 'point', 'location', 'system', 'severity', 'lifecycle',
    'value', 'unit', 'previousState', 'currentState', 'quality', 'event',
    'action', 'scenario', 'operator', 'message', 'asset', 'source', 'runId',
    'trigger', 'reset'
  ];
  var FULL_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;
  var DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
  var MAX_SAFE_INTEGER = 9007199254740991;
  var MAX_EVENT_FIELD_LENGTH = 256;
  var MAX_EVENT_MESSAGE_LENGTH = 4096;

  function isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function owns(map, key) {
    return Object.prototype.hasOwnProperty.call(map, key);
  }

  function isFiniteNumber(value) {
    return typeof value === 'number' && isFinite(value);
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

  function immutableCopy(value) {
    return deepFreeze(copy(value));
  }

  function errorItem(path, code, message) {
    return { path: path, code: code, message: message };
  }

  function validCalendarDate(value) {
    var match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    var year;
    var month;
    var day;
    var maxDay;
    if (!match) { return false; }
    year = Number(match[1]);
    month = Number(match[2]);
    day = Number(match[3]);
    if (month < 1 || month > 12 || day < 1) { return false; }
    maxDay = [31, ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0) ? 29 : 28,
      31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
    return day <= maxDay;
  }

  function validEventTimestamp(value) {
    return typeof value === 'string' && FULL_TIMESTAMP.test(value) &&
      validCalendarDate(value) && !isNaN(Date.parse(value));
  }

  function validBoundaryTimestamp(value) {
    return typeof value === 'string' && (DATE_ONLY.test(value) || FULL_TIMESTAMP.test(value)) &&
      validCalendarDate(value) && !isNaN(Date.parse(value));
  }

  function boundaryTime(value, isEnd) {
    if (DATE_ONLY.test(value)) {
      return Date.parse(value + (isEnd ? 'T23:59:59.999Z' : 'T00:00:00.000Z'));
    }
    return Date.parse(value);
  }

  function validSafeInteger(value) {
    return typeof value === 'number' && isFinite(value) && Math.floor(value) === value &&
      Math.abs(value) <= MAX_SAFE_INTEGER;
  }

  function validateObjectFields(value, allowed, path, code, errors) {
    var keys = Object.keys(value);
    var i;
    for (i = 0; i < keys.length; i++) {
      if (!owns(allowed, keys[i])) {
        errors.push(errorItem(path + '.' + keys[i], code, 'Unknown nested field: ' + keys[i]));
      }
    }
  }

  function validateSelector(value, path, errors) {
    var i;
    if (typeof value === 'string' && value.length > 0) { return; }
    if (Array.isArray(value) && value.length > 0) {
      for (i = 0; i < value.length; i++) {
        if (typeof value[i] !== 'string' || value[i].length === 0) {
          errors.push(errorItem(path + '[' + i + ']', 'SELECTOR_VALUE', 'Selector values must be non-empty strings'));
        }
      }
      return;
    }
    if (isObject(value)) {
      validateObjectFields(value, SELECTOR_FIELDS, path, 'UNKNOWN_SELECTOR_FIELD', errors);
      if (!owns(SELECTOR_OPERATORS, value.operator)) {
        errors.push(errorItem(path + '.operator', 'SELECTOR_OPERATOR', 'Unsupported selector operator'));
      }
      if (typeof value.value !== 'string' || value.value.length === 0 || value.value.length > 256) {
        errors.push(errorItem(path + '.value', 'SELECTOR_VALUE', 'Selector value must be 1-256 characters'));
      }
      return;
    }
    errors.push(errorItem(path, 'SELECTOR_TYPE', 'Selector must be a string or a non-empty string array'));
  }

  function validateEnumSelector(value, allowed, path, errors) {
    var values = Array.isArray(value) ? value : [value];
    var i;
    if (isObject(value)) {
      errors.push(errorItem(path, 'ENUM_SELECTOR', 'Enum filters support exact string selectors only'));
      return;
    }
    validateSelector(value, path, errors);
    for (i = 0; i < values.length; i++) {
      if (typeof values[i] === 'string' && !owns(allowed, values[i].toLowerCase())) {
        errors.push(errorItem(path, 'ENUM_VALUE', 'Unsupported value: ' + values[i]));
      }
    }
  }

  function validateAnalog(value, path, errors) {
    var operator;
    if (!isObject(value)) {
      errors.push(errorItem(path, 'ANALOG_TYPE', 'Analog comparator must be an object'));
      return;
    }
    validateObjectFields(value, ANALOG_FIELDS, path, 'UNKNOWN_ANALOG_FIELD', errors);
    operator = value.operator;
    if (!owns(ANALOG_OPERATORS, operator)) {
      errors.push(errorItem(path + '.operator', 'ANALOG_OPERATOR', 'Unsupported analog comparator'));
      return;
    }
    if (operator === 'between' || operator === 'outside') {
      if (value.value !== undefined) {
        errors.push(errorItem(path + '.value', 'ANALOG_FIELD', 'Range comparator does not accept value'));
      }
      if (!isFiniteNumber(value.min) || !isFiniteNumber(value.max) || value.min > value.max) {
        errors.push(errorItem(path, 'ANALOG_RANGE', 'Range comparator requires finite min <= max'));
      }
    } else {
      if (value.min !== undefined || value.max !== undefined) {
        errors.push(errorItem(path, 'ANALOG_FIELD', 'Single-value comparator does not accept min or max'));
      }
      if (!isFiniteNumber(value.value)) {
        errors.push(errorItem(path + '.value', 'ANALOG_VALUE', 'Comparator requires a finite value'));
      }
    }
  }

  function validateDiscrete(value, path, errors) {
    if (!isObject(value)) {
      errors.push(errorItem(path, 'DISCRETE_TYPE', 'Discrete transition must be an object'));
      return;
    }
    validateObjectFields(value, DISCRETE_FIELDS, path, 'UNKNOWN_DISCRETE_FIELD', errors);
    if (value.current === undefined && value.previous === undefined) {
      errors.push(errorItem(path, 'DISCRETE_EMPTY', 'Current or previous state is required'));
    }
    if (value.current !== undefined) { validateSelector(value.current, path + '.current', errors); }
    if (value.previous !== undefined) { validateSelector(value.previous, path + '.previous', errors); }
  }

  function validateText(value, path, errors) {
    var fields;
    var i;
    if (typeof value === 'string') {
      if (value.trim().length === 0) { errors.push(errorItem(path, 'TEXT_VALUE', 'Text search must be non-empty')); }
      return;
    }
    if (!isObject(value)) {
      errors.push(errorItem(path, 'TEXT_TYPE', 'Text search must be a string or selector object'));
      return;
    }
    validateObjectFields(value, TEXT_QUERY_FIELDS, path, 'UNKNOWN_TEXT_FIELD', errors);
    validateSelector({ operator: value.operator || 'contains', value: value.value }, path, errors);
    fields = value.fields === undefined ? Object.keys(TEXT_FIELDS) : value.fields;
    if (!Array.isArray(fields) || fields.length === 0) {
      errors.push(errorItem(path + '.fields', 'TEXT_FIELDS', 'Text fields must be a non-empty array'));
      return;
    }
    for (i = 0; i < fields.length; i++) {
      if (!owns(TEXT_FIELDS, fields[i])) { errors.push(errorItem(path + '.fields[' + i + ']', 'TEXT_FIELD', 'Unsupported text field')); }
    }
  }

  function validateFilterNode(filter, path, errors, depth) {
    var keys;
    var i;
    var field;
    var group;
    if (!isObject(filter)) {
      errors.push(errorItem(path, 'FILTER_TYPE', 'Filter must be an object'));
      return;
    }
    if (depth > 8) {
      errors.push(errorItem(path, 'FILTER_DEPTH', 'Nested filter depth exceeds 8'));
      return;
    }
    keys = Object.keys(filter);
    for (i = 0; i < keys.length; i++) {
      field = keys[i];
      if (!owns(FILTER_FIELDS, field)) {
        errors.push(errorItem(path + '.' + field, 'UNKNOWN_FIELD', 'Unknown filter field: ' + field));
      }
    }
    if (filter.from !== undefined && !validBoundaryTimestamp(filter.from)) {
      errors.push(errorItem(path + '.from', 'DATE_VALUE', 'From must be an ISO-compatible timestamp'));
    }
    if (filter.to !== undefined && !validBoundaryTimestamp(filter.to)) {
      errors.push(errorItem(path + '.to', 'DATE_VALUE', 'To must be an ISO-compatible timestamp'));
    }
    if (validBoundaryTimestamp(filter.from) && validBoundaryTimestamp(filter.to) &&
        boundaryTime(filter.from, false) > boundaryTime(filter.to, true)) {
      errors.push(errorItem(path, 'DATE_RANGE', 'From must be before or equal to To'));
    }
    validateFilterFields(filter, path, errors);
    for (i = 0; i < 2; i++) {
      group = i === 0 ? 'and' : 'or';
      if (filter[group] !== undefined) { validateGroup(filter[group], path + '.' + group, errors, depth); }
    }
  }

  function validateFilterFields(filter, path, errors) {
    var fields = Object.keys(SIMPLE_FILTERS);
    var i;
    var field;
    for (i = 0; i < fields.length; i++) {
      field = fields[i];
      if (filter[field] === undefined) { continue; }
      if (field === 'severity') { validateEnumSelector(filter[field], SEVERITIES, path + '.' + field, errors); }
      else if (field === 'lifecycle') { validateEnumSelector(filter[field], LIFECYCLES, path + '.' + field, errors); }
      else if (field === 'quality') { validateEnumSelector(filter[field], QUALITIES, path + '.' + field, errors); }
      else { validateSelector(filter[field], path + '.' + field, errors); }
    }
    if (filter.analog !== undefined) { validateAnalog(filter.analog, path + '.analog', errors); }
    if (filter.discrete !== undefined) { validateDiscrete(filter.discrete, path + '.discrete', errors); }
    if (filter.text !== undefined) { validateText(filter.text, path + '.text', errors); }
  }

  function validateGroup(group, path, errors, depth) {
    var i;
    if (!Array.isArray(group) || group.length === 0) {
      errors.push(errorItem(path, 'EMPTY_GROUP', 'AND/OR group must contain at least one filter'));
      return;
    }
    for (i = 0; i < group.length; i++) {
      validateFilterNode(group[i], path + '[' + i + ']', errors, depth + 1);
    }
  }

  function validateFilter(filter) {
    var errors = [];
    validateFilterNode(filter === undefined ? {} : filter, '$', errors, 0);
    return immutableCopy({ valid: errors.length === 0, errors: errors });
  }

  function validateEvents(events) {
    var errors = [];
    var required = ['id', 'timestamp', 'tag', 'point', 'location', 'system', 'severity',
      'lifecycle', 'kind', 'quality', 'event', 'action', 'scenario', 'operator',
      'message', 'incidentId'];
    var optionalStrings = ['unit', 'previousState', 'currentState', 'asset', 'source',
      'runId', 'trigger', 'reset'];
    var seenIds = Object.create(null);
    var i;
    var j;
    var event;
    var keys;
    if (!Array.isArray(events)) {
      return immutableCopy({ valid: false, errors: [errorItem('$', 'EVENTS_TYPE', 'Events must be an array')] });
    }
    for (i = 0; i < events.length; i++) {
      event = events[i];
      if (!isObject(event)) {
        errors.push(errorItem('$[' + i + ']', 'EVENT_TYPE', 'Event must be an object'));
        continue;
      }
      keys = Object.keys(event);
      for (j = 0; j < keys.length; j++) {
        if (!owns(EVENT_FIELDS, keys[j])) {
          errors.push(errorItem('$[' + i + '].' + keys[j], 'UNKNOWN_EVENT_FIELD', 'Unknown event field: ' + keys[j]));
        }
      }
      for (j = 0; j < required.length; j++) {
        if (typeof event[required[j]] !== 'string' || event[required[j]].length === 0) {
          errors.push(errorItem('$[' + i + '].' + required[j], 'EVENT_FIELD', 'Required non-empty string'));
        } else if (event[required[j]].length >
            (required[j] === 'message' ? MAX_EVENT_MESSAGE_LENGTH : MAX_EVENT_FIELD_LENGTH)) {
          errors.push(errorItem('$[' + i + '].' + required[j], 'EVENT_FIELD_LENGTH', 'Event field exceeds maximum length'));
        }
      }
      for (j = 0; j < optionalStrings.length; j++) {
        if (event[optionalStrings[j]] !== undefined && typeof event[optionalStrings[j]] !== 'string') {
          errors.push(errorItem('$[' + i + '].' + optionalStrings[j], 'EVENT_FIELD', 'Optional field must be a string'));
        } else if (typeof event[optionalStrings[j]] === 'string' &&
            event[optionalStrings[j]].length > MAX_EVENT_FIELD_LENGTH) {
          errors.push(errorItem('$[' + i + '].' + optionalStrings[j], 'EVENT_FIELD_LENGTH', 'Event field exceeds maximum length'));
        }
      }
      if (!validEventTimestamp(event.timestamp)) { errors.push(errorItem('$[' + i + '].timestamp', 'EVENT_TIMESTAMP', 'Timestamp must be RFC3339 with timezone')); }
      if (!validSafeInteger(event.sequence) || event.sequence < 0) { errors.push(errorItem('$[' + i + '].sequence', 'EVENT_SEQUENCE', 'Sequence must be a non-negative safe integer')); }
      if (typeof event.id === 'string' && event.id.length > 0) {
        if (seenIds[event.id]) { errors.push(errorItem('$[' + i + '].id', 'DUPLICATE_ID', 'Event IDs must be unique')); }
        seenIds[event.id] = true;
      }
      if (!owns(SEVERITIES, event.severity)) { errors.push(errorItem('$[' + i + '].severity', 'EVENT_SEVERITY', 'Invalid severity')); }
      if (!owns(LIFECYCLES, event.lifecycle)) { errors.push(errorItem('$[' + i + '].lifecycle', 'EVENT_LIFECYCLE', 'Invalid lifecycle')); }
      if (!owns(QUALITIES, event.quality)) { errors.push(errorItem('$[' + i + '].quality', 'EVENT_QUALITY', 'Invalid quality')); }
      if (!owns(KINDS, event.kind)) { errors.push(errorItem('$[' + i + '].kind', 'EVENT_KIND', 'Invalid kind')); }
      if (event.value !== undefined && !isFiniteNumber(event.value)) {
        errors.push(errorItem('$[' + i + '].value', 'EVENT_VALUE', 'Event value must be finite when present'));
      } else if (event.kind === 'analog' && event.value === undefined) {
        errors.push(errorItem('$[' + i + '].value', 'EVENT_VALUE', 'Analog event requires a finite value'));
      }
      if (event.kind === 'discrete' && (typeof event.currentState !== 'string' || typeof event.previousState !== 'string')) {
        errors.push(errorItem('$[' + i + ']', 'EVENT_STATE', 'Discrete event requires current and previous state'));
      }
    }
    return immutableCopy({ valid: errors.length === 0, errors: errors });
  }

  function lower(value) { return String(value === undefined ? '' : value).toLowerCase(); }

  function wildcardMatches(actual, pattern) {
    var text = lower(actual);
    var glob = lower(pattern);
    var textIndex = 0;
    var globIndex = 0;
    var starIndex = -1;
    var retryTextIndex = 0;
    while (textIndex < text.length) {
      if (globIndex < glob.length && (glob.charAt(globIndex) === '?' ||
          glob.charAt(globIndex) === text.charAt(textIndex))) {
        textIndex += 1;
        globIndex += 1;
      } else if (globIndex < glob.length && glob.charAt(globIndex) === '*') {
        starIndex = globIndex;
        globIndex += 1;
        retryTextIndex = textIndex;
      } else if (starIndex !== -1) {
        globIndex = starIndex + 1;
        retryTextIndex += 1;
        textIndex = retryTextIndex;
      } else {
        return false;
      }
    }
    while (globIndex < glob.length && glob.charAt(globIndex) === '*') { globIndex += 1; }
    return globIndex === glob.length;
  }

  function structuredSelectorMatches(actual, selector) {
    var target = String(actual === undefined ? '' : actual);
    var expected = selector.value;
    switch (selector.operator) {
      case 'exact': return lower(target) === lower(expected);
      case 'prefix': return lower(target).indexOf(lower(expected)) === 0;
      case 'contains': return lower(target).indexOf(lower(expected)) !== -1;
      case 'wildcard': return wildcardMatches(target, expected);
      default: return false;
    }
  }

  function selectorMatches(actual, selector) {
    var values = Array.isArray(selector) ? selector : [selector];
    var target = lower(actual);
    var i;
    if (isObject(selector)) { return structuredSelectorMatches(actual, selector); }
    for (i = 0; i < values.length; i++) {
      if (target === lower(values[i])) { return true; }
    }
    return false;
  }

  function analogMatches(event, comparator) {
    var value = event.value;
    if (event.kind !== 'analog' || !isFiniteNumber(value)) { return false; }
    switch (comparator.operator) {
      case 'eq': return value === comparator.value;
      case 'ne': return value !== comparator.value;
      case 'gt': return value > comparator.value;
      case 'gte': return value >= comparator.value;
      case 'lt': return value < comparator.value;
      case 'lte': return value <= comparator.value;
      case 'between': return value >= comparator.min && value <= comparator.max;
      case 'outside': return value < comparator.min || value > comparator.max;
      default: return false;
    }
  }

  function textMatches(event, text) {
    var fields;
    var selector;
    var i;
    if (typeof text === 'string') {
      fields = Object.keys(TEXT_FIELDS);
      selector = { operator: 'contains', value: text };
    } else {
      fields = text.fields === undefined ? Object.keys(TEXT_FIELDS) : text.fields;
      selector = { operator: text.operator || 'contains', value: text.value };
    }
    for (i = 0; i < fields.length; i++) {
      if (structuredSelectorMatches(event[fields[i]], selector)) { return true; }
    }
    return false;
  }

  function matchesNode(event, filter) {
    var fields = Object.keys(SIMPLE_FILTERS);
    var i;
    var group;
    if (filter.from !== undefined && Date.parse(event.timestamp) < boundaryTime(filter.from, false)) { return false; }
    if (filter.to !== undefined && Date.parse(event.timestamp) > boundaryTime(filter.to, true)) { return false; }
    for (i = 0; i < fields.length; i++) {
      if (filter[fields[i]] !== undefined && !selectorMatches(event[fields[i]], filter[fields[i]])) { return false; }
    }
    if (filter.analog !== undefined && !analogMatches(event, filter.analog)) { return false; }
    if (filter.discrete !== undefined) {
      if (event.kind !== 'discrete') { return false; }
      if (filter.discrete.current !== undefined && !selectorMatches(event.currentState, filter.discrete.current)) { return false; }
      if (filter.discrete.previous !== undefined && !selectorMatches(event.previousState, filter.discrete.previous)) { return false; }
    }
    if (filter.text !== undefined && !textMatches(event, filter.text)) { return false; }
    group = filter.and;
    if (group !== undefined) {
      for (i = 0; i < group.length; i++) { if (!matchesNode(event, group[i])) { return false; } }
    }
    group = filter.or;
    if (group !== undefined) {
      for (i = 0; i < group.length; i++) { if (matchesNode(event, group[i])) { return true; } }
      return false;
    }
    return true;
  }

  function chronological(a, b) {
    var timeDelta = Date.parse(a.timestamp) - Date.parse(b.timestamp);
    var sequenceDelta;
    var aId;
    var bId;
    if (timeDelta !== 0) { return timeDelta; }
    sequenceDelta = Number(a.sequence || 0) - Number(b.sequence || 0);
    if (sequenceDelta !== 0) { return sequenceDelta; }
    aId = String(a.id);
    bId = String(b.id);
    return aId < bId ? -1 : (aId > bId ? 1 : 0);
  }

  function assertValid(events, filter) {
    var eventValidation = validateEvents(events);
    var filterValidation = validateFilter(filter);
    if (!eventValidation.valid) { throw new TypeError('Invalid alarm events: ' + eventValidation.errors[0].message); }
    if (!filterValidation.valid) { throw new TypeError('Invalid alarm filter: ' + filterValidation.errors[0].message); }
  }

  function query(events, filter) {
    var effectiveFilter = filter === undefined ? {} : filter;
    var records = [];
    var i;
    assertValid(events, effectiveFilter);
    for (i = 0; i < events.length; i++) {
      if (matchesNode(events[i], effectiveFilter)) { records.push(copy(events[i])); }
    }
    records.sort(chronological);
    return immutableCopy({ records: records, total: records.length, filter: effectiveFilter });
  }

  function validateDimensions(fields) {
    var i;
    if (!Array.isArray(fields) || fields.length === 0) { throw new TypeError('Grouping fields must be a non-empty array'); }
    for (i = 0; i < fields.length; i++) {
      if (!owns(GROUP_FIELDS, fields[i])) { throw new TypeError('Unsupported grouping field: ' + fields[i]); }
    }
  }

  function groupDisplayLabel(event, fields) {
    var values = [];
    var i;
    for (i = 0; i < fields.length; i++) { values.push(lower(event[fields[i]])); }
    return values.join('|');
  }

  function groupKey(event, fields) {
    var values = [];
    var i;
    for (i = 0; i < fields.length; i++) { values.push(lower(event[fields[i]])); }
    return stableStringify(values);
  }

  function groupIdentity(event, fields) { return groupKey(event, fields); }

  function firstOut(events, fields) {
    var dimensions = fields === undefined ? ['incidentId'] : fields;
    var ordered;
    var seen = Object.create(null);
    var output = [];
    var i;
    var key;
    validateDimensions(dimensions);
    assertValid(events, {});
    ordered = copy(events).sort(chronological);
    for (i = 0; i < ordered.length; i++) {
      key = groupIdentity(ordered[i], dimensions);
      if (!seen[key]) {
        seen[key] = true;
        output.push(ordered[i]);
      }
    }
    return immutableCopy(output);
  }

  function newGroup(event, key, displayLabel, fields) {
    var dimensions = {};
    var i;
    for (i = 0; i < fields.length; i++) { dimensions[fields[i]] = event[fields[i]]; }
    return {
      key: key, displayLabel: displayLabel, dimensions: dimensions,
      count: 0, firstOutId: event.id,
      firstTimestamp: event.timestamp, lastTimestamp: event.timestamp,
      severityCounts: {}, lifecycleCounts: {}
    };
  }

  function groupBy(events, fields) {
    var ordered;
    var index = Object.create(null);
    var groups = [];
    var i;
    var event;
    var key;
    var identity;
    var group;
    validateDimensions(fields);
    assertValid(events, {});
    ordered = copy(events).sort(chronological);
    for (i = 0; i < ordered.length; i++) {
      event = ordered[i];
      key = groupKey(event, fields);
      identity = key;
      if (index[identity] === undefined) {
        index[identity] = groups.length;
        groups.push(newGroup(event, key, groupDisplayLabel(event, fields), fields));
      }
      group = groups[index[identity]];
      group.count += 1;
      group.lastTimestamp = event.timestamp;
      group.severityCounts[event.severity] = (group.severityCounts[event.severity] || 0) + 1;
      group.lifecycleCounts[event.lifecycle] = (group.lifecycleCounts[event.lifecycle] || 0) + 1;
    }
    return immutableCopy(groups);
  }

  function stableStringify(value) {
    var keys;
    var parts;
    var i;
    if (value === null || typeof value !== 'object') { return JSON.stringify(value); }
    if (Array.isArray(value)) {
      parts = [];
      for (i = 0; i < value.length; i++) { parts.push(stableStringify(value[i])); }
      return '[' + parts.join(',') + ']';
    }
    keys = Object.keys(value).sort();
    parts = [];
    for (i = 0; i < keys.length; i++) { parts.push(JSON.stringify(keys[i]) + ':' + stableStringify(value[keys[i]])); }
    return '{' + parts.join(',') + '}';
  }

  function hash8(text) {
    var hash = 2166136261;
    var i;
    for (i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return ('00000000' + (hash >>> 0).toString(16)).slice(-8);
  }

  function validateExportOptions(options) {
    var fields;
    var i;
    if (!isObject(options)) { throw new TypeError('Export options must be an object'); }
    if (options.format !== 'csv' && options.format !== 'json') { throw new TypeError('Export format must be csv or json'); }
    if (!validEventTimestamp(options.generatedAt)) { throw new TypeError('generatedAt must be an RFC3339 timestamp with timezone'); }
    if (typeof options.requestedBy !== 'string' || options.requestedBy.length === 0) { throw new TypeError('requestedBy is required'); }
    if (options.fileStem !== undefined && !/^[a-z0-9_-]+$/i.test(options.fileStem)) { throw new TypeError('fileStem contains unsupported characters'); }
    fields = options.fields === undefined ? DEFAULT_EXPORT_FIELDS : options.fields;
    if (!Array.isArray(fields) || fields.length === 0) { throw new TypeError('Export fields must be a non-empty array'); }
    for (i = 0; i < fields.length; i++) {
      if (!owns(EXPORT_FIELDS, fields[i])) { throw new TypeError('Unsupported export field: ' + fields[i]); }
    }
    if (options.firstOutBy !== undefined) { validateDimensions(options.firstOutBy); }
  }

  function projectRecords(records, fields) {
    var output = [];
    var i;
    var j;
    var row;
    for (i = 0; i < records.length; i++) {
      row = {};
      for (j = 0; j < fields.length; j++) { row[fields[j]] = records[i][fields[j]]; }
      output.push(row);
    }
    return output;
  }

  function sourceFirstOutForMatches(sourceEvents, matchedEvents, dimensions) {
    var matchingGroups = Object.create(null);
    var sourceFirst = firstOut(sourceEvents, dimensions);
    var selected = [];
    var i;
    for (i = 0; i < matchedEvents.length; i++) {
      matchingGroups[groupIdentity(matchedEvents[i], dimensions)] = true;
    }
    for (i = 0; i < sourceFirst.length; i++) {
      if (matchingGroups[groupIdentity(sourceFirst[i], dimensions)]) { selected.push(sourceFirst[i]); }
    }
    return selected;
  }

  function prepareExport(events, filter, options) {
    var result;
    var fields;
    var firstDimensions;
    var firstRecords;
    var firstMatching;
    var firstIds = [];
    var firstMatchingIds = [];
    var recordIds = [];
    var metadata;
    var i;
    validateExportOptions(options);
    result = query(events, filter);
    fields = options.fields === undefined ? DEFAULT_EXPORT_FIELDS : options.fields;
    firstDimensions = options.firstOutBy === undefined ? ['incidentId'] : options.firstOutBy;
    firstRecords = sourceFirstOutForMatches(events, result.records, firstDimensions);
    firstMatching = firstOut(result.records, firstDimensions);
    for (i = 0; i < firstRecords.length; i++) { firstIds.push(firstRecords[i].id); }
    for (i = 0; i < firstMatching.length; i++) { firstMatchingIds.push(firstMatching[i].id); }
    for (i = 0; i < result.records.length; i++) { recordIds.push(result.records[i].id); }
    metadata = {
      format: options.format,
      generatedAt: options.generatedAt,
      requestedBy: options.requestedBy,
      fileName: (options.fileStem || 'dc-ai-alarm-history') + '.' + options.format,
      sourceCount: events.length,
      filteredCount: result.total,
      fields: copy(fields),
      filter: copy(result.filter),
      firstOutBy: copy(firstDimensions),
      firstOutIds: firstIds,
      firstMatchingIds: firstMatchingIds,
      timeWindow: { from: result.filter.from || null, to: result.filter.to || null }
    };
    metadata.exportId = 'ALM-' + hash8(stableStringify({ metadata: metadata, recordIds: recordIds }));
    return immutableCopy({ metadata: metadata, records: projectRecords(result.records, fields) });
  }

  var FIXTURE = deepFreeze([
    { id: 'FX-001', timestamp: '2026-08-26T08:00:00.000Z', sequence: 1, tag: 'UPS-A', point: 'STATE', location: 'DH-01/ELEC-A', system: 'electrical', severity: 'critical', lifecycle: 'active_unack', kind: 'discrete', previousState: 'NORMAL', currentState: 'TRIPPED', quality: 'simulated', event: 'ups-trip', action: 'transfer-feed-b', scenario: 'ups-a-trip', operator: 'system', message: 'UPS A trip initiated transfer', incidentId: 'FX-PWR-01' },
    { id: 'FX-002', timestamp: '2026-08-26T08:00:02.000Z', sequence: 2, tag: 'ATS-A', point: 'POSITION', location: 'DH-01/ELEC-A', system: 'electrical', severity: 'high', lifecycle: 'active_ack', kind: 'discrete', previousState: 'SOURCE-A', currentState: 'SOURCE-B', quality: 'simulated', event: 'source-transfer', action: 'verify-feed-b', scenario: 'ups-a-trip', operator: 'system', message: 'ATS transferred to source B', incidentId: 'FX-PWR-01' },
    { id: 'FX-003', timestamp: '2026-08-26T08:01:00.000Z', sequence: 3, tag: 'CDU-04', point: 'FLOW', location: 'DH-01/CDU-04', system: 'cooling', severity: 'medium', lifecycle: 'active_unack', kind: 'analog', value: 310, unit: 'L/min', quality: 'simulated', event: 'flow-low', action: 'start-standby-pump', scenario: 'cdu-pump-fail', operator: 'system', message: 'CDU flow below operating band', incidentId: 'FX-CLG-01' },
    { id: 'FX-004', timestamp: '2026-08-26T08:02:00.000Z', sequence: 4, tag: 'VESDA-Z02', point: 'FIRE_1', location: 'DH-01/ZONE-02', system: 'fire', severity: 'critical', lifecycle: 'active_unack', kind: 'discrete', previousState: 'NORMAL', currentState: 'ALARM', quality: 'simulated', event: 'smoke-confirmed', action: 'cause-effect-stage-2', scenario: 'fire-zone-02', operator: 'system', message: 'Confirmed smoke in zone 02', incidentId: 'FX-FIRE-01' },
    { id: 'FX-005', timestamp: '2026-08-26T08:03:00.000Z', sequence: 5, tag: 'LF-02', point: 'CRC_ERRORS', location: 'DH-01/MDF', system: 'network', severity: 'low', lifecycle: 'shelved', kind: 'analog', value: 12, unit: 'errors/min', quality: 'uncertain', event: 'crc-rate-high', action: 'inspect-optics', scenario: 'normal', operator: 'shift-a', message: 'CRC warning shelved for optics inspection', incidentId: 'FX-NET-01' },
    { id: 'FX-006', timestamp: '2026-08-26T08:04:00.000Z', sequence: 6, tag: 'UPS-A', point: 'STATE', location: 'DH-01/ELEC-A', system: 'electrical', severity: 'critical', lifecycle: 'returned_ack', kind: 'discrete', previousState: 'TRIPPED', currentState: 'NORMAL', quality: 'simulated', event: 'return-to-normal', action: 'reset', scenario: 'ups-a-trip', operator: 'shift-a', message: 'UPS A returned to normal', incidentId: 'FX-PWR-01' }
  ]);

  function createFixture() { return immutableCopy(FIXTURE); }

  var API = deepFreeze({
    SEVERITIES: copy(SEVERITIES),
    LIFECYCLES: copy(LIFECYCLES),
    QUALITIES: copy(QUALITIES),
    ANALOG_OPERATORS: copy(ANALOG_OPERATORS),
    validateFilter: validateFilter,
    validateEvents: validateEvents,
    query: query,
    firstOut: firstOut,
    groupBy: groupBy,
    prepareExport: prepareExport,
    createFixture: createFixture,
    version: '1.0.0'
  });

  if (root) { root.RZDataHallAlarmQuery = API; }
  if (typeof module !== 'undefined' && module.exports) { module.exports = API; }

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
