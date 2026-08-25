(function initDocumentationUi(root, doc) {
  'use strict';
  if (!root || !doc || root.__rzDocumentationUi) return;
  root.__rzDocumentationUi = true;

  var WRAPPER_SELECTOR = '.mn-tablewrap';
  var FORMULA_SELECTOR = '.mn-formula';
  var SCROLL_CLASS = 'rz-table-scrollable';
  var HINT_CLASS = 'mn-table-hint';
  var HINT_TEXT = 'Scroll horizontally for all columns →';

  function sectionLabel(wrapper, index) {
    var section = wrapper.closest ? wrapper.closest('.mn-section') : null;
    var heading = section ? section.querySelector('h2,h3') : null;
    var title = heading ? heading.textContent.replace(/\s+/g, ' ').trim() : '';
    return title ? title + ' data table' : 'Scrollable data table ' + (index + 1);
  }

  function ensureHint(wrapper, index) {
    var hint = wrapper.querySelector('.' + HINT_CLASS);
    if (hint) return hint;
    hint = doc.createElement('div');
    hint.className = HINT_CLASS;
    hint.id = 'rz-table-hint-' + (index + 1);
    hint.setAttribute('aria-hidden', 'true');
    hint.textContent = HINT_TEXT;
    wrapper.insertBefore(hint, wrapper.firstChild);
    return hint;
  }

  function updateWrapper(wrapper) {
    var isScrollable = wrapper.scrollWidth > wrapper.clientWidth + 1;
    wrapper.classList.toggle(SCROLL_CLASS, isScrollable);
  }

  function formulaLabel(formula, index) {
    var section = formula.closest ? formula.closest('.mn-section') : null;
    var heading = section ? section.querySelector('h2,h3') : null;
    var title = heading ? heading.textContent.replace(/\s+/g, ' ').trim() : '';
    return title ? title + ' formula' : 'Scrollable formula ' + (index + 1);
  }

  function updateFormula(formula, index) {
    var isScrollable = formula.scrollWidth > formula.clientWidth + 1;
    if (!isScrollable) {
      formula.removeAttribute('tabindex');
      formula.removeAttribute('role');
      formula.removeAttribute('aria-label');
      return;
    }
    formula.tabIndex = 0;
    formula.setAttribute('role', 'region');
    formula.setAttribute('aria-label', formulaLabel(formula, index));
  }

  function enhanceWrapper(wrapper, index) {
    var hint = ensureHint(wrapper, index);
    wrapper.tabIndex = 0;
    wrapper.setAttribute('role', 'region');
    wrapper.setAttribute('aria-label', sectionLabel(wrapper, index));
    wrapper.setAttribute('aria-describedby', hint.id);
    updateWrapper(wrapper);
  }

  function init() {
    var wrappers = Array.prototype.slice.call(doc.querySelectorAll(WRAPPER_SELECTOR));
    var formulas = Array.prototype.slice.call(doc.querySelectorAll(FORMULA_SELECTOR));
    wrappers.forEach(enhanceWrapper);
    formulas.forEach(updateFormula);
    if (typeof root.ResizeObserver === 'function') {
      var tableObserver = new root.ResizeObserver(function updateObserved(entries) {
        entries.forEach(function updateEntry(entry) { updateWrapper(entry.target); });
      });
      var formulaObserver = new root.ResizeObserver(function updateFormulas(entries) {
        entries.forEach(function updateEntry(entry) {
          updateFormula(entry.target, formulas.indexOf(entry.target));
        });
      });
      wrappers.forEach(function observeWrapper(wrapper) { tableObserver.observe(wrapper); });
      formulas.forEach(function observeFormula(formula) { formulaObserver.observe(formula); });
    } else {
      root.addEventListener('resize', function updateAll() {
        wrappers.forEach(updateWrapper);
        formulas.forEach(updateFormula);
      });
    }
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init);
  else init();
}(window, document));
