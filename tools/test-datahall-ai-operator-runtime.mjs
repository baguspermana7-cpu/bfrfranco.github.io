import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const AlarmQuery = require('../js/datahall-ai/alarm-query.js');
const operatorSource = await readFile(new URL('../js/datahall-ai/operator-ui.js', import.meta.url), 'utf8');

class FakeClassList {
  constructor() { this.values = new Set(); }
  toggle(name, force) {
    if (force === false) { this.values.delete(name); return false; }
    if (force === true) { this.values.add(name); return true; }
    if (this.values.has(name)) { this.values.delete(name); return false; }
    this.values.add(name);
    return true;
  }
}

class FakeElement {
  constructor(tagName, ownerDocument) {
    this.tagName = String(tagName).toUpperCase();
    this.ownerDocument = ownerDocument;
    this.attributes = Object.create(null);
    this.children = [];
    this.listeners = Object.create(null);
    this.parentNode = null;
    this.classList = new FakeClassList();
    this.className = '';
    this.value = '';
    this.disabled = false;
    this.type = '';
    this.href = '';
    this.download = '';
    this._text = '';
  }

  get firstChild() { return this.children[0] || null; }
  get textContent() { return this._text + this.children.map((child) => child.textContent).join(''); }
  set textContent(value) { this._text = String(value); this.children = []; }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index >= 0) { this.children.splice(index, 1); }
    child.parentNode = null;
    return child;
  }

  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null; }
  removeAttribute(name) { delete this.attributes[name]; }

  addEventListener(type, listener) {
    if (!this.listeners[type]) { this.listeners[type] = []; }
    this.listeners[type].push(listener);
  }

  dispatch(type, values = {}) {
    const event = {
      type,
      target: this,
      key: '',
      defaultPrevented: false,
      preventDefault() { this.defaultPrevented = true; },
      ...values,
    };
    (this.listeners[type] || []).forEach((listener) => listener.call(this, event));
    return event;
  }

  click() { this.dispatch('click'); }
  focus() { this.ownerDocument.activeElement = this; }

  closest(selector) {
    let current = this;
    while (current) {
      if (selector === 'button[data-alarm-index]' && current.tagName === 'BUTTON' && current.getAttribute('data-alarm-index') !== null) {
        return current;
      }
      if (selector === 'tr' && current.tagName === 'TR') { return current; }
      current = current.parentNode;
    }
    return null;
  }
}

function createDocument() {
  const elements = Object.create(null);
  const document = {
    readyState: 'complete',
    activeElement: null,
    createElement(tagName) { return new FakeElement(tagName, document); },
    getElementById(id) { return elements[id] || null; },
    querySelectorAll() { return []; },
    addEventListener() {},
  };
  const add = (id, tagName = 'div') => {
    elements[id] = new FakeElement(tagName, document);
    return elements[id];
  };

  add('alarmFilterForm', 'form');
  add('alarmSavedView', 'select');
  add('alarmFirstOut', 'button');
  add('alarmExport', 'button');
  add('alarmResultsBody', 'tbody');
  add('alarmDetail');
  add('alarmQueryStatus');
  add('alarmResultCount');
  add('alarmCriticalCount');
  add('alarmActiveCount');
  add('alarmFirstOutCount');
  add('alarmSimulatedCount');

  for (const id of [
    'alarmFrom', 'alarmTo', 'alarmPoint', 'alarmSystem', 'alarmSeverity',
    'alarmLifecycle', 'alarmQuality', 'alarmComparator', 'alarmValue',
    'alarmStateFrom', 'alarmStateTo', 'alarmEventType', 'alarmAction', 'alarmText',
  ]) {
    add(id, 'input');
  }

  for (const [id, value] of [
    ['bmsAlmActive', 'LIVE ACTIVE'],
    ['bmsAlmAck', 'LIVE ACK'],
    ['bmsAlmCleared', 'LIVE CLEARED'],
  ]) {
    add(id).textContent = value;
  }
  return { document, elements };
}

function fixtureWithFormulaPrefixes() {
  return AlarmQuery.createFixture().map((event, index) => Object.freeze(index === 0 ? {
    ...event,
    tag: '=TAG',
    point: '+POINT',
    message: '-FORMULA',
    operator: '@USER',
  } : { ...event }));
}

