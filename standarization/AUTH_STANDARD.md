# Authentication System Standard — ResistanceZero

> **Version**: 1.0 | **Updated**: 2026-02-16

---

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  auth.js    │────>│  localStorage    │<────│ Article Login    │
│ (shared)    │     │ rz_premium_      │     │ Modal (per-page) │
│             │     │ session          │     │                  │
│ - Navbar UI │     │ {email, tier,    │     │ - showLoginModal │
│ - Global    │     │  expires}        │     │ - handleLogin    │
│   modal     │     └──────────────────┘     │ - dispatch event │
└─────────────┘              │               └──────────────────┘
       ▲                     │                        │
       │         ┌───────────┴───────────┐           │
       └─────────│  'rz-auth-change'     │───────────┘
                 │   CustomEvent          │
                 └───────────────────────┘
```

---

## Session Format

**Key**: `rz_premium_session`

```json
{
  "email": "demo@resistancezero.com",
  "tier": "pro",
  "expires": "2026-03-18T00:00:00.000Z"
}
```

- **Tier values**: `"pro"` (only tier currently)
- **Expiry**: 30 days from login
- **Null/missing/expired** = not authenticated

---

## Valid Credentials

| Email | Password | Tier | Role | Source |
|-------|----------|------|------|--------|
| `bagus@resistancezero.com` | `RZ@Premium2026!` | pro | root | Hardcoded in auth.js + all pages |
| `admin@resistancezero.com` | `RZ@Premium2026!` | pro | root | Hardcoded in auth.js + all pages |
| `demo@resistancezero.com` | `demo2026` | pro | pro | Hardcoded in auth.js + all pages |
| *(manual accounts)* | *(varies)* | *(varies)* | pro | `rz_manual_accounts` localStorage |

**Root** = full pro access + rz-ops admin console. **Pro** = calculator pro features only (no rz-ops access).

**Demo account** is the primary test/showcase credential.

---

## auth.js — Shared Module

### What It Does
1. Injects Login/Logout buttons into navbar (auto-detects 4 navbar types)
2. Injects global login modal with demo credentials hint
3. Manages session state (login, logout, expiry check)
4. Listens for `rz-auth-change` event to update navbar
5. Dispatches `rz-auth-change` after its own login/logout

### Navbar Detection Types
| Type | Selector | Articles |
|------|----------|----------|
| A | `ul.nav-menu` + `.theme-toggle` | 1-10, most pages |
| B | `.nav-links` + `.nav-back` | calculators, DC solutions |
| C | `.hdr-r` or `.header-right` | datahallAI, dc-conventional |
| D | Fallback: `nav` or `header` | Any remaining pages |

### Loading
```html
<!-- Always at bottom of page, before </body> -->
<script src="auth.js"></script>
```

---

## Article-Specific Login Modal

Each article with Pro Mode has its OWN login modal (separate from auth.js global modal). This is because:
- Article modals are themed to match the article
- They describe what Pro unlocks for THAT specific calculator
- They trigger article-specific unlock logic after login

### Required Elements
```html
<div class="[prefix]login-overlay" id="[prefix]LoginOverlay">
  <div class="[prefix]login-box">
    <button class="[prefix]login-close" onclick="[prefix]HideLogin()">&times;</button>
    <h3><i class="fas fa-lock" style="color:THEME;"></i> Pro Analysis</h3>
    <p>Unlock [specific features] for this calculator.</p>
    <input type="email" id="[prefix]LoginEmail" placeholder="Email address">
    <input type="password" id="[prefix]LoginPass" placeholder="Password">
    <button class="[prefix]login-submit" onclick="[prefix]HandleLogin()">
      Unlock Pro Analysis
    </button>
    <div class="[prefix]login-error" id="[prefix]LoginError">
      Invalid credentials.
    </div>
    <div class="[prefix]login-demo">
      Demo: <code>demo@resistancezero.com</code> / <code>demo2026</code>
    </div>
    <div style="text-align:center;margin-top:10px;font-size:0.68rem;color:#475569;line-height:1.5;">
      By signing in, you agree to our <a href="terms.html" style="color:THEME;text-decoration:none;">Terms</a> &amp; <a href="privacy.html" style="color:THEME;text-decoration:none;">Privacy Policy</a>
    </div>
  </div>
