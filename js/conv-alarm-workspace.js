/* Conventional DC read-only alarm historian UI. Depends on alarm-query.js + conv-alarm-events.js. */
(function (root) {
  'use strict';

  var queryApi = root.RZDataHallAlarmQuery;
  var eventApi = root.RZConvAlarmEvents;
  var previousFocus = null;
  var previousOverflow = '';
  var filteredRecords = [];
  var backgroundState = [];

  function byId(id) { return document.getElementById(id); }

  function node(tag, className, value) {
    var item = document.createElement(tag);
    if (className) { item.className = className; }
    if (value !== undefined) { item.textContent = String(value); }
    return item;
  }

  function option(value, label) {
    var item = node('option', '', label);
    item.value = value;
    return item;
  }

  function appendOptions(select, values) {
    var i;
    for (i = 0; i < values.length; i++) { select.appendChild(option(values[i][0], values[i][1])); }
  }

  function fieldShell(id, label, wide) {
    var shell = node('div', 'rz-conv-alarm-field' + (wide ? ' rz-conv-alarm-field--wide' : ''));
    var caption = node('label', '', label);
    caption.htmlFor = id;
    shell.appendChild(caption);
    return shell;
  }

  function inputField(id, label, type, wide, attributes) {
    var shell = fieldShell(id, label, wide);
    var input = node('input');
    var keys = Object.keys(attributes || {});
    var i;
    input.id = id;
    input.name = id;
    input.type = type;
    for (i = 0; i < keys.length; i++) { input.setAttribute(keys[i], attributes[keys[i]]); }
    shell.appendChild(input);
    return shell;
  }

  function selectField(id, label, values, wide) {
    var shell = fieldShell(id, label, wide);
    var select = node('select');
    select.id = id;
    select.name = id;
    appendOptions(select, values);
    shell.appendChild(select);
    return shell;
  }

  function button(label, className) {
    var item = node('button', className, label);
    item.type = 'button';
    return item;
  }

  function selectValues() {
    return {
      systems: [['', 'All systems']].concat(eventApi.systems.map(function (name) { return [name, name]; })),
      severity: [['', 'All severities'], ['critical', 'Critical'], ['high', 'High'], ['medium', 'Medium'], ['low', 'Low'], ['info', 'Info']],
      lifecycle: [['', 'All lifecycle states'], ['active_unack', 'Active / unacknowledged'], ['active_ack', 'Active / acknowledged'], ['returned_unack', 'Returned / unacknowledged'], ['returned_ack', 'Returned / acknowledged'], ['shelved', 'Shelved'], ['suppressed', 'Suppressed'], ['inhibited', 'Inhibited'], ['out_of_service', 'Out of service'], ['maintenance', 'Maintenance'], ['normal', 'Normal']],
      quality: [['', 'All qualities'], ['good', 'Good'], ['simulated', 'Simulated'], ['uncertain', 'Uncertain'], ['bad', 'Bad'], ['stale', 'Stale'], ['manual', 'Manual'], ['substituted', 'Substituted'], ['comms_loss', 'Comms loss']],
      comparator: [['', 'No value filter'], ['gt', '> greater than'], ['gte', '>= at least'], ['eq', '= equal'], ['ne', '!= not equal'], ['lte', '<= at most'], ['lt', '< less than']]
    };
  }

  function createFilterForm() {
    var values = selectValues();
    var form = node('form', 'rz-conv-alarm-filter');
    var actions = node('div', 'rz-conv-alarm-actions');
    var run = button('Run query', 'rz-conv-alarm-button rz-conv-alarm-button--primary');
    var reset = button('Reset', 'rz-conv-alarm-button');
    var exportButton = button('Export CSV', 'rz-conv-alarm-button');
    var status = node('output', 'rz-conv-alarm-status', 'READY');
    form.id = 'rzConvAlarmFilter';
    form.appendChild(inputField('rzConvAlarmFrom', 'From date', 'date'));
    form.appendChild(inputField('rzConvAlarmTo', 'To date', 'date'));
    form.appendChild(selectField('rzConvAlarmSystem', 'System', values.systems));
    form.appendChild(inputField('rzConvAlarmPoint', 'Point / tag', 'search', false, { list: 'rzConvAlarmPoints', placeholder: 'e.g. CHWP-02' }));
    form.appendChild(selectField('rzConvAlarmSeverity', 'Severity', values.severity));
    form.appendChild(selectField('rzConvAlarmLifecycle', 'Lifecycle / state', values.lifecycle));
    form.appendChild(selectField('rzConvAlarmQuality', 'Quality', values.quality));
    form.appendChild(inputField('rzConvAlarmEvent', 'Event type', 'search', false, { placeholder: 'e.g. fuel-leak' }));
    form.appendChild(inputField('rzConvAlarmAction', 'Action', 'search', false, { placeholder: 'e.g. isolate' }));
    form.appendChild(selectField('rzConvAlarmComparator', 'Value comparator', values.comparator));
    form.appendChild(inputField('rzConvAlarmValue', 'Analog value', 'number', false, { step: 'any', inputmode: 'decimal' }));
    form.appendChild(inputField('rzConvAlarmPrevious', 'Previous state', 'search'));
    form.appendChild(inputField('rzConvAlarmCurrent', 'Current state', 'search'));
    form.appendChild(inputField('rzConvAlarmText', 'Message / source search', 'search', true, { placeholder: 'Search message, asset, source, action or event' }));
    run.id = 'rzConvAlarmRun';
    reset.id = 'rzConvAlarmReset';
    exportButton.id = 'rzConvAlarmExport';
    status.id = 'rzConvAlarmStatus';
    status.setAttribute('aria-live', 'polite');
    status.setAttribute('data-state', 'ready');
    actions.appendChild(run);
    actions.appendChild(reset);
    actions.appendChild(exportButton);
    actions.appendChild(status);
    form.appendChild(actions);
    return form;
  }

  function createPointList() {
    var list = node('datalist');
    var values = Object.create(null);
    list.id = 'rzConvAlarmPoints';
    eventApi.EVENTS.forEach(function (event) {
      values[event.point] = true;
      values[event.tag] = true;
    });
    Object.keys(values).sort().forEach(function (value) { list.appendChild(option(value, value)); });
    return list;
  }

  function createResultTable() {
    var wrapper = node('div', 'rz-conv-alarm-result');
    var table = node('table', 'rz-conv-alarm-table');
    var caption = node('caption', '', 'Conventional DC alarm and event historian results');
    var head = node('thead');
    var row = node('tr');
    var body = node('tbody');
    caption.className = 'rz-conv-alarm-visually-hidden';
    ['Timestamp', 'Severity', 'System / location', 'Point / tag', 'Value / transition', 'Lifecycle at capture', 'Quality', 'Event / action', 'Message'].forEach(function (label) {
      var heading = node('th', '', label);
      heading.scope = 'col';
      row.appendChild(heading);
    });
    head.appendChild(row);
    body.id = 'rzConvAlarmRows';
    table.appendChild(caption);
    table.appendChild(head);
    table.appendChild(body);
    wrapper.appendChild(table);
    return wrapper;
  }

  function createDialog() {
    var scrim = node('div', 'rz-conv-alarm-scrim');
    var dialog = node('section', 'rz-conv-alarm-dialog');
    var head = node('div', 'rz-conv-alarm-head');
    var titleGroup = node('div');
    var title = node('h2', 'rz-conv-alarm-title', 'Alarm & Event History');
    var close = button('Close', 'rz-conv-alarm-close');
    var foot = node('footer', 'rz-conv-alarm-foot');
    var summary = node('div', 'rz-conv-alarm-summary');
    scrim.id = 'rzConvAlarmScrim';
    scrim.hidden = true;
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'rzConvAlarmTitle');
    title.id = 'rzConvAlarmTitle';
    close.id = 'rzConvAlarmClose';
    titleGroup.appendChild(title);
    titleGroup.appendChild(node('p', 'rz-conv-alarm-subtitle', 'Read-only historian training snapshot · lifecycle is state at capture, not the live alarm strip · no commands'));
    head.appendChild(titleGroup);
    head.appendChild(close);
    summary.id = 'rzConvAlarmSummary';
    foot.appendChild(summary);
    foot.appendChild(node('span', '', 'SIMULATED HISTORIAN FIXTURE · run CONV-20260827 · independent from current live alarm state'));
    dialog.appendChild(head);
    dialog.appendChild(createFilterForm());
    dialog.appendChild(createResultTable());
    dialog.appendChild(foot);
    scrim.appendChild(dialog);
    scrim.appendChild(createPointList());
    return scrim;
  }

  function readInput(id) {
    var target = byId(id);
    return target ? target.value : '';
  }

  function filterInput() {
    return {
      from: readInput('rzConvAlarmFrom'),
      to: readInput('rzConvAlarmTo'),
      system: readInput('rzConvAlarmSystem'),
      point: readInput('rzConvAlarmPoint'),
      severity: readInput('rzConvAlarmSeverity'),
      lifecycle: readInput('rzConvAlarmLifecycle'),
      quality: readInput('rzConvAlarmQuality'),
      event: readInput('rzConvAlarmEvent'),
      action: readInput('rzConvAlarmAction'),
      comparator: readInput('rzConvAlarmComparator'),
      value: readInput('rzConvAlarmValue'),
      previousState: readInput('rzConvAlarmPrevious'),
      currentState: readInput('rzConvAlarmCurrent'),
      text: readInput('rzConvAlarmText')
    };
  }

  function textCell(row, value) {
    var cell = node('td', '', value);
    row.appendChild(cell);
    return cell;
  }

  function displayValue(event) {
    if (event.kind === 'analog') { return Number(event.value).toLocaleString('en-US') + ' ' + event.unit; }
    if (event.kind === 'discrete') { return event.previousState + ' -> ' + event.currentState; }
    return event.currentState || event.event;
  }

  function renderRow(event) {
    var row = node('tr');
    var badge = node('span', 'rz-conv-alarm-severity', event.severity);
    badge.setAttribute('data-severity', event.severity);
    textCell(row, event.timestamp.replace('T', ' ').replace('.000Z', 'Z'));
    textCell(row, '').appendChild(badge);
    textCell(row, event.system + ' / ' + event.location);
    textCell(row, event.point + ' / ' + event.tag);
    textCell(row, displayValue(event));
    textCell(row, event.lifecycle.replace(/_/g, ' '));
    textCell(row, event.quality);
    textCell(row, event.event + ' / ' + event.action);
    textCell(row, event.message);
    return row;
  }

  function summaryText(records, filter) {
    var active = records.filter(function (event) { return event.lifecycle.indexOf('active_') === 0; }).length;
    var critical = records.filter(function (event) { return event.severity === 'critical' || event.severity === 'high'; }).length;
    var scope = filter.system || 'all systems';
    return records.length + ' record(s) · ' + active + ' active-at-capture · '
      + critical + ' critical/high · scope ' + scope;
  }

  function render(records, filter) {
    var body = byId('rzConvAlarmRows');
    var summary = byId('rzConvAlarmSummary');
    while (body.firstChild) { body.removeChild(body.firstChild); }
    filteredRecords = records.slice();
    if (!records.length) {
      var emptyRow = node('tr');
      var empty = node('td', 'rz-conv-alarm-empty', 'No records match the active filter. Adjust or reset the query.');
      empty.colSpan = 9;
      emptyRow.appendChild(empty);
      body.appendChild(emptyRow);
    } else {
      records.slice().reverse().forEach(function (event) { body.appendChild(renderRow(event)); });
    }
    summary.textContent = summaryText(records, filter);
  }

  function setStatus(message, state) {
    var status = byId('rzConvAlarmStatus');
    status.textContent = message;
    status.setAttribute('data-state', state);
  }

  function runQuery() {
    try {
      var filter = eventApi.buildFilter(filterInput());
      var result = queryApi.query(eventApi.EVENTS, filter);
      render(result.records, filter);
      setStatus('READY · ' + result.total + ' result(s)', 'ready');
      return { filter: filter, records: result.records };
    } catch (error) {
      render([], {});
      setStatus(error && error.message ? error.message : String(error), 'invalid');
      return null;
    }
  }

  function csvCell(value) {
    var output = String(value === undefined ? '' : value);
    if (/^[\t\r\n ]*[=+\-@]/.test(output)) { output = "'" + output; }
    return '"' + output.replace(/"/g, '""') + '"';
  }

  function downloadCsv() {
    var snapshot = runQuery();
    var prepared;
    var lines;
    var url;
    var link;
    if (!snapshot) { return; }
    prepared = queryApi.prepareExport(eventApi.EVENTS, snapshot.filter, {
      format: 'csv', generatedAt: new Date().toISOString(),
      requestedBy: 'Conventional DC operator', fileStem: 'conventional-alarm-history'
    });
    lines = [prepared.metadata.fields.map(csvCell).join(',')];
    prepared.records.forEach(function (record) {
      lines.push(prepared.metadata.fields.map(function (field) { return csvCell(record[field]); }).join(','));
    });
    url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' }));
    link = node('a');
    link.href = url;
    link.download = prepared.metadata.fileName;
    link.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 0);
  }

  function defaultSystem() { return eventApi.systemForPath(root.location.pathname); }

  function resetFilter() {
    byId('rzConvAlarmFilter').reset();
    byId('rzConvAlarmSystem').value = defaultSystem() || '';
    runQuery();
  }

  function focusableElements() {
    return Array.prototype.slice.call(byId('rzConvAlarmScrim').querySelectorAll(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
    ));
  }

  function setBackgroundInert(active) {
    var scrim = byId('rzConvAlarmScrim');
    if (active) {
      if (backgroundState.length) { return; }
      backgroundState = Array.prototype.slice.call(document.body.children)
        .filter(function (item) { return item !== scrim; })
        .map(function (item) {
          var state = {
            item: item,
            hadInert: item.hasAttribute('inert'),
            ariaHidden: item.getAttribute('aria-hidden')
          };
          item.setAttribute('inert', '');
          item.setAttribute('aria-hidden', 'true');
          return state;
        });
      return;
    }
    backgroundState.forEach(function (state) {
      if (!state.hadInert) { state.item.removeAttribute('inert'); }
      if (state.ariaHidden === null) { state.item.removeAttribute('aria-hidden'); }
      else { state.item.setAttribute('aria-hidden', state.ariaHidden); }
    });
    backgroundState = [];
  }

  function closeWorkspace() {
    var scrim = byId('rzConvAlarmScrim');
    if (!scrim || scrim.hidden) { return; }
    scrim.hidden = true;
    document.documentElement.style.overflow = previousOverflow;
    setBackgroundInert(false);
    if (previousFocus && typeof previousFocus.focus === 'function') { previousFocus.focus(); }
  }

  function openWorkspace() {
    var scrim = byId('rzConvAlarmScrim');
    previousFocus = document.activeElement;
    previousOverflow = document.documentElement.style.overflow;
    scrim.hidden = false;
    document.documentElement.style.overflow = 'hidden';
    setBackgroundInert(true);
    byId('rzConvAlarmSystem').value = defaultSystem() || '';
    runQuery();
    byId('rzConvAlarmClose').focus();
  }

  function keyHandler(event) {
    var items;
    var first;
    var last;
    if (byId('rzConvAlarmScrim').hidden) { return; }
    if (event.key === 'Escape') { event.preventDefault(); closeWorkspace(); return; }
    if (event.key !== 'Tab') { return; }
    items = focusableElements();
    first = items[0];
    last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  function createLaunch() {
    var launch = button('Alarm history', 'rz-conv-alarm-launch');
    var target = document.querySelector('[data-rz-alarm-launch-slot]')
      || document.querySelector('.topbar, .top-bar, .header-controls, .header-actions, .nav-actions, .header-right');
    launch.id = 'rzConvAlarmLaunch';
    launch.setAttribute('aria-haspopup', 'dialog');
    if (target) { target.appendChild(launch); }
    else { launch.className += ' rz-conv-alarm-launch--fallback'; document.body.appendChild(launch); }
    return launch;
  }

  function wire() {
    byId('rzConvAlarmLaunch').addEventListener('click', openWorkspace);
    byId('rzConvAlarmClose').addEventListener('click', closeWorkspace);
    byId('rzConvAlarmFilter').addEventListener('submit', function (event) { event.preventDefault(); runQuery(); });
    byId('rzConvAlarmRun').addEventListener('click', runQuery);
    byId('rzConvAlarmReset').addEventListener('click', resetFilter);
    byId('rzConvAlarmExport').addEventListener('click', downloadCsv);
    byId('rzConvAlarmScrim').addEventListener('mousedown', function (event) {
      if (event.target === this) { closeWorkspace(); }
    });
    document.addEventListener('keydown', keyHandler);
  }

  function initialize() {
    if (!queryApi || !eventApi || byId('rzConvAlarmScrim')) { return false; }
    if (!eventApi.supportsPath(root.location.pathname)) { return false; }
    document.body.appendChild(createDialog());
    createLaunch();
    wire();
    resetFilter();
    return true;
  }

  var API = Object.freeze({ initialize: initialize, open: openWorkspace, close: closeWorkspace, version: '1.0.0' });
  root.RZConvAlarmWorkspace = API;
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', initialize); }
  else { initialize(); }
}(typeof window !== 'undefined' ? window : globalThis));
