/* Resistance Zero — mobile hamburger nav toggle (v1.8.5)
   Robustly detects existing .hamburger / .menu-toggle buttons and wires them up
   instead of double-injecting. Falls back to injection if no toggle exists.

   Fixes v1.8.4 regressions:
   - Two hamburger buttons on index.html (existing .hamburger + injected .rz-nav-burger)
   - Drawer couldn't scroll on iOS (missing -webkit-overflow-scrolling)
   - Some pages without .nav-right host couldn't position the burger correctly
*/
(function(){
    'use strict';

    function findNavbar() {
        /* One querySelector with a comma list returns the first match in DOCUMENT ORDER, not the
           first selector that matches — so on 24 article pages, where `nav.toc-sidebar` sits above
           `nav.navbar` in the markup, the LAST fallback (`body > nav:first-of-type`) claimed the
           table-of-contents sidebar. That sidebar is `display:none` on a phone, so the burger was
           injected into it and no reader ever saw a menu button. Ask in priority order instead. */
        var selectors = [
            'nav.navbar', 'header.navbar', '.navbar',
            'nav.cx-nav', 'nav.rfs-navbar',
            'header > nav', 'body > nav:first-of-type'
        ];
        for (var i = 0; i < selectors.length; i++) {
            var hit = document.querySelector(selectors[i]);
            /* a hidden shell is not the navbar a reader uses */
            if (hit && hit.getClientRects().length) { return hit; }
        }
        return null;
    }

    function findExistingBurger(navbar) {
        /* v3.10.20 — `.mobile-nav-toggle` was missing from this list, and that is the whole
           double-hamburger bug this file's header says it exists to prevent. Seven pages
           (datacenter-solutions and the six pln-java-grid pages) mark their toggle up with that
           class; the query missed it, the code fell through to the INJECT branch, and the reader
           got two hamburgers in one header. The id is matched too, because a page that names the
           element without classing it is the same page from a reader's point of view. */
        return navbar.querySelector(
            '.hamburger, .menu-toggle, [data-nav-toggle], .nav-toggle, ' +
            '.mobile-menu-btn, button.menuButton, .mobile-nav-toggle, #mobileNavToggle'
        );
    }

    /* Does anything in this document actually style the open drawer?
       The seven pages above do not load styles.min.css, so none of its 45 `body.rz-nav-open`
       rules reach them: the burger set the class correctly and the menu stayed invisible. That
       is the second half of "two buttons and neither works" — one button was a duplicate, and
       the surviving one toggled a class with no listener.
       Checked rather than assumed: a page that HAS the rules must not get a second, lower-quality
       copy layered over them. Cross-origin sheets throw on .cssRules and are skipped. */
    /* ONLY `body.rz-nav-open` counts as "this page already draws its own open menu", and the
       reason is specificity, not taste.
       89 pages carry a mobile block with `.nav-menu, .nav-links { display: none !important }`.
       The shared stylesheet beats it, because `body.rz-nav-open .nav-links` is both !important AND
       more specific. A page-local `.navbar.menu-open .nav-links` is NOT !important, so importance
       beats it however specific it looks — which is why these seven pages shipped a drawer,
       designed in their own palette, that could never open.
       So the class is still toggled below (a page whose rule CAN win should get to use it), but it
       does not count as coverage: treating it as coverage suppressed the fallback on exactly the
       seven pages that needed one. */
    function stylesDrawer(selector) {
        return !!selector && selector.indexOf('rz-nav-open') !== -1;
    }

    function documentStylesTheDrawer() {
        var sheets = document.styleSheets;
        for (var i = 0; i < sheets.length; i++) {
            var rules;
            try { rules = sheets[i].cssRules; } catch (e) { continue; }
            if (!rules) continue;
            for (var j = 0; j < rules.length; j++) {
                if (stylesDrawer(rules[j].selectorText)) return true;
                /* the canonical rules live inside a @media block */
                if (rules[j].cssRules) {
                    for (var k = 0; k < rules[j].cssRules.length; k++) {
                        if (stylesDrawer(rules[j].cssRules[k].selectorText)) return true;
                    }
                }
            }
        }
        return false;
    }

    /* A minimal drawer, injected ONLY where the shared stylesheet is absent. Plain on purpose:
       its job is that the menu OPENS, not that it matches the site's nicer one.

       It hangs off the NAVBAR, not the viewport, and that is the part worth keeping. The first cut
       used `position:fixed; top:56px; bottom:0` and rendered 48px tall. Nothing set a height —
       `.navbar` carries `backdrop-filter: blur(20px)`, and a filtered ancestor becomes the
       containing block for its fixed descendants, so the drawer resolved against a 64px bar
       instead of the screen. The navbar is itself `position:fixed` on these pages, so anchoring
       to it with `top:100%` is both correct and simpler than fighting the containing block. */
    function injectDrawerStyles() {
        if (document.getElementById('rz-nav-drawer-fallback')) return;
        var style = document.createElement('style');
        style.id = 'rz-nav-drawer-fallback';
        /* The burger itself needs styling here too, not just the drawer. `.rz-nav-burger` and its
           three <span> bars live in styles.min.css; on a page that does not load it, a WIRED
           existing button renders its bars at zero width — spares-readiness-calculator measured a
           4px-wide tap target that opened the menu correctly and could not be hit. The inject
           branch sets those styles inline; the wire branch had nothing. */
        var BURGER =
            '.rz-nav-burger{display:inline-flex !important;flex-direction:column;' +
            'align-items:center;justify-content:center;gap:5px;' +
            'width:44px !important;min-width:44px;height:44px !important;min-height:44px;' +
            'padding:0;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.18);' +
            'border-radius:8px;color:#f1f5f9;cursor:pointer;}' +
            '.rz-nav-burger>span{display:block !important;width:20px !important;height:2px !important;' +
            'background:currentColor !important;border-radius:2px;flex-shrink:0;}';
        /* every menu shape this site ships, not just the two most common */
        var MENU = 'body.rz-nav-open .nav-menu,body.rz-nav-open .nav-links,' +
                   'body.rz-nav-open .cx-nav-links,body.rz-nav-open .rfs-nav-links';
        style.textContent =
            '@media (max-width:768px){' + BURGER +
            MENU + '{' +
            'display:flex !important;position:absolute !important;' +
            'top:100% !important;left:0 !important;right:0 !important;bottom:auto !important;' +
            'flex-direction:column !important;align-items:stretch !important;' +
            'height:auto !important;max-height:calc(100vh - 100%);overflow-y:auto;' +
            'background:rgba(15,23,42,0.97);padding:0.5rem 1.25rem 1.5rem;margin:0;' +
            'gap:0 !important;z-index:1000;' +
            'border-top:1px solid rgba(255,255,255,0.10);}' +
            MENU.split(',').map(function(s){return s + ' a';}).join(',') + '{' +
            /* !important because these pages hid surplus links at mobile width back when there
               was no drawer to put them in — rfs-readiness-workbench had two of its three links
               at `display:none`, so the menu opened showing one link. Inside an OPEN drawer there
               is room, and hiding them there serves nobody. */
            'display:block !important;padding:0.85rem 0.25rem;color:#f1f5f9;text-decoration:none;' +
            'border-bottom:1px solid rgba(255,255,255,0.10);font-size:1rem;}' +
            'body.rz-nav-open{overflow:hidden;}' +
            '}';
        document.head.appendChild(style);
    }

    function init() {
        var navbar = findNavbar();
        if (!navbar) return;

        // Skip if our script already wired this navbar
        if (navbar.querySelector('.rz-nav-burger-bound, .rz-nav-burger')) return;

        var burger;
        var existing = findExistingBurger(navbar);

        if (existing) {
            // Wire up the existing button — preferred path (single hamburger)
            burger = existing;
            burger.classList.add('rz-nav-burger', 'rz-nav-burger-bound');
            /* Give it the 3-line structure ONLY if the button is empty.
               v3.10.21 — this used to fire whenever the button had no <span>, which on
               datacenter-solutions replaced its `<i class="fas fa-bars">` with three bare spans.
               Those spans are styled by `.rz-nav-burger span` in styles.min.css, and that page
               does not load it, so the button rendered 0px wide: the fix for "two hamburgers"
               shipped "no hamburger". An existing icon is already a hamburger — leave it. */
            if (!burger.firstElementChild && !burger.textContent.trim()) {
                burger.innerHTML = '<span></span><span></span><span></span>';
            }
            if (!burger.getAttribute('aria-label')) {
                burger.setAttribute('aria-label', 'Toggle navigation menu');
            }
            burger.setAttribute('aria-expanded', 'false');
        } else {
            // Inject new — fallback when no toggle exists
            burger = document.createElement('button');
            burger.className = 'rz-nav-burger';
            burger.setAttribute('aria-label', 'Toggle navigation menu');
            burger.setAttribute('aria-expanded', 'false');
            burger.type = 'button';
            burger.innerHTML = '<span></span><span></span><span></span>';

            // Inline styles as a defensive fallback — ensures rendering even if
            // CSS doesn't load or specificity collisions happen on calc pages
            burger.style.cssText =
                'width:44px !important;height:44px !important;' +
                'min-width:44px !important;min-height:44px !important;' +
                'flex-shrink:0 !important;' +
                'align-items:center !important;justify-content:center !important;' +
                'flex-direction:column !important;gap:5px !important;' +
                'padding:0 !important;margin-left:auto !important;' +
                'background:rgba(255,255,255,0.06);' +
                'border:1px solid rgba(255,255,255,0.18);' +
                'border-radius:8px;' +
                'cursor:pointer;color:#f1f5f9;' +
                'z-index:1001;position:relative;';
            for (var i = 0; i < burger.children.length; i++) {
                burger.children[i].style.cssText =
                    'display:block !important;' +
                    'width:20px !important;height:2px !important;' +
                    'background:currentColor !important;' +
                    'border-radius:2px !important;' +
                    'flex-shrink:0 !important;' +
                    'transition:transform 0.25s,opacity 0.18s;';
            }

            // Pick the best host: nav-right > nav-container > cx-nav-inner > navbar root
            var host = navbar.querySelector(
                '.nav-right, .nav-container, .cx-nav-inner, .rfs-nav-inner, .nav-inner'
            ) || navbar;
            host.appendChild(burger);

            // Show the INJECTED burger only at the mobile breakpoint (≤768px).
            // (The old inline `display:inline-flex !important` overrode the desktop
            //  `.rz-nav-burger{display:none}` rule, so the burger appeared — and
            //  misfired — on desktop pages that inject it, e.g. the LTC labs.)
            var mq = window.matchMedia('(max-width:768px)');
            var applyBurgerDisplay = function(){
                burger.style.display = mq.matches ? 'inline-flex' : 'none';
            };
            applyBurgerDisplay();
            (mq.addEventListener ? mq.addEventListener('change', applyBurgerDisplay)
                                 : window.addEventListener('resize', applyBurgerDisplay));
        }

        if (!documentStylesTheDrawer()) { injectDrawerStyles(); }

        // Store reference on window so the close-on-outside handler can find it
        window.__rzNavBurger = burger;

        function setOpen(open) {
            document.body.classList.toggle('rz-nav-open', open);
            /* the page-local pattern, for navbars that style their own drawer */
            navbar.classList.toggle('menu-open', open);
            burger.classList.toggle('open', open);
            burger.setAttribute('aria-expanded', open ? 'true' : 'false');
            // Prevent body scroll while drawer is open
            if (open) {
                document.body.style.overflow = 'hidden';
                document.documentElement.style.overflow = 'hidden';
            } else {
                document.body.style.overflow = '';
                document.documentElement.style.overflow = '';
            }
        }

        // Burger click toggles drawer
        burger.addEventListener('click', function(e){
            e.preventDefault();
            e.stopPropagation();
            setOpen(!document.body.classList.contains('rz-nav-open'));
        });

        // Click handler for in-menu links and dropdown triggers
        document.addEventListener('click', function(e){
            if (!document.body.classList.contains('rz-nav-open')) return;
            // Don't close if clicking the burger itself
            if (e.target.closest('.rz-nav-burger')) return;

            // DROPDOWN TOGGLE: clicking a .nav-dropdown > a (with aria-haspopup or .dropdown-arrow)
            // — toggle the .is-mobile-open class on the parent <li>, don't navigate.
            var dropdownTrigger = e.target.closest('.nav-dropdown > a, [aria-haspopup="true"]');
            if (dropdownTrigger) {
                var parentLi = dropdownTrigger.closest('.nav-dropdown');
                if (parentLi) {
                    e.preventDefault();
                    e.stopPropagation();
                    var isOpen = parentLi.classList.toggle('is-mobile-open');
                    dropdownTrigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
                    return;
                }
            }

            // Outside-click: if click is OUTSIDE the open menu AND outside the navbar, close
            var insideMenu = e.target.closest('.nav-menu, .nav-links, .cx-nav-links, .rfs-nav-links');
            var insideNavbar = e.target.closest('nav.navbar, header.navbar, nav.cx-nav, nav.rfs-navbar');
            if (!insideMenu && !insideNavbar) {
                setOpen(false);
                return;
            }

            // In-menu link click → close drawer (regular link nav)
            var link = e.target.closest('.nav-menu a, .nav-links a, .cx-nav-links a');
            if (link && !link.matches('.nav-dropdown > a, summary, [aria-haspopup="true"]')) {
                setOpen(false);
            }
        });

        // Esc key closes
        document.addEventListener('keydown', function(e){
            if (e.key === 'Escape' && document.body.classList.contains('rz-nav-open')) {
                setOpen(false);
            }
        });

        // Resize-to-desktop closes (cleanup state)
        var mq = window.matchMedia('(max-width: 768px)');
        if (mq.addEventListener) {
            mq.addEventListener('change', function(e){
                if (!e.matches && document.body.classList.contains('rz-nav-open')) {
                    setOpen(false);
                }
            });
        } else if (mq.addListener) {
            // Older Safari fallback
            mq.addListener(function(e){
                if (!e.matches && document.body.classList.contains('rz-nav-open')) {
                    setOpen(false);
                }
            });
        }

        // Scroll-aware navbar solidity: the base .navbar is background:transparent and only
        // turns solid via the .scrolled class (normally added by script.js). Pages that use a
        // custom inline script instead of script.js never get it, so content bleeds THROUGH the
        // navbar on scroll. Bind it here once so every page that loads this shared nav script is
        // covered. Idempotent with script.js's own handler (both compute from scrollY).
        if (!window.__rzNavScrollBound) {
            window.__rzNavScrollBound = true;
            var navEl = document.querySelector('nav.navbar, header.navbar, .navbar');
            if (navEl) {
                var onNavScroll = function(){
                    var y = window.pageYOffset || document.documentElement.scrollTop || 0;
                    navEl.classList.toggle('scrolled', y > 10);
                };
                window.addEventListener('scroll', onNavScroll, { passive: true });
                onNavScroll();
            }
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