function loadRuntime() {
  const { document, elements } = createDocument();
  let exportedBlob = null;
  const runtimeAlarmApi = Object.freeze({
    ...AlarmQuery,
    createFixture: fixtureWithFormulaPrefixes,
  });
  const sandbox = {
    Blob,
    Date,
    URL: {
      createObjectURL(blob) { exportedBlob = blob; return 'blob:alarm-export'; },
      revokeObjectURL() {},
    },
    document,
    isNaN,
    RZDataHallAlarmQuery: runtimeAlarmApi,
    setTimeout(callback) { callback(); return 1; },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(operatorSource, sandbox, { filename: 'operator-ui.js' });
  return { document, elements, exportedBlob: () => exportedBlob };
}

test('alarm history owns only local KPIs and uses native action buttons', () => {
  const { elements } = loadRuntime();
  assert.equal(elements.bmsAlmActive.textContent, 'LIVE ACTIVE');
  assert.equal(elements.bmsAlmAck.textContent, 'LIVE ACK');
  assert.equal(elements.bmsAlmCleared.textContent, 'LIVE CLEARED');
  assert.equal(elements.alarmResultsBody.children.length, 6);

  const row = elements.alarmResultsBody.children[0];
  assert.equal(row.getAttribute('role'), null);
  assert.equal(row.getAttribute('tabindex'), null);
  const action = row.children.at(-1).children[0];
  assert.equal(action.tagName, 'BUTTON');
  assert.equal(action.type, 'button');
  assert.equal(action.textContent, 'View details');

  elements.alarmResultsBody.dispatch('click', { target: action });
  assert.equal(row.getAttribute('aria-selected'), 'true');
  assert.match(elements.alarmDetail.textContent, /Record detail/);
});

test('invalid alarm query clears stale state and disables export until recovery', () => {
  const { elements } = loadRuntime();
  elements.alarmFrom.value = 'not-a-date';
  elements.alarmFilterForm.dispatch('submit');

  assert.equal(elements.alarmResultsBody.children.length, 0);
  for (const id of [
    'alarmResultCount', 'alarmCriticalCount', 'alarmActiveCount',
    'alarmFirstOutCount', 'alarmSimulatedCount',
  ]) {
    assert.equal(elements[id].textContent, '0', `${id} must clear`);
  }
  assert.equal(elements.alarmQueryStatus.textContent, 'INVALID');
  assert.equal(elements.alarmQueryStatus.getAttribute('data-state'), 'invalid');
  assert.equal(elements.alarmFilterForm.getAttribute('data-query-state'), 'invalid');
  assert.equal(elements.alarmExport.disabled, true);
  assert.match(elements.alarmDetail.textContent, /Filter error/);

  elements.alarmFrom.value = '';
  elements.alarmFilterForm.dispatch('submit');
  assert.equal(elements.alarmQueryStatus.textContent, 'READY');
  assert.equal(elements.alarmExport.disabled, false);
  assert.equal(elements.alarmResultsBody.children.length, 6);
});

test('FIRST badges, first-out view, and export use source provenance', async () => {
  const runtime = loadRuntime();
  const { elements } = runtime;
  elements.alarmLifecycle.value = 'active_ack';
  elements.alarmFilterForm.dispatch('submit');

  assert.equal(elements.alarmResultsBody.children.length, 1);
  assert.equal(elements.alarmResultsBody.children[0].children[1].textContent, '—');
  assert.equal(elements.alarmFirstOutCount.textContent, '0');

  elements.alarmFirstOut.click();
  assert.equal(elements.alarmResultsBody.children.length, 0);
  elements.alarmExport.click();
  const csv = await runtime.exportedBlob().text();
  assert.equal(csv.split('\n').length, 1, 'first-out-only export must exclude non-source-first records');
});

test('CSV neutralizes spreadsheet formula prefixes', async () => {
  const runtime = loadRuntime();
  runtime.elements.alarmExport.click();
  const csv = await runtime.exportedBlob().text();
  for (const neutralized of ["'=TAG", "'+POINT", "'-FORMULA", "'@USER"]) {
    assert.ok(csv.includes(neutralized), `CSV must neutralize ${neutralized.slice(1)}`);
  }
});
