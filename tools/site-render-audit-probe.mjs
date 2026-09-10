export async function verifyScrollingGaps(gaps) {
  const original = { left: scrollX, top: scrollY };
  const observations = [];
  const settle = async () => {
    for (let frame = 0; frame < 4; frame += 1) await new Promise(resolve => requestAnimationFrame(resolve));
  };
  const visibleInk = element => {
    const box = element.getBoundingClientRect();
    if (!box.width || !box.height || box.bottom <= 0 || box.top >= innerHeight || box.right <= 0 || box.left >= innerWidth) return false;
    for (let parent = element; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      if (style.display === 'none' || style.visibility !== 'visible' || Number(style.opacity) === 0) return false;
    }
    return true;
  };
  try {
    for (const gap of gaps) {
      const midpoint = (gap.top + gap.bottom) / 2;
      const root = [...document.querySelectorAll('[data-rz-scrolly]')].find(element => {
        const box = element.getBoundingClientRect();
        return box.top + scrollY <= gap.top && box.bottom + scrollY >= gap.bottom;
      });
      if (!root) { observations.push({ ...gap, verified: false, reason: 'not-scrolly' }); continue; }
      scrollTo(0, midpoint - innerHeight / 2);
      await settle();
      const steps = [...root.querySelectorAll('.rz-scrolly-step')];
      const expectedStep = steps.findIndex(step => {
        const box = step.getBoundingClientRect();
        return box.top <= innerHeight / 2 && box.bottom > innerHeight / 2;
      });
      const canvas = root.querySelector('.rz-scrolly-canvas');
      const ink = canvas && [...canvas.querySelectorAll('svg text,svg path,svg rect,img')].some(visibleInk);
      const active = expectedStep >= 0 && steps[expectedStep].classList.contains('active') && root.dataset.step === String(expectedStep);
      observations.push({ ...gap, verified: Boolean(ink && active), reason: 'scrolly-probed',
        root: root.id || '[data-rz-scrolly]', scrollY, expectedStep, actualStep: root.dataset.step, visibleInk: Boolean(ink), active });
    }
  } finally { scrollTo(original.left, original.top); await settle(); }
  return observations;
}

