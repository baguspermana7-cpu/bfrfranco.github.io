#!/usr/bin/env node
/*
 * R128–R134 mock (PRD_DATAHALL_DRAWINGS.md §12): dh-drawings-mock.html = datahallAI.html + the HMI redraw layer.
 * Generated, noindex, never linked. Deleted when the owner accepts the mock and the layer moves into the page.
 *   node tools/build-dh-drawings-mock.mjs [--check]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SRC = path.join(ROOT, 'datahallAI.html');
const OUT = path.join(ROOT, 'dh-drawings-mock.html');
const V = 'mock-r128';
const html = fs.readFileSync(SRC, 'utf8');

const headAt = html.indexOf('</head>');
const bodyAt = html.lastIndexOf('</body>');
if (headAt < 0 || bodyAt < headAt) { console.error('build-dh-drawings-mock: </head> or </body> not found'); process.exit(1); }
const head = `<meta name="robots" content="noindex,nofollow">\n` +
  `<link rel="stylesheet" href="css/rz-hmi.css?v=${V}">\n<link rel="stylesheet" href="css/rz-dh-shell.css?v=${V}">\n`;
const tail = ['js/rz-eng-symbols.js', 'js/rz-hmi-sheet.js', 'js/datahall-ai/hmi-sheets.js', 'js/datahall-ai/hmi-v2.js']
  .map((s) => `<script src="${s}?v=${V}"></script>`).join('\n') + '\n';
let out = html.slice(0, headAt) + head + html.slice(headAt, bodyAt) + tail + html.slice(bodyAt);
out = out.replace(/<link rel="canonical"[^>]*>\s*/i, '');

if (process.argv.includes('--check')) {
  const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  console.log(cur === out ? 'dh-drawings-mock.html current' : 'dh-drawings-mock.html STALE');
  process.exit(cur === out ? 0 : 1);
}
fs.writeFileSync(OUT, out);
console.log(`dh-drawings-mock.html written (${out.length} bytes)`);
