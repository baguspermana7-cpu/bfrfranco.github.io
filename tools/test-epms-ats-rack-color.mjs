import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import puppeteer from 'puppeteer';

const ROOT = process.cwd();
const MIME = Object.freeze({
  '.css': 'text/css',
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
});

function safeFilePath(pathname) {
  const decoded = decodeURIComponent(pathname);
  const relative = decoded.endsWith('/') ? `${decoded.slice(1)}index.html` : decoded.slice(1);
  const target = resolve(ROOT, relative || 'index.html');
  return target.startsWith(`${resolve(ROOT)}${sep}`) ? target : null;
}

async function serveFile(request, response) {
  const target = safeFilePath(new URL(request.url, 'http://127.0.0.1').pathname);
  if (!target) {
    response.writeHead(403).end('Forbidden');
    return;
  }
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

const { server, origin } = await startServer();
const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

try {
  const page = await browser.newPage();
  await page.goto(`${origin}/EPMS_Telemetry.html`, {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  });
  await page.waitForFunction(() => (
    typeof calcPowerFlow === 'function'
      && document.getElementById('flow-w_ats_rack_0')
      && document.getElementById('flow-w_ats_rack_5')
  ));

  const scenarios = await page.evaluate(() => {
    function resetScenario() {
      WIRES.forEach((wire) => { SIM.breakers[wire.br] = wire.def || 'closed'; });
      SIM.sources.A = false;
      SIM.sources.B = false;
      SIM.genRunning.A = false;
      SIM.genRunning.B = false;
      SIM.genRunning.C = false;
    }

    function readRackLegs() {
      return [0, 5].map((index) => (
        document.getElementById(`flow-w_ats_rack_${index}`).getAttribute('class')
      ));
    }

    const result = {};

    resetScenario();
    SIM.sources.A = true;
    SIM.sources.B = true;
    calcPowerFlow();
    result.normal = readRackLegs();

    resetScenario();
    SIM.sources.B = true;
    SIM.breakers.br_mv_tie = 'closed';
    calcPowerFlow();
    result.utilityBViaTie = readRackLegs();

    resetScenario();
    SIM.genRunning.A = true;
    SIM.breakers.br_gen_a = 'closed';
    SIM.breakers.br_util_a = 'open';
    SIM.breakers.br_util_b = 'open';
    SIM.breakers.br_util_c = 'open';
    calcPowerFlow();
    result.generatorA = readRackLegs();

    resetScenario();
    SIM.genRunning.C = true;
    SIM.breakers.br_gen_c = 'closed';
    SIM.breakers.br_util_a = 'open';
    SIM.breakers.br_util_b = 'open';
    SIM.breakers.br_util_c = 'open';
    calcPowerFlow();
    result.generatorC = readRackLegs();

    return result;
  });

  assert.deepEqual(
    scenarios.normal,
    ['flow energized-A', 'flow energized-A'],
    'normal ATS-to-rack legs must inherit the resolved Feed A path',
  );
  assert.deepEqual(
    scenarios.utilityBViaTie,
    ['flow energized-B', 'flow energized-B'],
    'Feed B tie backfeed must remain Feed B through each rack ATS',
  );
  assert.deepEqual(
    scenarios.generatorA,
    ['flow energized-A-gen', 'flow'],
    'Generator A must retain Feed A generator provenance and not energize the isolated B rack',
  );
  assert.deepEqual(
    scenarios.generatorC,
    ['flow energized-C-gen', 'flow energized-C-gen'],
    'Catcher generator must retain Feed C provenance through each rack ATS',
  );

  console.log('PASS EPMS ATS-to-rack color inheritance: normal, tie, and generator scenarios');
} finally {
  await browser.close();
  await new Promise((accept) => server.close(accept));
}