export function collectMeasurements() {
  const protectedSelector = 'svg,canvas,pre,code,[data-rz-diagram],[data-rz-chart],[data-rz-instrument],.aurora-mesh,[class^="aurora-"],[class*=" aurora-"]';
  const instrumentSelector = '[data-rz-cockpit-root],.instrument,.instrument-panel,.calculator,.calculator-section,.calculator-container,.calc-container,.calc-panel,[role="grid"],table';
  const proseSelector = 'article,.article-body,.article-content,.prose,.manual-content,.prd-content,.mn-wrap';
  /* Site CHROME is not reading prose. The cookie-consent sentence and the copyright line appear on
     every page at their own size by design, so counting them made every page report a
     prose-font-size finding it could never legitimately fix. */
  const nonProseSelector = 'nav,header,footer,button,aside,.caption,figcaption,.kpi,.metric,.toc,.table-source,.chart-source,.article-disclaimer,.calc-disclaimer,.newsletter-signup,.author-bio,.related-articles,.rz-cookie-banner,.cookie-banner,.footer-brand,.footer-copyright,.footer-legal,.legal-disclaimer,.newsletter-box';
  const contextCache = new WeakMap();
  const roleContext = element => {
    if (contextCache.has(element)) return contextCache.get(element);
    const inherited = element.parentElement && element.parentElement !== document.body
      ? roleContext(element.parentElement) : { role: 'editorial', protectedBy: null, ancestry: [], fixed: false };
    const ancestry = [];
    let role = inherited.role;
    let protectedBy = inherited.protectedBy;
    for (const parent of [element]) {
      const identity = `${parent.id} ${typeof parent.className === 'string' ? parent.className : ''}`.trim();
      const classIdentity = typeof parent.className === 'string' ? parent.className : '';
      const style = getComputedStyle(parent);
      const statistics = inherited.role === 'statistics' || (/evidence-block/i.test(identity)
        && parent.parentElement?.matches('body,main') && !parent.querySelector('input,select,button,canvas,svg'));
      ancestry.push({ tag: parent.tagName, identity, background: style.backgroundColor, image: style.backgroundImage });
      const stops = [...style.backgroundImage.matchAll(/rgba?\(\s*([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)/g)];
      const darkOpaqueGradient = /gradient\(/.test(style.backgroundImage) && !/transparent/.test(style.backgroundImage)
        && Number(style.opacity) >= 0.98 && stops.length >= 2 && stops.every(stop => {
          const channels = stop.slice(1, 4).map(value => Number(value) / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
          return Number(stop[4] ?? 1) >= 0.98 && channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722 < 0.18;
        });
      if (!statistics && (/calculator|(?:^|[\s_-])calc(?:[\s_-]|$)|evidence-block|(?:^|[\s_-])instrument(?:[\s_-]|$)/i.test(identity)
        || /(?:^|[\s_-])(?:chart|diagram)(?:[\s_-]|$)/i.test(classIdentity))) {
        role = 'instrument'; protectedBy ||= identity;
      }
      if (darkOpaqueGradient && !statistics) { role = 'instrument'; protectedBy ||= `opaque-dark-gradient:${identity}`; }
      if (parent.tagName === 'FIGCAPTION' || /(?:^|[\s_-])caption(?:[\s_-]|$)/i.test(classIdentity)) {
        role = 'caption'; protectedBy ||= identity || 'figcaption';
      }
      if (parent.matches('.service-row .revenue-badge.rev-high,.service-row .revenue-badge.rev-medium,.service-row .revenue-badge.rev-low')
        && /^(HIGH|MEDIUM|LOW)$/.test(parent.textContent.trim())) {
        role = 'instrument'; protectedBy = `revenue-status:${identity}`;
      }
      if (parent.matches('.verdict-container .verdict-box')) {
        role = 'instrument'; protectedBy = `calculator-verdict:${identity}`;
      }
      if (statistics) { role = 'statistics'; protectedBy = null; }
    }
    const result = { role, protectedBy, ancestry: [...ancestry, ...inherited.ancestry].slice(0, 8),
      fixed: inherited.fixed || getComputedStyle(element).position === 'fixed' };
    contextCache.set(element, result);
    return result;
  };
  const visible = element => {
    /* This runs for EVERY element on the page, so each check below is ordered cheapest-first and
       the expensive ones (getComputedStyle, an ancestor walk) are reached only by the elements
       whose geometry already looks suspicious. Doing them unconditionally cost minutes per page. */
    const rects = element.getClientRects();
    if (!rects.length) return false;
    if (element.closest('.skip-link,.skip-to-content,.sr-only,.visually-hidden') && !element.matches(':focus')) return false;
    /* The visually-hidden idiom is a 1x1 box with `clip: rect(0,0,0,0)` — it paints NO ink, and
       pln-java-grid applies it through inline styles on its live region, so a class-name list can
       never catch it. A box that thin cannot show a reader anything either way. */
    const ownBox = rects[0];
    if (ownBox.width <= 1 || ownBox.height <= 1) {
      const ownStyle = getComputedStyle(element);
      if (/hidden|clip/.test(ownStyle.overflowX) || /hidden|clip/.test(ownStyle.overflowY)
        || ownStyle.clip !== 'auto') return false;
    }
    /* A CLOSED <details> hides its body BY DESIGN; only its <summary> is on screen. Pages that
       author `details { overflow: hidden }` (the CDU checklists, the compare FAQs) still lay the
       hidden body out, so every span inside it read as text clipped by an ancestor — 121 findings
       on cdu-checklist.html alone, none of them a defect a reader could ever see. */
    if (element.closest('details:not([open])') && !element.closest('summary')) return false;
    /* An OFF-CANVAS panel is parked outside the viewport ON PURPOSE and paints nothing until it
       opens — cx-calculator's .cx-drawer sits at translateX(377px) on a 390px screen. The nearest
       POSITIONED host decides; content stranded outside the viewport by ordinary flow is a
       different thing and stays a finding. Only an element already off-screen can be in one. */
    if (ownBox.right <= 0 || ownBox.left >= innerWidth) {
      for (let parent = element; parent; parent = parent.parentElement) {
        const position = getComputedStyle(parent).position;
        if (position !== 'fixed' && position !== 'absolute') continue;
        const host = parent.getBoundingClientRect();
        if (host.right <= 0 || host.left >= innerWidth) return false;
        break;
      }
    }
    const menu = element.closest('.nav-menu,.nav-links');
    if (menu && !document.body.classList.contains('rz-nav-open') && !menu.classList.contains('active')) {
      const box = menu.getBoundingClientRect();
      if (box.right <= 0 || box.left >= innerWidth) return false;
    }
    for (let parent = element; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
      if (/hidden|clip/.test(style.overflowY) && parent.clientHeight === 0) return false;
    }
    return true;
  };
  const target = element => {
    if (element.id) return `#${CSS.escape(element.id)}`;
    const parts = [];
    for (let parent = element; parent && parts.length < 6; parent = parent.parentElement) {
      const siblings = parent.parentElement ? [...parent.parentElement.children].filter(child => child.tagName === parent.tagName) : [parent];
      parts.unshift(`${parent.tagName.toLowerCase()}:nth-of-type(${siblings.indexOf(parent) + 1})`);
    }
    return parts.join(' > ');
  };
  const clipping = (element, rectangles) => {
    const reasons = new Set();
    for (const rect of rectangles) {
      let scrollableX = false;
      let scrollableY = false;
      /* A MARQUEE queues its next items outside the window it scrolls them through: that is the
         mechanism, not a defect. Once the walk passes an element a keyframe animation is moving,
         every clipping box above it is that window (index.html's news ticker, .rz-marquee). */
      let marquee = false;
      /* `text-overflow: ellipsis` is the authored truncation affordance — the cut is declared and
         the reader can SEE it happened. Only the horizontal axis it governs is exempt; a box that
         clips with no ellipsis (datahall's CRAH tags) is still a finding. */
      let ellipsised = false;
      /* `-webkit-line-clamp` is the multi-line form of the same affordance: it draws its own
         ellipsis at the cut, so it exempts BOTH axes — the clamp is what makes the box short. */
      let clamped = false;
      /* Text a non-root box already clips CANNOT reach past the viewport — the rect measured here
         is the UNCLIPPED range, so a truncated line was reporting viewport-horizontal for ink that
         is never painted. Only the root's own overflow is excluded: suppressing on that would gut
         the rule on every page carrying `html, body { overflow-x: hidden }`. */
      let clippedX = false;
      for (let parent = element; parent; parent = parent.parentElement) {
        const style = getComputedStyle(parent);
        const box = parent.getBoundingClientRect();
        const root = parent === document.body || parent === document.documentElement;
        const clipX = /hidden|clip/.test(style.overflowX);
        const clipY = /hidden|clip/.test(style.overflowY);
        const horizontal = rect.left < box.left - 2 || rect.right > box.right + 2;
        const vertical = rect.top < box.top - 2 || rect.bottom > box.bottom + 2;
        if (/ellipsis/.test(style.textOverflow)) ellipsised = true;
        if ((style.webkitLineClamp || style.getPropertyValue('-webkit-line-clamp')) !== 'none') clamped = true;
        /* A box that CAN scroll on an axis is never the reason ink is unreachable: either it
           scrolls (the reader gets there) or its content fits and nothing is hidden. The second
           case matters — `white-space: pre-wrap` HANGS preserved indentation, so article-26's
           chemistry blocks measured a 504px range inside a 347px box that scrollWidth (rightly)
           reports as fitting, and <body> was blamed for whitespace that paints nothing. */
        if (!root && /auto|scroll/.test(style.overflowX)) scrollableX = true;
        if (!root && /auto|scroll/.test(style.overflowY)) scrollableY = true;
        if (!root && clipX && horizontal) clippedX = true;
        if (clipX && horizontal && !scrollableX && !marquee && !ellipsised && !clamped) reasons.add(`ancestor-clipping-x:${target(parent)}`);
        if (!root && clipY && vertical && !scrollableY && !marquee && !clamped) reasons.add(`ancestor-clipping-y:${target(parent)}`);
        if (style.animationName !== 'none' && style.transform !== 'none') marquee = true;
      }
      if (!scrollableX && !marquee && !clippedX && (rect.right > innerWidth + 2 || rect.left < -2)) reasons.add('viewport-horizontal');
    }
    return [...reasons];
  };
  const decoration = (element, style) => {
    const rules = [];
    const identity = `${element.id} ${element.className}`;
    if (/evidence-block/.test(identity) && element.parentElement?.matches('body,main')
      && !element.querySelector('input,select,button,canvas,svg') && /gradient\(/.test(style.backgroundImage)) rules.push('top-level-statistics-gradient');
    const surface = /card|callout|info-box|insight-box|engineer-note|bento|pill|badge/.test(identity);
    const purple = /139,\s*92,\s*246/.test(style.backgroundColor);
    if (/pill|badge/.test(identity) && purple) rules.push('purple-pill');
    if (/hero|dot-grid/.test(identity) && /radial-gradient/.test(style.backgroundImage)
      && /\b[1-9](?:\.\d+)?px\b/.test(style.backgroundSize)) rules.push('decorative-dot-grid');
    if (/callout|info-box|insight-box|engineer-note/.test(identity) && /gradient/.test(style.backgroundImage)) rules.push('gradient-callout');
    if (surface && /blur\(/.test(style.backdropFilter)) rules.push('decorative-glass');
    /* §A bans TRANSLUCENT CARD WASHES in article bodies (CLAUDE.md rejected pattern 7, and the
       `flattenWashes()` runtime that enforces it). Two things are NOT that: the site's own
       replacement — a flat tint plus a 1px hairline, which is what `.quote-callout` renders
       under css/rz-article-dark.css — and a tinted instrument chip, which is a different idiom
       and carries no card/panel/block token at all. Chips were 1,332 of the 1,988 findings this
       rule raised; a badge that ALSO calls itself a card stays in scope. */
    const washSurface = /card|panel|block|callout|info-box|insight-box|engineer-note/.test(identity);
    const hairline = style.borderTopStyle === 'solid' && parseFloat(style.borderTopWidth) > 0
      && parseFloat(style.borderTopWidth) <= 2;
    if (washSurface && !hairline && element.closest(proseSelector)) {
      const alpha = style.backgroundColor.match(/^rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)/)?.[1];
      if (alpha && Number(alpha) >= 0.02 && Number(alpha) <= 0.5) rules.push('editorial-translucent-wash');
    }
    /* §A bans TINTED HIGHLIGHT SPANS over running prose. A status chip is not one: it is
       `display: inline-block` carrying its own padding and radius, and it labels the sentence
       rather than tinting it (geopolitics-2's `.confidence-badge`, the manual pages'
       `.mn-status`). A highlighter is plain `inline` text with neither. */
    const chip = style.display !== 'inline' && parseFloat(style.paddingLeft) > 0;
    if (element.tagName === 'SPAN' && !chip && element.closest('p') && element.closest(proseSelector)
      && style.backgroundColor !== 'rgba(0, 0, 0, 0)' && style.backgroundColor !== 'transparent') rules.push('prose-highlight-wash');
    return rules;
  };
  const elements = [];
  const occupied = [];
  const proseBoxes = [];
  const roleExclusions = [];
  const overflowBoxes = [];
  for (const element of document.body.querySelectorAll('*')) {
    if (!visible(element)) continue;
    const style = getComputedStyle(element);
    const context = roleContext(element);
    const protectedNode = Boolean(element.closest(protectedSelector));
    const instrument = context.role === 'instrument' || Boolean(element.closest(instrumentSelector));
    const nonReading = instrument || context.role === 'caption';
    const directNodes = [...element.childNodes].filter(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
    const text = element.textContent.trim().replace(/\s+/g, ' ').slice(0, 180);
    const legalNotice = /^(?:All content on ResistanceZero is independent personal research|By using this tool you agree)/.test(text);
    const prose = !nonReading && Boolean(element.closest(proseSelector)) && /^(P|LI|BLOCKQUOTE|DD)$/.test(element.tagName)
      && !element.closest(nonProseSelector) && !legalNotice
      && element.textContent.trim().split(/\s+/).length >= 8;
    if (nonReading && /^(P|LI|BLOCKQUOTE|DD)$/.test(element.tagName) && element.textContent.trim().split(/\s+/).length >= 8) {
      roleExclusions.push({ target: target(element), text, fontSize: parseFloat(style.fontSize), context });
    }
    const rectangles = directNodes.flatMap(node => {
      const range = document.createRange();
      range.selectNodeContents(node);
      return [...range.getClientRects()];
    });
    const box = element.getBoundingClientRect();
    if (box.right > innerWidth + 2 || box.left < -2) {
      const ancestors = [];
      for (let parent = element; parent && ancestors.length < 6; parent = parent.parentElement) {
        const parentStyle = getComputedStyle(parent);
        ancestors.push({ target: target(parent), overflowX: parentStyle.overflowX, overflowY: parentStyle.overflowY,
          scrollWidth: parent.scrollWidth, clientWidth: parent.clientWidth });
      }
      const contained = ancestors.slice(1).some(ancestor => {
        const parent = document.querySelector(ancestor.target);
        if (!parent) return false;
        const rectangle = parent.getBoundingClientRect();
        return /auto|scroll|hidden|clip/.test(ancestor.overflowX) && rectangle.left >= -2 && rectangle.right <= innerWidth + 2;
      });
      overflowBoxes.push({ target: target(element), left: box.left, right: box.right, width: box.width, ancestors, contained });
    }
    const inFlow = !element.closest('[role="dialog"]') && !context.fixed;
    if (inFlow && (directNodes.length || /^(IMG|SVG|CANVAS|VIDEO|IFRAME|INPUT|BUTTON)$/.test(element.tagName))) {
      occupied.push({ top: box.top + scrollY, bottom: box.bottom + scrollY });
    }
    if (prose && !protectedNode) {
      const container = element.closest(proseSelector);
      const containerBox = container.getBoundingClientRect();
      const containerStyle = getComputedStyle(container);
      proseBoxes.push({ target: target(element), top: box.top + scrollY, left: box.left, width: box.width,
        readingColumn: !element.closest('[class*="card"],.grid,.bento,[class*="-grid"]'),
        container: target(container), containerWidth: containerBox.width, containerLeft: containerBox.left,
        paddingLeft: parseFloat(containerStyle.paddingLeft), paddingRight: parseFloat(containerStyle.paddingRight),
        textAlign: style.textAlign, marginLeft: parseFloat(style.marginLeft), marginRight: parseFloat(style.marginRight) });
    }
    const overflow = protectedNode ? [] : clipping(element, rectangles);
    const decorations = protectedNode || instrument ? [] : decoration(element, style);
    if (!prose && !overflow.length && !decorations.length) continue;
    const fontSize = parseFloat(style.fontSize);
    elements.push({ target: target(element), text, prose, protected: protectedNode || instrument, context,
      fontSize, lineRatio: style.lineHeight === 'normal' ? null : parseFloat(style.lineHeight) / fontSize,
      overflow, decoration: decorations });
  }
  const blockedSelectors = '#rootGate,.root-gate,#rzRestrictedOverlay,.rz-restricted-overlay,[data-auth-required],body.locked,[role="dialog"][aria-modal="true"]';
  const blocked = [...document.querySelectorAll(blockedSelectors)].filter(visible).map(element => ({
    target: target(element), text: element.textContent.trim().slice(0, 200) }));
  if (document.querySelector('input[type="password"]') && visible(document.querySelector('input[type="password"]'))) {
    blocked.push({ target: 'input[type=password]', text: 'Visible authentication form' });
  }
  occupied.sort((first, second) => first.top - second.top);
  const blankGaps = [];
  let bottom = 0;
  for (const interval of occupied) {
    if (interval.top - bottom > Math.max(160, innerHeight * 0.35)) blankGaps.push({ top: bottom, bottom: interval.top, height: interval.top - bottom });
    bottom = Math.max(bottom, interval.bottom);
  }
  const originalX = scrollX;
  const originalY = scrollY;
  scrollTo(document.documentElement.scrollWidth, originalY);
  const actualScrollX = scrollX;
  scrollTo(originalX, originalY);
  const headerOverlaps = [];
  const headers = [...document.querySelectorAll('nav.navbar,header.navbar,.site-header,[data-rz-site-header],#navbar,.rz-global-nav')]
    .filter(element => visible(element) && ['fixed', 'sticky'].includes(getComputedStyle(element).position))
    .map(element => ({ element, box: element.getBoundingClientRect() }));
  const heroText = document.querySelectorAll('h1,[class*="hero"] h2,[class*="hero"] [class*="category"],[class*="hero"] [class*="kicker"],[class*="hero"] [class*="eyebrow"],[class*="hero"] [class*="label"]');
  for (const element of heroText) {
    if (!visible(element) || element.closest('nav,[role="toolbar"],[role="dialog"]')) continue;
    const range = document.createRange();
    range.selectNodeContents(element);
    for (const header of headers) {
      if (header.element.contains(element)) continue;
      const overlap = [...range.getClientRects()].find(rectangle => rectangle.top < innerHeight && rectangle.bottom > 0
        && Math.min(rectangle.right, header.box.right) - Math.max(rectangle.left, header.box.left) > 2
        && Math.min(rectangle.bottom, header.box.bottom) - Math.max(rectangle.top, header.box.top) > 2);
      if (overlap) headerOverlaps.push({ target: target(element), header: target(header.element),
        text: element.textContent.trim().slice(0, 120), top: overlap.top, bottom: overlap.bottom, headerBottom: header.box.bottom });
    }
  }
  return { elements, blocked, title: document.title, actualTheme: document.documentElement.dataset.theme,
    roleExclusions,
    layout: { viewportWidth: innerWidth, viewportHeight: innerHeight, documentHeight: document.documentElement.scrollHeight,
      headerOverlaps,
      actualScrollX, overflowBoxes: overflowBoxes.sort((first, second) => second.right - first.right).slice(0, 5),
      uncontainedOverflowBoxes: overflowBoxes.filter(box => !box.contained).slice(0, 5),
      articleStartY: proseBoxes.length ? Math.min(...proseBoxes.map(box => box.top)) : null,
      proseBoxes, blankGaps },
    bodyTextLength: document.body.innerText.trim().length,
    /* `deferred` marks an image the browser has not fetched YET because the page told it not to:
       loading="lazy" and still outside the viewport. That is the page working as written, not a
       broken image — all 20 findings on articles.html were this, and every one resolved on scroll. */
    images: [...document.images].filter(visible).map(element => ({ target: target(element),
      src: element.currentSrc || element.src, complete: element.complete, naturalWidth: element.naturalWidth,
      deferred: element.loading === 'lazy' && !element.complete
        && (() => { const box = element.getBoundingClientRect();
          return box.bottom < -200 || box.top > innerHeight + 200; })() })),
    frames: [...document.querySelectorAll('iframe')].filter(visible).map(element => element.src),
    documentOverflow: document.documentElement.scrollWidth > innerWidth + 2 ? document.documentElement.scrollWidth - innerWidth : false };
}
