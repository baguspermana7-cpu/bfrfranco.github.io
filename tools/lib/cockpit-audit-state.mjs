const AUTH_BLOCKER_SELECTOR = [
  '#rootGate',
  '#rzRestrictedOverlay',
  '#rzModalOverlay',
].join(', ');

const COCKPIT_IDENTITY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function cockpitRootSelector(cockpitIdentity) {
  if (typeof cockpitIdentity !== 'string'
      || !COCKPIT_IDENTITY_PATTERN.test(cockpitIdentity)) {
    throw new TypeError(`invalid cockpit identity: ${String(cockpitIdentity)}`);
  }
  return `[data-rz-cockpit-root="${cockpitIdentity}"]`;
}

export async function primeCockpitAuditDocument(page, theme) {
  await page.evaluateOnNewDocument((activeTheme) => {
    localStorage.setItem('theme', activeTheme);
    localStorage.setItem('rz_theme', activeTheme);
    localStorage.setItem('rz_cookie_consent', 'declined');
  }, theme);
}

export async function enterAuthorizedAuditState(page, cockpitIdentity) {
  const rootSelector = cockpitRootSelector(cockpitIdentity);
  await page.evaluate((blockerSelector, expectedRootSelector) => {
    const clearAuthBlockers = () => {
      if (document.body.classList.contains('locked')) document.body.classList.remove('locked');
      document.querySelectorAll(blockerSelector).forEach((node) => node.remove());
      const root = document.querySelector(expectedRootSelector);
      for (let node = root; node; node = node.parentElement) {
        if (node.hasAttribute('inert')) node.removeAttribute('inert');
      }
    };

    window.__rzCockpitAuditGateObserver?.disconnect();
    const observer = new MutationObserver(clearAuthBlockers);
    observer.observe(document.body, { attributes: true, childList: true, subtree: true });
    window.__rzCockpitAuditGateObserver = observer;
    clearAuthBlockers();
  }, AUTH_BLOCKER_SELECTOR, rootSelector);
}

export async function inspectAuthorizedAuditState(page, cockpitIdentity) {
  const rootSelector = cockpitRootSelector(cockpitIdentity);
  return page.evaluate((blockerSelector, expectedRootSelector) => {
    const roots = Array.from(document.querySelectorAll(expectedRootSelector));
    const root = roots[0] || null;
    /* v1.135.0 — MEASURABLE, not merely unlocked. Clearing body.locked, the overlays and
       `inert` says the surface is not BLOCKED; it does not say the surface is on screen.
       datahallAI.html ships `data-datahall-authority="unavailable"`, and its own CSS then
       does `#tabs, .wrap { display: none !important }` — so an audit could satisfy every
       check above while measuring a page with no box at all, and report it clean. That is
       how eight of ten tabs went unmeasured for this long. A hidden root is now a failure,
       and the attribute that hid it is named in the error rather than left to be guessed. */
    const rootStyle = root ? getComputedStyle(root) : null;
    const rootBox = root ? root.getBoundingClientRect() : null;
    const rootMeasurable = Boolean(root)
      && rootStyle.display !== 'none'
      && rootStyle.visibility !== 'hidden'
      && rootBox.width > 2 && rootBox.height > 2;
    return {
      bodyLocked: document.body.classList.contains('locked'),
      blockingOverlayCount: document.querySelectorAll(blockerSelector).length,
      cockpitRootCount: roots.length,
      hasCockpitRoot: roots.length === 1,
      cockpitRootInert: Boolean(root?.closest('[inert]')),
      cockpitRootMeasurable: rootMeasurable,
      cockpitRootHiddenBy: root && !rootMeasurable
        ? (document.body.getAttribute('data-datahall-authority')
          || document.body.getAttribute('data-rz-basis-authority')
          || 'unknown-rule')
        : null,
    };
  }, AUTH_BLOCKER_SELECTOR, rootSelector);
}

export async function assertAuthorizedAuditState(page, cockpitIdentity) {
  const state = await inspectAuthorizedAuditState(page, cockpitIdentity);
  if (state.bodyLocked || state.blockingOverlayCount > 0
      || !state.hasCockpitRoot || state.cockpitRootInert
      || !state.cockpitRootMeasurable) {
    throw new Error(`invalid authorized audit surface: ${JSON.stringify(state)}`);
  }
}

export function assertAuditFindingsComplete(findings, expectedKeys) {
  const evidence = findings && typeof findings === 'object' ? findings : {};
  const requiredKeys = Array.isArray(expectedKeys) ? expectedKeys : [];
  const errorKeys = Object.keys(evidence).filter((key) => key.includes('_ERR_'));
  const missingKeys = requiredKeys.filter((key) => (
    !Object.hasOwn(evidence, key)
      || !evidence[key]
      || typeof evidence[key] !== 'object'
      || Boolean(evidence[key].error)
  ));

  if (errorKeys.length > 0 || missingKeys.length > 0) {
    throw new Error(`audit evidence incomplete: errors=${errorKeys.join(',') || 'none'}; missing=${missingKeys.join(',') || 'none'}`);
  }
}
