#!/usr/bin/env node
/**
 * audit-ux-laws.mjs — enforce the MECHANIZABLE part of §D UX LAWS
 * (standarization/ANTI_VIBECODE_STANDARD.md).
 *
 * Scope discipline, per that document's own audit contract: this tool checks ONLY what a static
 * scan can actually decide. It prints the laws it does NOT check so nobody mistakes a green run
 * for design clearance. A static scan is not rendered evidence.
 *
 *   node tools/audit-ux-laws.mjs            report
 *   node tools/audit-ux-laws.mjs --strict   exit 1 on any finding
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname, basename } from "node:path";

const ROOT = process.cwd();
const STRICT = process.argv.includes("--strict");

const SKIP = new Set(["node_modules", ".git", "dcmoc", ".next", "games", "Dunia-Emosi",
  "obsidian-knowledge-vault", ".claude", "review", "Documents", "cf-worker", "result",
  "Article", "Apps", "Automation", "dc-corpus", "my-video", "TestEA", "worktrees",
  "backups", ".qa-screens"]);

function walk(dir, ext, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name) || name.startsWith("02.02.26")) continue;
    const p = join(dir, name);
    let st; try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) walk(p, ext, out);
    else if (ext.includes(extname(name)) && !name.includes(".min.")) out.push(p);
  }
  return out;
}
const rel = (p) => p.replace(ROOT + "/", "");
const read = (p) => { try { return readFileSync(p, "utf8"); } catch { return ""; } };

/* A real async data load. Analytics, fonts and search-ping beacons are NOT user-visible content
   loads — a skeleton for a gtag call would be nonsense, so they are excluded by context, not by
   a blanket keyword. */
const ASYNC = /\bfetch\s*\(|XMLHttpRequest/g;
const BEACON = /googletag|analytics|gtag|indexnow|doubleclick|clarity|fonts\.googleapis|fonts\.gstatic/i;
/* The site's real loading idioms, learned from the tree rather than invented:
   exp-skeleton · fs-skel skelrow · mayar-skeleton · skel · plus the generic a11y/HTML ones. */
const AFFORDANCE = /skel|aria-busy|spinner|shimmer|loading|placeholder/i;

function hasRealAsync(text) {
  ASYNC.lastIndex = 0;
  for (let m; (m = ASYNC.exec(text)); ) {
    if (!BEACON.test(text.slice(Math.max(0, m.index - 220), m.index + 220))) return true;
  }
  return false;
}

const pages = walk(ROOT, [".html"]);
/* A tree without a js/ directory is valid input (a docs-only checkout, a test fixture).
   readdirSync would throw ENOENT and take the whole gate down with it. */
let modules = [];
try { modules = walk(join(ROOT, "js"), [".js"]); } catch { modules = []; }
const findings = [];

// #6 Doherty — a surface that loads data asynchronously must show that it is working.
for (const p of pages) {
  const t = read(p);
  if (hasRealAsync(t) && !AFFORDANCE.test(t)) {
    findings.push({ law: "#6 doherty-skeleton", file: rel(p),
      msg: "page performs an async data load but shows no loading affordance" });
  }
}
/* A shared module's async load is only visible through the pages that mount it, so the finding
   belongs to the CONSUMER page — flagging the module would name a file the user never sees. */
for (const m of modules) {
  const mt = read(m);
  if (!hasRealAsync(mt) || AFFORDANCE.test(mt)) continue;
  const name = basename(m);
  for (const p of pages) {
    const t = read(p);
    if (!t.includes(name)) continue;
    if (!AFFORDANCE.test(t)) {
      findings.push({ law: "#6 doherty-skeleton", file: rel(p),
        msg: `loads ${name} (async) but shows no loading affordance` });
    }
  }
}

console.log("── UX LAWS AUDIT (§D, mechanizable subset) ──");
console.log(`Scanned ${pages.length} pages + ${modules.length} shared modules.`);
console.log("CHECKED here: #6 Doherty (loading affordance on async surfaces).");
console.log("CHECKED elsewhere: #2 Fitts (audit-mobile-responsive.py), #12 radii + #14 rails/shadows (audit-vibecode.mjs).");
console.log("NOT CHECKED — human design review only: #1 Hick's, #3 Jakob's, #4 Proximity, #5 Miller's,");
console.log("  #7 Von Restorff, #8 target distance, #9 Serial position, #10 Peak-end, #11 Zeigarnik,");
console.log("  #13 Similarity, #15 Tesler's, #16 Postel's, #17 Parkinson's, #18 Occam's, #19 Pareto.");
console.log("");
if (!findings.length) {
  console.log("No findings in the mechanizable subset. This is NOT design clearance —");
  console.log("the 15 laws above still require human review on any visual/IA change.");
  process.exit(0);
}
for (const f of findings) console.log(`  ✗ ${f.law}  ${f.file} — ${f.msg}`);
console.log(`\n── ${findings.length} finding(s).`);
process.exit(STRICT ? 1 : 0);
