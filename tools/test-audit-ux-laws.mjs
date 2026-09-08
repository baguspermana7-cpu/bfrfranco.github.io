/**
 * test-audit-ux-laws.mjs — RED→GREEN proof for the §D #6 gate.
 * A gate that has only ever printed "no findings" is untested: it must be shown to go RED on a
 * real fault before a green run means anything.
 *   node --test tools/test-audit-ux-laws.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const TOOL = join(process.cwd(), "tools", "audit-ux-laws.mjs");

function run(dir) {
  try {
    const out = execFileSync(process.execPath, [TOOL, "--strict"], { cwd: dir, encoding: "utf8" });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status, out: (e.stdout || "") + (e.stderr || "") };
  }
}
const fixture = () => mkdtempSync(join(tmpdir(), "uxlaws-"));

test("RED: page with async load and no loading affordance is flagged", () => {
  const d = fixture();
  writeFileSync(join(d, "bad.html"), `<html><body><script>fetch('/api/data.json').then(r=>r.json())</script></body></html>`);
  const r = run(d);
  rmSync(d, { recursive: true, force: true });
  assert.equal(r.code, 1, "must exit 1 under --strict");
  assert.match(r.out, /doherty-skeleton/);
  assert.match(r.out, /bad\.html/);
});

test("GREEN: same page with a skeleton affordance passes", () => {
  const d = fixture();
  writeFileSync(join(d, "ok.html"), `<html><body><div class="skel"></div><script>fetch('/api/data.json')</script></body></html>`);
  const r = run(d);
  rmSync(d, { recursive: true, force: true });
  assert.equal(r.code, 0, "clean tree must exit 0");
  assert.match(r.out, /No findings/);
});

test("analytics beacons are not content loads (no false positive)", () => {
  const d = fixture();
  writeFileSync(join(d, "ga.html"), `<html><body><script>fetch('https://www.google-analytics.com/collect')</script></body></html>`);
  const r = run(d);
  rmSync(d, { recursive: true, force: true });
  assert.equal(r.code, 0, "a gtag beacon must not demand a skeleton");
});

test("RED via a shared module: finding names the CONSUMER page, not the module", () => {
  const d = fixture();
  mkdirSync(join(d, "js"));
  writeFileSync(join(d, "js", "loader.js"), `export function go(){ return fetch('/api/x.json'); }`);
  writeFileSync(join(d, "host.html"), `<html><body><script src="js/loader.js"></script></body></html>`);
  const r = run(d);
  rmSync(d, { recursive: true, force: true });
  assert.equal(r.code, 1);
  assert.match(r.out, /host\.html/, "must blame the page the user actually sees");
  assert.match(r.out, /loader\.js/, "and name the module responsible");
});

test("a tree with no js/ directory does not crash the gate", () => {
  const d = fixture();
  writeFileSync(join(d, "plain.html"), `<html><body>hi</body></html>`);
  const r = run(d);
  rmSync(d, { recursive: true, force: true });
  assert.equal(r.code, 0);
  assert.match(r.out, /UX LAWS AUDIT/);
});
