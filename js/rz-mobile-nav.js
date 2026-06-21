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
        // Try most-specific to least-specific selectors
        return document.querySelector(
            'nav.navbar, header.navbar, .navbar, ' +
            'nav.cx-nav, nav.rfs-navbar, ' +
            'header > nav, body > nav:first-of-type'
        );
    }

    function findExistingBurger(navbar) {
        return navbar.querySelector(
            '.hamburger, .menu-toggle, [data-nav-toggle], .nav-toggle, ' +
            '.mobile-menu-btn, button.menuButton'
        );
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
            // Ensure it has the 3-line structure for the X-morph animation
            if (!burger.querySelector('span')) {
                burger.innerHTML = '<span></span><span></span><span></span>';
            }
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
                'display:inline-flex !important;' +
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
        }

        // Store reference on window so the close-on-outside handler can find it
        window.__rzNavBurger = burger;

        function setOpen(open) {
            document.body.classList.toggle('rz-nav-open', open);
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
