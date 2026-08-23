#!/usr/bin/env node
/**
 * audit-vibecode.mjs — fail the build if the site drifts toward the generic "AI-generated" look.
 * Codified in standarization/ANTI_VIBECODE_STANDARD.md. Detects the hard-banned tells with
 * context-awareness; whitelists the deliberate RZ signature (aurora-mesh hero radial gradients,
 * IBM Plex/Fraunces/JetBrains fonts). Run: node tools/audit-vibecode.mjs --strict
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, extname } from "node:path";

const ROOT = process.cwd();
const STRICT = process.argv.includes("--strict");
// Scope = the PUBLISHED site (root pages, articles, calculators, css). Excludes sub-apps with their
// own design systems (Apps/*, dca-app, finance-terminal), scraped/generated artifacts (Automation/*,
// tools/dc-corpus/raw), and non-shipped dirs.
const SKIP = ["node_modules", ".git", "dcmoc", ".next", "games", "Dunia-Emosi", "obsidian-knowledge-vault",
  ".claude", "review", "Documents", "cf-worker", "result", "Article", "02.02.26",
  "Apps", "Automation", "dc-corpus", "my-video", "TestEA", "worktrees", "backups", ".qa-screens"];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.some((s) => name === s || name.toLowerCase() === s.toLowerCase())) continue;
    const p = join(dir, name);
    let st; try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) walk(p, out);
    else if ([".html", ".css"].includes(extname(name))) out.push(p);
  }
  return out;
}

// each rule: {id, test(text, file) -> match string | null}
const RULES = [
  { id: "inter-primary-font",
    test: (t) => (/font-family:\s*['"]?(Inter|Geist|Space Grotesk)\b/i.test(t) || /family=(Inter|Geist|Space\+Grotesk)\b/.test(t))
      ? "Inter/Geist/Space-Grotesk as a PRIMARY font (use 'IBM Plex Sans')" : null },
  { id: "anthropic-purple",
    test: (t) => /#8b5cf6/i.test(t) ? "#8B5CF6 (rejected Anthropic-purple) — use a semantic token/mint" : null },
  { id: "sparkle-emoji",
    test: (t) => /[✨🪄]/.test(t) || /fa-(magic|wand-magic|sparkles?)/.test(t) ? "sparkle/wand icon (AI tell)" : null },
  { id: "dot-grid-bg",
    // real dot-grid background: radial-gradient(...) with background-size (tiled dots), not a comment
    test: (t) => {
      const noComments = t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/<!--[\s\S]*?-->/g, "");
      return /radial-gradient\([^)]*\)\s*;?\s*background-size:\s*\d/i.test(noComments) &&
             /circle|closest-side/.test(noComments) ? "dot-grid tiled background" : null;
    } },
  { id: "lucide-icons",
    test: (t) => /lucide(-|\.|\/)/i.test(t) ? "Lucide icon library (use the site's Font Awesome idiom)" : null },
  { id: "glass-decoration",
    // backdrop-filter blur used many times = glassmorphism slop (a couple is tolerated)
    test: (t) => { const n = (t.match(/backdrop-filter:\s*blur/gi) || []).length; return n >= 6 ? `glassmorphism blur used ${n}× (decorative)` : null; } },
];

const files = walk(ROOT);
const findings = [];
for (const f of files) {
  let t; try { t = readFileSync(f, "utf8"); } catch { continue; }
  for (const r of RULES) {
    const m = r.test(t, f);
    if (m) findings.push({ file: f.replace(ROOT + "/", ""), rule: r.id, msg: m });
  }
}

// REQUIRED pages (absence is itself a tell)
for (const req of ["terms.html", "privacy.html"]) {
  if (!existsSync(join(ROOT, req))) findings.push({ file: req, rule: "missing-legal", msg: `${req} missing (required)` });
}

const byRule = {};
for (const f of findings) (byRule[f.rule] ||= []).push(f.file);
console.log("── ANTI-VIBECODE AUDIT ──");
if (!findings.length) { console.log("CLEAN — no vibecode tells."); process.exit(0); }
for (const [rule, fs] of Object.entries(byRule)) {
  console.log(`  ✗ ${rule}: ${fs.length} file(s) — ${byRule[rule].slice(0, 4).join(", ")}${fs.length > 4 ? " …" : ""}`);
}
console.log(`── ${findings.length} finding(s) across ${new Set(findings.map((f) => f.file)).size} file(s). See standarization/ANTI_VIBECODE_STANDARD.md`);
process.exit(STRICT ? 1 : 0);
