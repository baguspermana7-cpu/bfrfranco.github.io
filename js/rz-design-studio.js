/* Shared Design Studio for data-centre engineering exports. */
(function (root) {
  'use strict';

  var registry = Object.create(null);
  var active = null;
  var previousFocus = null;
  var previousOverflow = '';
  var backgroundState = [];
  var nodes = null;
  var FOCUSABLE = 'button:not([disabled]),select:not([disabled]),input:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])';
  var DOCUMENT_TYPES = Object.freeze(['technical-specification', 'basis-of-design', 'operator-handover']);
  var SCOPES = Object.freeze(['current', 'current-plus-study']);

  function element(tag, className, text) {
    var node = document.createElement(tag);
    if (className) { node.className = className; }
    if (text !== undefined) { node.textContent = String(text); }
    return node;
  }

  function field(labelText, control) {
    var wrap = element('div', 'rz-design-studio__field');
    var label = element('label', '', labelText);
    label.setAttribute('for', control.id);
    wrap.appendChild(label);
    wrap.appendChild(control);
    return wrap;
  }

  function createSelect(id, options) {
    var select = element('select');
    select.id = id;
    for (var i = 0; i < options.length; i++) {
      var option = element('option', '', options[i].label);
      option.value = options[i].value;
      select.appendChild(option);
    }
    return select;
  }

  function buildHeader(dialog) {
    var header = element('div', 'rz-design-studio__header');
    var titleWrap = element('div');
    var eyebrow = element('div', 'rz-design-studio__eyebrow', 'Engineering document control');
    var title = element('h2', 'rz-design-studio__title', 'Design Studio');
    title.id = 'rzDesignStudioTitle';
    var subtitle = element('div', 'rz-design-studio__subtitle');
    subtitle.id = 'rzDesignStudioDescription';
    var close = element('button', 'rz-design-studio__close', 'Close');
    close.type = 'button';
    close.setAttribute('aria-label', 'Close Design Studio');
    titleWrap.appendChild(eyebrow);
    titleWrap.appendChild(title);
    titleWrap.appendChild(subtitle);
    header.appendChild(titleWrap);
    header.appendChild(close);
    dialog.appendChild(header);
    return { title: title, subtitle: subtitle, close: close };
  }

  function buildBody(dialog) {
    var body = element('div', 'rz-design-studio__body');
    var controls = element('section', 'rz-design-studio__section');
    controls.appendChild(element('h3', '', 'Issue controls'));
    var documentType = createSelect('rzDesignDocumentType', [
      { value: 'technical-specification', label: 'Technical Specification' },
      { value: 'basis-of-design', label: 'Basis of Design' },
      { value: 'operator-handover', label: 'Operator Handover Pack' }
    ]);
    var scope = createSelect('rzDesignScope', [
      { value: 'current', label: 'Current locked design' },
      { value: 'current-plus-study', label: 'Current design + study comparison' }
    ]);
    var note = element('textarea');
    note.id = 'rzDesignRevisionNote';
    note.maxLength = 240;
    note.placeholder = 'Optional revision note (max 240 characters)';
    controls.appendChild(field('Document type', documentType));
    controls.appendChild(field('Issue scope', scope));
    controls.appendChild(field('Revision note', note));

    /* v3.1.0 — owner comment (22): "partial or whole". A registration that declares
       sections gets a picker; one that does not is untouched, so the two existing
       adopters keep their exact dialog. */
    var sectionsWrap = element('section', 'rz-design-studio__section rz-design-studio__section--full');
    sectionsWrap.id = 'rzDesignSectionsWrap';
    sectionsWrap.appendChild(element('h3', '', 'Sections to include'));
    var sectionList = element('div', 'rz-design-studio__sections');
    sectionList.id = 'rzDesignSections';
    sectionsWrap.appendChild(sectionList);
    sectionsWrap.hidden = true;

    var snapshotSection = element('section', 'rz-design-studio__section');
    snapshotSection.appendChild(element('h3', '', 'Bound engineering snapshot'));
    var snapshot = element('dl', 'rz-design-studio__snapshot');
    snapshot.id = 'rzDesignSnapshot';
    snapshotSection.appendChild(snapshot);

    var provenance = element('section', 'rz-design-studio__section rz-design-studio__section--full');
    provenance.appendChild(element('h3', '', 'Provenance & issue rule'));
    var trace = element('div', 'rz-design-studio__trace');
    provenance.appendChild(trace);
    body.appendChild(controls);
    body.appendChild(sectionsWrap);
    body.appendChild(snapshotSection);
    body.appendChild(provenance);
    dialog.appendChild(body);
    return { documentType: documentType, scope: scope, note: note, snapshot: snapshot, trace: trace,
      sectionsWrap: sectionsWrap, sectionList: sectionList };
  }

  function buildFooter(dialog) {
    var footer = element('div', 'rz-design-studio__footer');
    var error = element('div', 'rz-design-studio__error');
    error.setAttribute('role', 'alert');
    var generate = element('button', 'rz-design-studio__button rz-design-studio__button--primary', 'Generate document');
    generate.type = 'button';
    footer.appendChild(error);
    footer.appendChild(generate);
    dialog.appendChild(footer);
    return { error: error, generate: generate };
  }

  function buildDialog() {
    var overlay = element('div', 'rz-design-studio');
    overlay.id = 'rzDesignStudio';
    overlay.setAttribute('data-open', 'false');
    overlay.setAttribute('aria-hidden', 'true');
    var dialog = element('div', 'rz-design-studio__dialog');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'rzDesignStudioTitle');
    dialog.setAttribute('aria-describedby', 'rzDesignStudioDescription');
    var header = buildHeader(dialog);
    var body = buildBody(dialog);
    var footer = buildFooter(dialog);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    return {
      overlay: overlay, dialog: dialog, title: header.title, subtitle: header.subtitle,
      close: header.close, documentType: body.documentType, scope: body.scope,
      note: body.note, snapshot: body.snapshot, trace: body.trace,
      sectionsWrap: body.sectionsWrap, sectionList: body.sectionList,
      error: footer.error, generate: footer.generate
    };
  }

  function renderSnapshot(snapshot) {
    while (nodes.snapshot.firstChild) { nodes.snapshot.removeChild(nodes.snapshot.firstChild); }
    var source = snapshot && typeof snapshot === 'object' ? snapshot : {};
    var keys = Object.keys(source);
    if (!keys.length) { keys = ['Status']; source = { Status: 'No bound snapshot available' }; }
    for (var i = 0; i < keys.length; i++) {
      nodes.snapshot.appendChild(element('dt', '', keys[i]));
      nodes.snapshot.appendChild(element('dd', '', source[keys[i]]));
    }
  }

  function getFocusable() {
    if (!nodes) { return []; }
    return Array.prototype.slice.call(nodes.dialog.querySelectorAll(FOCUSABLE));
  }

  function isolateBackground() {
    backgroundState = [];
    if (!document.body || !document.body.children) { return; }
    Array.prototype.forEach.call(document.body.children, function (child) {
      if (child === nodes.overlay) { return; }
      backgroundState.push({
        node: child,
        hadInert: child.hasAttribute('inert'),
        ariaHidden: child.getAttribute('aria-hidden'),
        visibility: child.style.visibility
      });
      child.setAttribute('inert', '');
      child.setAttribute('aria-hidden', 'true');
      if (child.id === 'cookieBanner') { child.style.visibility = 'hidden'; }
    });
  }

  function restoreBackground() {
    backgroundState.forEach(function (state) {
      if (!state.hadInert) { state.node.removeAttribute('inert'); }
      if (state.ariaHidden === null) { state.node.removeAttribute('aria-hidden'); }
      else { state.node.setAttribute('aria-hidden', state.ariaHidden); }
      state.node.style.visibility = state.visibility;
    });
    backgroundState = [];
  }

  function close() {
    if (!nodes || nodes.generate.disabled) { return; }
    nodes.overlay.setAttribute('data-open', 'false');
    nodes.overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = previousOverflow;
    restoreBackground();
    active = null;
    if (previousFocus && typeof previousFocus.focus === 'function') { previousFocus.focus(); }
  }

  function onKeydown(event) {
    if (!active || !nodes) { return; }
    if (event.key === 'Escape') { event.preventDefault(); close(); return; }
    if (event.key !== 'Tab') { return; }
    var focusable = getFocusable();
    if (!focusable.length) { return; }
    var first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first.focus();
    }
  }

  function readSections() {
    var chosen = [], omitted = [];
    var boxes = nodes.sectionList.querySelectorAll('input[type="checkbox"]');
    for (var i = 0; i < boxes.length; i++) {
      var row = { id: boxes[i].value, label: boxes[i].getAttribute('data-label') || boxes[i].value };
      (boxes[i].checked ? chosen : omitted).push(row);
    }
    return { chosen: chosen, omitted: omitted };
  }

  function requestPayload(config) {
    var snapshot = typeof config.snapshot === 'function' ? config.snapshot() : {};
    var picked = readSections();
    return Object.freeze({
      documentType: nodes.documentType.value,
      scope: nodes.scope.value,
      revisionNote: nodes.note.value.trim(),
      /* empty arrays when the registration declared no sections — a caller that does not
         use them sees exactly what it saw before */
      sections: Object.freeze(picked.chosen),
      omittedSections: Object.freeze(picked.omitted),
      snapshot: snapshot,
      capturedAt: new Date().toISOString()
    });
  }

  /* Rebuilt on every open so a page whose sections are rendered late still offers them. */
  function renderSections(config) {
    var list = nodes.sectionList;
    while (list.firstChild) { list.removeChild(list.firstChild); }
    var items = typeof config.sections === 'function' ? config.sections() : [];
    if (!items || !items.length) { nodes.sectionsWrap.hidden = true; return; }
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var row = element('label', 'rz-design-studio__section-row');
      var box = document.createElement('input');
      box.type = 'checkbox';
      box.value = String(item.id);
      box.checked = item.selected !== false;
      box.setAttribute('data-label', String(item.label || item.id));
      row.appendChild(box);
      row.appendChild(element('span', '', String(item.label || item.id)));
      list.appendChild(row);
    }
    nodes.sectionsWrap.hidden = false;
  }

  function configureSelect(select, allowed, fallback) {
    var first = '';
    Array.prototype.forEach.call(select.options, function (option) {
      option.disabled = allowed.indexOf(option.value) === -1;
      if (!option.disabled && !first) { first = option.value; }
    });
    select.value = allowed.indexOf(fallback) !== -1 ? fallback : first;
  }

  function generate() {
    if (!active || !nodes) { return; }
    var config = registry[active];
    nodes.error.textContent = '';
    nodes.generate.disabled = true;
    nodes.generate.textContent = 'Preparing document…';
    try {
      config.generate(requestPayload(config));
      nodes.generate.disabled = false;
      nodes.generate.textContent = 'Generate document';
      close();
    } catch (error) {
      nodes.generate.disabled = false;
      nodes.generate.textContent = 'Generate document';
      nodes.error.textContent = 'Generation failed. ' + (error && error.message ? error.message : 'Retry after reloading the page.');
    }
  }

  function open(id) {
    var config = registry[id];
    var wasOpen;
    if (!config) { return; }
    if (!nodes) {
      nodes = buildDialog();
      nodes.close.addEventListener('click', close);
      nodes.generate.addEventListener('click', generate);
      nodes.overlay.addEventListener('click', function (event) {
        if (event.target === nodes.overlay) { close(); }
      });
      document.addEventListener('keydown', onKeydown);
    }
    wasOpen = nodes.overlay.getAttribute('data-open') === 'true';
    active = id;
    renderSections(config);
    if (!wasOpen) {
      previousFocus = document.activeElement;
      previousOverflow = document.body.style.overflow;
      isolateBackground();
    }
    nodes.title.textContent = config.title;
    nodes.subtitle.textContent = config.subtitle;
    nodes.note.value = '';
    nodes.error.textContent = '';
    configureSelect(nodes.documentType, config.documentTypes, 'technical-specification');
    configureSelect(nodes.scope, config.scopes, 'current');
    nodes.trace.textContent = config.provenance;
    renderSnapshot(typeof config.snapshot === 'function' ? config.snapshot() : {});
    nodes.overlay.setAttribute('data-open', 'true');
    nodes.overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    nodes.documentType.focus();
  }

  function validateConfig(config) {
    if (!config || typeof config !== 'object') { throw new Error('Design Studio config must be an object'); }
    if (!config.id || !config.triggerId) { throw new Error('Design Studio requires id and triggerId'); }
    if (typeof config.generate !== 'function') { throw new Error('Design Studio requires a generate function'); }
    var trigger = document.getElementById(config.triggerId);
    if (!trigger) { throw new Error('Design Studio trigger not found: ' + config.triggerId); }
    return trigger;
  }

  function normalizeChoices(values, supported, label) {
    if (!Array.isArray(values) || !values.length) {
      throw new Error('Design Studio requires at least one ' + label);
    }
    var unique = [];
    values.forEach(function (value) {
      var normalized = String(value);
      if (supported.indexOf(normalized) === -1) {
        throw new Error('Unsupported ' + label + ': ' + normalized);
      }
      if (unique.indexOf(normalized) === -1) { unique.push(normalized); }
    });
    return Object.freeze(unique);
  }

  function register(config) {
    var trigger = validateConfig(config);
    var safe = Object.freeze({
      id: String(config.id),
      triggerId: String(config.triggerId),
      title: String(config.title || 'Design Studio'),
      subtitle: String(config.subtitle || 'Generate an engineering document from the current snapshot.'),
      provenance: String(config.provenance || 'Values are captured from the page engine at issue time.'),
      studyAvailable: !!config.studyAvailable,
      documentTypes: normalizeChoices(config.documentTypes || ['technical-specification'], DOCUMENT_TYPES, 'document type'),
      scopes: normalizeChoices(config.scopes || (config.studyAvailable ? ['current', 'current-plus-study'] : ['current']), SCOPES, 'scope'),
      snapshot: config.snapshot,
      /* optional: () -> [{id, label, selected}] */
      sections: typeof config.sections === 'function' ? config.sections : null,
      generate: config.generate
    });
    registry[safe.id] = safe;
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.setAttribute('aria-controls', 'rzDesignStudio');
    trigger.addEventListener('click', function () { open(safe.id); });
    return safe.id;
  }

  var API = Object.freeze({ register: register, open: open, close: close, version: '1.0.0' });
  root.RZDesignStudio = API;
  if (typeof module !== 'undefined' && module.exports) { module.exports = API; }
}(typeof window !== 'undefined' ? window : globalThis));
