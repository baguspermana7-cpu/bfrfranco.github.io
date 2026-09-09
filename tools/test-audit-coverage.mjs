/**
 * test-audit-coverage.mjs — "no page left behind".
 *
 * The design audits walk the filesystem with a SKIP list; the SITEMAP is what the site actually
 * publishes. Those two lists agreeing today is luck, not a property — one added directory in the
 * SKIP list silently drops a live page out of every design gate. This asserts the relationship.
 *
 *   node --test tools/test-audit-coverage.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = process.cwd();
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const inv = (tool) =>
  JSON.parse(execFileSync(process.execPath, [join(ROOT, "tools", tool), "--json"],
    { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })).inventory;

/** sitemap <loc> → repo-relative file. A directory URL is served by its index.html.
    Pure so it can be proven RED on synthetic input without touching the real sitemap.xml,
    which a parallel session may have dirty. */
export function parseSitemap(raw) {
  return [...raw.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => {
    const p = m[1].trim().replace(/^https?:\/\/[^/]+\/?/, "");
    if (p === "" || p === "/") return "index.html";
    return p.endsWith("/") ? p + "index.html" : p;
  });
}
/** Disallow set per robots group. Groups do NOT inherit, so each must be complete. */
export function robotsGroups(raw) {
  const groups = []; let cur = null;
  for (const line of raw.split(/\r?\n/)) {
    const l = line.trim();
    if (/^user-agent:/i.test(l)) { if (!cur || cur.size) { cur = new Set(); groups.push(cur); } }
    else if (/^disallow:/i.test(l) && cur) cur.add(l.split(":").slice(1).join(":").trim());
  }
  return groups.filter((g) => g.size);
}
const sitemapPaths = () => parseSitemap(read("sitemap.xml"));

test("every sitemap URL resolves to a real file", () => {
  const missing = sitemapPaths().filter((p) => !existsSync(join(ROOT, p)));
  assert.deepEqual(missing, [], `sitemap advertises pages that do not exist: ${missing.join(", ")}`);
});

test("every published page is inside the anti-vibecode audit scope", () => {
  const scope = new Set(inv("audit-vibecode.mjs").files);
  const outside = sitemapPaths().filter((p) => !scope.has(p));
  assert.deepEqual(outside, [], `published but never design-audited: ${outside.join(", ")}`);
});

test("every published page is inside the UX-laws audit scope", () => {
  const scope = new Set(inv("audit-ux-laws.mjs").pages);
  const outside = sitemapPaths().filter((p) => !scope.has(p));
  assert.deepEqual(outside, [], `published but outside the UX gate: ${outside.join(", ")}`);
});

/* robots groups do NOT inherit — the file says so itself. A Disallow added to one group and
   forgotten in another leaks that directory to whichever crawler owns the thinner group. */
test("every robots.txt group carries the identical Disallow set", () => {
  const withRules = robotsGroups(read("robots.txt"));
  assert.ok(withRules.length >= 2, "expected at least two robots groups");
  const base = [...withRules[0]].sort();
  for (const g of withRules.slice(1)) {
    assert.deepEqual([...g].sort(), base,
      "a robots group is missing a Disallow the others have — that directory leaks to its crawler");
  }
});

/* Reverse direction: a crawlable page that is in NO sitemap must have a reason — it is gated,
   marked noindex, or a known utility file. Anything else is content that silently never gets
   indexed, which is the same "left behind" failure seen from the other side. */
test("no crawlable page is orphaned from the sitemap without a reason", () => {
  const disallowed = [...read("robots.txt").matchAll(/^disallow:\s*\/(.+)$/gim)].map((m) => m[1].trim());
  const skipDir = new Set([...disallowed.map((d) => d.replace(/\/$/, "")),
    "games", "my-video", "TestEA", "worktrees", "backups", "node_modules", ".next", "output", ".git"]);
  const html = [];
  (function walk(dir, base = "") {
    for (const name of readdirSync(dir)) {
      const relPath = base ? `${base}/${name}` : name;
      if (skipDir.has(relPath) || skipDir.has(name) || name.startsWith(".")) continue;
      const p = join(dir, name);
      let st; try { st = statSync(p); } catch { continue; }
      if (st.isDirectory()) walk(p, relPath);
      else if (extname(name) === ".html") html.push(relPath);
    }
  })(ROOT);

  const inSitemap = new Set(sitemapPaths());
  const GATED = /enforceTierFeatureAccess|rootGate|root-gate|ROOT_ONLY/;
  const NOINDEX = /name=["']robots["'][^>]*noindex/i;
  const UTILITY = /^(404|google[0-9a-f]+|changelog)\.html$|^assets\/|^embed\//;

  const orphans = html.filter((f) => {
    if (inSitemap.has(f) || UTILITY.test(f)) return false;
    const t = readFileSync(join(ROOT, f), "utf8");
    return !GATED.test(t) && !NOINDEX.test(t);
  });
  assert.deepEqual(orphans, [],
    `public content missing from the sitemap (not gated, not noindex, not utility): ${orphans.join(", ")}`);
});

/* ── RED proofs on synthetic input ─────────────────────────────────────────────────
   The five checks above pass today. That is only meaningful if they can fail. These
   exercise the detection logic directly, so no tracked file is ever mutated. */

test("RED proof: a directory URL is mapped to its index.html, a page URL is not", () => {
  const paths = parseSitemap(`<loc>https://x.test/</loc><loc>https://x.test/id/</loc><loc>https://x.test/a.html</loc>`);
  assert.deepEqual(paths, ["index.html", "id/index.html", "a.html"]);
});

test("RED proof: a sitemap entry with no file would be caught", () => {
  const paths = parseSitemap(`<loc>https://x.test/ghost-page.html</loc>`);
  const missing = paths.filter((p) => !existsSync(join(ROOT, p)));
  assert.deepEqual(missing, ["ghost-page.html"], "the resolver must report a non-existent page");
});

test("RED proof: a robots group missing one Disallow is detected", () => {
  const groups = robotsGroups([
    "User-agent: *", "Disallow: /a/", "Disallow: /b/", "",
    "User-agent: Yandex", "Disallow: /a/",
  ].join("\n"));
  assert.equal(groups.length, 2);
  const base = [...groups[0]].sort();
  assert.notDeepEqual([...groups[1]].sort(), base,
    "a thinner second group must NOT compare equal — otherwise the leak check is blind");
});

test("RED proof: identical groups compare equal (no false alarm)", () => {
  const groups = robotsGroups([
    "User-agent: *", "Disallow: /a/", "",
    "User-agent: Yandex", "Disallow: /a/", "Crawl-delay: 2",
  ].join("\n"));
  assert.deepEqual([...groups[1]].sort(), [...groups[0]].sort());
});
