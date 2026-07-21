/* ============================================================================
 * rz-hero-fit.js — shared blur-letterbox for calculator hero images.
 * ----------------------------------------------------------------------------
 * Self-injecting (pattern of js/rz-manual-fab.js). Fixes hero images that
 * stretch/distort and whose width does not match the calculator container:
 *   - wraps the hero <img> in a fixed-aspect .rz-hero-fit box (aspect taken
 *     from the image's own width/height attrs — no distortion);
 *   - the sharp image sits object-fit:contain (WHOLE image, never cropped,
 *     never stretched); the empty sides are filled with a thin BLURRED copy
 *     of the same image (blur-letterbox);
 *   - aligns the box width to the calculator container (via data-rz-hero-width,
 *     default 1400px when it replaces a lone image wrapper) without touching
 *     the calculator's own layout.
 * Targets: img.brief-hero-img, or any img[data-rz-hero]. Guard: window.__rzHeroFit.
 * Standard: standarization/UI_FEATURES_STANDARD.md (Hero blur-letterbox).
 * ==========================================================================*/
(function (w, d) {
  'use strict';
  if (w.__rzHeroFit) { return; }
  w.__rzHeroFit = true;

  function injectStyle() {
    if (d.getElementById('rzHeroFitStyle')) { return; }
    var css =
      '.rz-hero-fit{position:relative;width:100%;margin:1.5rem auto;border-radius:16px;overflow:hidden;' +
      'box-shadow:0 8px 30px rgba(0,0,0,0.12);border:1px solid rgba(148,163,184,0.18);background:#0b0f14;}' +
      '.rz-hero-fit-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;' +
      'transform:scale(1.12);filter:blur(20px) brightness(0.9);z-index:0;pointer-events:none;}' +
      '.rz-hero-fit-img{position:relative;z-index:1;display:block;width:100%;height:100%;object-fit:contain;}' +
      '[data-theme="dark"] .rz-hero-fit{border-color:rgba(148,163,184,0.14);}' +
      '@media (prefers-reduced-motion:reduce){.rz-hero-fit-bg{filter:blur(20px);}}';
    var s = d.createElement('style');
    s.id = 'rzHeroFitStyle';
    s.textContent = css;
    d.head.appendChild(s);
  }

  function fit(img) {
    if (!img || img.getAttribute('data-rz-hero-done')) { return; }
    var src = img.currentSrc || img.getAttribute('src');
    if (!src) { return; }
    var wAttr = parseFloat(img.getAttribute('width'));
    var hAttr = parseFloat(img.getAttribute('height'));
    var aspect = (wAttr && hAttr) ? (wAttr + ' / ' + hAttr) : '1200 / 630';

    // The hero element is the <picture> if the img is inside one, else the img.
    var heroEl = (img.parentElement && img.parentElement.tagName === 'PICTURE') ? img.parentElement : img;
    // If heroEl's parent holds ONLY heroEl (a bare hero-image wrapper, e.g. the
    // inline max-width:800px div), REPLACE that parent (so we can re-align width).
    // Otherwise (img lives among text, e.g. .brief-card) wrap heroEl in place.
    var parent = heroEl.parentElement;
    var replaceParent = parent && parent.children.length === 1 && parent !== d.body;
    var host = replaceParent ? parent : heroEl;

    var box = d.createElement('div');
    box.className = 'rz-hero-fit';
    box.style.aspectRatio = aspect;
    var maxW = img.getAttribute('data-rz-hero-width') || (replaceParent ? '1400px' : '100%');
    box.style.maxWidth = maxW;

    var bg = d.createElement('img');
    bg.className = 'rz-hero-fit-bg';
    bg.setAttribute('src', src);
    bg.setAttribute('aria-hidden', 'true');
    bg.setAttribute('alt', '');

    // move the hero element (img or picture) into the box as the sharp contain layer
    img.classList.add('rz-hero-fit-img');
    img.setAttribute('data-rz-hero-done', '1');
    img.style.maxHeight = 'none';
    if (heroEl.tagName === 'PICTURE') { heroEl.classList.add('rz-hero-fit-img'); }

    host.parentNode.insertBefore(box, host);
    box.appendChild(bg);
    box.appendChild(heroEl);
    if (replaceParent && host !== heroEl && host.parentNode) { host.parentNode.removeChild(host); }
  }

  function run() {
    injectStyle();
    var imgs = d.querySelectorAll('img.brief-hero-img, img[data-rz-hero]');
    for (var i = 0; i < imgs.length; i++) { fit(imgs[i]); }
  }

  if (d.readyState === 'loading') {
    d.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }
})(window, document);
