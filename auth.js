/**
 * auth.js — Shared Authentication Module for ResistanceZero
 * Provides consistent Login/Logout UI across all pages.
 * Reads/writes localStorage key 'rz_premium_session'.
 * Compatible with capex-calculator.html's built-in auth system.
 */
(function () {
    'use strict';

    /* ───────── Load FontAwesome if not present ───────── */
    if (!document.querySelector('link[href*="font-awesome"], link[href*="fontawesome"]')) {
        var fa = document.createElement('link');
        fa.rel = 'stylesheet';
        fa.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
        document.head.appendChild(fa);
    }

    /* ───────── Valid Users ───────── */
    var VALID_USERS = [
        { email: 'demo@resistancezero.com',  password: 'demo2026',        tier: 'pro' }
    ];

    /* Also check manually-created accounts stored in localStorage by admin */
    function getManualAccounts() {
        try {
            var raw = localStorage.getItem('rz_manual_accounts');
            return raw ? JSON.parse(raw) : [];
        } catch (e) { return []; }
    }

    function findUser(email, password) {
        var e = email.toLowerCase().trim();
        var match = null;
        VALID_USERS.forEach(function (u) {
            if (u.email === e && u.password === password) match = u;
        });
        if (match) return match;
        /* Check manual accounts */
        var manuals = getManualAccounts();
        manuals.forEach(function (u) {
            if (u.email.toLowerCase() === e && u.password === password) match = u;
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
            return data;
        } catch (e) { return null; }
    }

    function setSession(email, tier) {
        var expires = new Date();
        expires.setDate(expires.getDate() + 30);
        localStorage.setItem('rz_premium_session', JSON.stringify({
            email: email,
            tier: tier,
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
            '.rz-dd-email{font-size:0.78rem;color:#94a3b8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
            '.rz-dd-logout{display:flex;align-items:center;gap:8px;width:100%;padding:8px 10px;border:none;border-radius:8px;background:rgba(239,68,68,0.1);color:#f87171;cursor:pointer;font-size:0.8rem;font-family:inherit;transition:all 0.2s;}',
            '.rz-dd-logout:hover{background:rgba(239,68,68,0.2);}',
            /* Login Modal */
            '.rz-modal-overlay{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:99999;display:none;align-items:center;justify-content:center;backdrop-filter:blur(4px);}',
            '.rz-modal-overlay.show{display:flex;}',
            '.rz-modal{width:380px;max-width:90vw;background:linear-gradient(145deg,#0f172a,#1e293b);border:1px solid rgba(139,92,246,0.3);border-radius:16px;padding:32px;position:relative;box-shadow:0 25px 60px rgba(0,0,0,0.5);}',
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
            '[data-theme="light"] .rz-modal{background:linear-gradient(145deg,#ffffff,#f8fafc);border-color:rgba(139,92,246,0.2);}',
            '[data-theme="light"] .rz-modal h3{color:#1e293b;}',
            '[data-theme="light"] .rz-modal input[type="email"],[data-theme="light"] .rz-modal input[type="password"]{background:#f8fafc;border-color:#e2e8f0;color:#1e293b;}',
            '[data-theme="light"] .rz-modal-close{background:rgba(0,0,0,0.05);color:#64748b;}',
            /* Responsive */
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
        return '<div class="rz-modal-overlay" id="rzModalOverlay">' +
            '<div class="rz-modal">' +
                '<button class="rz-modal-close" onclick="window._rzAuth.hideModal()">&times;</button>' +
                '<div id="rzModalForm">' +
                    '<h3><i class="fas fa-shield-alt" style="color:#8b5cf6;margin-right:8px;"></i>Premium Access</h3>' +
                    '<p class="rz-modal-sub">Sign in to unlock advanced features and full calculator access.</p>' +
                    '<div class="rz-error" id="rzModalError">Invalid email or password.</div>' +
                    '<label>Email</label>' +
                    '<input type="email" id="rzModalEmail" placeholder="your@email.com" autocomplete="email">' +
                    '<label>Password</label>' +
                    '<input type="password" id="rzModalPassword" placeholder="Enter password" autocomplete="current-password">' +
                    '<button class="rz-submit-btn" id="rzModalSubmit" onclick="window._rzAuth.doLogin()">Sign In</button>' +
                    '<div style="text-align:center;margin-top:14px;padding:10px 12px;border-radius:8px;background:rgba(139,92,246,0.08);border:1px solid rgba(139,92,246,0.15);font-size:0.78rem;color:#94a3b8;line-height:1.5;">' +
                        '<span style="color:#a78bfa;font-weight:600;">Demo:</span> ' +
                        '<code style="background:rgba(255,255,255,0.06);padding:2px 6px;border-radius:4px;font-size:0.75rem;">demo@resistancezero.com</code> / ' +
                        '<code style="background:rgba(255,255,255,0.06);padding:2px 6px;border-radius:4px;font-size:0.75rem;">demo2026</code>' +
                    '</div>' +
                '</div>' +
                '<div class="rz-success" id="rzModalSuccess">' +
                    '<i class="fas fa-check-circle"></i>' +
                    '<p id="rzSuccessTier">PRO Access Activated</p>' +
                    '<small>Page will refresh in a moment...</small>' +
                '</div>' +
            '</div>' +
        '</div>';
    }

    /* ───────── Navbar Detection & Injection ───────── */
    function injectAuthButton() {
        /* Skip if already injected */
        if (document.getElementById('rzAuthWrap')) return;

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
        var loginBtn = document.getElementById('rzLoginBtn');
        var userBtn = document.getElementById('rzUserBtn');
        var dropdown = document.getElementById('rzUserDropdown');

        if (!loginBtn || !userBtn) return;

        if (session) {
            loginBtn.style.display = 'none';
            userBtn.style.display = 'inline-flex';
            var avatar = document.getElementById('rzUserAvatar');
            var emailEl = document.getElementById('rzUserEmail');
            var ddBadge = document.getElementById('rzDdBadge');
            var ddEmail = document.getElementById('rzDdEmail');
            if (avatar) avatar.textContent = session.email.charAt(0).toUpperCase();
            if (emailEl) emailEl.textContent = session.email.split('@')[0];
            if (ddEmail) ddEmail.textContent = session.email;
            if (ddBadge) {
                var tier = session.tier || 'pro';
                ddBadge.textContent = tier.toUpperCase();
                ddBadge.className = 'rz-dd-badge ' + (tier === 'pro' ? 'pro' : 'free');
            }
        } else {
            loginBtn.style.display = 'inline-flex';
            userBtn.style.display = 'none';
            if (dropdown) dropdown.classList.remove('show');
        }
    }

    /* ───────── Public API ───────── */
    window._rzAuth = {
        showModal: function () {
            var overlay = document.getElementById('rzModalOverlay');
            var form = document.getElementById('rzModalForm');
            var success = document.getElementById('rzModalSuccess');
            var error = document.getElementById('rzModalError');
            if (form) form.style.display = 'block';
            if (success) success.className = 'rz-success';
            if (error) error.className = 'rz-error';
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

            var user = findUser(email, password);
            if (!user) {
                if (errorEl) { errorEl.textContent = 'Invalid email or password.'; errorEl.classList.add('show'); }
                return;
            }

            /* Success */
            setSession(user.email, user.tier);
            if (formEl) formEl.style.display = 'none';
            if (tierLabel) tierLabel.textContent = (user.tier === 'pro' ? 'PRO' : 'DEMO') + ' Access Activated';
            if (successEl) successEl.classList.add('show');
            updateAuthUI();

            /* Dispatch custom event for page-specific handlers */
            window.dispatchEvent(new CustomEvent('rz-auth-change', { detail: { email: user.email, tier: user.tier, action: 'login' } }));

            /* Auto-close modal after delay */
            setTimeout(function () {
                window._rzAuth.hideModal();
                /* If on a calculator page, reload to apply gating */
                var path = window.location.pathname.toLowerCase();
                if (path.indexOf('capex-calculator') !== -1 || path.indexOf('opex-calculator') !== -1) {
                    window.location.reload();
                }
            }, 1500);
        },

        logout: function () {
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

        getSession: getSession
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

    /* ───────── Init ───────── */
    function init() {
        injectCSS();
        injectAuthButton();
        injectLoginModal();
        updateAuthUI();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