</div>
```

> **IMPORTANT**: The Terms & Privacy Policy line is **mandatory** on ALL login modals — both the shared auth.js modal and every page-specific inline modal. Use the page's accent color for link styling (e.g., `#8b5cf6` purple, `#dc2626` red, `#991b1b` dark red). This was a recurring issue found in FF-1, geopolitics-2/3, cx-calculator, rfs-readiness-workbench, and articles 19-21 (March 2026).

### Login Handler Pattern

> **CRITICAL — NEVER hardcode custom credentials.** Always validate against the SAME credential list from the Valid Credentials table above. This is a recurring bug — article-22, and earlier pages shipped with made-up credentials like `admin/admin123` or `demo/demo123` that don't match auth.js. The calculator login rejected valid root/pro users.

```js
function handleLogin() {
  var email = document.getElementById('[prefix]LoginEmail').value.trim();
  var pass = document.getElementById('[prefix]LoginPass').value;

  /* ── MUST match Valid Credentials table exactly ── */
  var VALID = [
    { email: 'demo@resistancezero.com',  password: 'demo2026' },
    { email: 'bagus@resistancezero.com',  password: 'RZ@Premium2026!' },
    { email: 'admin@resistancezero.com',  password: 'RZ@Premium2026!' }
  ];
  var found = VALID.some(function(u) {
    return u.email.toLowerCase() === email.toLowerCase() && u.password === pass;
  });

  if (found) {
    // Store session
    localStorage.setItem('rz_premium_session', JSON.stringify({
      email: email,
      tier: 'pro',
      expires: new Date(Date.now() + 30 * 86400000).toISOString()
    }));

    // Update local state
    isPremium = true;
    hideLogin();
    unlockPanels();
    setMode('pro');

    // CRITICAL: Notify auth.js to update navbar
    window.dispatchEvent(new CustomEvent('rz-auth-change', {
      detail: { email: email, tier: 'pro', action: 'login' }
    }));
  } else {
    document.getElementById('[prefix]LoginError').style.display = 'block';
  }
}
```

---

## Event System

### `rz-auth-change` CustomEvent

**Dispatched by**:
- auth.js `doLogin()` — after global modal login
- auth.js `logout()` — after logout
- Each article's `handleLogin()` — after article modal login

**Listened by**:
- auth.js — `updateAuthUI()` (hides/shows navbar buttons)
- Each article — unlock panels, switch to Pro mode

### Detail Payload
```js
{
  email: 'demo@resistancezero.com',
  tier: 'pro',
  action: 'login'  // or 'logout'
}
```

---

## Session Check on Page Load

```js
// At start of article's Pro JS
var session = null;
try {
  session = JSON.parse(localStorage.getItem('rz_premium_session'));
  if (session && new Date(session.expires) < new Date()) {
    localStorage.removeItem('rz_premium_session');
    session = null;
  }
} catch(e) { session = null; }
var isPremium = !!session;

// If premium on load, unlock panels AND switch to Pro mode
if (isPremium) {
  activatePremiumUI();  // must call setMode('pro')
}
```

### `activatePremiumUI()` Pattern (standalone calculators)

Every standalone calculator's `activatePremiumUI()` function MUST call `setMode('pro')`. This ensures Pro panels auto-populate with data when a stored session is detected on page load. Without it, `currentMode` stays `'free'` and `calculate()` skips Pro panel updates.

```js
function activatePremiumUI() {
    var proBtn = document.getElementById('btnProMode');
    if (proBtn) proBtn.classList.remove('locked-hint');
    var pdfBtn = document.getElementById('btnExportPDF');
    if (pdfBtn) pdfBtn.classList.remove('disabled');
    updateNavbarAuthUI();
    setMode('pro');  // REQUIRED — triggers calculate() which populates Pro panels
}
```

---

## Admin Dashboard

- File: `admin.html`
- Manual account creation stored in `rz_manual_accounts` localStorage
- KPIs, user table, credential vault
- Admin credentials: same as `admin@resistancezero.com`

