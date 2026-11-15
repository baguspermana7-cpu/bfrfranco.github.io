#!/usr/bin/env node
/**
 * build-design-scale.mjs — PRD-P22 FR-P22-1: data/design-scale.json, GENERATED from documentation/design.md.
 *
 * The scale is read from the tokens design.md declares, never typed a second time:
 *   - spacing: every `--rz-space-N: <px>px` (§ spacing tokens); the grid is their greatest common divisor
 *   - font sizes: every fixed `--rz-text-*: <px>px`, and every `--rz-text-*: clamp(min, vw, max)` evaluated at the
 *     audit viewport (1440 px), because computed styles are px at one width
 *   - radii: every `--rz-radius: <px>px` a register declares, plus the instrument ceiling the anti-pattern list states
 *     ("4px radius"), plus circles and pills (shape, not decoration)
 * Line-height has no scale in design.md, so it is not checked (a gate cannot enforce a scale that does not exist).
 *
 *   node tools/build-design-scale.mjs           write data/design-scale.json
 *   node tools/build-design-scale.mjs --check   exit 1 when the file is stale against design.md
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'documentation/design.md');
const OUT = join(ROOT, 'data/design-scale.json');
export const VIEWPORT = 1440;

const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const uniqSorted = (xs) => [...new Set(xs.map((x) => Math.round(x * 100) / 100))].sort((a, b) => a - b);

export function extract(md, viewport = VIEWPORT) {
  const space = [...md.matchAll(/--rz-space-\d+:\s*(\d+(?:\.\d+)?)px/g)].map((m) => +m[1]);
  const fixedText = [...md.matchAll(/--rz-text-[a-z-]+:\s*(\d+(?:\.\d+)?)px/g)].map((m) => +m[1]);
  const fluid = [...md.matchAll(/--rz-text-([a-z0-9-]+):\s*clamp\(\s*(\d+(?:\.\d+)?)px\s*,\s*(\d+(?:\.\d+)?)vw\s*,\s*(\d+(?:\.\d+)?)px\s*\)/g)]
    .map((m) => ({ token: '--rz-text-' + m[1], min: +m[2], vw: +m[3], max: +m[4],
      at: Math.min(+m[4], Math.max(+m[2], (+m[3] * viewport) / 100)) }));
  const radii = [...md.matchAll(/--rz-radius:\s*(\d+(?:\.\d+)?)px/g)].map((m) => +m[1]);
  const ceiling = /4px radius/.test(md) ? 4 : null;
  if (!space.length || !fixedText.length || !fluid.length || !radii.length || ceiling == null) {
    throw new Error('design.md no longer declares one of: --rz-space-*, fixed --rz-text-*, clamp --rz-text-*, --rz-radius, "4px radius"');
  }
  return {
    generatedBy: 'tools/build-design-scale.mjs',
    source: 'documentation/design.md',
    viewport,
    tolerancePx: 0.5,
    spacing: { tokens: uniqSorted(space), gridPx: space.reduce(gcd), hairlineMaxPx: 2 },
    fontSize: { fixed: uniqSorted(fixedText), fluid, allowed: uniqSorted([...fixedText, ...fluid.map((f) => f.at)]) },
    radius: { tokens: uniqSorted(radii), instrumentCeilingPx: ceiling, shapes: ['circle: radius >= half the shorter side', 'pill: radius >= 999px', 'any % value'] },
    notChecked: { lineHeight: 'design.md declares no line-height scale' },
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const json = JSON.stringify(extract(readFileSync(SRC, 'utf8')), null, 2) + '\n';
  if (process.argv.includes('--check')) {
    const cur = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
    if (cur !== json) { console.log('STALE data/design-scale.json — run node tools/build-design-scale.mjs'); process.exit(1); }
    console.log('design scale fresh');
  } else {
    writeFileSync(OUT, json);
    const d = JSON.parse(json);
    console.log('wrote data/design-scale.json — spacing grid ' + d.spacing.gridPx + ' px, font sizes ' + d.fontSize.allowed.join('/') + ', radii ' + d.radius.tokens.join('/') + ' + ceiling ' + d.radius.instrumentCeilingPx);
  }
}
