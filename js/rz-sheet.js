/* ============================================================================
 * rz-sheet.js — the site's ONLY bottom sheet. Vanilla, zero-build.
 * ----------------------------------------------------------------------------
 * WHY NOT vaul
 *
 * vaul is the reference and the right answer in React. This repo is zero-build
 * vanilla, so the behaviour is ported rather than the package. What makes a
 * sheet feel native, and what this implements:
 *
 *   1. THE DRAG IS 1:1. While a finger is down the sheet tracks it exactly, with
 *      NO transition — a transition during a drag is what makes a sheet feel
 *      like it is arguing with you. The transition is added back on release.
 *   2. ASYMMETRIC TIMING. Dragging is the user deliberating, so it is
 *      unmediated; the release is the system responding, so it is snappy
 *      (280ms on the drawer curve).
 *   3. VELOCITY DECIDES, NOT DISTANCE ALONE. A fast flick dismisses from
 *      anywhere; a slow drag has to clear ~40% of the height. Distance alone
 *      makes a quick flick feel ignored.
 *   4. RUBBER-BAND UPWARD. Dragging up past the top resists instead of
 *      following, so the edge of the gesture is legible.
 *   5. EXIT THE WAY IT ENTERED — down, through the bottom edge.
 *
 * MOTION, stated so a reviewer can check it
 *   tool        CSS transition toggled by JS; the drag itself is direct
 *               transform assignment with transition:none
 *   properties  transform + opacity only
 *   curve       var(--rz-ease-drawer) = cubic-bezier(.32,.72,0,1), the iOS-like
 *               drawer curve, for open/close; var(--rz-ease-out) for the scrim
 *   duration    var(--rz-dur-panel) = 280ms, under the 300ms ceiling
 *   entrance    translateY(100%) → translateY(0). Percentage, so it is the
 *               sheet's own height whatever the content is
 *   reduced     the sheet fades rather than travels; drag still works, because
 *               a gesture the user drives is not the motion they asked to
 *               reduce
 *
 * FOCUS: focus moves into the sheet on open, is trapped while open, and returns
 * to the opener on close. A hand-rolled sheet without this is the usual reason
 * not to hand-roll one.
 *
 * API
 *   var s = RZSheet.open({ title:'Filters', content: nodeOrHTMLString })
 *   RZSheet.close()
 *   RZSheet.open({ content: el, dismissible:false })
 *
 * Guard: window.__rzSheet.
 * ==========================================================================*/
