import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const audit = resolve('tools/audit-vibecode.mjs');

function scan(css, { file = 'fixture.css', args = [] } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'rz-vibecode-'));
  try {
    for (const name of ['terms.html', 'privacy.html']) writeFileSync(join(root, name), '');
    mkdirSync(join(root, file, '..'), { recursive: true });
    writeFileSync(join(root, file), css);
    const result = spawnSync(process.execPath, [audit, '--strict', '--json', ...args], { cwd: root, encoding: 'utf8' });
    return { status: result.status, report: JSON.parse(result.stdout) };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('decorative rules gate beyond the flagship and expose every block', () => {
  const result = scan('.card { border-radius: 8px; border-left: 3px solid red; } .panel { border-radius: 12px; }');
  assert.equal(result.status, 1);
  assert.equal(result.report.findings.find(finding => finding.rule === 'large-radius').blocks.length, 2);
  assert.ok(result.report.inventory.excludedNames.includes('dcmoc'));
});

test('none, zero and transparent borders cannot disguise shadow-only cards', () => {
  for (const border of ['none', '0', '1px solid transparent']) {
    const result = scan(`.card { border: ${border}; box-shadow: 0 3px 8px #333; }`);
    assert.equal(result.status, 1, border);
  }
  assert.equal(scan('.card { box-shadow: none; }').status, 0);
  assert.equal(scan('.card { box-shadow:   none !important; }').status, 0);
  assert.equal(scan('.card { border: 1px solid #aaa; box-shadow: 0 2px 4px #333; }').status, 0);
});

test('detect decimal, shorthand and rem radii and logical callout rails', () => {
  for (const radius of ['8.5px', '.5rem', '4px 12px', '4px / 12px']) {
    assert.equal(scan(`.card { border-radius: ${radius}; }`).status, 1, radius);
  }
  assert.equal(scan('.callout { border-inline-start: 3.5px solid red; }').status, 1);
});

test('preserve print, geometry, photos, functional UI and protected aurora', () => {
  const result = scan(`
    @media print { .card { border-radius: 12px; box-shadow: 0 2px 4px #333; } }
    .status-dot { border-radius: 50%; box-shadow: 0 0 4px green; }
    .card-photo { border-radius: 12px; box-shadow: 0 2px 4px #333; }
    .diagram-node { border-radius: 12px; }
    .menu-panel { border-radius: 12px; box-shadow: 0 2px 4px #333; }
    .card:focus-visible { box-shadow: 0 0 0 3px blue; }
    .aurora-mesh { border-radius: 50%; filter: blur(40px); }
  `);
  assert.equal(result.status, 0);
});

test('print exemption cannot leak; braces in strings do not break extraction', () => {
  const result = scan('@media print { .card { border-radius: 12px; } } .card::before { content: "}"; border-radius: 8px; }');
  assert.equal(result.status, 1);
  assert.equal(result.report.findings[0].blocks.length, 1);
});

test('semantic safety-state rails remain functional, decorative warnings still fail', () => {
  const result = scan(`
    .rz-fire-tile { border-left: 3px solid var(--rz-ops-green); }
    .fire-iso-consequence[data-state="impair"] { border-left: 3px solid red; }
    .status-box.warning { border-left: 3px solid var(--st-warn); }
    .alarm-strip.state-alarm { border-left: 5px solid var(--st-alarm); }
    .alarm-item { border-left: 3px solid var(--off); }
    .cap-card.warn { border-left: 3px solid var(--st-warn); }
    .sb-box.bad { border-left: 3px solid var(--st-bad); }
    .basis-card.study { border-left: 3px solid var(--warn); }
  `);
  assert.equal(result.status, 0);
  assert.equal(scan('.warning-box { border-left: 4px solid red; }').status, 1);
  assert.equal(scan('.card[data-state="new"] { border-left: 4px solid red; }').status, 1);
});

test('page rules never exempt screen CSS and prefixed selectors resolve root tokens', () => {
  assert.equal(scan('@page { margin: 2cm; } .card { border-radius: 12px; }').status, 1);
  assert.equal(scan('html[data-rz-register="editorial"] .card { border-radius: 8px; }').status, 1);
  assert.equal(scan(':root { --radius-card: 12px; } html[data-rz-register="editorial"] .card { border-radius: var(--radius-card); }').status, 1);
});

test('owner holds fail closed and archives are inventoried as historical evidence', () => {
  const held = scan('.card { border-radius: 4px; }', { args: ['--hold=fixture.css'] });
  assert.equal(held.status, 1);
  assert.equal(held.report.inventory.activeOwnerHolds[0].status, 'UNVERIFIED');
  const archive = scan('<style>.card { border-radius: 12px; }</style>', { file: 'standarization/Audit result/Historical.html' });
  assert.equal(archive.status, 0);
  assert.ok(archive.report.inventory.historicalEvidenceExcluded.includes('standarization/Audit result/'));
});

test('real paper is explicit, JS print templates cannot swallow screen styles', () => {
  const paper = scan('<style>@page { size: A4; } .card { border-radius: 12px; } body { background: white; }</style>', { file: 'article-9-paper.html' });
  assert.equal(paper.status, 0);
  const screen = scan('<script>const printCss = "<style>@page { size: A4; }</style>";</script><style>.card { border-radius: 12px; }</style>', { file: 'screen.html' });
  assert.equal(screen.status, 1);
});

test('later border resets cannot borrow an earlier visible border', () => {
  assert.equal(scan('.card { border: 1px solid #aaa; } .card { border: none; box-shadow: 0 3px 8px #333; }').status, 1);
});

test('holds are opt-in and never hide actual design findings', () => {
  assert.deepEqual(scan('.card { border-radius: 4px; }').report.inventory.activeOwnerHolds, []);
  const held = scan('.card { border-radius: 12px; }', { args: ['--hold=fixture.css'] });
  assert.equal(held.report.findings.filter(finding => finding.rule === 'active-owner-hold').length, 1);
  assert.equal(held.report.findings.filter(finding => finding.rule === 'large-radius').length, 1);
});

test('root authentication overlay geometry is functional, an ordinary root card is not', () => {
  assert.equal(scan('.root-gate { position: fixed; inset: 0; } .root-card { border-radius: 14px; box-shadow: 0 18px 36px #000; }').status, 0);
  assert.equal(scan('.root-card { border-radius: 14px; }').status, 1);
});

test('neutral editorial blockquotes and visible scrolly cards remain valid', () => {
  const result = scan(`
    :root { --surface-radius: 4px; --line: #64748b; --panel: #f8fafc; }
    html[data-rz-register="editorial"] .article-body blockquote {
      background: var(--panel); border: 1px solid var(--line);
      border-left: 2px solid var(--line); border-radius: var(--surface-radius); box-shadow: none;
    }
    html[data-rz-register="editorial"] .rz-scrolly-step-inner {
      border: 1px solid var(--line); border-left: 2px solid var(--line);
      border-radius: var(--surface-radius); background: var(--panel); opacity: 1;
    }
  `);
  assert.equal(result.status, 0);
});

/* Regression fixtures for the v1.135.3 glass-decoration rewrite. The previous rule counted
   selectors with a naive regex and only fired at >= 3 decorative surfaces per file, so it read
   0 findings site-wide while live pages carried decorative blur. */

test('ONE decorative glass surface is a finding — the >=3 threshold licensed real slop', () => {
  const result = scan('.evidence-card { background: rgba(30,41,59,0.6); backdrop-filter: blur(12px); }');
  assert.equal(result.status, 1);
  const finding = result.report.findings.find(f => f.rule === 'glass-decoration');
  assert.ok(finding, 'a single decorative glass surface must be reported');
});

test('a modal backdrop is functional, not decorative glass', () => {
  /* `.block-detail-backdrop` is position:absolute; inset:0 behind a detail panel. Blur there
     pushes context back, exactly as `modal` and `overlay` already do. Exempting it is why
     `backdrop` sits in FUNC_SEL; without this fixture that keyword would be unexplained. */
  const result = scan('.block-detail-backdrop { position: absolute; inset: 0; background: rgba(2,6,23,0.62); backdrop-filter: blur(2px); }');
  assert.ok(!result.report.findings.some(f => f.rule === 'glass-decoration'),
    'a dialog backdrop must not be reported as decorative glassmorphism');
});

test('functional blur on a sticky header stays exempt', () => {
  const result = scan('.navbar.scrolled { backdrop-filter: saturate(180%) blur(14px); }');
  assert.ok(!result.report.findings.some(f => f.rule === 'glass-decoration'));
});
