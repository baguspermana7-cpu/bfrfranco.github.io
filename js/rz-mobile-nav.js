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

        // Close when an in-menu link is clicked (but not if it's a dropdown trigger)
        document.addEventListener('click', function(e){
            if (!document.body.classList.contains('rz-nav-open')) return;
            // Don't close if clicking the burger itself
            if (e.target.closest('.rz-nav-burger')) return;
            // Outside-click: if click is OUTSIDE the open menu AND outside the navbar, close
            var insideMenu = e.target.closest('.nav-menu, .nav-links, .cx-nav-links, .rfs-nav-links');
            var insideNavbar = e.target.closest('nav.navbar, header.navbar, nav.cx-nav, nav.rfs-navbar');
            if (!insideMenu && !insideNavbar) {
                setOpen(false);
                return;
            }
            // In-menu link click — close (but not if it's a dropdown summary/expander)
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
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