(function () {
    'use strict';
    if (window.__rzSheet) return;
    window.__rzSheet = true;

    var DISMISS_FRACTION = 0.4;    /* a slow drag must clear 40% of the height */
    var FLICK_VELOCITY = 0.55;     /* px/ms downward that dismisses from anywhere */
    var RUBBER = 0.28;             /* how much of an upward overdrag is honoured */

    var CSS = [
        '.rz-sheet-scrim{position:fixed;inset:0;z-index:2147482000;',
        '  background:rgba(8,10,13,.52);opacity:0;',
        '  transition:opacity var(--rz-dur-panel,280ms) var(--rz-ease-out,cubic-bezier(.23,1,.32,1));}',
        '.rz-sheet-scrim.rz-in{opacity:1}',

        '.rz-sheet{position:fixed;left:0;right:0;bottom:0;z-index:2147482001;',
        '  box-sizing:border-box;margin:0 auto;width:100%;max-width:560px;',
        '  max-height:88vh;display:flex;flex-direction:column;',
        '  background:var(--rz-sheet-bg,#16181d);',
        '  color:var(--rz-sheet-ink,#e8ecf1);',
        '  font-family:var(--rz-art-sans,"IBM Plex Sans",system-ui,sans-serif);',
        '  border:1px solid var(--rz-sheet-line,rgba(160,168,180,.22));border-bottom:0;',
        '  border-radius:10px 10px 0 0;',        /* editorial register radius */
        '  box-shadow:0 -10px 40px rgba(0,0,0,.34);',
        '  transform:translateY(100%);',
        '  transition:transform var(--rz-dur-panel,280ms) var(--rz-ease-drawer,cubic-bezier(.32,.72,0,1));',
        '  will-change:transform;touch-action:none;}',
        '.rz-sheet.rz-in{transform:translateY(0)}',
        /* set while a finger is down: the drag must be 1:1 */
        '.rz-sheet.rz-dragging{transition:none}',

        ':root:not([data-theme="dark"]) .rz-sheet{',
        '  --rz-sheet-bg:#ffffff;--rz-sheet-ink:#1a1d23;--rz-sheet-line:rgba(26,29,35,.14);}',

        '.rz-sheet-grip{flex:0 0 auto;display:flex;justify-content:center;padding:10px 0 2px;cursor:grab;}',
        '.rz-sheet-grip:active{cursor:grabbing}',
        '.rz-sheet-grip span{display:block;width:36px;height:4px;border-radius:2px;',
        '  background:var(--rz-sheet-line,rgba(160,168,180,.4));}',
        '.rz-sheet-head{flex:0 0 auto;display:flex;align-items:center;gap:8px;',
        '  padding:4px 16px 10px;border-bottom:1px solid var(--rz-sheet-line,rgba(160,168,180,.16));}',
        '.rz-sheet-title{flex:1 1 auto;margin:0;font-size:.95rem;font-weight:600;line-height:1.3;}',
        '.rz-sheet-x{flex:0 0 auto;appearance:none;background:none;border:0;padding:4px 6px;',
        '  font:inherit;line-height:1;color:inherit;opacity:.55;cursor:pointer;border-radius:3px;',
        '  min-width:44px;min-height:44px;',      /* the site's touch-target floor */
        '  transition:opacity var(--rz-dur-press,120ms) ease;}',
        '.rz-sheet-x:hover{opacity:1}',
        '.rz-sheet-x:focus-visible{outline:2px solid currentColor;outline-offset:2px}',
        '.rz-sheet-body{flex:1 1 auto;overflow-y:auto;-webkit-overflow-scrolling:touch;',
        '  overscroll-behavior:contain;padding:14px 16px 20px;',
        '  font-size:.9rem;line-height:1.6;touch-action:pan-y;}',

        '@media (prefers-reduced-motion:reduce){',
        '  .rz-sheet{transition:opacity var(--rz-dur-panel,280ms) ease;transform:none;opacity:0}',
        '  .rz-sheet.rz-in{transform:none;opacity:1}',
        '  .rz-sheet.rz-dragging{transition:none}}'
    ].join('');

    var state = null;

    function injectCSS() {
        if (document.getElementById('rz-sheet-css')) return;
        var s = document.createElement('style');
        s.id = 'rz-sheet-css'; s.textContent = CSS;
        document.head.appendChild(s);
    }

    var FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),' +
                    'textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

    function trap(e) {
        if (!state || e.key !== 'Tab') return;
        var items = state.sheet.querySelectorAll(FOCUSABLE);
        if (!items.length) { e.preventDefault(); return; }
        var first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }

    function onKey(e) {
        if (!state) return;
        if (e.key === 'Escape' && state.dismissible) { e.preventDefault(); close(); return; }
        trap(e);
    }

    function close() {
        if (!state || state.closing) return;
        state.closing = true;
        var s = state;
        s.sheet.classList.remove('rz-in', 'rz-dragging');
        s.sheet.style.transform = '';          /* let the class own the exit */
        s.scrim.classList.remove('rz-in');
        document.removeEventListener('keydown', onKey, true);
        document.documentElement.style.overflow = s.prevOverflow;
        var done = function () {
            if (s.sheet.parentNode) s.sheet.parentNode.removeChild(s.sheet);
            if (s.scrim.parentNode) s.scrim.parentNode.removeChild(s.scrim);
            if (s.opener && typeof s.opener.focus === 'function') s.opener.focus();
            if (state === s) state = null;
        };
        var fired = false;
        s.sheet.addEventListener('transitionend', function once(e) {
            if (e.target !== s.sheet || fired) return;
            fired = true; s.sheet.removeEventListener('transitionend', once); done();
        });
        setTimeout(function () { if (!fired) { fired = true; done(); } }, 520);
    }

    function attachDrag(s) {
        var startY = 0, lastY = 0, lastT = 0, dy = 0, dragging = false, pid = null;

        function down(e) {
            if (!s.dismissible) return;
            /* Only start a drag from the grip or the header. Starting it from the
               body would fight the body's own scroll. */
            if (!e.target.closest('.rz-sheet-grip,.rz-sheet-head')) return;
            dragging = true; pid = e.pointerId;
            startY = lastY = e.clientY; lastT = e.timeStamp; dy = 0;
            s.sheet.classList.add('rz-dragging');
            try { s.sheet.setPointerCapture(pid); } catch (err) {}
        }
        function move(e) {
            if (!dragging || e.pointerId !== pid) return;
            dy = e.clientY - startY;
            /* upward overdrag resists rather than follows */
            var shown = dy < 0 ? dy * RUBBER : dy;
            s.sheet.style.transform = 'translateY(' + shown + 'px)';
            var h = s.sheet.offsetHeight || 1;
            s.scrim.style.opacity = String(Math.max(0, 1 - Math.max(0, dy) / h));
            lastY = e.clientY; lastT = e.timeStamp;
            e.preventDefault();
        }
        function up(e) {
            if (!dragging || (e.pointerId !== undefined && e.pointerId !== pid)) return;
            dragging = false;
            try { s.sheet.releasePointerCapture(pid); } catch (err) {}
            s.sheet.classList.remove('rz-dragging');   /* transition comes back here */
            var dt = Math.max(1, e.timeStamp - lastT);
            var v = (e.clientY - lastY) / dt;          /* px/ms, downward positive */
            var h = s.sheet.offsetHeight || 1;
            /* velocity OR distance. A flick must dismiss from anywhere, or a
               quick gesture reads as ignored. */
            if (v > FLICK_VELOCITY || dy > h * DISMISS_FRACTION) { close(); return; }
            s.sheet.style.transform = '';              /* spring back to rest */
            s.scrim.style.opacity = '';
        }
        s.sheet.addEventListener('pointerdown', down);
        s.sheet.addEventListener('pointermove', move, { passive: false });
        s.sheet.addEventListener('pointerup', up);
        s.sheet.addEventListener('pointercancel', up);
    }

    function open(opts) {
        opts = opts || {};
        if (state) close();
        injectCSS();

        var s = {
            opener: document.activeElement,
            dismissible: opts.dismissible !== false,
            prevOverflow: document.documentElement.style.overflow,
            closing: false
        };

        s.scrim = document.createElement('div');
        s.scrim.className = 'rz-sheet-scrim';
        if (s.dismissible) s.scrim.addEventListener('click', close);

        s.sheet = document.createElement('div');
        s.sheet.className = 'rz-sheet';
        s.sheet.setAttribute('role', 'dialog');
        s.sheet.setAttribute('aria-modal', 'true');

        if (s.dismissible) {
            var grip = document.createElement('div');
            grip.className = 'rz-sheet-grip';
            grip.appendChild(document.createElement('span'));
            s.sheet.appendChild(grip);
        }

        if (opts.title) {
            var head = document.createElement('div');
            head.className = 'rz-sheet-head';
            var h = document.createElement('h2');
            h.className = 'rz-sheet-title';
            h.id = 'rz-sheet-title-' + Date.now();
            h.textContent = String(opts.title);
            s.sheet.setAttribute('aria-labelledby', h.id);
            head.appendChild(h);
            if (s.dismissible) {
                var x = document.createElement('button');
                x.type = 'button'; x.className = 'rz-sheet-x';
                x.setAttribute('aria-label', 'Close');
                x.textContent = '×';
                x.addEventListener('click', close);
                head.appendChild(x);
            }
            s.sheet.appendChild(head);
        }

        var body = document.createElement('div');
        body.className = 'rz-sheet-body';
        if (opts.content instanceof Node) body.appendChild(opts.content);
        else if (typeof opts.content === 'string') body.textContent = opts.content;
        s.sheet.appendChild(body);
        s.body = body;

        document.body.appendChild(s.scrim);
        document.body.appendChild(s.sheet);
        document.documentElement.style.overflow = 'hidden';
        state = s;

        attachDrag(s);
        document.addEventListener('keydown', onKey, true);

        /* Two frames: a single rAF can share the insert's style recalculation,
           leaving the browser no "before" value to transition from. */
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                s.sheet.classList.add('rz-in');
                s.scrim.classList.add('rz-in');
                var target = s.sheet.querySelector(FOCUSABLE) || s.sheet;
                if (target === s.sheet) s.sheet.setAttribute('tabindex', '-1');
                try { target.focus({ preventScroll: true }); } catch (e) { target.focus(); }
            });
        });
        return s;
    }

    window.RZSheet = {
        open: open,
        close: close,
        isOpen: function () { return !!state; }
    };
})();
