#!/usr/bin/env node
/**
 * No page asks the reader for money, or for their e-mail.
 *
 * WHY THIS GATE EXISTS
 *
 * Owner, 2026-09-20, on seeing a "Stay Updated / Subscribe" box at the foot of an article:
 * *"Jangan ada tulisan subscribe atau apapun. Ini bukti klw saya mengkomersilkan ini. Delete atau
 * ganti aja. Audit total pastikan tidak ada."* The site is an engineering portfolio and a teaching
 * model. A newsletter capture and a PRO tier read as a business, and that reading is the defect.
 *
 * The audit found far more than the one box he was looking at:
 *   - 22 newsletter capture forms (19 `.newsletter-signup`, 3 `.newsletter-box`), plus a global
 *     `subscribeNewsletter()` in script.js that opened a mailto to the owner;
 *   - a PRO / Premium tier presentation across ~40 pages — crowns, "Upgrade to PRO",
 *     "Unlock PRO", "Premium Access", PRO badges.
 *
 * The tier was NOT a paywall: access is granted by `rz-auth-change` on login and by an
 * `rz_premium_session` key, with no payment check anywhere in the page. The words were the only
 * commercial thing about it, so the words changed and the gating did not.
 *
 * WHAT IS CHECKED, AND WHERE
 *
 * Visible text only — text nodes and the attributes a reader sees (title, aria-label, placeholder,
 * alt). CSS class names and JS identifiers are deliberately NOT checked: `.newsletter-box` as a
 * selector paints nothing once no element carries it, and renaming live identifiers to satisfy a
 * text rule is how a sweep breaks a page.
 *
 * WHAT IS EXEMPT, AND WHY EACH ONE IS
 *
 *   - No word is banned on its own. "Upgrade UPS to 2N", "CAPEX premium", "OpenAI pricing" and
 *     BACnet COV subscriptions are engineering and editorial content, and an earlier cut of this
 *     gate that banned those words reported 254 findings on 71 pages, all false. The rules match
 *     the ASK instead: a tier CTA's exact phrasing, a per-month price, or an e-mail field.
 *   - `changelog.html`, which is generated from CHANGELOG.md and quotes this very sweep.
 *   - `rz-ops-p7x3k9m.html`, the owner's own root-gated, `noindex`, sitemap-absent admin console.
 *     It is not a page a reader can reach, and it is listed here so its exclusion is a decision on
 *     the record rather than a silent hole.
 *
 * Usage: node tools/test-no-commercial-surface.mjs [--json]
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const SKIP_DIR = /^(Article|Apps|Data|dcmoc|games|Dunia-Emosi|node_modules|worktrees|backups|my-video|TestEA|Documents|cf-worker|obsidian-knowledge-vault|standarization)\//;
const SKIP_FILE = new Set(['changelog.html', 'rz-ops-p7x3k9m.html']);

/* WHAT THE RULES MATCH, AND THE MISTAKE THEY WERE REWRITTEN TO AVOID
 *
 * The first cut of this gate banned the WORDS — premium, pricing, unlock, upgrade — and reported
 * 254 findings on 71 pages, every single one a false positive: "OpenAI pricing" in an article
 * about the AI market, "CAPEX premium" in a Tier comparison, "resilience upgrade to Cloudflare's
 * Multi-Colo", and "Log in to unlock", which is the correct access wording this sweep introduced.
 *
 * A rule that over-reports is not the safe direction: it gets switched off. So the rules below
 * match the ASK — the exact phrase a tier CTA uses, or a form that actually collects an address —
 * never the vocabulary. The engineering content is free to say "pricing" as often as it likes.
 *
 * A "$N/month" rule was written and then deleted for the same reason: its 27 findings were all
 * electricity bills and data-center economics ("$17/month increase already; $70/month projected
 * by 2028"). A site that charged money would say so in a CTA, and the CTA rule already catches
 * that; a price regex on a page full of cost engineering catches only the engineering.
 */
