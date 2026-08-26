import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);

class FakeElement {
  constructor(tagName) {
    this.tagName = String(tagName).toUpperCase();
    this.attributes = Object.create(null);
    this.children = [];
    this.className = '';
    this.disabled = false;
    this.id = '';
    this.listeners = Object.create(null);
    this.parentNode = null;
    this.style = Object.create(null);
    this.textContent = '';
    this.value = '';
  }

  get firstChild() { return this.children[0] || null; }
  get options() { return this.tagName === 'SELECT' ? this.children : []; }

  addEventListener(name, handler) { this.listeners[name] = handler; }
  appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
  focus() { global.document.activeElement = this; }
  getAttribute(name) { return Object.hasOwn(this.attributes, name) ? this.attributes[name] : null; }
  hasAttribute(name) { return Object.hasOwn(this.attributes, name); }
  removeAttribute(name) { delete this.attributes[name]; }
  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index >= 0) { this.children.splice(index, 1); child.parentNode = null; }
    return child;
  }
  setAttribute(name, value) { this.attributes[name] = String(value); }

  querySelectorAll(selector) {
    const descendants = [];
    const visit = (node) => {
      node.children.forEach((child) => { descendants.push(child); visit(child); });
    };
    visit(this);
    if (selector === 'h3') { return descendants.filter((node) => node.tagName === 'H3'); }
    if (selector.includes('button:not([disabled])')) {
      return descendants.filter((node) => {
        if (node.disabled) { return false; }
        return ['BUTTON', 'SELECT', 'INPUT', 'TEXTAREA', 'A'].includes(node.tagName);
      });
    }
    return [];
  }
}

function findByClass(root, className) {
  if (String(root.className).split(/\s+/).includes(className)) { return root; }
  for (const child of root.children) {
    const found = findByClass(child, className);
    if (found) { return found; }
  }
  return null;
}

function walk(root, predicate) {
  if (predicate(root)) { return root; }
  for (const child of root.children) {
    const match = walk(child, predicate);
    if (match) { return match; }
  }
  return null;
}

const body = new FakeElement('body');
const header = body.appendChild(new FakeElement('header'));
const trigger = header.appendChild(new FakeElement('button'));
trigger.id = 'trigger';
const existingHidden = body.appendChild(new FakeElement('aside'));
existingHidden.id = 'existing-hidden';
existingHidden.setAttribute('aria-hidden', 'true');
existingHidden.setAttribute('inert', '');
const main = body.appendChild(new FakeElement('main'));
main.id = 'main-content';
const cookieBanner = body.appendChild(new FakeElement('div'));
cookieBanner.id = 'cookieBanner';
cookieBanner.className = 'rz-cookie-banner';

global.document = {
  activeElement: trigger,
  body,
  listeners: Object.create(null),
  addEventListener(name, handler) { this.listeners[name] = handler; },
  createElement(tagName) { return new FakeElement(tagName); },
  getElementById(id) { return walk(body, (node) => node.id === id); },
};

const studio = require('../js/rz-design-studio.js');
const base = {
  id: 'valid',
  triggerId: 'trigger',
  documentTypes: ['technical-specification'],
  scopes: ['current'],
  snapshot() { return { Status: 'Bound' }; },
  generate() { throw new Error('simulated export failure'); },
};

assert.equal(studio.register(base), 'valid');
assert.equal(trigger.getAttribute('aria-haspopup'), 'dialog');
assert.equal(trigger.getAttribute('aria-controls'), 'rzDesignStudio');
assert.equal(typeof trigger.listeners.click, 'function');

assert.throws(
  () => studio.register({ ...base, id: 'bad-doc', documentTypes: ['unknown'] }),
  /Unsupported document type/,
);
assert.throws(
  () => studio.register({ ...base, id: 'empty-doc', documentTypes: [] }),
  /at least one document type/,
);
assert.throws(
  () => studio.register({ ...base, id: 'bad-scope', scopes: ['adopt-study'] }),
  /Unsupported scope/,
);
assert.throws(
  () => studio.register({ ...base, id: 'empty-scope', scopes: [] }),
  /at least one scope/,
);

trigger.listeners.click();
const overlay = document.getElementById('rzDesignStudio');
const dialog = findByClass(overlay, 'rz-design-studio__dialog');
const subtitle = findByClass(overlay, 'rz-design-studio__subtitle');
const generate = findByClass(overlay, 'rz-design-studio__button--primary');
const error = findByClass(overlay, 'rz-design-studio__error');

assert.equal(dialog.getAttribute('role'), 'dialog');
assert.equal(dialog.getAttribute('aria-modal'), 'true');
assert.equal(dialog.getAttribute('aria-labelledby'), 'rzDesignStudioTitle');
assert.equal(dialog.getAttribute('aria-describedby'), 'rzDesignStudioDescription');
assert.equal(subtitle.id, 'rzDesignStudioDescription');
assert.equal(dialog.querySelectorAll('h3').length, 3, 'dialog sections follow its h2 with h3 headings');
assert.equal(header.hasAttribute('inert'), true, 'background header is inert while open');
assert.equal(header.getAttribute('aria-hidden'), 'true');
assert.equal(main.hasAttribute('inert'), true, 'background main is inert while open');
assert.equal(cookieBanner.hasAttribute('inert'), true, 'cookie banner is isolated while the modal is open');
assert.equal(cookieBanner.style.visibility, 'hidden', 'higher-z cookie banner cannot obscure the modal');
assert.equal(body.style.overflow, 'hidden');

generate.listeners.click();
assert.match(error.textContent, /simulated export failure/);
studio.close();
assert.equal(header.hasAttribute('inert'), false, 'new inert state is removed on close');
assert.equal(header.hasAttribute('aria-hidden'), false, 'new aria-hidden state is removed on close');
assert.equal(existingHidden.hasAttribute('inert'), true, 'pre-existing inert state is preserved');
assert.equal(existingHidden.getAttribute('aria-hidden'), 'true', 'pre-existing aria-hidden state is preserved');
assert.equal(cookieBanner.hasAttribute('inert'), false, 'cookie banner interactivity is restored on close');
assert.equal(cookieBanner.style.visibility, undefined, 'cookie banner visibility is restored on close');
assert.equal(document.activeElement, trigger, 'focus returns to the trigger');

studio.open('valid');
assert.equal(error.textContent, '', 'stale generation errors clear when reopened');
studio.close();

const operatorCss = readFileSync(new URL('../css/datahall-ai-operator.css', import.meta.url), 'utf8');
assert.match(
  operatorCss,
  /\[data-rz-line\]\.rz-flow-active\s*\{[^}]*animation:[^;]+!important;/s,
  'active electrical paths explicitly override the legacy animation reset',
);
assert.match(
  operatorCss,
  /\[data-rz-line\]\.rz-flow-inactive\s*\{[^}]*animation:\s*none\s*!important;[^}]*stroke-dasharray:\s*none\s*!important;/s,
  'inactive electrical paths cannot retain legacy flow animation or dash styling',
);
assert.match(
  operatorCss,
  /prefers-reduced-motion:\s*reduce[\s\S]*\.rz-flow-active\s*\{\s*animation:\s*none\s*!important;/,
  'reduced-motion must override the active electrical animation',
);

delete global.document;
console.log('PASS shared Design Studio accessibility and operator motion contracts');
