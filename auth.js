/**
 * auth.js — Shared Authentication Module for ResistanceZero
 * Provides consistent Login/Logout UI across all pages.
 * Reads/writes localStorage key 'rz_premium_session'.
 * Compatible with capex-calculator.html's built-in auth system.
 */
(function () {
    'use strict';

    /* ───────── Load FontAwesome if not present (async via print/onload pattern) ───────── */
    if (!document.querySelector('link[href*="font-awesome"], link[href*="fontawesome"]')) {
        var fa = document.createElement('link');
        fa.rel = 'stylesheet';
        fa.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
        fa.media = 'print';
        fa.onload = function() { this.media = 'all'; this.onload = null; };
        document.head.appendChild(fa);
    }

    /* ───────── R-015 Phase 3: rz-auth-gateway feature flag ─────────
       AUTH_V2 (localStorage.rz_auth_v2 === '1') routes login/logout/hydrate
       through the Cloudflare Worker auth gateway instead of the hardcoded
       VALID_USERS array below. Default OFF — Worker isn't deployed in
       production yet. Per-browser opt-in is documented in
       worker-auth/SETUP.md §7. Rollout state described in __RZ_AUTH_BACKEND.

       Flag-OFF path MUST be byte-identical to the legacy hardcoded auth so
       that existing pages continue to work unchanged. */
    var __RZ_AUTH_BACKEND = 'mock'; /* 'mock' (current) | 'worker' (post-rollout default) */
    var AUTH_V2 = false;
    var AUTH_GW = '';
    try {
        if (typeof localStorage !== 'undefined') {
            AUTH_V2 = localStorage.getItem('rz_auth_v2') === '1';
            AUTH_GW = localStorage.getItem('rz_auth_gw') || '';
        }
    } catch (e) { /* localStorage unavailable (private mode, SSR) — flag stays off */ }
    /* AUTH_V2 fallback URL — overridable via localStorage.rz_auth_gw. */
    if (AUTH_V2 && !AUTH_GW) AUTH_GW = 'https://rz-auth-gateway.PLACEHOLDER.workers.dev';

    /**
     * Internal fetch helper for the Worker gateway. Always sends cookies,
     * always JSON, parses the standard {ok, data, error} envelope. Throws
     * on non-ok responses with `err.status` set so callers can branch.
     */
    function gw(path, opts) {
        opts = opts || {};
        var url = AUTH_GW + path;
        var fopts = {
            method: opts.method || 'GET',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' }
        };
        if (opts.csrf) fopts.headers['X-CSRF-Token'] = opts.csrf;
        if (opts.body) fopts.body = JSON.stringify(opts.body);
        return fetch(url, fopts).then(function (r) {
            return r.json().then(function (j) {
                if (!j || j.ok !== true) {
                    var err = new Error((j && j.error) || ('gw ' + r.status));
                    err.status = r.status;
                    throw err;
                }
                return j.data;
            });
        });
    }

    /**
     * Worker-backed login: POSTs to /auth/login. On success the Worker sets
     * the HttpOnly rz_sess cookie; we store a UI-only mirror of {email, role,
     * tier, expires} in localStorage so getSession() / updateAuthUI() keep
     * working without a per-render network round-trip. csrf is kept in a
     * separate localStorage key for the rz-ops admin UI (Phase 4).
     */
    function loginV2(email, password) {
        return gw('/auth/login', { method: 'POST', body: { email: email, password: password } })
            .then(function (data) {
                try {
                    localStorage.setItem('rz_auth_csrf', data.csrf || '');
                    localStorage.setItem('rz_premium_session', JSON.stringify({
                        email: data.email,
                        role: data.role,
                        tier: data.tier,
                        expires: (data.expiresAt || 0) * 1000,
                        v2: true
                    }));
                } catch (e) { /* storage full / unavailable */ }
                return data;
            });
    }

    /**
     * Worker-backed logout: POSTs to /auth/logout with the saved CSRF. We
     * always clear the local mirror even if the revoke call fails so the UI
     * never falsely shows a logged-in state after the user clicks logout.
     */
    function logoutV2() {
        var csrf = '';
        try { csrf = localStorage.getItem('rz_auth_csrf') || ''; } catch (e) {}
        return gw('/auth/logout', { method: 'POST', csrf: csrf })
            .catch(function () { /* revoke best-effort */ })
            .then(function () {
                try {
                    localStorage.removeItem('rz_premium_session');
                    localStorage.removeItem('rz_auth_csrf');
                } catch (e) {}
            });
    }

    /**
     * Page-load hydration: GET /auth/me to refresh the local mirror. The
     * Worker is the source of truth — if the cookie expired server-side we
     * clear the local mirror so the login button shows. Runs once at init.
     */
    function hydrateSessionFromWorker() {
        return gw('/auth/me')
            .then(function (data) {
                try {
                    localStorage.setItem('rz_premium_session', JSON.stringify({
                        email: data.email,
                        role: data.role,
                        tier: data.tier,
                        expires: (data.expiresAt || 0) * 1000,
                        v2: true
                    }));
                } catch (e) {}
                return data;
            })
            .catch(function () {
                try {
                    localStorage.removeItem('rz_premium_session');
                    localStorage.removeItem('rz_auth_csrf');
                } catch (e2) {}
                return null;
            });
    }

    var ROOT_EMAILS = ['admin@resistancezero.com', 'bagus@resistancezero.com'];
    var DEMO_EMAILS = ['demo@resistancezero.com'];
    var EDUCATOR_SEED_EMAILS = ['educator@resistancezero.com'];
    /**
     * Load the educator allowlist: seed entries merged with any extras stored
     * by the admin panel under localStorage key 'rz_admin_educators' (JSON
     * array of email strings). Tolerant of corrupt/missing JSON: returns the
     * seed list on any parse error.
     * @returns {string[]} deduped, lowercased, trimmed emails
     */
    function loadEducatorEmails() {
        var out = [];
        var seen = {};
        function push(raw) {
            if (raw == null) return;
            var s = String(raw).toLowerCase().trim();
            if (!s || seen[s]) return;
            seen[s] = 1;
            out.push(s);
        }
        for (var i = 0; i < EDUCATOR_SEED_EMAILS.length; i++) {
            push(EDUCATOR_SEED_EMAILS[i]);
        }
        try {
            if (typeof localStorage !== 'undefined') {
                var raw = localStorage.getItem('rz_admin_educators');
                if (raw) {
                    var extras = JSON.parse(raw);
                    if (extras && extras.length) {
                        for (var j = 0; j < extras.length; j++) push(extras[j]);
                    }
                }
            }
        } catch (e) { /* corrupt JSON or storage unavailable — ignore */ }
        return out;
    }
    var EDUCATOR_EMAILS = loadEducatorEmails();
    if (typeof window !== 'undefined' && window.addEventListener) {
        /* Cross-tab sync: only rebuild when the educator allowlist key
           specifically changes. A full localStorage.clear() (e.key === null)
           is handled by page reload elsewhere — no need to rebuild here. */
        window.addEventListener('storage', function (e) {
            if (e && e.key === 'rz_admin_educators') {
                EDUCATOR_EMAILS = loadEducatorEmails();
            }
        });
        window.addEventListener('rz-educators-changed', function () {
            EDUCATOR_EMAILS = loadEducatorEmails();
        });
    }
    function detectRole(email) {
        var e = String(email || '').toLowerCase().trim();
        if (ROOT_EMAILS.indexOf(e) !== -1) return 'root';
        if (DEMO_EMAILS.indexOf(e) !== -1) return 'demo';
        if (EDUCATOR_EMAILS.indexOf(e) !== -1) return 'educator';
        return 'pro';
    }
    function isRootEmail(email) {
        return ROOT_EMAILS.indexOf(String(email || '').toLowerCase().trim()) !== -1;
    }
    function isRootAccess(session) {
        return !!(session && isRootEmail(session.email));
    }
    function isRootSession() {
        return isRootAccess(getSession());
    }
    function getRoleFromSession(session) {
        if (!session) return '';
        return session.role || detectRole(session.email);
    }
    function normalizePathFromHref(href) {
        if (!href) return '';
        try {
            return new URL(href, window.location.href).pathname.toLowerCase();
        } catch (e) {
            return String(href).toLowerCase().split('#')[0].split('?')[0];
        }
    }
    /* datahallai + dc-conventional were converted from the hard-block ROOT_ONLY_PATHS
       list to the 4-tier feature-flag matrix (gated by enforceTierFeatureAccess() +
       the `page-access` feature in rz-feature-flags.js).
       ROOT-ONLY here (nav lock + click intercept):
        - /dc-market, /dc-market-tracker.html (out of educator scope).
        - /dcmoc — the DCMOC app is a separate Next.js SPA that enforces root itself
          (dcmoc/src/store/auth.ts → ROOT_EMAILS); a resistancezero page-gate can't run
          inside it, so the nav must lock it the same way. Prefix match covers /dcmoc/ + /dcmoc/index.html. */
    var ROOT_ONLY_PATHS = [
        '/dc-market',
        '/dc-market-tracker.html',
        '/dcmoc',
        '/dc-incidents.html',
        '/incident-'
    ];
    function isRootOnlyHref(href) {
        var path = normalizePathFromHref(href);
        if (!path) return false;
        for (var i = 0; i < ROOT_ONLY_PATHS.length; i++) {
            var p = ROOT_ONLY_PATHS[i];
            if (path === p || path === p + '/' || path.indexOf(p + '/') === 0) return true;
        }
        return false;
    }
    function ensureLockIcon(link) {
        if (!link || link.querySelector('.rz-lock-icon, .fa-lock')) return;
        var icon = document.createElement('i');
        icon.className = 'fas fa-lock rz-lock-icon';
        icon.setAttribute('aria-hidden', 'true');
        var floatingLabel = link.querySelector('.floating-card-label');
        if (floatingLabel) {
            floatingLabel.insertAdjacentElement('afterbegin', icon);
            return;
        }
        link.insertAdjacentElement('afterbegin', icon);
    }
    function handleRootOnlyLinkClick(e) {
        var session = getSession();
        var role = getRoleFromSession(session);
        if (role === 'root') return;

        e.preventDefault();
        e.stopPropagation();

        var message = session
            ? 'This module is root-only. Please sign in using a root account.'
            : 'Please sign in with a root account to access this module.';

        if (window._rzAuth && typeof window._rzAuth.showRootGatePrompt === 'function') {
            window._rzAuth.showRootGatePrompt(message);
            return;
        }
        if (window._rzAuth && typeof window._rzAuth.showModal === 'function') {
            window._rzAuth.showModal();
            var err = document.getElementById('rzModalError');
            if (err) {
                err.textContent = message;
                err.classList.add('show');
            }
            return;
        }
        alert(message);
    }
    function updateRootOnlyLinksUI() {
        var session = getSession();
        var role = getRoleFromSession(session);
        var links = document.querySelectorAll('a[href]');
        links.forEach(function (link) {
            var href = link.getAttribute('href');
            if (!isRootOnlyHref(href)) return;
            link.classList.add('rz-root-link');
            ensureLockIcon(link);
            var locked = role !== 'root';
            link.classList.toggle('rz-root-locked', locked);
            link.setAttribute('data-rz-root-only', '1');
            link.setAttribute('title', locked ? 'Root account required' : 'Root access enabled');
            if (!link.dataset.rzRootGuardBound) {
                link.dataset.rzRootGuardBound = '1';
                link.addEventListener('click', handleRootOnlyLinkClick, true);
            }
        });
    }

    /* ───────── Valid Users ─────────
       OFFLINE / DEMO fallback ONLY. Real accounts (bagus/admin/educator) authenticate against Supabase —
       their passwords live in Supabase (migrated), NEVER in this repo. The demo account stays here so the
       site remains usable offline / if Supabase is unreachable. (No real-account secret in source.) */
    var VALID_USERS = [
        { email: 'demo@resistancezero.com', password: 'demo2026', tier: 'demo', role: 'demo' }
    ];

    /* OFFLINE ROOT RECOVERY (v1.127.2) — so a flaky/unreachable/errored Supabase can NEVER lock the
       owner out. When Supabase errors (network blip, unreachable, or the account is not there), a root
       email may sign in offline with a recovery passphrase. The passphrase is NOT stored — only its
       SHA-256 — so reading this file never reveals it. Grants root CLIENT-SIDE, the same trust model as
       ROOT_EMAILS/detectRole (root here unlocks gated educational content, not secrets; and root is
       already client-settable via localStorage, so this lowers no real security floor).
       CHANGE THE PASSPHRASE (keep it DIFFERENT from the live Supabase password so this PUBLIC hash is
       never the live credential):
         node -e 'console.log(require("crypto").createHash("sha256").update("YOUR NEW PASSPHRASE").digest("hex"))'
       then replace the hash(es) below. Default hash = the legacy root passphrase. */
    var OFFLINE_ROOT = {
        'bagus@resistancezero.com': 'e54b1313a65acb2066866ff5e945a2285fc36000cdde111d299f927eaea8998f',
        'admin@resistancezero.com': 'e54b1313a65acb2066866ff5e945a2285fc36000cdde111d299f927eaea8998f'
    };
    function _sha256Hex(str) {
        try {
            var enc = new TextEncoder().encode(String(str || ''));
            return crypto.subtle.digest('SHA-256', enc).then(function (buf) {
                var b = new Uint8Array(buf), h = '';
                for (var i = 0; i < b.length; i++) h += b[i].toString(16).padStart(2, '0');
                return h;
            });
        } catch (e) { return Promise.resolve(null); } /* crypto.subtle needs https/localhost — graceful null on file:// */
    }
    /* Resolves to a root user object when the recovery passphrase hash matches, else null. */
    function offlineRoot(email, password) {
        var e = String(email || '').toLowerCase().trim();
        if (!OFFLINE_ROOT[e]) return Promise.resolve(null);
        return _sha256Hex(password).then(function (h) {
            return (h && h === OFFLINE_ROOT[e]) ? { email: e, tier: 'pro', role: 'root' } : null;
        });
    }

    /* Also check manually-created accounts stored in localStorage by admin */
    function getManualAccounts() {
        try {
            var raw = localStorage.getItem('rz_manual_accounts');
            return raw ? JSON.parse(raw) : [];
        } catch (e) { return []; }
    }

    /* Lazy-load the shared Supabase client (config + module) on demand, so the ONE shared login modal is
       Supabase-aware on EVERY page without adding the module to 105 pages. Resolves to window.rzSupa or null. */
    function ensureSupabase() {
        if (window.rzSupa && window.rzSupa.ready) return window.rzSupa.ready;
        if (window.__rzSupaLoading) return window.__rzSupaLoading;
        window.__rzSupaLoading = new Promise(function (resolve) {
            function loadModule() {
                var m = document.createElement('script');
                m.type = 'module';
                m.src = '/js/rz-supabase.js?v=2026-08-22-netretry';
                m.onload = function () {
                    var r = (window.rzSupa && window.rzSupa.ready) ? window.rzSupa.ready : Promise.resolve(window.rzSupa || null);
                    r.then(resolve).catch(function () { resolve(window.rzSupa || null); });
                };
                m.onerror = function () { resolve(null); };
                document.head.appendChild(m);
            }
            if (window.RZ_CONFIG) { loadModule(); return; }
            var c = document.createElement('script');
            c.src = '/js/rz-config.js?v=2026-07-13';
            c.onload = loadModule;
            c.onerror = function () { resolve(null); };
            document.head.appendChild(c);
        });
        return window.__rzSupaLoading;
    }

    /* demo/manual offline fallback only (real accounts go through Supabase). */
    function findUser(email, password) {
        var e = email.toLowerCase().trim();
        var p = password.trim();
        var match = null;
        VALID_USERS.forEach(function (u) {
            if (u.email === e && u.password === p) {
                match = { email: u.email, tier: u.tier || 'pro', role: u.role || detectRole(u.email) };
            }
        });
        if (match) return match;
        /* Check manual accounts */
        var manuals = getManualAccounts();
        manuals.forEach(function (u) {
            if (u.email.toLowerCase() === e && u.password === p) {
                match = { email: u.email, tier: u.tier || 'pro', role: u.role || detectRole(u.email) };
            }
        });
        return match;
    }

    /* ───────── Session ───────── */
    function getSession() {
        try {
            var raw = localStorage.getItem('rz_premium_session');
            if (!raw) return null;
            var data = JSON.parse(raw);
            if (data.expires && new Date(data.expires) < new Date()) {
                localStorage.removeItem('rz_premium_session');
                return null;
            }
            if (!data.role) {
                data.role = detectRole(data.email);
                localStorage.setItem('rz_premium_session', JSON.stringify(data));
            }
            return data;
        } catch (e) { return null; }
    }

    function setSession(email, tier, role) {
        var expires = new Date();
        expires.setDate(expires.getDate() + 30);
        localStorage.setItem('rz_premium_session', JSON.stringify({
            email: email,
            tier: tier,
            role: role || detectRole(email),
           expires: expires.toISOString()
        }));
    }

    function clearSession() {
        localStorage.removeItem('rz_premium_session');
    }

    /* ───────── CSS Injection ───────── */
    function injectCSS() {
        if (document.getElementById('rz-auth-css')) return;
        var style = document.createElement('style');
        style.id = 'rz-auth-css';
        style.textContent = [
            /* Auth wrap */
            '.rz-auth-wrap{display:inline-flex;align-items:center;position:relative;margin-left:8px;vertical-align:middle;}',
            /* Login button */
            '.rz-login-btn{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:10px;border:1px solid rgba(139,92,246,0.4);background:linear-gradient(135deg,rgba(139,92,246,0.15),rgba(168,85,247,0.08));color:#a78bfa;font-size:0.82rem;font-weight:600;cursor:pointer;transition:all 0.3s;font-family:inherit;white-space:nowrap;}',
            '.rz-login-btn:hover{background:linear-gradient(135deg,rgba(139,92,246,0.25),rgba(168,85,247,0.15));transform:translateY(-1px);box-shadow:0 4px 15px rgba(139,92,246,0.2);}',
            '.rz-login-btn i{font-size:1rem;}',
            /* User button (logged in) */
            '.rz-user-btn{display:inline-flex;align-items:center;gap:8px;padding:6px 12px;border-radius:10px;border:1px solid rgba(139,92,246,0.3);background:rgba(139,92,246,0.08);color:#c4b5fd;cursor:pointer;font-family:inherit;font-size:0.82rem;transition:all 0.3s;}',
            '.rz-user-btn:hover{background:rgba(139,92,246,0.15);}',
            '.rz-user-avatar{width:28px;height:28px;border-radius:8px;background:linear-gradient(135deg,#8b5cf6,#a78bfa);display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:700;color:#fff;}',
            '.rz-user-email{max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
            '.rz-user-chevron{font-size:0.65rem;opacity:0.6;transition:transform 0.2s;}',
            /* Dropdown */
            '.rz-user-dropdown{position:absolute;top:calc(100% + 6px);right:0;min-width:220px;background:rgba(15,23,42,0.98);border:1px solid rgba(139,92,246,0.3);border-radius:12px;padding:12px;opacity:0;visibility:hidden;transform:translateY(-8px);transition:all 0.2s;z-index:9999;backdrop-filter:blur(20px);}',
            '.rz-user-dropdown.show{opacity:1;visibility:visible;transform:translateY(0);}',
            '.rz-dd-header{display:flex;align-items:center;gap:8px;padding-bottom:10px;border-bottom:1px solid rgba(255,255,255,0.1);margin-bottom:8px;}',
            '.rz-dd-badge{padding:3px 10px;border-radius:6px;font-size:0.7rem;font-weight:700;letter-spacing:0.5px;}',
            '.rz-dd-badge.pro{background:linear-gradient(135deg,#8b5cf6,#a78bfa);color:#fff;}',
            '.rz-dd-badge.free{background:rgba(100,116,139,0.2);color:#94a3b8;}',
            /* Educator role (tier=pro, role=educator) — instrument-cyan, matches rz-ops admin UI. NOT purple. */
            '.rz-dd-badge.educator{background:rgba(8,145,178,0.18);color:#67e8f9;}',
            '.rz-dd-email{font-size:0.78rem;color:#94a3b8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
            '.rz-dd-logout{display:flex;align-items:center;gap:8px;width:100%;padding:8px 10px;border:none;border-radius:8px;background:rgba(239,68,68,0.1);color:#f87171;cursor:pointer;font-size:0.8rem;font-family:inherit;transition:all 0.2s;}',
            '.rz-dd-logout:hover{background:rgba(239,68,68,0.2);}',
            /* Login Modal */
            '.rz-modal-overlay{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.75);z-index:99999;display:none;align-items:center;justify-content:center;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);}',
            '.rz-modal-overlay.show{display:flex;}',
            '.rz-modal{width:380px;max-width:90vw;background:#0f172a;border:1px solid rgba(139,92,246,0.3);border-radius:16px;padding:32px;position:relative;box-shadow:0 25px 60px rgba(0,0,0,0.6),0 0 0 1px rgba(255,255,255,0.04) inset;}',
            '.rz-modal-close{position:absolute;top:12px;right:12px;width:32px;height:32px;border:none;border-radius:8px;background:rgba(255,255,255,0.05);color:#94a3b8;font-size:1.1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s;}',
            '.rz-modal-close:hover{background:rgba(255,255,255,0.1);color:#fff;}',
            '.rz-modal h3{margin:0 0 6px;font-size:1.3rem;color:#f1f5f9;font-weight:700;}',
            '.rz-modal .rz-modal-sub{font-size:0.82rem;color:#94a3b8;margin:0 0 24px;}',
            '.rz-modal label{display:block;font-size:0.78rem;font-weight:600;color:#94a3b8;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px;}',
            '.rz-modal input[type="email"],.rz-modal input[type="password"]{width:100%;padding:10px 14px;border-radius:10px;border:1px solid #334155;background:#1e293b;color:#f1f5f9;font-size:0.9rem;font-family:inherit;margin-bottom:16px;box-sizing:border-box;outline:none;transition:border-color 0.2s,box-shadow 0.2s;}',
            '.rz-modal input:focus{border-color:rgba(139,92,246,0.5);box-shadow:0 0 0 3px rgba(139,92,246,0.1);}',
            '.rz-modal .rz-submit-btn{width:100%;padding:12px;border:none;border-radius:10px;background:linear-gradient(135deg,#8b5cf6,#7c3aed);color:#fff;font-size:0.9rem;font-weight:600;cursor:pointer;font-family:inherit;transition:all 0.3s;}',
            '.rz-modal .rz-submit-btn:hover{transform:translateY(-1px);box-shadow:0 8px 25px rgba(139,92,246,0.3);}',
            '.rz-modal .rz-submit-btn:disabled{opacity:0.5;cursor:not-allowed;transform:none;box-shadow:none;}',
            '.rz-modal .rz-error{display:none;padding:8px 12px;border-radius:8px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);color:#f87171;font-size:0.8rem;margin-bottom:12px;}',
            '.rz-modal .rz-error.show{display:block;}',
            '.rz-modal .rz-success{display:none;text-align:center;padding:20px 0;}',
            '.rz-modal .rz-success.show{display:block;}',
            '.rz-modal .rz-success i{font-size:2.5rem;color:#10b981;margin-bottom:10px;}',
            '.rz-modal .rz-success p{color:#f1f5f9;font-weight:600;margin:4px 0;}',
            '.rz-modal .rz-success small{color:#64748b;font-size:0.8rem;}',
            /* Light theme */
            '[data-theme="light"] .rz-login-btn{background:linear-gradient(135deg,rgba(139,92,246,0.1),rgba(168,85,247,0.05));color:#7c3aed;border-color:rgba(139,92,246,0.3);}',
            '[data-theme="light"] .rz-user-btn{background:rgba(139,92,246,0.06);color:#6d28d9;border-color:rgba(139,92,246,0.2);}',
            '[data-theme="light"] .rz-user-avatar{background:linear-gradient(135deg,#7c3aed,#8b5cf6);}',
            '[data-theme="light"] .rz-user-dropdown{background:rgba(255,255,255,0.98);border-color:rgba(139,92,246,0.2);box-shadow:0 10px 40px rgba(0,0,0,0.12);}',
            '[data-theme="light"] .rz-dd-email{color:#475569;}',
            '[data-theme="light"] .rz-dd-logout{background:rgba(239,68,68,0.06);color:#dc2626;}',
            '[data-theme="light"] .rz-modal{background:#ffffff;border-color:rgba(139,92,246,0.2);box-shadow:0 25px 60px rgba(0,0,0,0.15),0 0 0 1px rgba(0,0,0,0.04) inset;}',
            '[data-theme="light"] .rz-modal h3{color:#1e293b;}',
            '[data-theme="light"] .rz-modal .rz-modal-sub{color:#64748b;}',
            '[data-theme="light"] .rz-modal label{color:#475569;}',
            '.rz-modal .rz-modal-legal{color:#94a3b8;}',
            '.rz-modal .rz-modal-legal a{color:#a78bfa;text-decoration:underline;text-underline-offset:2px;}',
            '[data-theme="light"] .rz-modal .rz-modal-legal{color:#475569;}',
            '[data-theme="light"] .rz-modal .rz-modal-legal a{color:#6d28d9;}',
            '[data-theme="light"] .rz-modal input[type="email"],[data-theme="light"] .rz-modal input[type="password"]{background:#f1f5f9;border-color:#e2e8f0;color:#1e293b;}',
            '[data-theme="light"] .rz-modal input:focus{border-color:rgba(139,92,246,0.5);background:#fff;}',
            '[data-theme="light"] .rz-modal-close{background:rgba(0,0,0,0.05);color:#64748b;}',
            '[data-theme="light"] .rz-demo-hint{background:rgba(139,92,246,0.06) !important;border-color:rgba(139,92,246,0.15) !important;color:#475569 !important;}',
            '[data-theme="light"] .rz-demo-hint code{background:rgba(139,92,246,0.1) !important;color:#6d28d9 !important;}',
            '[data-theme="light"] .rz-demo-hint .rz-demo-label{color:#7c3aed !important;}',
            '[data-theme="light"] .rz-pro-link{color:#7c3aed !important;}',
            '[data-theme="light"] .rz-pro-link:hover{color:#6d28d9 !important;}',
            /* Pro link */
            '.rz-pro-link:hover{color:#a78bfa !important;text-decoration:underline !important;}',
            '.rz-root-link .rz-lock-icon{font-size:.7em;margin-right:5px;opacity:.65;}',
            '.rz-root-link.rz-root-locked{filter:saturate(0.9);}',
            '.floating-side-card.rz-root-link .floating-card-label{display:inline-flex;align-items:center;}',
            '.floating-side-card.rz-root-link .rz-lock-icon{font-size:.72em;margin-right:6px;opacity:.85;}',
            /* Responsive */
            '@media(max-width:768px){.rz-user-email{display:none;}.rz-login-btn .rz-login-text{display:none;}.rz-login-btn{padding:8px 12px;}}'
        ].join('\n');
        document.head.appendChild(style);
    }

    /* ───────── HTML Templates ───────── */
    function authButtonHTML() {
        return '<div class="rz-auth-wrap" id="rzAuthWrap">' +
            '<button class="rz-login-btn" id="rzLoginBtn" onclick="window._rzAuth.showModal()" aria-label="Login">' +
                '<i class="fas fa-user-circle"></i>' +
                '<span class="rz-login-text">Login</span>' +
            '</button>' +
            '<button class="rz-user-btn" id="rzUserBtn" style="display:none;" onclick="window._rzAuth.toggleDropdown()">' +
                '<div class="rz-user-avatar" id="rzUserAvatar">U</div>' +
                '<span class="rz-user-email" id="rzUserEmail"></span>' +
                '<i class="fas fa-chevron-down rz-user-chevron"></i>' +
            '</button>' +
            '<div class="rz-user-dropdown" id="rzUserDropdown">' +
                '<div class="rz-dd-header">' +
                    '<div class="rz-dd-badge" id="rzDdBadge">PRO</div>' +
                    '<div class="rz-dd-email" id="rzDdEmail"></div>' +
                '</div>' +
                '<button class="rz-dd-logout" onclick="window._rzAuth.logout()">' +
                    '<i class="fas fa-sign-out-alt"></i> Logout' +
                '</button>' +
            '</div>' +
        '</div>';
    }

    function loginModalHTML() {
        return '<div class="rz-modal-overlay" id="rzModalOverlay" role="dialog" aria-modal="true" aria-labelledby="rzModalTitle">' +
            '<div class="rz-modal">' +
                '<button class="rz-modal-close" onclick="window._rzAuth.hideModal()" aria-label="Close login dialog">&times;</button>' +
                '<div id="rzModalForm">' +
                    '<h3 id="rzModalTitle"><i class="fas fa-shield-alt" style="color:#8b5cf6;margin-right:8px;" aria-hidden="true"></i>Sign In</h3>' +
                    '<p class="rz-modal-sub">Access calculators, tools, and analytical content.</p>' +
                    '<div class="rz-error" id="rzModalError">Invalid email or password.</div>' +
                    /* v1.40.1 — wrapped in <form> so Enter submits + autocomplete + browser warns on insecure context */
                    '<form id="rzModalFormEl" onsubmit="event.preventDefault();window._rzAuth.doLogin();return false;" novalidate>' +
                    '<label for="rzModalEmail">Email</label>' +
                    '<input type="email" id="rzModalEmail" name="email" placeholder="your@email.com" autocomplete="email" required>' +
                    '<label for="rzModalPassword">Password</label>' +
                    '<input type="password" id="rzModalPassword" name="password" placeholder="Enter password" autocomplete="current-password" required>' +
                    '<button type="submit" class="rz-submit-btn" id="rzModalSubmit">Sign In</button>' +
                    '</form>' +
                    '<div class="rz-modal-legal" style="text-align:center;margin-top:12px;font-size:0.68rem;line-height:1.5;">' +
                        'By signing in, you agree to our <a href="terms.html">Terms</a> &amp; <a href="privacy.html">Privacy Policy</a>' +
                    '</div>' +
                    '<div class="rz-demo-hint" style="text-align:center;margin-top:14px;padding:10px 12px;border-radius:8px;background:rgba(139,92,246,0.12);border:1px solid rgba(139,92,246,0.25);font-size:0.78rem;color:#94a3b8;line-height:1.5;">' +
                        '<span class="rz-demo-label" style="color:#a78bfa;font-weight:600;">Demo Account:</span><br>' +
                        '<code style="background:rgba(139,92,246,0.15);padding:2px 6px;border-radius:4px;font-size:0.75rem;color:#c4b5fd;">demo@resistancezero.com</code> / ' +
                        '<code style="background:rgba(139,92,246,0.15);padding:2px 6px;border-radius:4px;font-size:0.75rem;color:#c4b5fd;">demo2026</code>' +
                    '</div>' +
                '</div>' +
                '<div class="rz-success" id="rzModalSuccess">' +
                    '<i class="fas fa-check-circle"></i>' +
                    '<p id="rzSuccessTier">Access Activated</p>' +
                    '<small>Page will refresh in a moment...</small>' +
                '</div>' +
            '</div>' +
        '</div>';
    }

    /* ───────── Navbar Detection & Injection ───────── */
    function injectAuthButton() {
        /* Skip if already injected */
        if (document.getElementById('rzAuthWrap')) return;
        /* Skip if page has its own auth UI (calculators, dc-market-tracker, articles with inline auth) */
        if (document.getElementById('navAuthWrap') || document.getElementById('navLoginBtn')) return;
        if (document.querySelector('.nav-login-btn') || document.querySelector('[id$="NavLoginBtn"]')) return;

        var html = authButtonHTML();
        var inserted = false;

        /* Type A: Portfolio nav — <ul class="nav-menu"> ... </ul> then <button class="theme-toggle"> */
        var navMenu = document.querySelector('ul.nav-menu');
        if (navMenu && !inserted) {
            var themeToggle = navMenu.parentElement.querySelector('.theme-toggle, button.theme-toggle');
            if (themeToggle) {
                themeToggle.insertAdjacentHTML('beforebegin', html);
                inserted = true;
            } else {
                navMenu.insertAdjacentHTML('afterend', html);
                inserted = true;
            }
        }

        /* Type B: Calculator/DC Solutions nav — <div class="nav-links"> with .nav-back */
        if (!inserted) {
            var navLinks = document.querySelector('.nav-links');
            if (navLinks) {
                var navBack = navLinks.querySelector('.nav-back');
                if (navBack) {
                    navBack.insertAdjacentHTML('beforebegin', html);
                    inserted = true;
                } else {
                    var toggle = navLinks.querySelector('.theme-toggle');
                    if (toggle) {
                        toggle.insertAdjacentHTML('beforebegin', html);
                        inserted = true;
                    } else {
                        navLinks.insertAdjacentHTML('beforeend', html);
                        inserted = true;
                    }
                }
            }
        }

        /* Type C: datahallAI / dc-conventional header — .hdr-r or .header-right */
        if (!inserted) {
            var hdrRight = document.querySelector('.hdr-r') || document.querySelector('.header-right');
            if (hdrRight) {
                hdrRight.insertAdjacentHTML('afterbegin', html);
                inserted = true;
            }
        }

        /* Fallback: inject into first nav or header found */
        if (!inserted) {
            var nav = document.querySelector('nav.navbar .nav-container') || document.querySelector('nav') || document.querySelector('header');
            if (nav) {
                nav.insertAdjacentHTML('beforeend', html);
                inserted = true;
            }
        }
    }

    function injectLoginModal() {
        if (document.getElementById('rzModalOverlay')) return;
        document.body.insertAdjacentHTML('beforeend', loginModalHTML());

        /* Close on overlay click */
        var overlay = document.getElementById('rzModalOverlay');
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) window._rzAuth.hideModal();
        });

        /* Enter key to submit */
        var passInput = document.getElementById('rzModalPassword');
        if (passInput) {
            passInput.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') window._rzAuth.doLogin();
            });
        }
        var emailInput = document.getElementById('rzModalEmail');
        if (emailInput) {
            emailInput.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') document.getElementById('rzModalPassword').focus();
            });
        }
    }

    /* ───────── UI Update ───────── */
    function updateAuthUI() {
        var session = getSession();
        /* Prefer the shared injected buttons (rz*), but FALL BACK to a page's own
           hardcoded nav auth markup (nav*) — calculators, spares, dc-market-tracker,
           and any page carrying #navAuthWrap. injectAuthButton() skips shared-button
           injection on those pages, so without this fallback updateAuthUI() would
           early-return and the page's Login button would stay stale even when logged
           in (the recurring "login button shows on every page" bug). Idempotent +
           safe on pages that also run their own local sync (same end state). */
        var loginBtn = document.getElementById('rzLoginBtn') || document.getElementById('navLoginBtn');
        var userBtn = document.getElementById('rzUserBtn') || document.getElementById('navUserBtn');
        var dropdown = document.getElementById('rzUserDropdown') || document.getElementById('navUserDropdown');

        if (!loginBtn || !userBtn) return;

        if (session) {
            loginBtn.style.display = 'none';
            userBtn.style.display = 'inline-flex';
            var avatar = document.getElementById('rzUserAvatar') || document.getElementById('navUserAvatar');
            var emailEl = document.getElementById('rzUserEmail') || document.getElementById('navUserEmail');
            var ddBadge = document.getElementById('rzDdBadge') || document.getElementById('navDdTierBadge');
            var ddEmail = document.getElementById('rzDdEmail') || document.getElementById('navDdEmail');
            if (avatar) avatar.textContent = session.email.charAt(0).toUpperCase();
            if (emailEl) emailEl.textContent = session.email.split('@')[0];
            if (ddEmail) ddEmail.textContent = session.email;
            if (ddBadge) {
                /* Educator role (tier=pro, role=educator) gets a distinct cyan
                   EDUCATOR badge to match the rz-ops admin UI palette. Other
                   roles fall back to the legacy tier-driven label. */
                var role = getRoleFromSession(session);
                var tier = session.tier || 'pro';
                if (role === 'educator') {
                    ddBadge.textContent = 'EDUCATOR';
                    ddBadge.className = 'rz-dd-badge educator';
                } else {
                    ddBadge.textContent = tier.toUpperCase();
                    ddBadge.className = 'rz-dd-badge ' + (tier === 'pro' ? 'pro' : 'free');
                }
            }
        } else {
            loginBtn.style.display = 'inline-flex';
            userBtn.style.display = 'none';
            if (dropdown) dropdown.classList.remove('show');
        }
        updateRootOnlyLinksUI();
    }

    /* ───────── Public API ───────── */
    window._rzAuth = {
        isRootEmail: isRootEmail,
        isRootAccess: isRootAccess,
        isRootSession: isRootSession,
        isRootOnlyHref: isRootOnlyHref,

        showModal: function () {
            var overlay = document.getElementById('rzModalOverlay');
            var form = document.getElementById('rzModalForm');
            var success = document.getElementById('rzModalSuccess');
            var error = document.getElementById('rzModalError');
            if (form) form.style.display = 'block';
            if (success) success.className = 'rz-success';
            if (error) error.className = 'rz-error';
            if (overlay) overlay.classList.add('show');
            this._prevFocus = document.activeElement;
            setTimeout(function () {
                var em = document.getElementById('rzModalEmail');
                if (em) em.focus();
            }, 100);
            // Focus trap
            if (!this._trapHandler) {
                var self = this;
                this._trapHandler = function(e) {
                    if (e.key === 'Escape') { self.hideModal(); return; }
                    if (e.key !== 'Tab') return;
                    var modal = document.querySelector('.rz-modal');
                    if (!modal) return;
                    var focusable = modal.querySelectorAll('input,button,a,[tabindex]:not([tabindex="-1"])');
                    if (!focusable.length) return;
                    var first = focusable[0], last = focusable[focusable.length - 1];
                    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
                    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
                };
            }
            document.addEventListener('keydown', this._trapHandler);
        },

        hideModal: function () {
            var overlay = document.getElementById('rzModalOverlay');
            if (overlay) overlay.classList.remove('show');
            if (this._trapHandler) document.removeEventListener('keydown', this._trapHandler);
            if (this._prevFocus) { try { this._prevFocus.focus(); } catch(e){} }
        },

        showRootGatePrompt: function (message) {
            this.showModal();
            var error = document.getElementById('rzModalError');
            if (error) {
                error.textContent = message || 'Root account required for this module.';
                error.classList.add('show');
            }
        },

        doLogin: function () {
            var emailEl = document.getElementById('rzModalEmail');
            var passEl = document.getElementById('rzModalPassword');
            var errorEl = document.getElementById('rzModalError');
            var formEl = document.getElementById('rzModalForm');
            var successEl = document.getElementById('rzModalSuccess');
            var tierLabel = document.getElementById('rzSuccessTier');

            var email = emailEl ? emailEl.value.trim() : '';
            var password = passEl ? passEl.value : '';

            if (!email || !password) {
                if (errorEl) { errorEl.textContent = 'Please enter email and password.'; errorEl.classList.add('show'); }
                return;
            }

            /* Phase 3: Worker-backed login when feature flag is on. The
               worker is the source of truth; we keep a UI-only mirror in
               localStorage so render code (badge, dropdown) keeps working
               without a per-render network call. On Worker failure we
               surface the error explicitly — NO silent fallback to the
               hardcoded VALID_USERS array (plan §6 threat model). */
            if (AUTH_V2) {
                loginV2(email, password).then(function (data) {
                    if (formEl) formEl.style.display = 'none';
                    if (tierLabel) tierLabel.textContent = 'Access Activated';
                    if (successEl) successEl.classList.add('show');
                    updateAuthUI();
                    window.dispatchEvent(new CustomEvent('rz-auth-change', {
                        detail: {
                            email: data.email,
                            tier: data.tier,
                            role: data.role || detectRole(data.email),
                            action: 'login'
                        }
                    }));
                    setTimeout(function () {
                        window._rzAuth.hideModal();
                        var path = window.location.pathname.toLowerCase();
                        if (path.indexOf('capex-calculator') !== -1 || path.indexOf('opex-calculator') !== -1) {
                            window.location.reload();
                        }
                    }, 1500);
                }).catch(function (err) {
                    if (!errorEl) return;
                    var msg = 'Invalid email or password.';
                    if (err && err.status === 403) {
                        msg = 'Account disabled. Contact support.';
                    } else if (err && err.status === 429) {
                        msg = 'Too many attempts. Try again in a few minutes.';
                    } else if (!err || !err.status) {
                        /* Network / parse failure — Worker unreachable. */
                        msg = 'Auth service unavailable — please retry.';
                    }
                    /* v1.29.0 — append stale-cache rescue link */
                    errorEl.innerHTML = msg + ' ' +
                        '<a href="#" onclick="event.preventDefault();if(navigator.serviceWorker){navigator.serviceWorker.getRegistrations().then(function(rs){rs.forEach(function(r){r.unregister()});});}if(window.caches){caches.keys().then(function(ks){ks.forEach(function(k){caches.delete(k)})});}localStorage.removeItem(\'rz_premium_session\');localStorage.removeItem(\'rz_auth_v2\');localStorage.removeItem(\'rz_auth_gw\');localStorage.removeItem(\'rz_auth_csrf\');setTimeout(function(){location.reload()},500);return false;" style="color:#a78bfa;text-decoration:underline;cursor:pointer">Try fresh reload</a>';
                    errorEl.classList.add('show');
                });
                return;
            }

            var rescueLink = ' <a href="#" onclick="event.preventDefault();if(navigator.serviceWorker){navigator.serviceWorker.getRegistrations().then(function(rs){rs.forEach(function(r){r.unregister()});});}if(window.caches){caches.keys().then(function(ks){ks.forEach(function(k){caches.delete(k)})});}localStorage.removeItem(\'rz_premium_session\');localStorage.removeItem(\'rz_auth_v2\');localStorage.removeItem(\'rz_auth_gw\');localStorage.removeItem(\'rz_auth_csrf\');setTimeout(function(){location.reload()},500);return false;" style="color:#a78bfa;text-decoration:underline;cursor:pointer">Try fresh reload</a>';
            function _showErr(msg) { if (!errorEl) return; errorEl.innerHTML = msg + rescueLink; errorEl.classList.add('show'); }
            function _finish(u) {
                if (errorEl) { errorEl.classList.remove('show'); errorEl.textContent = ''; }
                setSession(u.email, u.tier, u.role);
                if (formEl) formEl.style.display = 'none';
                if (tierLabel) tierLabel.textContent = 'Access Activated';
                if (successEl) successEl.classList.add('show');
                updateAuthUI();
                window.dispatchEvent(new CustomEvent('rz-auth-change', { detail: { email: u.email, tier: u.tier, role: u.role || detectRole(u.email), action: 'login' } }));
                setTimeout(function () {
                    window._rzAuth.hideModal();
                    var path = window.location.pathname.toLowerCase();
                    if (path.indexOf('capex-calculator') !== -1 || path.indexOf('opex-calculator') !== -1) { window.location.reload(); }
                }, 1500);
            }

            /* Supabase-PRIMARY: real accounts authenticate against Supabase (source of truth post-migration);
               tier comes from the profile row, role from the email allowlist (detectRole — not a secret).
               The hardcoded demo/manual accounts are an OFFLINE fallback only. */
            var emailNorm = email.toLowerCase().trim();
            ensureSupabase().then(function (supa) {
                if (supa && supa.configured) {
                    return supa.signIn(email, password).then(function (res) {
                        if (res && res.error) {
                            /* Only fall through to the offline demo/manual set for emails that are actually in
                               it — never run findUser for a real (Supabase) account that just failed auth. */
                            var eN = email.toLowerCase().trim();
                            var known = VALID_USERS.some(function (u) { return u.email === eN; })
                                || getManualAccounts().some(function (u) { return String(u.email || '').toLowerCase() === eN; });
                            if (known) { var demoA = findUser(email, password); if (demoA) { _finish(demoA); return; } }
                            /* Offline root recovery — Supabase errored (network blip, unreachable, or no
                               such account); let the owner in with the recovery passphrase so Supabase
                               state can never lock root out. Falls through to the real error otherwise. */
                            return offlineRoot(email, password).then(function (ru) {
                                if (ru) { _finish(ru); return; }
                                /* Surface WHAT Supabase actually rejected so the fix is obvious. */
                                var em = String((res.error && res.error.message) || res.error || '').toLowerCase();
                                if (/not confirmed|confirm/.test(em)) {
                                    _showErr('Email belum dikonfirmasi. Cek inbox untuk link konfirmasi, atau konfirmasi lewat setup-supabase.html.');
                                } else if (/invalid login|invalid credentials/.test(em)) {
                                    _showErr('Email/password salah — atau akun ini belum ada di Supabase. Reset password-nya di Supabase → Authentication → Users, atau daftar di account.html.');
                                } else {
                                    _showErr('Login gagal: ' + (em || 'invalid email or password') + '.');
                                }
                            });
                        }
                        return supa.getProfile().then(function (pr) {
                            var tier = (pr && pr.data && pr.data.tier) || 'pro';
                            _finish({ email: emailNorm, tier: tier, role: detectRole(emailNorm) });
                        }).catch(function () {
                            _finish({ email: emailNorm, tier: 'pro', role: detectRole(emailNorm) });
                        });
                    });
                }
                /* Supabase unreachable/unconfigured → offline demo/manual + root-recovery fallback */
                var demoB = findUser(email, password);
                if (demoB) { _finish(demoB); return; }
                return offlineRoot(email, password).then(function (ru) {
                    if (ru) { _finish(ru); return; }
                    _showErr('Server auth sedang tidak tersedia (mungkin Supabase paused/restoring). Coba lagi, atau masuk offline dengan passphrase recovery root.');
                });
            }).catch(function () {
                var demoC = findUser(email, password);
                if (demoC) { _finish(demoC); return; }
                offlineRoot(email, password).then(function (ru) {
                    if (ru) { _finish(ru); } else { _showErr('Server auth sedang tidak tersedia (mungkin Supabase paused/restoring). Coba lagi, atau masuk offline dengan passphrase recovery root.'); }
                });
            });
        },

        logout: function () {
            /* Phase 3: revoke the Worker session before clearing UI state.
               logoutV2() never rejects — it always proceeds to clear the
               local mirror even if the revoke call fails. */
            if (AUTH_V2) {
                logoutV2().then(function () {
                    updateAuthUI();
                    var dropdown = document.getElementById('rzUserDropdown');
                    if (dropdown) dropdown.classList.remove('show');
                    window.dispatchEvent(new CustomEvent('rz-auth-change', { detail: { action: 'logout' } }));
                    var path = window.location.pathname.toLowerCase();
                    if (path.indexOf('capex-calculator') !== -1 || path.indexOf('opex-calculator') !== -1) {
                        window.location.reload();
                    }
                });
                return;
            }
            clearSession();
            updateAuthUI();
            var dropdown = document.getElementById('rzUserDropdown');
            if (dropdown) dropdown.classList.remove('show');
            window.dispatchEvent(new CustomEvent('rz-auth-change', { detail: { action: 'logout' } }));
            /* If on calculator page, reload to restore gating */
            var path = window.location.pathname.toLowerCase();
            if (path.indexOf('capex-calculator') !== -1 || path.indexOf('opex-calculator') !== -1) {
                window.location.reload();
            }
        },

        toggleDropdown: function () {
            var dropdown = document.getElementById('rzUserDropdown');
            if (dropdown) dropdown.classList.toggle('show');
        },

        getSession: getSession,

        /**
         * Read the saved CSRF token (set by loginV2 on success). Used by the
         * Phase 4 rz-ops admin UI to populate X-CSRF-Token on state-changing
         * Worker calls. Returns '' when no V2 session is active.
         */
        getCsrf: function () {
            try { return localStorage.getItem('rz_auth_csrf') || ''; } catch (e) { return ''; }
        },

        /**
         * Resolve the current user's feature tier: 'free' | 'demo' | 'pro'.
         * Used by rz-feature-flags.js as the canonical tier source.
         * Pass an explicit session object to check a specific session instead
         * of reading from localStorage.
         *
         * Tier mapping:
         *   ROOT_EMAILS  → 'pro'   (root accounts have full pro access)
         *   DEMO_EMAILS  → 'demo'
         *   any other authenticated session → 'pro'
         *   no session or expired → 'free'
         *
         * @param {object} [session] — optional override; defaults to getSession()
         * @returns {'free'|'demo'|'pro'} canonical tier from email + session.
         *   Note: root accounts return 'pro' from this helper (root detection is
         *   handled separately via getRoleFromSession). The page-side resolver
         *   in rz-feature-flags.js returns 'root' when the role IS root.
         */
        getTier: function (session) {
            session = session || getSession();
            if (!session || !session.email) return 'free';
            var email = String(session.email).toLowerCase();
            if (ROOT_EMAILS.indexOf(email) !== -1) return 'pro';
            if (DEMO_EMAILS.indexOf(email) !== -1) return 'demo';
            if (EDUCATOR_EMAILS.indexOf(email) !== -1) return 'pro';
            return 'pro';
        },

        getRoleFromSession: getRoleFromSession,

        /**
         * Tier-gated page access via the rz-feature-flags.js matrix.
         *
         * Resolves the current session's effective tier and consults the
         * `page-access` feature on the given page entry. Root sessions
         * short-circuit to allowed. On denial, swaps the page body for the
         * existing "Restricted Access" UX and shows the login/upgrade modal
         * (same copy/flow as the legacy requireRoot gate).
         *
         * Used by datahallAI.html, dc-conventional.html, and dcmoc/index.html
         * to replace the previous hard ROOT_ONLY_PATHS block with a 4-tier
         * matrix-driven gate that educator + pro users pass.
         *
         * @param {string} pageKey — rz-feature-flags page key (e.g. 'datahall-ai')
         * @returns {boolean} true when access is allowed; false when denied
         */
        enforceTierFeatureAccess: function (pageKey) {
            var session = getSession();
            var role = getRoleFromSession(session);
            if (role === 'root') {
                /* v1.127.x fix: root is authorized — actually UNLOCK the page. Previously this returned
                   true without removing 'locked', so a root user who logged in via the modal stayed behind
                   the "Root access required" gate (the SB gate's ag() relies solely on this call). */
                if (typeof document !== 'undefined' && document.body) document.body.classList.remove('locked');
                return true;
            }

            var allowed = false;
            try {
                if (window._rzFeatures && typeof window._rzFeatures.canAccess === 'function') {
                    allowed = !!window._rzFeatures.canAccess(pageKey, 'page-access');
                } else if (window.RZ_FEATURE_FLAGS && typeof window.RZ_FEATURE_FLAGS.canAccess === 'function') {
                    allowed = !!window.RZ_FEATURE_FLAGS.canAccess(pageKey, 'page-access');
                } else if (window._rzFeatures && typeof window._rzFeatures.has === 'function') {
                    allowed = !!window._rzFeatures.has(pageKey, 'page-access');
                }
            } catch (e) { allowed = false; }

            if (allowed) {
                if (typeof document !== 'undefined' && document.body) {
                    document.body.classList.remove('locked');
                }
                return true;
            }

            if (typeof document !== 'undefined' && document.body) {
                document.body.classList.add('locked');
            }
            var message = session
                ? 'Pro or Educator access required for this module.'
                : 'Please sign in with a Pro or Educator account to access this module.';
            if (typeof this.showRootGatePrompt === 'function') {
                this.showRootGatePrompt(message);
            } else if (typeof this.showModal === 'function') {
                this.showModal();
                var err = (typeof document !== 'undefined')
                    ? document.getElementById('rzModalError')
                    : null;
                if (err) {
                    err.textContent = message;
                    err.classList.add('show');
                }
            }
            return false;
        }
    };

    /* Close dropdown on outside click */
    document.addEventListener('click', function (e) {
        var dropdown = document.getElementById('rzUserDropdown');
        var userBtn = document.getElementById('rzUserBtn');
        if (dropdown && userBtn && !userBtn.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove('show');
        }
    });

    /* ───────── Listen for auth changes from page-specific login handlers ───────── */
    window.addEventListener('rz-auth-change', function () {
        updateAuthUI();
    });

    /* v1.115.21 — Supabase→mirror rehydration. ROOT CAUSE of "login state lepas
       saat pindah page / back": getSession() reads ONLY the localStorage mirror
       (rz_premium_session); when the mirror is missing/expired but the Supabase
       session token (sb-*-auth-token) is still valid, every page showed "Login"
       although the user is signed in (the Supabase→sitewide bridge was never
       implemented — rz-supabase.js "plan B4"). Rebuild the mirror from Supabase
       once per page-load. Async + fail-silent; skips entirely when no Supabase
       token exists (no module load, no network) so offline/demo flows are
       untouched. */
    function rehydrateFromSupabase() {
        try {
            if (getSession()) return;                          // mirror healthy
            var hasSbToken = false;
            for (var i = 0; i < localStorage.length; i++) {
                var k = localStorage.key(i);
                if (k && k.indexOf('sb-') === 0 && k.indexOf('auth-token') !== -1) { hasSbToken = true; break; }
            }
            if (!hasSbToken) return;                           // not Supabase-logged-in
            ensureSupabase().then(function () {
                var supa = window.rzSupa;
                if (!supa || typeof supa.getSession !== 'function') return;
                Promise.resolve(supa.getSession()).then(function (sess) {
                    var email = sess && sess.user && sess.user.email;
                    if (!email) return;
                    email = String(email).toLowerCase().trim();
                    var role = detectRole(email);
                    var finish = function (tier) {
                        setSession(email, tier || (role === 'demo' ? 'demo' : 'pro'), role);
                        updateAuthUI();
                        updateRootOnlyLinksUI();
                        try { window.dispatchEvent(new Event('rz-auth-change')); } catch (e) {}
                    };
                    if (typeof supa.getProfile === 'function') {
                        Promise.resolve(supa.getProfile())
                            .then(function (p) { finish(p && p.tier); })
                            .catch(function () { finish(null); });
                    } else finish(null);
                }).catch(function () {});
            }).catch(function () {});
        } catch (e) {}
    }

    /* ───────── Init ───────── */
    function init() {
        injectCSS();
        injectAuthButton();
        injectLoginModal();
        updateAuthUI();
        updateRootOnlyLinksUI();
        rehydrateFromSupabase();
        /* Phase 3: when flag is on, refresh the local mirror from the
           Worker once per page-load. hydrateSessionFromWorker() resolves
           with null on failure and clears the mirror — we re-render after
           that so the login button correctly appears. */
        if (AUTH_V2) {
            hydrateSessionFromWorker().then(function () {
                updateAuthUI();
                updateRootOnlyLinksUI();
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
