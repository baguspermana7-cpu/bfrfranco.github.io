/* RZ DC AI — hall plan micro-interactions (v3.21.5)
 *
 * The hall plan (#hSvg) draws 440 racks, the CDU line and both fan-wall galleries at one scale. Read at
 * once it is a wall of glyphs; this module lets the reader ASK the drawing a question by pointing:
 *
 *   hover a rack      -> its row, its contained hot aisle and that aisle's sensors stay lit
 *   hover a CDU       -> the liquid path stays lit: CDU stubs, TCS headers, row manifolds, HTW
 *   hover a fan wall  -> the air path stays lit: cold supply, hot aisles, plenum return, fan walls
 *   hover a layer chip or a key entry -> the same spotlight for that layer / that kind of object
 *   click equipment   -> a selection ring stays on it, so closing the HMI shows where you were
 *   switch hall       -> the new hall crossfades in instead of teleporting
 *
 * Rules it obeys (standarization/MOTION_STANDARD.md):
 *   - state lives in ATTRIBUTES on the svg and its children, never in classes: js/rz-svg-legible.js
 *     refits on any class change under <body>, and a refit resets the pan.
 *   - opacity only for the spotlight; hover is a tens-per-minute action, so the dim is 160 ms and
 *     engages after a short dwell, never a flicker while sweeping across the field.
 *   - reduced motion keeps the opacity cues (they explain) and drops the moving crossfade offset.
 *   - nothing here computes or prints an engine quantity.
 */
