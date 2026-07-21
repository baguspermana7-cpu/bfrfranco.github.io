#!/usr/bin/env node
/* ============================================================================
   verify-article-light.mjs — headless verification for light-mode editorial CSS
   Checks that html[data-rz-register="editorial"]:not([data-theme="dark"]) rules
   apply correctly: Fraunces on .article-title, drop-cap on first p, mono on .article-meta.
   Also verifies the dark block still works.
   Usage: node tools/verify-article-light.mjs
   ============================================================================ */
import puppeteer from 'puppeteer';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.mjs': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2',
  '.ttf': 'font/ttf', '.otf': 'font/otf',
};

const srv = http.createServer((req, res) => {
  let p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (p.endsWith('/')) p += 'index.html';
  fs.readFile(p, (e, d) => {
    if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
    res.end(d);
  });
});
await new Promise(r => srv.listen(0, r));
const PORT = srv.address().port;
console.log(`Server up on port ${PORT}`);

const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
});

let passed = 0;
let failed = 0;
const results = [];

function pass(label, detail) {
  passed++;
  results.push({ ok: true, label, detail });
  console.log(`  ✓ ${label}${detail ? ': ' + detail : ''}`);
}
function fail(label, detail) {
  failed++;
  results.push({ ok: false, label, detail });
  console.error(`  ✗ ${label}${detail ? ': ' + detail : ''}`);
}

async function openPage(theme) {
  const pg = await browser.newPage();
  // Set theme in localStorage BEFORE navigation so the page picks it up on load
  await pg.evaluateOnNewDocument((t) => {
    localStorage.setItem('theme', t);
  }, theme);
  await pg.goto(`http://localhost:${PORT}/article-1.html`, {
    waitUntil: 'networkidle2',
    timeout: 30000,
  });
  // Also set data-theme attribute explicitly (belt-and-suspenders)
  if (theme === 'dark') {
    await pg.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
    });
  } else {
    await pg.evaluate(() => {
      document.documentElement.removeAttribute('data-theme');
    });
  }
  // Allow CSS to recompute
  await new Promise(r => setTimeout(r, 600));
  return pg;
}

async function checkTheme(theme) {
  console.log(`\n--- ${theme.toUpperCase()} MODE ---`);
  const pg = await openPage(theme);

  try {
    // 1. Check .article-title font-family contains Fraunces
    const titleFont = await pg.evaluate(() => {
      const el = document.querySelector('.article-title');
      if (!el) return null;
      return window.getComputedStyle(el).fontFamily;
    });
    if (titleFont && titleFont.toLowerCase().includes('fraunces')) {
      pass(`[${theme}] .article-title font-family`, titleFont);
    } else {
      fail(`[${theme}] .article-title font-family should contain Fraunces`, titleFont || 'element not found');
    }

    // 2. Check .article-body h2 font-family contains Fraunces
    const h2Font = await pg.evaluate(() => {
      const el = document.querySelector('.article-body h2');
      if (!el) return null;
      return window.getComputedStyle(el).fontFamily;
    });
    if (h2Font && h2Font.toLowerCase().includes('fraunces')) {
      pass(`[${theme}] .article-body h2 font-family`, h2Font);
    } else {
      fail(`[${theme}] .article-body h2 font-family should contain Fraunces`, h2Font || 'element not found');
    }

    // 3. Check drop-cap: first letter of first paragraph should have larger font-size
    // We check the lead paragraph font-size is 1.14rem (editorial lead paragraph rule)
    const leadPFontSize = await pg.evaluate(() => {
      const el = document.querySelector('.article-body > p:first-of-type');
      if (!el) return null;
      return window.getComputedStyle(el).fontSize;
    });
    // 1.14rem at default 16px = 18.24px, so > 16px means it's enlarged
    const leadPx = leadPFontSize ? parseFloat(leadPFontSize) : 0;
    if (leadPx > 16) {
      pass(`[${theme}] .article-body > p:first-of-type is enlarged (lead ¶)`, `${leadPFontSize} > 16px`);
    } else {
      fail(`[${theme}] .article-body > p:first-of-type font-size should be > 16px`, leadPFontSize || 'element not found');
    }

    // 3b. Check ::first-letter pseudo-element via counter trick: computed font-size of drop-cap
    // (We can't directly query ::first-letter with getComputedStyle, but we can verify the
    //  Fraunces font-family is set on it via a style sheet check)
    const dropCapCheck = await pg.evaluate(() => {
      // Check that any stylesheet has the drop-cap rule with font-size: 3.1rem
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules || []) {
            if (rule.selectorText && rule.selectorText.includes('first-of-type::first-letter')) {
              return { found: true, fontSize: rule.style.fontSize, fontFamily: rule.style.fontFamily };
            }
          }
        } catch (e) { /* cross-origin */ }
      }
      return { found: false };
    });
    if (dropCapCheck.found) {
      const fs = parseFloat(dropCapCheck.fontSize);
      if (fs >= 3) {
        pass(`[${theme}] drop-cap ::first-letter rule present`, `font-size: ${dropCapCheck.fontSize}, family: ${dropCapCheck.fontFamily}`);
      } else {
        fail(`[${theme}] drop-cap ::first-letter font-size too small`, dropCapCheck.fontSize);
      }
    } else {
      fail(`[${theme}] drop-cap ::first-letter rule NOT found in stylesheets`, '');
    }

    // 4. Check .article-meta uses IBM Plex Mono
    const metaFont = await pg.evaluate(() => {
      const el = document.querySelector('.article-meta');
      if (!el) return null;
      return window.getComputedStyle(el).fontFamily;
    });
    const isMono = metaFont && (metaFont.toLowerCase().includes('mono') || metaFont.toLowerCase().includes('ibm plex mono'));
    if (isMono) {
      pass(`[${theme}] .article-meta font-family is mono`, metaFont);
    } else {
      fail(`[${theme}] .article-meta should use mono font`, metaFont || 'element not found');
    }

    // 5. Check editorial register is active (data-rz-register=editorial on html)
    const hasRegister = await pg.evaluate(() =>
      document.documentElement.getAttribute('data-rz-register') === 'editorial'
    );
    if (hasRegister) {
      pass(`[${theme}] data-rz-register="editorial" is set on html`, '');
    } else {
      fail(`[${theme}] data-rz-register="editorial" missing on html`, '');
    }

    // 6. Check that --rz-art-accent CSS var is set (editorial token active)
    const accentVar = await pg.evaluate(() => {
      return window.getComputedStyle(document.documentElement).getPropertyValue('--rz-art-accent').trim();
    });
    if (accentVar) {
      pass(`[${theme}] --rz-art-accent token is set`, accentVar);
    } else {
      fail(`[${theme}] --rz-art-accent token not found`, '');
    }

  } finally {
    await pg.close();
  }
}

await checkTheme('light');
await checkTheme('dark');

await browser.close();
srv.close();

console.log(`\n=== RESULT: ${passed} passed, ${failed} failed ===`);
if (failed > 0) {
  console.error('\nFAILED CHECKS:');
  results.filter(r => !r.ok).forEach(r => console.error(`  ✗ ${r.label}: ${r.detail}`));
  process.exit(1);
} else {
  console.log('All assertions passed.');
}
