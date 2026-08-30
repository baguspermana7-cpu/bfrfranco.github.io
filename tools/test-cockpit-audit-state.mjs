import assert from 'node:assert/strict';
import { readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import puppeteer from 'puppeteer';

import {
  assertAuditFindingsComplete,
  assertAuthorizedAuditState,
  enterAuthorizedAuditState,
  inspectAuthorizedAuditState,
} from './lib/cockpit-audit-state.mjs';

const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
  headless: true,
});

try {
  const page = await browser.newPage();
  await page.setContent(`
    <body class="locked">
      <main data-rz-cockpit-root="fixture" inert>Operator surface</main>
      <div class="root-gate" id="rootGate">Gate</div>
      <div class="rz-restricted-overlay" id="rzRestrictedOverlay">Restricted</div>
      <div class="rz-modal-overlay" id="featureModal">Feature dialog</div>
    </body>
  `);

  await enterAuthorizedAuditState(page, 'fixture');
  await page.evaluate(() => {
    const delayedModal = document.createElement('div');
    delayedModal.className = 'rz-modal-overlay';
    delayedModal.id = 'rzModalOverlay';
    delayedModal.textContent = 'Late auth modal';
    document.body.classList.add('locked');
    document.body.appendChild(delayedModal);
  });
  await new Promise((accept) => setTimeout(accept, 50));

  const state = await inspectAuthorizedAuditState(page, 'fixture');
  assert.equal(state.bodyLocked, false, 'audit surface must not remain body-locked');
  assert.equal(state.blockingOverlayCount, 0, 'late auth overlays must be removed');
  assert.equal(state.hasCockpitRoot, true, 'route-specific operator surface must remain mounted');
  assert.equal(state.cockpitRootInert, false, 'authorized operator surface must accept interaction');
  assert.equal(await page.$eval('#featureModal', (node) => node.textContent), 'Feature dialog',
    'non-auth feature modals must survive authorized audit setup');
  await assertAuthorizedAuditState(page, 'fixture');

  await assert.rejects(
    assertAuthorizedAuditState(page, 'wrong-route'),
    /invalid authorized audit surface/,
    'a generic page or wrong cockpit identity must never qualify as the requested route',
  );
  await assert.rejects(
    enterAuthorizedAuditState(page, 'fixture, main'),
    /invalid cockpit identity/,
    'selector fragments must not be accepted as cockpit identities',
  );

  assert.doesNotThrow(() => assertAuditFindingsComplete({ expected: { path: '/tmp/a.png' } }, ['expected']));
  assert.throws(
    () => assertAuditFindingsComplete({ route_ERR_dark_m: { error: 'locked' } }, ['route_dark_m']),
    /audit evidence incomplete/,
    'recorded audit errors must make the CLI fail after evidence is written',
  );
  assert.throws(
    () => assertAuditFindingsComplete({}, ['missing_capture']),
    /missing_capture/,
    'missing captures must make the CLI fail',
  );

  const evidencePath = join(tmpdir(), `rz-cockpit-audit-negative-${process.pid}.json`);
  const helperUrl = new URL('./lib/cockpit-audit-state.mjs', import.meta.url).href;
  const negativeCli = spawnSync(process.execPath, ['--input-type=module', '--eval', `
    import { writeFile } from 'node:fs/promises';
    import { assertAuditFindingsComplete } from ${JSON.stringify(helperUrl)};
    const findings = { route_ERR_dark_m: { error: 'locked' } };
    await writeFile(${JSON.stringify(evidencePath)}, JSON.stringify(findings));
    assertAuditFindingsComplete(findings, ['route_dark_m']);
  `], { encoding: 'utf8' });
  assert.notEqual(negativeCli.status, 0,
    'an audit CLI with recorded errors must return a non-zero exit status');
  assert.deepEqual(JSON.parse(await readFile(evidencePath, 'utf8')),
    { route_ERR_dark_m: { error: 'locked' } },
    'the failing CLI must preserve its evidence before exiting non-zero');
  await rm(evidencePath);

  await page.close();
  console.log('cockpit audit authorized-state contract: PASS');
} finally {
  await browser.close();
}