const BANNED = [
  { id: 'newsletter capture',
    re: /\b(stay updated\b[^]{0,120}subscribe|unsubscribe anytime|no spam\.|newsletter signup|subscribe to (our|the) newsletter|join (our|the) (newsletter|mailing list))/i },
  { id: 'paid tier CTA',
    re: /\b(upgrade to (pro|premium)|unlock (pro|premium)\b|go pro\b|premium access|pro active|start (your )?free trial|buy now|purchase now|choose (a )?plan)\b/i },
];

/* An e-mail field that is NOT a sign-in or a contact form is a capture. Checked structurally,
   because the copy around one can say anything. */
const EMAIL_FIELD = /<input[^>]+type="email"[^>]*>/gi;
const LEGITIMATE_FORM = /(login|signin|sign-in|auth|contact|register|account|password)/i;

const files = execFileSync('git', ['ls-files', '*.html'], { cwd: ROOT, encoding: 'utf8' })
  .split('\n').filter(Boolean)
  .filter((f) => !SKIP_DIR.test(f) && !SKIP_FILE.has(f.split('/').pop()));

const findings = [];
for (const file of files) {
  let html;
  try { html = readFileSync(resolve(ROOT, file), 'utf8'); } catch { continue; }
  /* Strip script and style wholesale: identifiers there are not visible text. */
  const visibleSrc = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');

  const chunks = [];
  for (const m of visibleSrc.matchAll(/>([^<>]{2,400})</g)) chunks.push(m[1]);
  for (const m of visibleSrc.matchAll(/(?:title|aria-label|placeholder|alt|data-tip)="([^"]{2,300})"/g)) chunks.push(m[1]);

  for (const raw of chunks) {
    const text = raw.replace(/&amp;/g, '&').trim();
    if (!text) continue;
    for (const rule of BANNED) {
      if (rule.re.test(text)) {
        findings.push({ file, rule: rule.id, text: text.slice(0, 90) });
        break;
      }
    }
  }

  /* Structural: an e-mail input inside a form that is not a sign-in, contact or account form is
     collecting addresses, whatever the copy around it claims.

     The first cut of this rule read a 600-character window around the input and asked whether the
     word "account" appeared in it. Every page on this site has an Account link in its navigation,
     so the rule excused every form on every page and reported nothing — proven by injecting a bare
     mailing-list form, which it failed to catch. Scope the question to the FORM's own opening tag,
     which is the only thing that says what the form is for. */
  for (const form of html.matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form>/gi)) {
    const [, attrs, body] = form;
    if (!/<input[^>]+type="email"/i.test(body)) continue;
    if (LEGITIMATE_FORM.test(attrs)) continue;
    findings.push({ file, rule: 'email capture form', text: attrs.trim().slice(0, 90) || '<form>' });
  }
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ scanned: files.length, findings }, null, 2));
  process.exit(findings.length ? 1 : 0);
}

console.log('── COMMERCIAL SURFACE ──');
if (!findings.length) {
  console.log(`  ✓ ${files.length} public page(s) ask the reader for neither money nor an e-mail address`);
  console.log('\nPASS — no newsletter capture, no paid tier, no unlock wording.');
  process.exit(0);
}
const byFile = new Map();
for (const f of findings) byFile.set(f.file, [...(byFile.get(f.file) || []), f]);
for (const [file, list] of byFile) {
  console.log(`  ✗ ${file}`);
  for (const f of list.slice(0, 4)) console.log(`      [${f.rule}] ${f.text}`);
}
console.log(`\nFAIL — ${findings.length} commercial surface(s) on ${byFile.size} page(s).`);
console.log('This site is a portfolio and a teaching model. It does not sell, and it does not');
console.log('collect e-mail addresses. Use access language ("Sign in for the full analysis"),');
console.log('not tier language. If a rule fired on engineering or editorial content, the rule');
console.log('is wrong and belongs here — never the content.');
process.exit(1);
