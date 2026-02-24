/**
 * supabase-auth.js — Supabase Authentication Module for ResistanceZero
 * =====================================================================
 * Drop-in replacement for auth.js.  Swaps localStorage credential check
 * with real Supabase Auth (email/password + Google OAuth) and loads
 * entitlements from the Cloud Function API (/api/me).
 *
 * Same public API:  window._rzAuth.{showModal, hideModal, doLogin, logout,
 *                    toggleDropdown, getSession}
 *
 * SETUP: Before loading this script, set your config:
 *   <script>
 *     window.RZ_CONFIG = {
 *       SUPABASE_URL:  'https://YOUR_PROJECT.supabase.co',
 *       SUPABASE_ANON: 'eyJ...',
 *       API_BASE:      'https://resistancezero-api-xxx.a.run.app'
 *     };
 *   </script>
 *   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
 *   <script src="supabase-auth.js"></script>
 */
(function () {
    'use strict';

    /* ───────── Config ───────── */
    var cfg = window.RZ_CONFIG || {};
    var SUPABASE_URL  = cfg.SUPABASE_URL  || '';
    var SUPABASE_ANON = cfg.SUPABASE_ANON || '';
    var API_BASE      = cfg.API_BASE      || '';

    /* ───────── Supabase client ───────── */
    var supabase = null;
    if (window.supabase && SUPABASE_URL && SUPABASE_ANON) {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
    }

    /* ───────── Load FontAwesome if not present ───────── */
    if (!document.querySelector('link[href*="font-awesome"], link[href*="fontawesome"]')) {
        var fa = document.createElement('link');
        fa.rel = 'stylesheet';
        fa.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
        document.head.appendChild(fa);
    }

    /* ───────── Entitlements cache ───────── */
    var _entitlements = null;
    var _profile = null;

    /* ───────── Session helpers ───────── */
    // For backward compat, also write rz_premium_session to localStorage
    // so capex-calculator.html's built-in gating still works.
    function syncLocalStorage(session) {
        if (session) {
            var expires = new Date();
            expires.setDate(expires.getDate() + 30);
            localStorage.setItem('rz_premium_session', JSON.stringify({
                email: session.email,
                tier: _entitlements ? _entitlements.tier : 'free',
                expires: expires.toISOString()
            }));
        } else {
            localStorage.removeItem('rz_premium_session');
        }
    }

    async function getSupabaseSession() {
        if (!supabase) return null;
        var { data } = await supabase.auth.getSession();
        return data?.session || null;
    }

    function getSession() {
        // Synchronous fallback: read from localStorage for immediate UI
        try {
            var raw = localStorage.getItem('rz_premium_session');
            if (!raw) return null;
            var data = JSON.parse(raw);
            if (data.expires && new Date(data.expires) < new Date()) {
                localStorage.removeItem('rz_premium_session');
                return null;
            }
            return data;
        } catch (e) { return null; }
    }

    /* ───────── Fetch entitlements from API ───────── */
    async function fetchEntitlements(accessToken) {
        if (!API_BASE) return null;
        try {
            var res = await fetch(API_BASE + '/api/me', {
                headers: { 'Authorization': 'Bearer ' + accessToken }
            });
            if (!res.ok) return null;
            var data = await res.json();
            _entitlements = data.entitlements;
            _profile = data.profile;
            return data;
        } catch (e) {
            console.warn('Failed to fetch entitlements:', e);
            return null;
        }
    }

    /* ───────── CSS Injection ───────── */
    function injectCSS() {
        if (document.getElementById('rz-auth-css')) return;
        var style = document.createElement('style');
        style.id = 'rz-auth-css';
        style.textContent = [
            '.rz-auth-wrap{display:inline-flex;align-items:center;position:relative;margin-left:8px;vertical-align:middle;}',
            '.rz-login-btn{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:10px;border:1px solid rgba(139,92,246,0.4);background:linear-gradient(135deg,rgba(139,92,246,0.15),rgba(168,85,247,0.08));color:#a78bfa;font-size:0.82rem;font-weight:600;cursor:pointer;transition:all 0.3s;font-family:inherit;white-space:nowrap;}',
            '.rz-login-btn:hover{background:linear-gradient(135deg,rgba(139,92,246,0.25),rgba(168,85,247,0.15));transform:translateY(-1px);box-shadow:0 4px 15px rgba(139,92,246,0.2);}',
            '.rz-login-btn i{font-size:1rem;}',
            '.rz-user-btn{display:inline-flex;align-items:center;gap:8px;padding:6px 12px;border-radius:10px;border:1px solid rgba(139,92,246,0.3);background:rgba(139,92,246,0.08);color:#c4b5fd;cursor:pointer;font-family:inherit;font-size:0.82rem;transition:all 0.3s;}',
            '.rz-user-btn:hover{background:rgba(139,92,246,0.15);}',
            '.rz-user-avatar{width:28px;height:28px;border-radius:8px;background:linear-gradient(135deg,#8b5cf6,#a78bfa);display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:700;color:#fff;}',
            '.rz-user-email{max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
            '.rz-user-chevron{font-size:0.65rem;opacity:0.6;transition:transform 0.2s;}',
            '.rz-user-dropdown{position:absolute;top:calc(100% + 6px);right:0;min-width:220px;background:rgba(15,23,42,0.98);border:1px solid rgba(139,92,246,0.3);border-radius:12px;padding:12px;opacity:0;visibility:hidden;transform:translateY(-8px);transition:all 0.2s;z-index:9999;backdrop-filter:blur(20px);}',
            '.rz-user-dropdown.show{opacity:1;visibility:visible;transform:translateY(0);}',
            '.rz-dd-header{display:flex;align-items:center;gap:8px;padding-bottom:10px;border-bottom:1px solid rgba(255,255,255,0.1);margin-bottom:8px;}',
            '.rz-dd-badge{padding:3px 10px;border-radius:6px;font-size:0.7rem;font-weight:700;letter-spacing:0.5px;}',
            '.rz-dd-badge.pro{background:linear-gradient(135deg,#8b5cf6,#a78bfa);color:#fff;}',
            '.rz-dd-badge.free{background:rgba(100,116,139,0.3);color:#94a3b8;}',
            '.rz-dd-email{font-size:0.78rem;color:#94a3b8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
            '.rz-dd-upgrade{display:flex;align-items:center;gap:8px;width:100%;padding:8px 10px;border:none;border-radius:8px;background:linear-gradient(135deg,rgba(139,92,246,0.15),rgba(168,85,247,0.1));color:#a78bfa;cursor:pointer;font-size:0.8rem;font-family:inherit;transition:all 0.2s;margin-bottom:6px;}',
            '.rz-dd-upgrade:hover{background:linear-gradient(135deg,rgba(139,92,246,0.25),rgba(168,85,247,0.18));}',
            '.rz-dd-logout{display:flex;align-items:center;gap:8px;width:100%;padding:8px 10px;border:none;border-radius:8px;background:rgba(239,68,68,0.1);color:#f87171;cursor:pointer;font-size:0.8rem;font-family:inherit;transition:all 0.2s;}',
            '.rz-dd-logout:hover{background:rgba(239,68,68,0.2);}',
            /* Modal */
            '.rz-modal-overlay{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:99999;display:none;align-items:center;justify-content:center;backdrop-filter:blur(4px);}',
            '.rz-modal-overlay.show{display:flex;}',
            '.rz-modal{width:400px;max-width:90vw;background:linear-gradient(145deg,#0f172a,#1e293b);border:1px solid rgba(139,92,246,0.3);border-radius:16px;padding:32px;position:relative;box-shadow:0 25px 60px rgba(0,0,0,0.5);}',
            '.rz-modal-close{position:absolute;top:12px;right:12px;width:32px;height:32px;border:none;border-radius:8px;background:rgba(255,255,255,0.05);color:#94a3b8;font-size:1.1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s;}',
            '.rz-modal-close:hover{background:rgba(255,255,255,0.1);color:#fff;}',
            '.rz-modal h3{margin:0 0 6px;font-size:1.3rem;color:#f1f5f9;font-weight:700;}',
            '.rz-modal .rz-modal-sub{font-size:0.82rem;color:#64748b;margin:0 0 24px;}',
            '.rz-modal label{display:block;font-size:0.78rem;font-weight:600;color:#94a3b8;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px;}',
            '.rz-modal input[type="email"],.rz-modal input[type="password"]{width:100%;padding:10px 14px;border-radius:10px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.05);color:#f1f5f9;font-size:0.9rem;font-family:inherit;margin-bottom:16px;box-sizing:border-box;outline:none;transition:border-color 0.2s;}',
            '.rz-modal input:focus{border-color:rgba(139,92,246,0.5);}',
            '.rz-modal .rz-submit-btn{width:100%;padding:12px;border:none;border-radius:10px;background:linear-gradient(135deg,#8b5cf6,#7c3aed);color:#fff;font-size:0.9rem;font-weight:600;cursor:pointer;font-family:inherit;transition:all 0.3s;}',
            '.rz-modal .rz-submit-btn:hover{transform:translateY(-1px);box-shadow:0 8px 25px rgba(139,92,246,0.3);}',
            '.rz-modal .rz-submit-btn:disabled{opacity:0.5;cursor:not-allowed;transform:none;box-shadow:none;}',
            '.rz-modal .rz-divider{display:flex;align-items:center;gap:12px;margin:18px 0;color:#475569;font-size:0.78rem;}',
            '.rz-modal .rz-divider::before,.rz-modal .rz-divider::after{content:"";flex:1;height:1px;background:rgba(255,255,255,0.1);}',
            '.rz-modal .rz-google-btn{width:100%;padding:11px;border:1px solid rgba(255,255,255,0.12);border-radius:10px;background:rgba(255,255,255,0.04);color:#e2e8f0;font-size:0.88rem;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:10px;transition:all 0.2s;}',
            '.rz-modal .rz-google-btn:hover{background:rgba(255,255,255,0.08);border-color:rgba(255,255,255,0.2);}',
            '.rz-modal .rz-google-btn svg{width:18px;height:18px;}',
            '.rz-modal .rz-error{display:none;padding:8px 12px;border-radius:8px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);color:#f87171;font-size:0.8rem;margin-bottom:12px;}',
            '.rz-modal .rz-error.show{display:block;}',
            '.rz-modal .rz-success{display:none;text-align:center;padding:20px 0;}',
            '.rz-modal .rz-success.show{display:block;}',
            '.rz-modal .rz-success i{font-size:2.5rem;color:#10b981;margin-bottom:10px;}',
            '.rz-modal .rz-success p{color:#f1f5f9;font-weight:600;margin:4px 0;}',
            '.rz-modal .rz-success small{color:#64748b;font-size:0.8rem;}',
            '.rz-modal .rz-signup-link{text-align:center;margin-top:16px;font-size:0.8rem;color:#64748b;}',
            '.rz-modal .rz-signup-link a{color:#a78bfa;cursor:pointer;text-decoration:none;}',
            '.rz-modal .rz-signup-link a:hover{text-decoration:underline;}',
            /* Light theme */
            '[data-theme="light"] .rz-login-btn{background:linear-gradient(135deg,rgba(139,92,246,0.1),rgba(168,85,247,0.05));color:#7c3aed;border-color:rgba(139,92,246,0.3);}',
            '[data-theme="light"] .rz-user-btn{background:rgba(139,92,246,0.06);color:#6d28d9;border-color:rgba(139,92,246,0.2);}',
            '[data-theme="light"] .rz-user-avatar{background:linear-gradient(135deg,#7c3aed,#8b5cf6);}',
            '[data-theme="light"] .rz-user-dropdown{background:rgba(255,255,255,0.98);border-color:rgba(139,92,246,0.2);box-shadow:0 10px 40px rgba(0,0,0,0.12);}',
            '[data-theme="light"] .rz-dd-email{color:#475569;}',
            '[data-theme="light"] .rz-dd-logout{background:rgba(239,68,68,0.06);color:#dc2626;}',
            '[data-theme="light"] .rz-modal{background:linear-gradient(145deg,#ffffff,#f8fafc);border-color:rgba(139,92,246,0.2);}',
            '[data-theme="light"] .rz-modal h3{color:#1e293b;}',
            '[data-theme="light"] .rz-modal .rz-modal-sub{color:#64748b;}',
            '[data-theme="light"] .rz-modal input[type="email"],[data-theme="light"] .rz-modal input[type="password"]{background:#f8fafc;border-color:#e2e8f0;color:#1e293b;}',
            '[data-theme="light"] .rz-modal-close{background:rgba(0,0,0,0.05);color:#64748b;}',
            '[data-theme="light"] .rz-modal .rz-google-btn{background:#fff;border-color:#e2e8f0;color:#1e293b;}',
            '@media(max-width:768px){.rz-user-email{display:none;}.rz-login-btn .rz-login-text{display:none;}.rz-login-btn{padding:8px 12px;}}'
        ].join('\n');
        document.head.appendChild(style);
    }

    /* ───────── HTML Templates ───────── */
    function authButtonHTML() {
        return '<div class="rz-auth-wrap" id="rzAuthWrap">' +
            '<button class="rz-login-btn" id="rzLoginBtn" onclick="window._rzAuth.showModal()">' +
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
                    '<div class="rz-dd-badge" id="rzDdBadge">FREE</div>' +
                    '<div class="rz-dd-email" id="rzDdEmail"></div>' +
                '</div>' +
                '<button class="rz-dd-logout" onclick="window._rzAuth.logout()">' +
                    '<i class="fas fa-sign-out-alt"></i> Logout' +
                '</button>' +
            '</div>' +
        '</div>';
    }

    var GOOGLE_ICON_SVG = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>' +
        '<path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>' +
        '<path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>' +
        '<path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>' +
        '</svg>';

    function loginModalHTML() {
        return '<div class="rz-modal-overlay" id="rzModalOverlay">' +
            '<div class="rz-modal">' +
                '<button class="rz-modal-close" onclick="window._rzAuth.hideModal()">&times;</button>' +
                /* Login form */
                '<div id="rzModalForm">' +
                    '<h3><i class="fas fa-shield-alt" style="color:#8b5cf6;margin-right:8px;"></i>Sign In</h3>' +
                    '<p class="rz-modal-sub">Access calculators, tools, and analytical content.</p>' +
                    '<div class="rz-error" id="rzModalError"></div>' +
                    '<label>Email</label>' +
                    '<input type="email" id="rzModalEmail" placeholder="your@email.com" autocomplete="email">' +
                    '<label>Password</label>' +
                    '<input type="password" id="rzModalPassword" placeholder="Enter password" autocomplete="current-password">' +
                    '<button class="rz-submit-btn" id="rzModalSubmit" onclick="window._rzAuth.doLogin()">Sign In</button>' +
                    '<div class="rz-divider">or</div>' +
                    '<button class="rz-google-btn" onclick="window._rzAuth.loginGoogle()">' +
                        GOOGLE_ICON_SVG + ' Continue with Google' +
                    '</button>' +
                    '<div class="rz-signup-link" id="rzSignupLink">' +
                        'No account? <a onclick="window._rzAuth.showSignup()">Create one</a>' +
                    '</div>' +
                    '<div style="text-align:center;margin-top:12px;font-size:0.68rem;color:#475569;line-height:1.5;">' +
                        'By signing in, you agree to our <a href="terms.html" style="color:#8b5cf6;text-decoration:none;">Terms</a> &amp; <a href="privacy.html" style="color:#8b5cf6;text-decoration:none;">Privacy Policy</a>' +
                    '</div>' +
                '</div>' +
                /* Signup form */
                '<div id="rzSignupForm" style="display:none;">' +
                    '<h3><i class="fas fa-user-plus" style="color:#8b5cf6;margin-right:8px;"></i>Create Account</h3>' +
                    '<p class="rz-modal-sub">Create a free account to access all features.</p>' +
                    '<div class="rz-error" id="rzSignupError"></div>' +
                    '<label>Full Name</label>' +
                    '<input type="text" id="rzSignupName" placeholder="Your full name" style="width:100%;padding:10px 14px;border-radius:10px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.05);color:#f1f5f9;font-size:0.9rem;font-family:inherit;margin-bottom:16px;box-sizing:border-box;outline:none;">' +
                    '<label>Email</label>' +
                    '<input type="email" id="rzSignupEmail" placeholder="your@email.com" autocomplete="email">' +
                    '<label>Password</label>' +
                    '<input type="password" id="rzSignupPassword" placeholder="Min 6 characters" autocomplete="new-password">' +
                    '<button class="rz-submit-btn" onclick="window._rzAuth.doSignup()">Create Account</button>' +
                    '<div class="rz-signup-link">' +
                        'Already have an account? <a onclick="window._rzAuth.showLogin()">Sign in</a>' +
                    '</div>' +
                '</div>' +
                /* Success */
                '<div class="rz-success" id="rzModalSuccess">' +
                    '<i class="fas fa-check-circle"></i>' +
                    '<p id="rzSuccessTier">Welcome!</p>' +
                    '<small id="rzSuccessSub">Page will refresh in a moment...</small>' +
                '</div>' +
            '</div>' +
        '</div>';
    }

    /* ───────── Navbar Detection & Injection ───────── */
    function injectAuthButton() {
        if (document.getElementById('rzAuthWrap')) return;
        var html = authButtonHTML();
        var inserted = false;

        /* Type A: Portfolio nav — <ul class="nav-menu"> */
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

        /* Type B: Calculator/DC Solutions nav — <div class="nav-links"> */
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

        /* Type C: datahallAI / dc-conventional header */
        if (!inserted) {
            var hdrRight = document.querySelector('.hdr-r') || document.querySelector('.header-right');
            if (hdrRight) {
                hdrRight.insertAdjacentHTML('afterbegin', html);
                inserted = true;
            }
        }

        /* Fallback */
        if (!inserted) {
            var nav = document.querySelector('nav.navbar .nav-container') || document.querySelector('nav') || document.querySelector('header');
            if (nav) {
                nav.insertAdjacentHTML('beforeend', html);
            }
        }
    }

    function injectLoginModal() {
        if (document.getElementById('rzModalOverlay')) return;
        document.body.insertAdjacentHTML('beforeend', loginModalHTML());

        var overlay = document.getElementById('rzModalOverlay');
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) window._rzAuth.hideModal();
        });

        /* Enter key handling */
        document.getElementById('rzModalPassword').addEventListener('keydown', function (e) {
            if (e.key === 'Enter') window._rzAuth.doLogin();
        });
        document.getElementById('rzModalEmail').addEventListener('keydown', function (e) {
            if (e.key === 'Enter') document.getElementById('rzModalPassword').focus();
        });
    }

    /* ───────── UI Update ───────── */
    function updateAuthUI(session) {
        var loginBtn = document.getElementById('rzLoginBtn');
        var userBtn = document.getElementById('rzUserBtn');
        if (!loginBtn || !userBtn) return;

        // Use passed session or read from localStorage
        var s = session || getSession();

        if (s) {
            loginBtn.style.display = 'none';
            userBtn.style.display = 'inline-flex';

            var email = s.email || s.user?.email || '';
            var tier = s.tier || (_entitlements ? _entitlements.tier : 'free');

            var avatar = document.getElementById('rzUserAvatar');
            var emailEl = document.getElementById('rzUserEmail');
            var ddBadge = document.getElementById('rzDdBadge');
            var ddEmail = document.getElementById('rzDdEmail');
            var ddUpgrade = document.getElementById('rzDdUpgrade');

            if (avatar) avatar.textContent = email.charAt(0).toUpperCase();
            if (emailEl) emailEl.textContent = email.split('@')[0];
            if (ddEmail) ddEmail.textContent = email;
            if (ddBadge) {
                ddBadge.textContent = tier.toUpperCase();
                ddBadge.className = 'rz-dd-badge ' + tier;
            }
            // Show upgrade button for free users
            if (ddUpgrade) {
                ddUpgrade.style.display = (tier === 'free') ? 'flex' : 'none';
            }
        } else {
            loginBtn.style.display = 'inline-flex';
            userBtn.style.display = 'none';
            var dropdown = document.getElementById('rzUserDropdown');
            if (dropdown) dropdown.classList.remove('show');
        }
    }

    /* ───────── Public API ───────── */
    window._rzAuth = {
        showModal: function () {
            var overlay = document.getElementById('rzModalOverlay');
            document.getElementById('rzModalForm').style.display = 'block';
            document.getElementById('rzSignupForm').style.display = 'none';
            document.getElementById('rzModalSuccess').className = 'rz-success';
            document.getElementById('rzModalError').className = 'rz-error';
            if (overlay) overlay.classList.add('show');
            setTimeout(function () {
                var em = document.getElementById('rzModalEmail');
                if (em) em.focus();
            }, 100);
        },

        hideModal: function () {
            var overlay = document.getElementById('rzModalOverlay');
            if (overlay) overlay.classList.remove('show');
        },

        showSignup: function () {
            document.getElementById('rzModalForm').style.display = 'none';
            document.getElementById('rzSignupForm').style.display = 'block';
            document.getElementById('rzSignupError').className = 'rz-error';
            setTimeout(function () {
                document.getElementById('rzSignupName').focus();
            }, 100);
        },

        showLogin: function () {
            document.getElementById('rzModalForm').style.display = 'block';
            document.getElementById('rzSignupForm').style.display = 'none';
        },

        doLogin: async function () {
            var emailEl = document.getElementById('rzModalEmail');
            var passEl = document.getElementById('rzModalPassword');
            var errorEl = document.getElementById('rzModalError');
            var submitBtn = document.getElementById('rzModalSubmit');

            var email = emailEl.value.trim();
            var password = passEl.value;

            if (!email || !password) {
                errorEl.textContent = 'Please enter email and password.';
                errorEl.classList.add('show');
                return;
            }

            submitBtn.disabled = true;
            submitBtn.textContent = 'Signing in...';

            if (!supabase) {
                errorEl.textContent = 'Authentication service not configured.';
                errorEl.classList.add('show');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Sign In';
                return;
            }

            var { data, error } = await supabase.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (error) {
                errorEl.textContent = error.message || 'Invalid email or password.';
                errorEl.classList.add('show');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Sign In';
                return;
            }

            // Fetch entitlements from API
            var tier = 'free';
            if (data.session) {
                var meData = await fetchEntitlements(data.session.access_token);
                if (meData?.entitlements) tier = meData.entitlements.tier;
            }

            // Sync to localStorage for backward compat
            syncLocalStorage({ email: data.user.email, tier: tier });

            // Show success
            document.getElementById('rzModalForm').style.display = 'none';
            document.getElementById('rzSuccessTier').textContent =
                tier === 'pro' ? 'PRO Access Active' : 'Welcome!';
            document.getElementById('rzSuccessSub').textContent =
                tier === 'free' ? 'Free access active.' : 'Page will refresh in a moment...';
            document.getElementById('rzModalSuccess').classList.add('show');
            updateAuthUI({ email: data.user.email, tier: tier });

            window.dispatchEvent(new CustomEvent('rz-auth-change', {
                detail: { email: data.user.email, tier: tier, action: 'login', entitlements: _entitlements }
            }));

            setTimeout(function () {
                window._rzAuth.hideModal();
                var path = window.location.pathname.toLowerCase();
                if (path.indexOf('capex-calculator') !== -1 || path.indexOf('opex-calculator') !== -1) {
                    window.location.reload();
                }
            }, 1500);
        },

        doSignup: async function () {
            var nameEl = document.getElementById('rzSignupName');
            var emailEl = document.getElementById('rzSignupEmail');
            var passEl = document.getElementById('rzSignupPassword');
            var errorEl = document.getElementById('rzSignupError');

            var fullName = nameEl.value.trim();
            var email = emailEl.value.trim();
            var password = passEl.value;

            if (!email || !password) {
                errorEl.textContent = 'Please fill in all fields.';
                errorEl.classList.add('show');
                return;
            }
            if (password.length < 6) {
                errorEl.textContent = 'Password must be at least 6 characters.';
                errorEl.classList.add('show');
                return;
            }

            if (!supabase) {
                errorEl.textContent = 'Authentication service not configured.';
                errorEl.classList.add('show');
                return;
            }

            var { data, error } = await supabase.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: { full_name: fullName }
                }
            });

            if (error) {
                errorEl.textContent = error.message;
                errorEl.classList.add('show');
                return;
            }

            // Show success
            document.getElementById('rzSignupForm').style.display = 'none';
            document.getElementById('rzSuccessTier').textContent = 'Account Created!';
            document.getElementById('rzSuccessSub').textContent =
                'Check your email to verify your account.';
            document.getElementById('rzModalSuccess').classList.add('show');
        },

        loginGoogle: async function () {
            if (!supabase) return;
            await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: window.location.href
                }
            });
        },

        logout: async function () {
            if (supabase) {
                await supabase.auth.signOut();
            }
            _entitlements = null;
            _profile = null;
            localStorage.removeItem('rz_premium_session');
            updateAuthUI(null);
            var dropdown = document.getElementById('rzUserDropdown');
            if (dropdown) dropdown.classList.remove('show');

            window.dispatchEvent(new CustomEvent('rz-auth-change', { detail: { action: 'logout' } }));

            var path = window.location.pathname.toLowerCase();
            if (path.indexOf('capex-calculator') !== -1 || path.indexOf('opex-calculator') !== -1) {
                window.location.reload();
            }
        },

        upgrade: function () {
            window.location.href = 'mailto:bagus@resistancezero.com';
        },

        toggleDropdown: function () {
            var dropdown = document.getElementById('rzUserDropdown');
            if (dropdown) dropdown.classList.toggle('show');
        },

        getSession: getSession,

        getEntitlements: function () { return _entitlements; },
        getProfile: function () { return _profile; }
    };

    /* Close dropdown on outside click */
    document.addEventListener('click', function (e) {
        var dropdown = document.getElementById('rzUserDropdown');
        var userBtn = document.getElementById('rzUserBtn');
        if (dropdown && userBtn && !userBtn.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove('show');
        }
    });

    /* ───────── Init ───────── */
    async function init() {
        injectCSS();
        injectAuthButton();
        injectLoginModal();

        // Check for existing Supabase session
        if (supabase) {
            var session = await getSupabaseSession();
            if (session) {
                var meData = await fetchEntitlements(session.access_token);
                var tier = meData?.entitlements?.tier || 'free';
                syncLocalStorage({ email: session.user.email, tier: tier });
                updateAuthUI({ email: session.user.email, tier: tier });

                window.dispatchEvent(new CustomEvent('rz-auth-change', {
                    detail: { email: session.user.email, tier: tier, action: 'session_restored', entitlements: _entitlements }
                }));
            } else {
                updateAuthUI(null);
            }

            // Listen for auth state changes (e.g., Google OAuth redirect)
            supabase.auth.onAuthStateChange(async function (event, session) {
                if (event === 'SIGNED_IN' && session) {
                    var meData = await fetchEntitlements(session.access_token);
                    var tier = meData?.entitlements?.tier || 'free';
                    syncLocalStorage({ email: session.user.email, tier: tier });
                    updateAuthUI({ email: session.user.email, tier: tier });

                    window.dispatchEvent(new CustomEvent('rz-auth-change', {
                        detail: { email: session.user.email, tier: tier, action: 'login', entitlements: _entitlements }
                    }));
                } else if (event === 'SIGNED_OUT') {
                    _entitlements = null;
                    _profile = null;
                    localStorage.removeItem('rz_premium_session');
                    updateAuthUI(null);
                }
            });
        } else {
            // No Supabase configured — use localStorage session only
            updateAuthUI(null);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
