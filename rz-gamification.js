/**
 * ResistanceZero — Gamification & Achievement System
 * Lightweight tracker loaded on every page (after auth.js).
 * Tracks page visits, calculator use, article reads, shares.
 * Awards achievement badges and shows toast notifications.
 *
 * localStorage keys:
 *   rz_pages_visited   – array of unique page names
 *   rz_calcs_used      – array of unique calculator names
 *   rz_articles_read   – array of unique article IDs
 *   rz_shares          – number of share-button clicks
 *   rz_achievements    – { id: { unlocked: true, date: "YYYY-MM-DD" } }
 */
(function () {
    'use strict';

    // ═══ STORAGE HELPERS ═══
    function getJSON(key, fallback) {
        try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
        catch (e) { return fallback; }
    }
    function setJSON(key, val) {
        try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
    }

    // ═══ ACHIEVEMENT DEFINITIONS ═══
    var ACHIEVEMENTS = [
        // Explorer
        { id: 'explorer_3',   cat: 'Explorer',         icon: 'fa-compass',        title: 'First Steps',        desc: 'Visit 3 different pages',              check: function () { return getJSON('rz_pages_visited', []).length >= 3; } },
        { id: 'explorer_10',  cat: 'Explorer',         icon: 'fa-binoculars',     title: 'Deep Diver',         desc: 'Visit 10 different pages',             check: function () { return getJSON('rz_pages_visited', []).length >= 10; } },
        { id: 'explorer_25',  cat: 'Explorer',         icon: 'fa-globe',          title: 'Completionist',      desc: 'Visit 25+ pages',                      check: function () { return getJSON('rz_pages_visited', []).length >= 25; } },
        // Calculator Pro
        { id: 'calc_any',     cat: 'Calculator Pro',   icon: 'fa-calculator',     title: 'Number Cruncher',    desc: 'Use any calculator',                   check: function () { return getJSON('rz_calcs_used', []).length >= 1; } },
        { id: 'calc_cost',    cat: 'Calculator Pro',   icon: 'fa-dollar-sign',    title: 'Cost Analyst',       desc: 'Use CAPEX + OPEX calculators',         check: function () { var c = getJSON('rz_calcs_used', []); return c.indexOf('capex') !== -1 && c.indexOf('opex') !== -1; } },
        { id: 'calc_pue',     cat: 'Calculator Pro',   icon: 'fa-bolt',           title: 'Efficiency Expert',  desc: 'Use PUE calculator',                   check: function () { return getJSON('rz_calcs_used', []).indexOf('pue') !== -1; } },
        { id: 'calc_5',       cat: 'Calculator Pro',   icon: 'fa-layer-group',    title: 'Full Stack',         desc: 'Use 5+ different calculators',         check: function () { return getJSON('rz_calcs_used', []).length >= 5; } },
        // Knowledge Seeker
        { id: 'read_1',       cat: 'Knowledge Seeker', icon: 'fa-book-open',      title: 'First Read',         desc: 'Read 1 article (scroll to bottom)',    check: function () { return getJSON('rz_articles_read', []).length >= 1; } },
        { id: 'read_5',       cat: 'Knowledge Seeker', icon: 'fa-bookmark',       title: 'Bookworm',           desc: 'Read 5 articles',                      check: function () { return getJSON('rz_articles_read', []).length >= 5; } },
        { id: 'read_15',      cat: 'Knowledge Seeker', icon: 'fa-graduation-cap', title: 'Scholar',            desc: 'Read 15+ articles',                    check: function () { return getJSON('rz_articles_read', []).length >= 15; } },
        // Standards Expert
        { id: 'std_tia',      cat: 'Standards Expert', icon: 'fa-clipboard-check',title: 'TIA Student',        desc: 'Complete TIA-942 checklist',           check: function () { return getJSON('rz_calcs_used', []).indexOf('tia942') !== -1; } },
        { id: 'std_tier',     cat: 'Standards Expert', icon: 'fa-sitemap',        title: 'Tier Thinker',       desc: 'Use Tier Advisor',                     check: function () { return getJSON('rz_calcs_used', []).indexOf('tier-advisor') !== -1; } },
        { id: 'std_carbon',   cat: 'Standards Expert', icon: 'fa-leaf',           title: 'Carbon Conscious',   desc: 'Use Carbon Footprint calculator',      check: function () { return getJSON('rz_calcs_used', []).indexOf('carbon') !== -1; } },
        // Community
        { id: 'comm_share',   cat: 'Community',        icon: 'fa-share-nodes',    title: 'Sharing is Caring',  desc: 'Share any page',                       check: function () { return (getJSON('rz_shares', 0)) >= 1; } },
        { id: 'comm_dark',    cat: 'Community',        icon: 'fa-moon',           title: 'Dark Side',          desc: 'Switch to dark mode',                  check: function () { return document.documentElement.getAttribute('data-theme') === 'dark' || localStorage.getItem('rz_used_dark') === '1'; } },
        { id: 'comm_night',   cat: 'Community',        icon: 'fa-star',           title: 'Night Owl',          desc: 'Visit between 10 PM – 5 AM',          check: function () { var h = new Date().getHours(); return h >= 22 || h < 5; } }
    ];

    // ═══ CORE TRACKING ═══
    function rzTrackPageVisit(pageName) {
        var pages = getJSON('rz_pages_visited', []);
        if (pages.indexOf(pageName) === -1) {
            pages.push(pageName);
            setJSON('rz_pages_visited', pages);
        }
        rzCheckAchievements();
    }

    function rzTrackCalculatorUse(calcName) {
        var calcs = getJSON('rz_calcs_used', []);
        if (calcs.indexOf(calcName) === -1) {
            calcs.push(calcName);
            setJSON('rz_calcs_used', calcs);
        }
        rzCheckAchievements();
    }

    function rzTrackArticleRead(articleId) {
        var articles = getJSON('rz_articles_read', []);
        if (articles.indexOf(articleId) === -1) {
            articles.push(articleId);
            setJSON('rz_articles_read', articles);
        }
        rzCheckAchievements();
    }

    function rzTrackShare() {
        var shares = getJSON('rz_shares', 0);
        setJSON('rz_shares', shares + 1);
        rzCheckAchievements();
    }

    // ═══ ACHIEVEMENT CHECKING ═══
    function rzCheckAchievements() {
        var achievements = getJSON('rz_achievements', {});
        for (var i = 0; i < ACHIEVEMENTS.length; i++) {
            var a = ACHIEVEMENTS[i];
            if (!achievements[a.id] && a.check()) {
                rzUnlockAchievement(a.id, a.title);
            }
        }
    }

    function rzUnlockAchievement(id, title) {
        var achievements = getJSON('rz_achievements', {});
        if (achievements[id]) return;
        achievements[id] = { unlocked: true, date: new Date().toISOString().split('T')[0] };
        setJSON('rz_achievements', achievements);
        // Find the description
        var desc = '';
        for (var i = 0; i < ACHIEVEMENTS.length; i++) {
            if (ACHIEVEMENTS[i].id === id) { desc = ACHIEVEMENTS[i].desc; break; }
        }
        rzShowToast(title, desc);
    }

    // ═══ TOAST NOTIFICATION ═══
    function rzShowToast(title, desc) {
        // Inject styles once
        if (!document.getElementById('rz-toast-style')) {
            var style = document.createElement('style');
            style.id = 'rz-toast-style';
            style.textContent =
                '.rz-toast{position:fixed;bottom:24px;right:24px;z-index:100000;background:linear-gradient(135deg,#7c3aed,#8b5cf6,#a78bfa);color:#fff;padding:16px 20px;border-radius:12px;box-shadow:0 8px 32px rgba(139,92,246,.4);display:flex;align-items:center;gap:14px;max-width:360px;transform:translateX(120%);opacity:0;transition:transform .4s cubic-bezier(.22,1,.36,1),opacity .4s ease;font-family:Inter,system-ui,sans-serif;}' +
                '.rz-toast.rz-toast--visible{transform:translateX(0);opacity:1;}' +
                '.rz-toast.rz-toast--hide{transform:translateX(120%);opacity:0;}' +
                '.rz-toast-icon{width:40px;height:40px;min-width:40px;border-radius:50%;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:18px;}' +
                '.rz-toast-body{flex:1;}' +
                '.rz-toast-label{font-size:11px;text-transform:uppercase;letter-spacing:1px;opacity:.8;margin-bottom:2px;}' +
                '.rz-toast-title{font-size:15px;font-weight:700;line-height:1.3;}' +
                '.rz-toast-desc{font-size:12px;opacity:.85;margin-top:2px;}';
            document.head.appendChild(style);
        }
        var toast = document.createElement('div');
        toast.className = 'rz-toast';
        toast.innerHTML =
            '<div class="rz-toast-icon">\u2728</div>' +
            '<div class="rz-toast-body">' +
                '<div class="rz-toast-label">Achievement Unlocked!</div>' +
                '<div class="rz-toast-title">' + title + '</div>' +
                (desc ? '<div class="rz-toast-desc">' + desc + '</div>' : '') +
            '</div>';
        document.body.appendChild(toast);
        // Trigger animation
        requestAnimationFrame(function () {
            requestAnimationFrame(function () { toast.classList.add('rz-toast--visible'); });
        });
        // Auto-dismiss after 5s
        setTimeout(function () {
            toast.classList.remove('rz-toast--visible');
            toast.classList.add('rz-toast--hide');
            setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 500);
        }, 5000);
    }

    // ═══ UTILITY ═══
    function rzGetProgress() {
        var achievements = getJSON('rz_achievements', {});
        var unlocked = Object.keys(achievements).length;
        var total = ACHIEVEMENTS.length;
        var percent = total > 0 ? Math.round((unlocked / total) * 100) : 0;
        var level = 'Novice';
        if (percent >= 90) level = 'Master';
        else if (percent >= 65) level = 'Architect';
        else if (percent >= 40) level = 'Engineer';
        else if (percent >= 20) level = 'Technician';
        return { total: total, unlocked: unlocked, percent: percent, level: level };
    }

    // ═══ AUTO-TRACKING ON LOAD ═══
    var pageName = location.pathname.split('/').pop() || 'index.html';
    rzTrackPageVisit(pageName);

    // Dark mode detection
    if (document.documentElement.getAttribute('data-theme') === 'dark') {
        localStorage.setItem('rz_used_dark', '1');
    }
    // Observe theme changes (MutationObserver)
    var obs = new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) {
            if (muts[i].attributeName === 'data-theme') {
                if (document.documentElement.getAttribute('data-theme') === 'dark') {
                    localStorage.setItem('rz_used_dark', '1');
                    rzCheckAchievements();
                }
            }
        }
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    // Calculator detection — look for common calculate buttons
    document.addEventListener('click', function (e) {
        var btn = e.target.closest('button, [onclick]');
        if (!btn) return;
        var text = (btn.textContent || '').toLowerCase().trim();
        var onclick = (btn.getAttribute('onclick') || '').toLowerCase();
        if (text.indexOf('calculate') !== -1 || onclick.indexOf('calculate') !== -1 || onclick.indexOf('runcalc') !== -1) {
            // Determine calculator name from page
            var calcName = detectCalcName(pageName);
            if (calcName) rzTrackCalculatorUse(calcName);
        }
        // Share button detection
        if (text.indexOf('share') !== -1 || btn.classList.contains('share-btn') ||
            btn.closest('.share-buttons') || btn.getAttribute('aria-label') === 'Share') {
            rzTrackShare();
        }
    });

    function detectCalcName(page) {
        var map = {
            'pue-calculator.html': 'pue',
            'capex-calculator.html': 'capex',
            'opex-calculator.html': 'opex',
            'carbon-footprint-calculator.html': 'carbon',
            'carbon-calculator.html': 'carbon',
            'tier-advisor.html': 'tier-advisor',
            'tia-942-checklist.html': 'tia942',
            'tia942-checklist.html': 'tia942',
            'cooling-calculator.html': 'cooling',
            'power-calculator.html': 'power',
            'bandwidth-calculator.html': 'bandwidth',
            'rack-calculator.html': 'rack',
            'ups-calculator.html': 'ups',
            'battery-calculator.html': 'battery',
            'generator-calculator.html': 'generator',
            'compare-air-vs-liquid-cooling.html': 'air-vs-liquid',
            'compare-pue-vs-dcie.html': 'pue-vs-dcie'
        };
        return map[page] || (page.indexOf('calculator') !== -1 || page.indexOf('calc') !== -1 ? page.replace('.html', '') : null);
    }

    // Article read detection — scroll to bottom of <article>
    var articleEl = document.querySelector('article');
    if (articleEl && pageName.indexOf('article') !== -1) {
        var articleTracked = false;
        window.addEventListener('scroll', function () {
            if (articleTracked) return;
            var rect = articleEl.getBoundingClientRect();
            // Consider article read when user scrolls to within 200px of the bottom
            if (rect.bottom <= window.innerHeight + 200) {
                articleTracked = true;
                rzTrackArticleRead(pageName.replace('.html', ''));
            }
        }, { passive: true });
    }

    // Night owl check on load
    rzCheckAchievements();

    // ═══ EXPOSE API ═══
    window.rzTrackPageVisit = rzTrackPageVisit;
    window.rzTrackCalculatorUse = rzTrackCalculatorUse;
    window.rzTrackArticleRead = rzTrackArticleRead;
    window.rzTrackShare = rzTrackShare;
    window.rzCheckAchievements = rzCheckAchievements;
    window.rzUnlockAchievement = rzUnlockAchievement;
    window.rzShowToast = rzShowToast;
    window.rzGetProgress = rzGetProgress;
    window.RZ_ACHIEVEMENTS = ACHIEVEMENTS;
})();
