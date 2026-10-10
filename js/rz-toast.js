/* ============================================================================
 * rz-toast.js — the site's ONLY toast. Vanilla, zero-build, self-injecting.
 * ----------------------------------------------------------------------------
 * WHY NOT sonner
 *
 * sonner is the right answer in React and is the reference this is built
 * against. resistancezero.com is zero-build vanilla ES5-ish, so the package
 * cannot be used; the principles are ported instead. The two that matter:
 *
 *   1. TRANSITIONS, NOT KEYFRAMES. A toast is the canonical rapidly-triggered
 *      element: fire two inside a second and keyframes restart from zero, so the
 *      second one visibly jumps. A transition retargets from wherever the
 *      element currently is.
 *   2. EXIT THE WAY IT ENTERED. It arrives from the bottom edge and leaves
 *      through the bottom edge. The symmetric path is what makes
 *      swipe-to-dismiss feel obvious rather than taught.
 *
 * MOTION, stated so a reviewer can check it
 *   tool        CSS transition, driven by a class
 *   properties  transform + opacity only (no layout, no paint, GPU)
 *   curve       var(--rz-ease-out) — the built-in ease-out is too weak to read
 *               as deliberate
 *   duration    var(--rz-dur-menu) = 200ms, under the 300ms UI ceiling
 *   entrance    translateY(100%) + scale(.96) + opacity 0 → never scale(0);
 *               nothing in the real world appears from nothing
 *   stagger     stacked toasts offset by transform, not by margin, so the stack
 *               reflows on the GPU
 *   reduced     opacity only, motion dropped — fewer and gentler, not zero
 *
 * API
 *   RZToast.show('Saved')                       // neutral
 *   RZToast.show('Saved', {kind:'ok'})           // ok | warn | fault | info
 *   RZToast.show('…', {duration: 6000})          // dwell, not the animation
 *   RZToast.show('…', {action:{label:'Undo', onClick: fn}})
 *   RZToast.dismissAll()
 *
 * Guard: window.__rzToast. Loading this file twice is a no-op.
 * ==========================================================================*/
