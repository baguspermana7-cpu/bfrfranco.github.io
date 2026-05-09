/* Resistance Zero — mobile hamburger nav toggle (v1.8.4)
   Fixes critical bug where mobile users had no way to access nav menu after
   v1.8.0 added .nav-menu, .nav-links { display: none; } on mobile.

   Injects a hamburger button into the navbar, toggles full-screen drawer,
   closes on link click + Esc + outside click. Idempotent. CSS-only on
   desktop (display:none on hamburger). */
(function(){
    'use strict';

    function init() {
        // Find the page's primary navbar
        var navbar = document.querySelector('nav.navbar, header.navbar, .navbar, nav.cx-nav, header > nav');
        if (!navbar) return;
        // Skip if hamburger already injected
        if (navbar.querySelector('.rz-nav-burger')) return;

        // Find the right host to append the button — prefer nav-container/nav-right
        var host = navbar.querySelector('.nav-right')
                || navbar.querySelector('.nav-container')
                || navbar;

        var burger = document.createElement('button');
        burger.className = 'rz-nav-burger';
        burger.setAttribute('aria-label', 'Toggle navigation menu');
        burger.setAttribute('aria-expanded', 'false');
        burger.setAttribute('aria-controls', 'rzMobileMenu');
        burger.type = 'button';
        burger.innerHTML = '<span></span><span></span><span></span>';
        host.appendChild(burger);

        function setOpen(open) {
            document.body.classList.toggle('rz-nav-open', open);
            burger.classList.toggle('open', open);
            burger.setAttribute('aria-expanded', open ? 'true' : 'false');
            // Lock body scroll when menu is open
            document.body.style.overflow = open ? 'hidden' : '';
        }

        burger.addEventListener('click', function(e){
            e.preventDefault();
            e.stopPropagation();
            var willOpen = !document.body.classList.contains('rz-nav-open');
            setOpen(willOpen);
        });

        // Close menu when an in-menu link is clicked
        document.addEventListener('click', function(e){
            if (!document.body.classList.contains('rz-nav-open')) return;
            var link = e.target.closest('.nav-menu a, .nav-links a, nav.navbar a, header.navbar a');
            if (link && !link.closest('.nav-dropdown') /* keep dropdowns interactive */) {
                setOpen(false);
            }
        });

        // Close on Esc
        document.addEventListener('keydown', function(e){
            if (e.key === 'Escape' && document.body.classList.contains('rz-nav-open')) {
                setOpen(false);
            }
        });

        // Close on resize-to-desktop so state isn't stuck
        var mq = window.matchMedia('(max-width: 768px)');
        if (mq.addEventListener) {
            mq.addEventListener('change', function(e){
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