(function () {
  'use strict';
  var doc = document, win = window;
  var svg = doc.getElementById('hSvg'), hc = doc.getElementById('hc');
  if (!svg || !hc) return;

  var EASE = 'cubic-bezier(.23,1,.32,1)';
  var reduce = win.matchMedia ? win.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  /* --- spotlight -------------------------------------------------------------------------- */
  var SETS = {
    liquid: '.hp-ly-liquid,.hp-cdu,.rowg,.fws-pipe-click',
    air: '.hp-ly-air,.hp-ly-thermal,.hp-crah,.hp-sens,.hp-hac',
    thermal: '.hp-ly-thermal,.hp-sens,.hp-hac',
    leak: '.hp-ly-leak',
    overhead: '.hp-ly-overhead',
    rack: '.rowg,[data-row-l]',
    hac: '.hp-hac,.hp-ly-overhead,.hp-ly-thermal',
    cdu: '.hp-cdu',
    crah: '.hp-crah'
  };
  var current = '', hotEls = [], dwellT = 0;

  function clearHot() {
    for (var i = 0; i < hotEls.length; i++) hotEls[i].removeAttribute('data-hp-hot');
    hotEls = [];
  }
  function markHot(sel) {
    var list = hc.querySelectorAll(sel);
    for (var i = 0; i < list.length; i++) { list[i].setAttribute('data-hp-hot', ''); hotEls.push(list[i]); }
  }
  /* key = 'kind:id'. kind decides what stays lit; the CSS dims everything else. */
  function apply(key) {
    if (key === current) return;
    current = key;
    clearHot();
    if (!key) { svg.removeAttribute('data-hp-focus'); return; }
    var kind = key.split(':')[0], id = key.slice(kind.length + 1);
    if (kind === 'row') {
      var row = hc.querySelector('.rowg[data-row="' + id + '"]');
      var pi = row ? row.getAttribute('data-pi') : null;
      markHot('.rowg[data-row="' + id + '"],[data-row-l="' + id + '"],.hp-ly-thermal' + (pi != null ? ',[data-pi="' + pi + '"]' : ''));
    } else if (kind === 'eq') {
      var g = hc.querySelector('[data-rz-equipment="' + id + '"]');
      if (g) { g.setAttribute('data-hp-hot', ''); hotEls.push(g); }
      kind = 'solo';
    } else if (SETS[kind]) {
      markHot(SETS[kind]);
    } else { current = ''; svg.removeAttribute('data-hp-focus'); return; }
    svg.setAttribute('data-hp-focus', kind);
  }
  /* First engagement waits a beat so a pointer crossing the plan does not strobe it; once a
     spotlight is up, moving to the next object retargets at once. */
  function request(key) {
    clearTimeout(dwellT);
    if (!key) { dwellT = setTimeout(function () { apply(''); }, 60); return; }
    if (current) { apply(key); return; }
    dwellT = setTimeout(function () { apply(key); }, 110);
  }

  function up(el, attr) {
    while (el && el !== svg) { if (el.getAttribute && el.getAttribute(attr) !== null) return el; el = el.parentNode; }
    return null;
  }
  function keyFor(t) {
    var eq = up(t, 'data-rz-equipment');
    if (eq) {
      var ref = eq.getAttribute('data-rz-equipment');
      if (/^rack-unit:/.test(ref)) { var r = up(eq, 'data-row'); return r ? 'row:' + r.getAttribute('data-row') : ''; }
      if (/^cdu:/.test(ref) || /^fws-piping:/.test(ref)) return 'liquid';
      if (/^crah:/.test(ref)) return 'air';
      return 'eq:' + ref;
    }
    var rl = up(t, 'data-row-l');
    if (rl) return 'row:' + rl.getAttribute('data-row-l');
    return '';
  }

  svg.addEventListener('pointermove', function (e) {
    if (e.pointerType && e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;   /* touch never hovers */
    request(keyFor(e.target));
  });
  svg.addEventListener('pointerleave', function () { request(''); });
  /* keyboard parity: tabbing to a unit spotlights the same thing a hover would */
  svg.addEventListener('focusin', function (e) { clearTimeout(dwellT); apply(keyFor(e.target)); });
  svg.addEventListener('focusout', function () { request(''); });

  /* layer chips and the key preview their own layer on the drawing */
  function hoverPreview(container, attr, map) {
    if (!container) return;
    container.addEventListener('pointerover', function (e) {
      var el = e.target.closest && e.target.closest('[' + attr + ']');
      if (!el) return;
      var k = el.getAttribute(attr); k = map ? (map[k] || k) : k;
      var hidden = (svg.getAttribute('data-hp-hide') || '').split(' ').indexOf(k) >= 0;
      request(hidden ? '' : k);
    });
    container.addEventListener('pointerleave', function () { request(''); });
    container.addEventListener('focusin', function (e) {
      var el = e.target.closest && e.target.closest('[' + attr + ']');
      if (el) { clearTimeout(dwellT); apply(el.getAttribute(attr)); }
    });
    container.addEventListener('focusout', function () { request(''); });
  }
  hoverPreview(doc.getElementById('hallLayers'), 'data-hp-layer', null);
  hoverPreview(doc.querySelector('.hp-key'), 'data-hp-k', null);

  /* --- selection ring ---------------------------------------------------------------------- */
  var selRef = '';
  function paintSel() {
    var old = hc.querySelectorAll('[data-hp-sel]');
    for (var i = 0; i < old.length; i++) old[i].removeAttribute('data-hp-sel');
    if (!selRef) return;
    var g = hc.querySelector('[data-rz-equipment="' + selRef + '"]');
    if (g) g.setAttribute('data-hp-sel', '');
  }
  /* pointerdown, not click: the equipment inspector owns click in the capture phase and may stop it */
  svg.addEventListener('pointerdown', function (e) {
    if (e.button !== 0) return;
    var eq = up(e.target, 'data-rz-equipment');
    selRef = eq ? eq.getAttribute('data-rz-equipment') : '';
    paintSel();
  });
  svg.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var eq = up(e.target, 'data-rz-equipment');
    if (eq) { selRef = eq.getAttribute('data-rz-equipment'); paintSel(); }
  });

  /* --- re-render: keep selection, crossfade a hall switch ---------------------------------- */
  var lastDH = win.currentDH || 1;
  new MutationObserver(function () {
    current = ''; hotEls = []; svg.removeAttribute('data-hp-focus');
    paintSel();
    var dh = win.currentDH || 1;
    if (dh !== lastDH && hc.animate) {
      hc.animate(reduce.matches
        ? [{ opacity: 0.35 }, { opacity: 1 }]
        : [{ opacity: 0.25, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }],
        { duration: 280, easing: EASE });
    }
    lastDH = dh;
  }).observe(hc, { childList: true });

  win.RZDatahallAIHallInteract = { version: '1.0.0', focus: apply, select: function (ref) { selRef = ref || ''; paintSel(); } };
})();
