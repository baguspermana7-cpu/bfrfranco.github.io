#!/usr/bin/env node
/**
 * preflight.mjs — static deploy-readiness check for rz-finance-gateway.
 *
 * Runs WITHOUT wrangler or network, so it's safe in any environment. Catches the common
 * deploy mistakes before you spend a `wrangler deploy`:
 *   - a worker module with a syntax error
 *   - wrangler.toml still carrying PLACEHOLDER KV ids (wrangler would reject, but this
 *     tells you clearly which step you skipped)
 *   - a route in index.js not documented in DEPLOY.md (or vice-versa) — contract drift
 *   - .dev.vars accidentally tracked by git (secret leak)
 *   - production origin missing from ALLOWED_ORIGINS
 *
 * Usage:  npm run preflight     (exit 0 = ready to deploy; 1 = fix something first)
 * This is NOT a substitute for the live endpoint tests (test/gateway.test.mjs, which need
 * `wrangler dev`) — it's the static gate you can always run.
 */
import { readFileSync, readdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0, warn = 0, fail = 0;
const P = (m) => { pass++; console.log("  \x1b[32m✓\x1b[0m " + m); };
const W = (m) => { warn++; console.log("  \x1b[33m⚠\x1b[0m " + m); };
const F = (m) => { fail++; console.log("  \x1b[31m✗\x1b[0m " + m); };

function read(rel) { try { return readFileSync(join(ROOT, rel), "utf8"); } catch { return null; } }

console.log("\nrz-finance-gateway — preflight (static deploy-readiness)\n");

/* 1. Worker modules parse */
console.log("1. Worker modules");
{
  const files = readdirSync(join(ROOT, "src")).filter((f) => f.endsWith(".js"));
  for (const f of files) {
    try { execSync(`node --check ${JSON.stringify(join(ROOT, "src", f))}`, { stdio: "pipe" }); P(`src/${f} parses`); }
    catch (e) { F(`src/${f} SYNTAX ERROR: ${String(e.stderr || e).split("\n")[0]}`); }
  }
}

/* 2. wrangler.toml bindings + placeholders */
console.log("\n2. wrangler.toml");
const toml = read("wrangler.toml");
if (!toml) { F("wrangler.toml missing"); }
else {
  for (const key of ["name", "main"]) {
    if (new RegExp(`^\\s*${key}\\s*=`, "m").test(toml)) P(`${key} set`); else F(`${key} missing`);
  }
  for (const b of ["QUOTE_CACHE", "META_CACHE"]) {
    if (toml.includes(`binding = "${b}"`)) P(`KV binding ${b} present`); else F(`KV binding ${b} missing`);
  }
  const placeholders = (toml.match(/PLACEHOLDER_[A-Z_]+/g) || []);
  if (placeholders.length) W(`${placeholders.length} PLACEHOLDER KV id(s) still in wrangler.toml — run \`npm run kv:create:quote\` + \`kv:create:meta\`, then paste the ids (DEPLOY.md step 2). wrangler WILL refuse to deploy until replaced.`);
  else P("no PLACEHOLDER KV ids remain");
  if (/ALLOWED_ORIGINS\s*=\s*"[^"]*https:\/\/resistancezero\.com/.test(toml)) P("ALLOWED_ORIGINS includes https://resistancezero.com");
  else F("ALLOWED_ORIGINS missing production origin https://resistancezero.com");
}

/* 3. Route ↔ DEPLOY.md contract drift */
console.log("\n3. Endpoint contract (index.js ↔ DEPLOY.md)");
const index = read("src/index.js");
const deploy = read("DEPLOY.md") || "";
if (!index) F("src/index.js missing");
else {
  const routes = [...index.matchAll(/p === "(\/[a-z-]+)"/g)].map((m) => m[1]);
  const uniq = [...new Set(routes)];
  const undocumented = uniq.filter((r) => !deploy.includes(r));
  if (undocumented.length) W(`routes not mentioned in DEPLOY.md: ${undocumented.join(", ")}`);
  else P(`all ${uniq.length} routes documented in DEPLOY.md`);
  // envelope: every aggregate route should return via okData
  const okCount = (index.match(/okData\(/g) || []).length;
  if (okCount >= uniq.length) P(`envelope: ${okCount} okData() responses (>= ${uniq.length} routes)`);
  else W(`only ${okCount} okData() calls for ${uniq.length} routes — verify each returns {ok:true,data}`);
}

/* 4. Secret hygiene */
console.log("\n4. Secret hygiene");
const gitignore = read(".gitignore") || "";
if (/(^|\n)\.dev\.vars/.test(gitignore)) P(".dev.vars is gitignored"); else F(".dev.vars NOT in .gitignore");
try {
  const tracked = execSync("git ls-files .dev.vars", { cwd: ROOT, stdio: "pipe" }).toString().trim();
  if (tracked) F(".dev.vars IS tracked by git — remove it: `git rm --cached cf-worker/.dev.vars`");
  else P(".dev.vars not tracked by git");
} catch { W("could not check git tracking of .dev.vars (not a git repo?)"); }
if (/wrangler secret put FINNHUB_TOKEN/.test(deploy)) P("DEPLOY.md documents the production FINNHUB_TOKEN secret step");
else W("DEPLOY.md should document `wrangler secret put FINNHUB_TOKEN`");

/* summary */
console.log(`\n${pass} passed · ${warn} warnings · ${fail} failed`);
if (fail) { console.log("\n\x1b[31mNOT READY\x1b[0m — fix the ✗ items above before deploying.\n"); process.exit(1); }
if (warn) { console.log("\n\x1b[33mREADY with warnings\x1b[0m — the ⚠ items are expected pre-deploy steps (esp. KV ids). Do them, then `npm run deploy`.\n"); process.exit(0); }
console.log("\n\x1b[32mREADY\x1b[0m — static checks pass. Next: `npm run deploy` (after wrangler login + KV + secret per DEPLOY.md).\n");
process.exit(0);
