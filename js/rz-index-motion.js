/* R121 homepage motion (owner via peer 2026-11-11: cinematic motion with Lenis 1.3.27 + GSAP 3.15.0 ScrollTrigger +
 * SplitText). MOCK: loaded by index-motion-mock.html only.
 *
 * Laws (tools/test-index-motion.mjs):
 *  - Lenis only on (pointer: fine) and (hover: hover); a phone gets native scroll.
 *  - prefers-reduced-motion: no Lenis, 0 tweens; the page shows its final state.
 *  - No JS (or a CDN that fails): nothing is hidden; every element starts in its final state in the markup.
 *  - transform and opacity only; nothing is pinned (the owner rejected a pinned scene as "terkunci scroll").
 *  - Each reveal plays once; nothing re-hides on scroll-up.
 *  - Nothing the reader already sees is hidden: when the scripts run after the first paint, on-screen parts stay as they are.
 */
(function () {
    'use strict';
    var mm = window.matchMedia ? function (q) { return window.matchMedia(q).matches; } : function () { return false; };
    var state = { lenis: false, tweens: 0, reason: '' };
    window.RZMotion = state;
    if (mm('(prefers-reduced-motion: reduce)')) { state.reason = 'reduced-motion'; return; }
    var gsap = window.gsap, ST = window.ScrollTrigger, Split = window.SplitText;
    if (!gsap || !ST) { state.reason = 'gsap-missing'; return; }
    gsap.registerPlugin(ST);
    if (Split) gsap.registerPlugin(Split);
    /* GSAP owns the motion here: the CSS .fade-in transitions would fight its per-frame transforms */
    document.documentElement.classList.add('rzm');

    /* one curve for the page: strong ease-out, close to cubic-bezier(0.23, 1, 0.32, 1) */
    var EASE = 'expo.out';
    var count = function (t) { state.tweens += 1; return t; };
    /* Arriving late (after the first paint, which the browser records as a 'paint' entry) must not hide what the reader already sees: anything on
     * screen at that moment stays put; only what is still below the fold animates. */
    var late = !!(window.performance && performance.getEntriesByType && performance.getEntriesByType('paint').length);
    state.late = late;
    var onScreen = function (el) { var r = el.getBoundingClientRect(); return r.top < window.innerHeight && r.bottom > 0; };

    /* smooth scroll: fine pointer + hover only */
    if (window.Lenis && mm('(pointer: fine)') && mm('(hover: hover)')) {
        var lenis = new window.Lenis({ duration: 1.05, smoothWheel: true });
        lenis.on('scroll', ST.update);
        gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
        gsap.ticker.lagSmoothing(0);
        state.lenis = true;
        state.instance = lenis;
    }

    /* hero: the name rises word by word, once, on load */
    var h1 = document.querySelector('.hero h1');
    if (h1 && Split && !(late && onScreen(h1))) {
        var words = new Split(h1, { type: 'words', wordsClass: 'rzm-word' }).words;
        count(gsap.from(words, { yPercent: 60, autoAlpha: 0, duration: 1.1, ease: EASE, stagger: 0.07, delay: 0.1 }));
    }

    /* sections: eyebrow, title, lede, then the items, each section once as its top reaches 85 % of the viewport.
     * Same items the inline reveal used; that reveal is not loaded on this page. */
    var ITEMS = { metrics: '.res-row', 'operational-excellence': '.oe-card', 'case-studies': '.case-card',
        about: '.about-text > *:not(.sec-head), .about-image', faq: '.faq-item, .faq-item-simple', contact: '.contact-info, .contact-form' };
    Object.keys(ITEMS).forEach(function (id) {
        var sec = document.getElementById(id);
        if (!sec || (late && onScreen(sec))) return;
        var head = [sec.querySelector('.sec-eyebrow'), sec.querySelector('.sec-head .section-title, .sec-head h2'),
            sec.querySelector('.sec-head .section-subtitle') || sec.querySelector('.sec-head p:not(.sec-eyebrow)')].filter(Boolean);
        var items = [].slice.call(sec.querySelectorAll(ITEMS[id]));
        if (!head.length && !items.length) return;
        var tl = gsap.timeline({ scrollTrigger: { trigger: sec, start: 'top 85%', once: true } });
        if (head.length) tl.from(head, { y: 22, autoAlpha: 0, duration: 0.8, ease: EASE, stagger: 0.08 });
        if (items.length) tl.from(items, { y: 28, autoAlpha: 0, duration: 0.8, ease: EASE, stagger: Math.min(0.07, 0.56 / items.length) }, head.length ? '-=0.55' : 0);
        count(tl);
    });

    /* employer cards rise in a batch as the row enters */
    var emp = document.querySelectorAll('.emp-card');
    if (emp.length && !(late && onScreen(emp[0]))) count(gsap.from(emp, { y: 24, autoAlpha: 0, duration: 0.8, ease: EASE, stagger: 0.06,
        scrollTrigger: { trigger: emp[0].parentElement, start: 'top 88%', once: true } }));

    /* depth: the portrait drifts a little slower than the page while the hero scrolls away (scrubbed, transform only) */
    var pics = document.querySelectorAll('.rz-photo-frame picture');
    if (pics.length) count(gsap.to(pics, { yPercent: 4, ease: 'none',
        scrollTrigger: { trigger: pics[0].closest('.rz-photo-frame') || pics[0], start: 'top top', end: 'bottom top', scrub: true } }));
})();
