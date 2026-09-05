import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import puppeteer from 'puppeteer';
import { createRequire as __rzRequire } from 'node:module';
const ENGINE_PUBLISHED_VERSION = (() => {
  const m = __rzRequire(import.meta.url)(process.cwd() + '/js/conv-engine.js');
  return (m.CONV_CALC || m).snapshot.meta.version;
})();

const ROOT = process.cwd();
const MIME = Object.freeze({
  '.css': 'text/css',
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.mjs': 'text/javascript',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
});
const DOCUMENTS = Object.freeze([
  Object.freeze({
    value: 'technical-specification',
    label: 'Technical Specification',
    ownHeading: 'Technical Specification Requirements and Acceptance',
  }),
  Object.freeze({
    value: 'basis-of-design',
    label: 'Basis of Design',
    ownHeading: 'Basis of Design Criteria and Boundaries',
  }),
  Object.freeze({
    value: 'operator-handover',
    label: 'Operator Handover Pack',
    ownHeading: 'Operator Handover and Readiness',
  }),
]);
const COCKPIT_SOURCE = await readFile(resolve(ROOT, 'dc-conventional.html'), 'utf8');
assert.match(
  COCKPIT_SOURCE,
/* v1.134.23 — this asserted the cache token as the LITERAL 2.0.0. Bumping the engine to
   2.1.0 broke it here and in three sibling gates, while the pages themselves were correct:
   the gate was pinning a version, not checking agreement. Read the published version instead,
   so the assertion keeps its meaning when the engine legitimately moves. Whether the pages
   AGREE with it is tools/test-conv-engine-version-pins.mjs's job. */
  new RegExp('<script src="js/conv-engine\\.js\\?v='
    + ENGINE_PUBLISHED_VERSION.replace(/\./g, '\\.') + '" data-conv-engine-authority></script>'),
  'Conventional cockpit must cache-bust and identify the governed v2 engine',
);

function safeFilePath(pathname) {
  const decoded = decodeURIComponent(pathname);
  const relative = decoded.endsWith('/') ? `${decoded.slice(1)}index.html` : decoded.slice(1);
  const target = resolve(ROOT, relative || 'index.html');
  return target.startsWith(`${resolve(ROOT)}${sep}`) ? target : null;
}

async function serveFile(request, response) {
  const target = safeFilePath(new URL(request.url, 'http://127.0.0.1').pathname);
  if (!target) { response.writeHead(403).end('Forbidden'); return; }
  try {
    const body = await readFile(target);
    response.writeHead(200, { 'Content-Type': MIME[extname(target)] || 'application/octet-stream' });
    response.end(body);
  } catch (error) {
    response.writeHead(error.code === 'ENOENT' ? 404 : 500).end('Not found');
  }
}

async function startServer() {
  const server = createServer((request, response) => { void serveFile(request, response); });
  await new Promise((accept, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', accept);
  });
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  return { server, origin: `http://127.0.0.1:${address.port}` };
}

async function openCockpit(browser, origin) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    const url = request.url();
    if (url.startsWith(origin) || url.startsWith('data:')) {
      request.continue();
      return;
    }
    if (url.startsWith('https://ipapi.co/json/')) {
      request.respond({ status: 200, contentType: 'application/json', body: '{}' });
      return;
    }
    request.respond({ status: 204, contentType: 'text/plain', body: '' });
  });
  await page.evaluateOnNewDocument(() => {
    const browserFetch = window.fetch.bind(window);
    window.fetch = function deterministicFetch(input, init) {
      const url = typeof input === 'string' ? input : input?.url || '';
      if (url.startsWith('https://ipapi.co/')) {
        return Promise.resolve(new Response('{}', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }));
      }
      return browserFetch(input, init);
    };
    localStorage.setItem('rz_premium_session', JSON.stringify({
      email: 'educator@resistancezero.com',
      tier: 'pro',
      role: 'educator',
      expires: '2099-12-31T23:59:59.000Z',
    }));
  });
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.goto(`${origin}/dc-conventional.html`, {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  });
  await page.waitForFunction(() => (
    window.CONV_CALC?.snapshot?.site?.it_load_kw === 30_000
    && !document.body.classList.contains('locked')
  ), { timeout: 30_000 });
  await page.evaluate(() => {
    window.__designDocuments = [];
    window.open = function openCapture() {
      const fakeDocument = {
        contents: '',
        open() { this.contents = ''; },
        write(value) { this.contents += String(value); },
        close() { window.__designDocuments.push(this.contents); },
      };
      return { document: fakeDocument, focus() {}, print() {} };
    };
  });
  return { page, errors };
}

async function openStudio(page) {
  await page.click('#genDesignTrigConv');
  await page.waitForSelector('#rzDesignStudio[data-open="true"]');
}

