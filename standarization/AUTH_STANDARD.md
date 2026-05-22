# Authentication System Standard — ResistanceZero

> **Version**: 1.0 | **Updated**: 2026-02-16
>
> **See also**: [`CALC_ENGINE_PLAN.md`](./CALC_ENGINE_PLAN.md) &mdash; Phase 1 of the
> calculator engine consolidation roadmap extracts the inline auth pattern
> documented below into a shared `calc-auth.js` library. **Do not add new
> inline `VALID_USERS` arrays or session-check code to new calculators** &mdash;
> consult the consolidation plan first so the new calculator can adopt the
> shared engine when Phase 1 ships.

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
| `educator@resistancezero.com` | `educator2026` | pro | educator | Hardcoded in auth.js + `rz_admin_educators` (admin-managed allowlist) |
| `demo@resistancezero.com` | `demo2026` | demo | demo | Hardcoded in auth.js + all pages |
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

---

## Auth tiers (4-tier matrix, educator-tier expansion 2026-05-22)

> Added by Tasks 1–7 of the educator-tier migration. Supersedes the
> single-tier `"pro"`-only model documented above. The session schema is
> unchanged — only the resolver semantics and the feature-flag matrix
> expanded. Existing inline `session.tier === 'pro'` checks across the
> codebase remain correct because educator users ALSO have `tier === 'pro'`
> (educator is a ROLE, not a separate tier).

### Tier ladder (4 levels — feature-flag matrix columns)

```
free  →  demo  →  pro  →  root
```

- **`free`** — unauthenticated visitor. Site pages reachable, calc free-tier
  features only.
- **`demo`** — `demo@resistancezero.com` and similar showcase accounts.
  Unlocks demo-gated features per matrix; cannot reach DC suites.
- **`pro`** — paid Pro accounts and educator accounts (educator users
  consume the PRO column). Full calculator pro features, DC AI, DC
  Conventional, DCMOC, LTC labs.
- **`root`** — admin accounts (`bagus@`, `admin@`). PRO column access plus
  rz-ops admin panel and root-only modules (currently
  `/dc-market-tracker.html`).

### Role ladder (5 roles — orthogonal to tier)

```
free  →  demo  →  pro  →  educator  →  root
```

- Role is attached to the session record (`session.role`) or detected from
  email via `detectRole(email)` in `auth.js`.
- **`educator`** sits between `pro` and `root` for badging/policy purposes
  but resolves to the PRO column for feature-flag access (educator gets
  pro-tier feature access **and** rz-ops admin-panel access is blocked
  the same as for pro).
- Root remains the only role that passes rz-ops gates and the root-only
  page list.

### Helper API additions

```js
window._rzAuth.getTier(session?)         // 'free' | 'demo' | 'pro'
window._rzAuth.getRoleFromSession(session) // '' | 'demo' | 'pro' | 'educator' | 'root'
window._rzAuth.enforceTierFeatureAccess(pageKey)
  // Page-level gate driven by rz-feature-flags.js.
  // Resolves session → tier → consults `page-access` feature on pageKey.
  // Root short-circuits to true. On denial, locks the page body + shows
  // the existing "Restricted Access" UX. Used by datahallAI.html,
  // dc-conventional.html, dcmoc/index.html, and the LTC labs.
```

### `page-access` feature convention

Each `rz-feature-flags.js` page entry MAY define a feature named
`page-access` (booleans for each of the four tiers). `enforceTierFeatureAccess(pageKey)`
consults this single key to decide whether the body renders or the
restricted-access overlay shows. This pattern replaced the legacy
`ROOT_ONLY_PATHS` hard block for DC AI, DC Conventional, DCMOC, and all
LTC labs.

```js
// rz-feature-flags.js excerpt — DC pages converted to matrix gates:
'datahall-ai': {
  'page-access':         { free: false, demo: false, pro: true, root: true },
  /* …other features… */
},
```

### Educator allowlist storage

The set of educator emails has two sources:

1. **Seed list** — hardcoded in `auth.js` (`EDUCATOR_SEED_EMAILS`,
   currently `['educator@resistancezero.com']`).
2. **Admin overrides** — `localStorage.rz_admin_educators`, a JSON array of
   email strings managed by the rz-ops admin panel.

Both lists are unioned by `loadEducatorEmails()`. The rz-ops admin panel
dispatches a `rz-educators-changed` CustomEvent + emits a `storage` event
after writing the override; `auth.js` re-reads the allowlist on either.

```js
// rz-ops adds an educator
var raw = localStorage.getItem('rz_admin_educators');
var list = raw ? JSON.parse(raw) : [];
list.push('partner-edu@university.edu');
localStorage.setItem('rz_admin_educators', JSON.stringify(list));
window.dispatchEvent(new CustomEvent('rz-educators-changed'));
```

### Badge convention (header dropdown)

The post-login header pill (`#rzDdBadge`) reflects the user's role:

| Role | Label | Background | Foreground |
|------|-------|------------|------------|
| `educator` | `EDUCATOR` | `rgba(8, 145, 178, 0.18)` (instrument-cyan) | `#67e8f9` |
| `pro` / `root` / others | tier `.toUpperCase()` | gradient purple | white |
| anonymous | hidden | — | — |

CSS rule (`.rz-dd-badge.educator`) is mirrored in **both** `styles.css`
**and** `styles-index.css` per the 2-stylesheet architecture rule.
