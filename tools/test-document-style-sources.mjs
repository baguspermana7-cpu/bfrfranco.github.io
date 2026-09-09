import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import test from 'node:test';

const ROOT = resolve('.');
const DOCUMENTS = [
  "embed/capex-widget.html",
  "embed/carbon-widget.html",
  "embed/index.html",
  "embed/pue-widget.html",
  "manual/achievements.html",
  "manual/ai-engineering-maintenance.html",
  "manual/capex.html",
  "manual/carbon.html",
  "manual/cdu-hub.html",
  "manual/chiller-plant.html",
  "manual/compare-air-vs-liquid-cooling.html",
  "manual/compare-raised-floor-vs-slab.html",
  "manual/cx.html",
  "manual/datahall.html",
  "manual/datahallai.html",
  "manual/dc-conventional.html",
  "manual/dc-market-tracker.html",
  "manual/dcmoc.html",
  "manual/fire-checklist.html",
  "manual/fire-system.html",
  "manual/fire.html",
  "manual/fuel-system.html",
  "manual/ict.html",
  "manual/index.html",
  "manual/ltc-system-modelling-lab.html",
  "manual/network-visualization-hub.html",
  "manual/opex.html",
  "manual/pillar-cooling.html",
  "manual/pillar-fire-safety.html",
  "manual/pillar-power.html",
  "manual/pillar-standards.html",
  "manual/pillar-sustainability.html",
  "manual/pln-java-grid.html",
  "manual/pln-sumatra-grid.html",
  "manual/pue.html",
  "manual/research-roadmap.html",
  "manual/rfs.html",
  "manual/roi.html",
  "manual/spares.html",
  "manual/standards-ltc-lab.html",
  "manual/tco.html",
  "manual/tia-942-checklist.html",
  "manual/tier.html",
  "manual/water-system.html"
];
const BUILDERS = ['build-sitemap.py', 'build-llms-txt.py', 'build-llms-full.py'];
const SUPPORT = ['crawler_inventory.py', 'crawler_llms.py'];

function digest(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

test('discovery regeneration preserves all 40 maintained manuals and four embed sources', () => {
  const root = mkdtempSync(join(tmpdir(), 'rz-document-sources-'));
  try {
    for (const file of ['robots.txt', ...DOCUMENTS, ...BUILDERS.concat(SUPPORT).map(name => 'tools/' + name)]) {
      mkdirSync(dirname(join(root, file)), { recursive: true });
      cpSync(join(ROOT, file), join(root, file));
    }
    execFileSync('git', ['init', '-q', root]);
    execFileSync('git', ['add', '--', ...DOCUMENTS], { cwd: root });
    const before = new Map(DOCUMENTS.map(file => [file, digest(join(root, file))]));
    for (const builder of BUILDERS) {
      execFileSync('python3', [join(root, 'tools', builder), '--apply'], { cwd: root, encoding: 'utf8' });
      for (const file of DOCUMENTS) {
        assert.equal(digest(join(root, file)), before.get(file), builder + ' changed source ' + file);
      }
    }
    for (const file of ['sitemap.xml', 'llms.txt', 'llms-full.txt']) assert.ok(existsSync(join(root, file)));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
