/* DC AI operator workspaces. Pure data modules remain the source of truth. */
(function (root) {
  'use strict';

  var alarmApi = root.RZDataHallAlarmQuery;
  var densityApi = root.RZDataHallRackDensity;
  var electricalApi = root.RZDatahallAIElectrical;
  var electricalVisualApi = root.RZDatahallAIElectricalVisualMap;
  var fireApi = root.RZDatahallAIFireCauseEffect;
  var alarmEvents = alarmApi ? alarmApi.createFixture() : [];
  var alarmRows = [];
  var firstOutOnly = false;

  function byId(id) { return document.getElementById(id); }

  function clear(node) {
    if (!node) { return; }
    while (node.firstChild) { node.removeChild(node.firstChild); }
  }

  function node(tag, className, value) {
    var item = document.createElement(tag);
    if (className) { item.className = className; }
    if (value !== undefined) { item.textContent = String(value); }
    return item;
  }

  function text(id, value) {
    var target = byId(id);
    if (target) { target.textContent = String(value); }
  }

  function formatNumber(value, digits) {
    return Number(value).toLocaleString('en-US', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    });
  }

  function localIso(id) {
    var value = byId(id).value;
    if (!value) { return null; }
    var parsed = new Date(value);
    if (isNaN(parsed.getTime())) { throw new Error('Invalid date in ' + id); }
    return parsed.toISOString();
  }

  function trimmed(id) {
    var target = byId(id);
    return target ? target.value.trim() : '';
  }

  function addFilter(filter, key, value) {
    if (!value) { return filter; }
    var next = {};
    Object.keys(filter).forEach(function (name) { next[name] = filter[name]; });
    next[key] = value;
    return next;
  }

  function savedFilter(view) {
    if (view === 'active') { return { lifecycle: ['active_unack', 'active_ack'] }; }
    if (view === 'critical-first-out') { return { severity: 'critical' }; }
    if (view === 'bad-quality') { return { quality: ['bad', 'stale'] }; }
    if (view === 'fire') { return { system: 'fire' }; }
    return {};
  }

  function buildAlarmFilter() {
    var filter = savedFilter(trimmed('alarmSavedView'));
    var point = trimmed('alarmPoint');
    var comparator = trimmed('alarmComparator');
    var value = trimmed('alarmValue');
    var previous = trimmed('alarmStateFrom');
    var current = trimmed('alarmStateTo');
    var discrete = {};
    var from = localIso('alarmFrom');
    var to = localIso('alarmTo');
    if (from) { filter = addFilter(filter, 'from', from); }
    if (to) { filter = addFilter(filter, 'to', to); }
    if (point) { filter = addFilter(filter, 'or', [{ tag: point }, { point: point }]); }
    filter = addFilter(filter, 'system', trimmed('alarmSystem'));
    filter = addFilter(filter, 'severity', trimmed('alarmSeverity'));
    filter = addFilter(filter, 'lifecycle', trimmed('alarmLifecycle'));
    filter = addFilter(filter, 'quality', trimmed('alarmQuality'));
    filter = addFilter(filter, 'event', trimmed('alarmEventType'));
    filter = addFilter(filter, 'action', trimmed('alarmAction'));
    filter = addFilter(filter, 'text', trimmed('alarmText'));
    if (comparator && value !== '') {
      filter = addFilter(filter, 'analog', { operator: comparator, value: Number(value) });
    }
    if (previous) { discrete.previous = previous; }
    if (current) { discrete.current = current; }
    if (Object.keys(discrete).length) { filter = addFilter(filter, 'discrete', discrete); }
    return filter;
  }

  function statusClass(severity) {
    if (severity === 'critical' || severity === 'high') { return 'rz-ops-status--critical'; }
    if (severity === 'medium' || severity === 'low') { return 'rz-ops-status--warning'; }
    return 'rz-ops-status--info';
  }

  function alarmValue(event) {
    if (event.kind === 'analog') { return formatNumber(event.value, 1) + ' ' + event.unit; }
    return event.previousState + ' → ' + event.currentState;
  }

  function appendCell(row, value, className) {
    var cell = node('td', className || '', value);
    row.appendChild(cell);
    return cell;
  }

  function showAlarmDetail(event) {
    var detail = byId('alarmDetail');
    var list = node('dl');
    var values = {
      'Record': event.id + ' / incident ' + event.incidentId,
      'Timestamp': event.timestamp,
      'Location': event.location,
      'Message': event.message,
      'Scenario': event.scenario,
      'Operator': event.operator,
      'Action': event.action,
      'Quality': event.quality
    };
    clear(detail);
    detail.appendChild(node('div', 'rz-ops-eyebrow', 'Record detail'));
    Object.keys(values).forEach(function (key) {
      list.appendChild(node('dt', '', key));
      list.appendChild(node('dd', '', values[key]));
    });
    detail.appendChild(list);
    detail.focus();
  }

  function alarmDetailButton(event, index) {
    var button = node('button', 'rz-ops-button rz-ops-button--compact', 'View details');
    button.type = 'button';
    button.setAttribute('data-alarm-index', index);
    button.setAttribute('aria-label', 'View details for ' + event.tag + ' ' + event.point);
    return button;
  }

  function renderAlarmRows(records, firstIds) {
    var body = byId('alarmResultsBody');
    clear(body);
    alarmRows = records.slice().reverse();
    alarmRows.forEach(function (event, index) {
      var row = node('tr');
      var badge = node('span', 'rz-ops-status ' + statusClass(event.severity), event.severity);
      row.setAttribute('aria-selected', 'false');
      appendCell(row, event.timestamp.replace('T', ' ').replace('.000Z', 'Z'));
      appendCell(row, firstIds[event.id] ? 'FIRST' : '—');
      appendCell(row, '').appendChild(badge);
      appendCell(row, event.tag + ' / ' + event.point);
      appendCell(row, event.system + ' / ' + event.location);
      appendCell(row, alarmValue(event));
      appendCell(row, event.lifecycle.replace(/_/g, ' '));
      appendCell(row, event.quality);
      appendCell(row, event.event + ' / ' + event.action);
      appendCell(row, '', 'rz-ops-actions-cell').appendChild(alarmDetailButton(event, index));
      body.appendChild(row);
    });
  }

  function renderAlarmSummary(records, firstOut) {
    var critical = records.filter(function (item) { return item.severity === 'critical'; }).length;
    var active = records.filter(function (item) { return item.lifecycle.indexOf('active_') === 0; }).length;
    var simulated = records.filter(function (item) { return item.quality === 'simulated'; }).length;
    text('alarmResultCount', records.length);
    text('alarmCriticalCount', critical);
    text('alarmActiveCount', active);
    text('alarmFirstOutCount', firstOut.length);
    text('alarmSimulatedCount', simulated);
  }

  function idLookup(ids) {
    var lookup = Object.create(null);
    ids.forEach(function (id) { lookup[id] = true; });
    return lookup;
  }

  function alarmQuerySnapshot(filter) {
    var result = alarmApi.query(alarmEvents, filter);
    var prepared = alarmApi.prepareExport(alarmEvents, filter, {
      format: 'csv', generatedAt: new Date().toISOString(), requestedBy: 'DC AI operator'
    });
    var firstIds = idLookup(prepared.metadata.firstOutIds);
    var firstOut = result.records.filter(function (item) { return firstIds[item.id]; });
    return { result: result, prepared: prepared, firstIds: firstIds, firstOut: firstOut };
  }

  function setAlarmQueryState(state) {
    var valid = state === 'ready';
    var form = byId('alarmFilterForm');
    var status = byId('alarmQueryStatus');
    var exportButton = byId('alarmExport');
    text('alarmQueryStatus', valid ? 'READY' : 'INVALID');
    form.setAttribute('data-query-state', state);
    form.setAttribute('aria-invalid', String(!valid));
    status.setAttribute('data-state', state);
    exportButton.disabled = !valid;
  }

  function renderAlarmError(error) {
    var detail = byId('alarmDetail');
    renderAlarmRows([], Object.create(null));
    renderAlarmSummary([], []);
    setAlarmQueryState('invalid');
    clear(detail);
    detail.appendChild(node('div', 'rz-ops-eyebrow', 'Filter error'));
    detail.appendChild(node('p', 'rz-ops-caption', error && error.message ? error.message : String(error)));
  }

  function runAlarmQuery() {
    try {
      var filter = buildAlarmFilter();
      var snapshot = alarmQuerySnapshot(filter);
      var records = firstOutOnly ? snapshot.firstOut : snapshot.result.records;
      renderAlarmRows(records, snapshot.firstIds);
      renderAlarmSummary(snapshot.result.records, snapshot.firstOut);
      setAlarmQueryState('ready');
    } catch (error) {
      renderAlarmError(error);
    }
  }

  function rowActivation(event) {
    var button = event.target.closest('button[data-alarm-index]');
    var row;
    if (!button) { return; }
    row = button.closest('tr');
    Array.prototype.forEach.call(row.parentNode.children, function (item) { item.setAttribute('aria-selected', 'false'); });
    row.setAttribute('aria-selected', 'true');
    showAlarmDetail(alarmRows[Number(button.getAttribute('data-alarm-index'))]);
  }

  function csvCell(value) {
    var output = String(value === undefined ? '' : value);
    if (/^[\t\r\n ]*[=+\-@]/.test(output)) { output = "'" + output; }
    return '"' + output.replace(/"/g, '""') + '"';
  }

  function exportAlarmCsv() {
    try {
      var exportButton = byId('alarmExport');
      var snapshot;
      var prepared;
      var records;
      if (exportButton.disabled) { return; }
      snapshot = alarmQuerySnapshot(buildAlarmFilter());
      prepared = snapshot.prepared;
      records = firstOutOnly ? snapshot.firstOut : snapshot.result.records;
      var fields = prepared.metadata.fields;
      var lines = [fields.map(csvCell).join(',')];
      records.forEach(function (record) {
        lines.push(fields.map(function (field) { return csvCell(record[field]); }).join(','));
      });
      var url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' }));
      var link = node('a');
      link.href = url;
      link.download = prepared.metadata.fileName;
      link.click();
      setTimeout(function () { URL.revokeObjectURL(url); }, 0);
    } catch (error) {
      text('alarmQueryStatus', 'EXPORT ERROR');
    }
  }

  function wireAlarms() {
    if (!alarmApi || !byId('alarmFilterForm')) { return; }
    byId('alarmFilterForm').addEventListener('submit', function (event) { event.preventDefault(); runAlarmQuery(); });
    byId('alarmFilterForm').addEventListener('reset', function () {
      setTimeout(function () { firstOutOnly = false; byId('alarmFirstOut').setAttribute('aria-pressed', 'false'); runAlarmQuery(); }, 0);
    });
    byId('alarmSavedView').addEventListener('change', function () {
      firstOutOnly = this.value === 'critical-first-out';
      byId('alarmFirstOut').setAttribute('aria-pressed', String(firstOutOnly));
      runAlarmQuery();
    });
    byId('alarmFirstOut').addEventListener('click', function () {
      firstOutOnly = !firstOutOnly;
      this.setAttribute('aria-pressed', String(firstOutOnly));
      runAlarmQuery();
    });
    byId('alarmExport').addEventListener('click', exportAlarmCsv);
    byId('alarmResultsBody').addEventListener('click', rowActivation);
    runAlarmQuery();
  }

  function platformRow(values) {
    var row = node('tr');
    values.forEach(function (value) { appendCell(row, value); });
    return row;
  }

  function renderDensity() {
    if (!densityApi || !byId('platformProfile')) { return; }
    var baseline = densityApi.getBaseline();
    var selected = byId('platformProfile').value;
    var study = selected === 'locked' ? null : densityApi.studyReference(selected);
    var body = byId('platformComparisonBody');
    clear(body);
    body.appendChild(platformRow([
      baseline.architectureName + ' — locked', baseline.status,
      baseline.logicalDomainsPerHall + ' domains × ' + baseline.rackPositionsPerDomain + ' positions',
      formatNumber(baseline.rackPositionKW, 0), baseline.rackPositionsPerHall,
      formatNumber(baseline.itPerHallKW / 1000, 3), formatNumber(baseline.hallItDensityKWPerM2, 2)
    ]));
    if (study) {
      body.appendChild(platformRow([
        study.reference.name, study.adoptionStatus,
        study.logicalDomainsPerHall + ' domains × ' + study.rackPositionsPerDomain + ' rack',
        formatNumber(study.rackPositionKW, 0), study.rackPositionsPerHall,
        formatNumber(study.itPerHallKW / 1000, 3), formatNumber(study.hallItDensityKWPerM2, 2)
      ]));
    }
    var detail = byId('platformStudyDetail');
    clear(detail);
    detail.appendChild(node('div', 'rz-ops-eyebrow', study ? 'Reference study — no baseline mutation' : 'Locked project basis'));
    detail.appendChild(node('p', 'rz-ops-caption', study ?
      study.reference.name + ': ' + formatNumber(study.itPerFacilityKW / 1000, 3) + ' MW facility IT; ' +
      formatNumber(study.deltaVsBaselinePct, 1) + '% per-hall delta. Engineer-of-Record confirmation required.' :
      baseline.basis + '. Select a reference to compare without changing live calculations.'));
  }

  function activeElectricalScope() {
    var activeTab = document.querySelector('#elecTabs .et.on');
    return electricalVisualApi.normalizeScope(activeTab ? activeTab.getAttribute('data-ep') : 'dh01');
  }

  function lineDescriptor(line) {
    return {
      lineId: line.getAttribute('data-id'),
      hall: line.getAttribute('data-hall') || undefined,
      edgeId: line.getAttribute('data-topology-edge') || undefined,
      edgePrefix: line.getAttribute('data-topology-prefix') || undefined
    };
  }

  function paintElectricalLines(result, scope) {
    Array.prototype.forEach.call(document.querySelectorAll('#p-elec [data-rz-line]'), function (line) {
      var projection = electricalVisualApi.projectLine(lineDescriptor(line), result, scope);
      line.classList.toggle('rz-flow-active', projection.active);
      line.classList.toggle('rz-flow-inactive', !projection.active);
      line.classList.toggle('rz-flow-partial', projection.partial);
      line.setAttribute('data-energized', String(projection.active));
      line.setAttribute('data-semantic-state', projection.semanticState);
      line.setAttribute('data-source-ids', projection.sourceIds.join(' '));
      line.setAttribute('data-topology-edge-ids', projection.edgeIds.join(' '));
    });
  }

  function renderElectrical() {
    if (!electricalApi || !electricalVisualApi || !byId('electricalScenario')) { return; }
    try {
      var result = electricalApi.evaluateScenario(byId('electricalScenario').value);
      var scope = activeElectricalScope();
      var counts = electricalVisualApi.hallCounts(result.racks, scope);
      var scopeLabel = scope === 'overview' ? 'Facility overview · 4 hall instances' : scope.toUpperCase().replace('DH0', 'DH-0');
      var summary = byId('electricalPathSummary');
      clear(summary);
      summary.appendChild(node('div', 'rz-ops-eyebrow', result.health + ' · ' + scopeLabel + ' · ' + result.scenarioLabel));
      summary.appendChild(node('p', 'rz-ops-caption', counts.available + '/' + counts.total + ' racks served · ' +
        counts.twoN + ' at 2N · ' + counts.degraded + ' degraded · ' + counts.lost + ' lost'));
      var timeline = byId('electricalTimeline');
      clear(timeline);
      result.timeline.forEach(function (event) {
        timeline.appendChild(node('li', '', 'T+' + event.offsetSeconds + 's · ' + event.code + ' · ' + event.message));
      });
      paintElectricalLines(result, scope);
    } catch (error) {
      text('electricalPathSummary', 'Topology evaluation failed: ' + error.message);
      paintElectricalLines({ edges: [] }, activeElectricalScope());
    }
  }

  function fireRow(rowItem, outputItem) {
    var row = node('tr');
    row.setAttribute('data-fire-event', rowItem.initiatingEvent.id);
    appendCell(row, rowItem.stage);
    appendCell(row, rowItem.initiatingEvent.label);
    appendCell(row, rowItem.delaySeconds + ' s');
    appendCell(row, outputItem.system + ' / ' + outputItem.action);
    appendCell(row, outputItem.scope);
    appendCell(row, outputItem.authority + ' · ' + outputItem.commandType);
    appendCell(row, outputItem.requiredFeedback.join(', '));
    appendCell(row, rowItem.failureState.join(', '));
    appendCell(row, (rowItem.overrideInhibit.allowed ? 'Authorized inhibit' : 'No inhibit') + ' / ' + rowItem.resetAuthority);
    return row;
  }

  function renderFireTable() {
    var body = byId('fireCauseEffectBody');
    clear(body);
    fireApi.BASE_ROWS.forEach(function (rowItem) {
      rowItem.outputs.forEach(function (outputItem) { body.appendChild(fireRow(rowItem, outputItem)); });
    });
  }

  function evaluateFire() {
    if (!fireApi) { return; }
    try {
      var eventId = byId('fireScenario').value;
      var result = fireApi.evaluateEvent({ eventId: eventId, zoneId: byId('fireZone').value, elapsedSeconds: 0 });
      Array.prototype.forEach.call(byId('fireCauseEffectBody').children, function (row) {
        row.setAttribute('aria-selected', String(row.getAttribute('data-fire-event') === eventId));
      });
      text('fireCauseEffectSummary', 'Stage ' + result.stage + ' · FACP authority · ' + result.commands.length +
        ' commands due now · ' + result.pending.length + ' pending by engineered delay · BMS monitor-only.');
    } catch (error) {
      text('fireCauseEffectSummary', 'Cause-and-effect evaluation failed: ' + error.message);
    }
  }

  function wireFire() {
    if (!fireApi || !byId('fireCauseEffectBody')) { return; }
    renderFireTable();
    byId('fireEvaluate').addEventListener('click', evaluateFire);
    byId('fireScenario').addEventListener('change', evaluateFire);
    byId('fireZone').addEventListener('change', evaluateFire);
    evaluateFire();
  }

  function initialize() {
    wireAlarms();
    if (densityApi && byId('platformProfile')) {
      byId('platformProfile').addEventListener('change', renderDensity);
      renderDensity();
    }
    if (electricalApi && electricalVisualApi && byId('electricalScenario')) {
      byId('electricalScenario').addEventListener('change', renderElectrical);
      byId('elecTabs').addEventListener('click', function (event) {
        if (event.target.closest('button[data-ep]')) { setTimeout(renderElectrical, 0); }
      });
      renderElectrical();
    }
    wireFire();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
}(typeof window !== 'undefined' ? window : globalThis));