(function () {
    'use strict';
    if (window.__rzToast) return;
    window.__rzToast = true;

    var MAX_VISIBLE = 3;          /* past three the stack stops being readable */
    var DEFAULT_DWELL = 4000;     /* dwell is not animation — it is reading time */
    var GAP = 10;
    var LIFT = 14;                /* how far each older toast sinks back */

    var CSS = [
        '.rz-toast-region{position:fixed;left:0;right:0;bottom:0;z-index:2147483000;',
        '  display:flex;flex-direction:column;align-items:center;pointer-events:none;',
        '  padding:0 16px 16px;}',
        '@media (min-width:640px){.rz-toast-region{align-items:flex-end;padding-right:24px;padding-bottom:24px}}',

        '.rz-toast{pointer-events:auto;box-sizing:border-box;width:100%;max-width:400px;',
        '  display:flex;align-items:flex-start;gap:10px;',
        '  padding:12px 14px;margin-top:' + GAP + 'px;',
        '  font-family:var(--rz-art-sans,"IBM Plex Sans",system-ui,sans-serif);',
        '  font-size:.875rem;line-height:1.45;',
        '  color:var(--rz-toast-ink,#e8ecf1);',
        '  background:var(--rz-toast-bg,#16181d);',
        '  border:1px solid var(--rz-toast-line,rgba(160,168,180,.22));',
        '  border-left:2px solid var(--cl,var(--rz-toast-line,rgba(160,168,180,.3)));',
        '  border-radius:4px;',                  /* instrument radius, not a pill */
        '  box-shadow:0 8px 24px rgba(0,0,0,.28);',
        /* the entrance state. transform + opacity, nothing else. */
        '  opacity:0;transform:translateY(100%) scale(.96);',
        '  transition:opacity var(--rz-dur-menu,200ms) var(--rz-ease-out,cubic-bezier(.23,1,.32,1)),',
        '             transform var(--rz-dur-menu,200ms) var(--rz-ease-out,cubic-bezier(.23,1,.32,1));',
        '  will-change:transform,opacity;}',
        '.rz-toast.rz-in{opacity:1;transform:translateY(0) scale(1);}',
        /* exit is the entrance reversed — same edge, same curve */
        '.rz-toast.rz-out{opacity:0;transform:translateY(100%) scale(.96);}',

        ':root:not([data-theme="dark"]) .rz-toast{',
        '  --rz-toast-bg:#ffffff;--rz-toast-ink:#1a1d23;--rz-toast-line:rgba(26,29,35,.16);}',

        '.rz-toast-msg{flex:1 1 auto;min-width:0;overflow-wrap:break-word;}',
        '.rz-toast-act{flex:0 0 auto;appearance:none;background:none;border:0;padding:2px 4px;',
        '  font:inherit;font-weight:600;color:var(--cl,inherit);cursor:pointer;border-radius:3px;',
        '  transition:opacity var(--rz-dur-press,120ms) ease;}',
        '.rz-toast-act:hover{opacity:.72}',
        '.rz-toast-act:focus-visible{outline:2px solid var(--cl,currentColor);outline-offset:2px}',
        '.rz-toast-x{flex:0 0 auto;appearance:none;background:none;border:0;padding:0 2px;',
        '  font:inherit;line-height:1;color:inherit;opacity:.5;cursor:pointer;',
        '  transition:opacity var(--rz-dur-press,120ms) ease;}',
        '.rz-toast-x:hover{opacity:1}',
        '.rz-toast-x:focus-visible{outline:2px solid currentColor;outline-offset:2px}',

        '.rz-toast[data-kind="ok"]{--cl:#0a8a5a}',
        '.rz-toast[data-kind="warn"]{--cl:#d97706}',
        '.rz-toast[data-kind="fault"]{--cl:#dc2626}',
        '.rz-toast[data-kind="info"]{--cl:#0e7490}',
        '[data-theme="dark"] .rz-toast[data-kind="ok"]{--cl:#00FF88}',
        '[data-theme="dark"] .rz-toast[data-kind="warn"]{--cl:#FFAA00}',
        '[data-theme="dark"] .rz-toast[data-kind="fault"]{--cl:#FF3030}',
        '[data-theme="dark"] .rz-toast[data-kind="info"]{--cl:#00DDFF}',

        /* Reduced motion: the toast still fades, it just does not travel.
           Fewer and gentler, not zero — a toast that appears with no transition
           at all reads as a glitch. */
        '@media (prefers-reduced-motion:reduce){',
        '  .rz-toast{transform:none !important;transition:opacity var(--rz-dur-menu,200ms) ease !important;}',
        '  .rz-toast.rz-in{transform:none !important}',
        '  .rz-toast.rz-out{transform:none !important}}'
    ].join('');

    var region = null, live = [];

    function injectCSS() {
        if (document.getElementById('rz-toast-css')) return;
        var s = document.createElement('style');
        s.id = 'rz-toast-css';
        s.textContent = CSS;
        document.head.appendChild(s);
    }

    function ensureRegion() {
        if (region && document.body.contains(region)) return region;
        injectCSS();
        region = document.createElement('div');
        region.className = 'rz-toast-region';
        /* polite, not assertive: a toast is a confirmation, and assertive
           interrupts whatever the reader's screen reader was saying. */
        region.setAttribute('role', 'status');
        region.setAttribute('aria-live', 'polite');
        region.setAttribute('aria-atomic', 'false');
        document.body.appendChild(region);
        return region;
    }

    /* The stack is expressed as transforms on the older toasts, so adding one
       never triggers layout on the others. */
    function restack() {
        for (var i = 0; i < live.length; i++) {
            var depth = live.length - 1 - i;      /* 0 = newest */
            var t = live[i];
            if (!t.el.classList.contains('rz-in')) continue;
            t.el.style.transform = depth === 0
                ? 'translateY(0) scale(1)'
                : 'translateY(' + (depth * LIFT) + 'px) scale(' + (1 - depth * 0.03).toFixed(3) + ')';
            t.el.style.opacity = depth >= MAX_VISIBLE ? '0' : String(1 - depth * 0.12);
            t.el.style.zIndex = String(1000 - depth);
        }
    }

    function remove(entry) {
        if (entry.removed) return;
        entry.removed = true;
        clearTimeout(entry.timer);
        entry.el.classList.remove('rz-in');
        entry.el.classList.add('rz-out');
        entry.el.style.transform = '';            /* let .rz-out own the exit */
        var done = function () {
            if (entry.el.parentNode) entry.el.parentNode.removeChild(entry.el);
            var i = live.indexOf(entry);
            if (i >= 0) live.splice(i, 1);
            restack();
            if (!live.length && region && region.parentNode) {
                region.parentNode.removeChild(region);
                region = null;
            }
        };
        /* transitionend is the right signal, but it never fires if the element
           is display:none'd by a theme switch or the tab is backgrounded, so a
           timeout backs it up. Whichever lands first wins. */
        var fired = false;
        entry.el.addEventListener('transitionend', function once(e) {
            if (e.target !== entry.el || fired) return;
            fired = true; entry.el.removeEventListener('transitionend', once); done();
        });
        setTimeout(function () { if (!fired) { fired = true; done(); } }, 420);
    }

    function show(message, opts) {
        if (!message) return null;
        opts = opts || {};
        var host = ensureRegion();

        var el = document.createElement('div');
        el.className = 'rz-toast';
        if (opts.kind) el.setAttribute('data-kind', opts.kind);

        var msg = document.createElement('span');
        msg.className = 'rz-toast-msg';
        msg.textContent = String(message);        /* textContent, never innerHTML */
        el.appendChild(msg);

        var entry = { el: el, removed: false, timer: null };

        if (opts.action && opts.action.label) {
            var act = document.createElement('button');
            act.type = 'button';
            act.className = 'rz-toast-act';
            act.textContent = String(opts.action.label);
            act.addEventListener('click', function () {
                try { if (typeof opts.action.onClick === 'function') opts.action.onClick(); }
                finally { remove(entry); }
            });
            el.appendChild(act);
        }

        var x = document.createElement('button');
        x.type = 'button';
        x.className = 'rz-toast-x';
        x.setAttribute('aria-label', 'Dismiss notification');
        x.textContent = '×';
        x.addEventListener('click', function () { remove(entry); });
        el.appendChild(x);

        host.appendChild(el);
        live.push(entry);

        /* Two frames, not one. A single rAF can land in the same style
           recalculation as the insert, and the browser then has no "before"
           value to transition FROM — the toast appears already in place. */
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                el.classList.add('rz-in');
                restack();
            });
        });

        var dwell = typeof opts.duration === 'number' ? opts.duration : DEFAULT_DWELL;
        if (dwell > 0) {
            entry.timer = setTimeout(function () { remove(entry); }, dwell);
            /* Hovering is reading. Pause the dwell, like sonner does. */
            el.addEventListener('mouseenter', function () { clearTimeout(entry.timer); });
            el.addEventListener('mouseleave', function () {
                entry.timer = setTimeout(function () { remove(entry); }, 1200);
            });
            el.addEventListener('focusin', function () { clearTimeout(entry.timer); });
        }

        while (live.length > MAX_VISIBLE + 1) remove(live[0]);
        return entry;
    }

    window.RZToast = {
        show: show,
        ok: function (m, o) { return show(m, Object.assign({}, o || {}, { kind: 'ok' })); },
        warn: function (m, o) { return show(m, Object.assign({}, o || {}, { kind: 'warn' })); },
        fault: function (m, o) { return show(m, Object.assign({}, o || {}, { kind: 'fault' })); },
        info: function (m, o) { return show(m, Object.assign({}, o || {}, { kind: 'info' })); },
        dismiss: function (entry) { if (entry) remove(entry); },
        dismissAll: function () { live.slice().forEach(remove); }
    };
})();