---

## New Article/Page Checklist

Before publishing any new article or calculator page, verify ALL of the following:

- [ ] `<script src="auth.js?v=20260228"></script>` loaded before `</body>`
- [ ] If page has inline login modal: **Terms & Privacy line present** after demo credentials
- [ ] `terms.html` and `privacy.html` links use page accent color
- [ ] Calculator disclaimer section present (if page has interactive calculator)
- [ ] Cookie banner HTML present (matches other articles)
- [ ] **Inline login credentials match Valid Credentials table exactly** (never hardcode custom credentials)
- [ ] `rz-auth-change` event dispatched after inline login
- [ ] `rz-auth-change` event listener present (sync with cross-page auth)
- [ ] Session check on page load (auto-unlock Pro if session exists)
- [ ] Page added to `sitemap.xml` and `search-index.json`
- [ ] BreadcrumbList schema added
- [ ] hreflang en + x-default tags in `<head>`

> **Lesson learned (March 2026):** FF-1, geopolitics-2/3, cx-calculator, rfs-readiness-workbench, and articles 19-21 were all shipped without the standard Terms & Privacy text in their login modals, and some were missing auth.js entirely. This checklist prevents that.

---

## Bug History

| Date | Bug | Fix |
|------|-----|-----|
| 2026-02-16 | Login button visible when already logged in | Added `rz-auth-change` listener to auth.js `updateAuthUI()` |
| 2026-02-16 | No demo hint in auth.js global modal | Added demo credentials div after Sign In button |
| 2026-02-27 | ROI calculator Pro panels show "--" on page load with stored session | `activatePremiumUI()` was missing `setMode('pro')` call — added it |
| 2026-02-27 | tia-942 & tier-advisor: auth/tooltips/DOMContentLoaded broken | `</script>` in PDF export string closed main script block — moved cookie HTML to separate block |
| 2026-03-20 | FF-1, geo-3, cx-calc, rfs-workbench missing Terms/Privacy in inline login modals | Added terms/privacy text to all inline login modals |
| 2026-03-20 | article-19, article-20, article-21, cx-calc, rfs-workbench missing auth.js | Added `<script src="auth.js?v=20260228"></script>` before `</body>` |
| 2026-03-20 | CAPEX & OPEX: Pro button shows "Logout from your account?" confirm dialog when already logged in | `activatePremiumUI()` was rebinding button onclick to `logoutPremium()`. Removed rebinding — Pro button always calls mode-switch handler. Added `rz-auth-change` listener/dispatch. |
| 2026-03-20 | article-22 calculator hardcoded `admin/admin123` and `demo/demo123` — rejected valid root/pro users | Aligned credentials with auth.js Valid Credentials table. Added `checkAuthState()` for localStorage session detection on load. Added `rz-auth-change` listener. |

---

## Anti-Pattern: Never Rebind Pro Button to Logout

**NEVER** change a Pro/Premium button's `onclick` handler to call a logout function.

### Wrong (causes confirm dialog on Pro click):
```js
// In activatePremiumUI():
premBtn.onclick = function() { logoutPremium(); };  // BUG!
```

### Correct:
```js
// Pro button ALWAYS keeps its original onclick (handlePremiumTab / setMode)
// activatePremiumUI() only changes text/style/badge — never rebinds onclick
function activatePremiumUI() {
    premBtn.classList.add('premium-active');
    premBtn.innerHTML = '<i class="fas fa-crown"></i> Premium Active';
    // DO NOT change premBtn.onclick
    switchMode('advanced');
    updateNavbarAuthUI();
}
```

### Rules:
1. Pro button ALWAYS calls its mode-switch handler (`handlePremiumTab()`, `setMode('pro')`)
2. Logout is ONLY triggered from the dedicated navbar dropdown "Logout" button
3. `activatePremiumUI()` changes button appearance only — never rebinds onclick
4. Every calculator page MUST dispatch `rz-auth-change` on login AND logout
5. Every calculator page MUST listen for `rz-auth-change` to sync with cross-page auth