async function assertSelectableDocumentTypes(page) {
  const options = await page.$$eval('#rzDesignDocumentType option', (nodes) => (
    nodes.map((node) => ({ value: node.value, label: node.textContent.trim(), disabled: node.disabled }))
  ));
  assert.deepEqual(options, DOCUMENTS.map((entry) => ({
    value: entry.value,
    label: entry.label,
    disabled: false,
  })));
  for (const documentType of DOCUMENTS) {
    await page.select('#rzDesignDocumentType', documentType.value);
    const selected = await page.$eval('#rzDesignDocumentType', (node) => node.value);
    assert.equal(selected, documentType.value, `${documentType.label} must remain selected`);
  }
}

async function issueDocument(page, documentType, scope) {
  await page.select('#rzDesignDocumentType', documentType);
  await page.select('#rzDesignScope', scope);
  const before = await page.evaluate(() => window.__designDocuments.length);
  await page.click('.rz-design-studio__button--primary');
  await page.waitForFunction((count) => window.__designDocuments.length === count + 1, {}, before);
  return page.evaluate(() => window.__designDocuments.at(-1));
}

function assertCurrentBasis(html, label) {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  assert.match(text, /\bIT load\b.{0,240}\b30[ ,]000\s*kW/i, `${label}: current IT basis`);
  assert.match(text, /\bFacility total power\b.{0,240}\b43[ ,]500\s*kW/i, `${label}: facility basis`);
  assert.doesNotMatch(text, /\b(?:1[,.]850\s*kW|1\.85\s*MW|2[,.]68[23]\s*MW)\b/i,
    `${label}: retired operating basis must not render`);
}

function assertThermalAndCarbonBasis(html, label) {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  assert.match(text, /Evaporator duty.{0,180}31[ ,]?250\s*kW/i,
    `${label}: evaporator duty must keep its own thermal plane`);
  assert.match(text, /Plant-duty CHW reference.{0,220}982\.3\s*L\/s/i,
    `${label}: plant-duty flow must remain a calculated reference`);
  assert.match(text, /Condenser \/ tower rejection.{0,220}36[ ,]?403\.4\s*kW/i,
    `${label}: tower rejection must include chiller electrical input`);
  assert.match(text, /measured header flow\s+UNAVAILABLE/i,
    `${label}: generated document must not present a calculated reference as metered flow`);
  assert.match(text, /18[ ,]?270\s*kgCO/i,
    `${label}: carbon rate must use the current 43.5 MW facility numerator`);
  assert.doesNotMatch(text, /(?:1[ ,]?126\.7|1[ ,]?127)\s*kgCO/i,
    `${label}: retired carbon numerator must not survive`);
}

const { server, origin } = await startServer();
const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

try {
  const { page, errors } = await openCockpit(browser, origin);
  await openStudio(page);
  await assertSelectableDocumentTypes(page);

  const snapshot = await page.$eval('#rzDesignSnapshot', (node) => node.textContent.replace(/\s+/g, ' '));
  assert.match(snapshot, /Current IT\s*30\.000 MW/i);
  assert.match(snapshot, /Current facility load\s*43\.500 MW/i);
  assert.match(snapshot, /4 halls\s*·\s*500 air-cooled racks\/hall\s*·\s*20\.00 kW design average\/rack/i);
  assert.doesNotMatch(snapshot, /1\.850 MW|2\.683 MW/i);

  const outputs = [];
  for (let index = 0; index < DOCUMENTS.length; index += 1) {
    const documentType = DOCUMENTS[index];
    if (index > 0) await openStudio(page);
    const scope = index === 1 ? 'current-plus-study' : 'current';
    const html = await issueDocument(page, documentType.value, scope);
    assert.ok(html.length > 5_000, `${documentType.label}: generated document is non-trivial`);
    assert.match(
      html,
      new RegExp(`<title>Conventional DC &mdash; ${documentType.label} \\(`, 'i'),
      `${documentType.label}: browser title identity`,
    );
    assert.match(
      html,
      new RegExp(`<tr><td>Document type</td><td>${documentType.label}</td></tr>`, 'i'),
      `${documentType.label}: cover identity`,
    );
    assertCurrentBasis(html, documentType.label);
    assertThermalAndCarbonBasis(html, documentType.label);
    assert.match(html, new RegExp(documentType.ownHeading, 'i'),
      `${documentType.label}: type-specific governed section`);
    for (const otherType of DOCUMENTS.filter((entry) => entry.value !== documentType.value)) {
      assert.doesNotMatch(html, new RegExp(otherType.ownHeading, 'i'),
        `${documentType.label}: must not reuse the ${otherType.label} body`);
    }
    if (scope === 'current-plus-study') {
      assert.match(html, /Four-hall governed capacity study/i);
      assert.match(html, /40\.000 MW/i);
    } else {
      assert.doesNotMatch(html, /Four-hall governed capacity study/i);
    }
    outputs.push(html);
  }

  assert.equal(outputs.length, DOCUMENTS.length, 'each document type must complete its issue path');
  assert.equal(new Set(outputs).size, DOCUMENTS.length,
    'document types must produce semantically distinct governed deliverables');
  assert.deepEqual(errors, [], `console/page errors: ${errors.join(' | ')}`);
  await page.close();
  console.log('PASS Conventional Design Studio document selection, current basis, and all issue paths');
} finally {
  await browser.close();
  await new Promise((accept) => server.close(accept));
}
