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
const JSON_OUTPUT = process.argv.includes("--json");
const OWNER_HOLDS = process.argv.filter(argument => argument.startsWith('--hold='))
  .flatMap(argument => argument.slice('--hold='.length).split(',')).filter(Boolean);
const SKIP = ["node_modules", ".git", "dcmoc", ".next", "games", "Dunia-Emosi", "obsidian-knowledge-vault",
  ".claude", "review", "Documents", "cf-worker", "result", "Article", "02.02.26",
  "Apps", "Automation", "dc-corpus", "my-video", "TestEA", "worktrees", "backups", ".qa-screens",
  // changelog.html is a GENERATED archive (build-changelog-html.py) that quotes historical site CSS +
  // tokens (`#8b5cf6`, old tier colors) as before/after illustration of the very purges it documents.
  // It is not a live-design surface; its real styling is governed by CHANGELOG.md + the generator, so
  // the ban is enforced there, not on the rendered archive. Excluded to avoid documentary false-positives.
  "changelog.html", "Audit result"];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.some((s) => name === s || name.toLowerCase() === s.toLowerCase())) continue;
    const p = join(dir, name);
    let st; try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) walk(p, out);
    /* v1.134.20 — .js was never scanned, and that is where the site's shared auth component
       authors its colours. A design ban enforced only on HTML and CSS misses every token a
       module injects at runtime. Generated `.min.` twins are skipped: they are built from the
       source that IS scanned, so flagging both reports one defect twice. */
    else if ([".html", ".css", ".js"].includes(extname(name)) && !name.includes(".min.")) out.push(p);
  }
  return out;
}


/* ── v1.135.2 — SHARED CSS-BLOCK MACHINERY for the decorative-surface rules ──────────────
   Seven §A rules (7, 10, 11, 12, 22, 23, 24) are properties of a CSS RULE BLOCK, not of a
   file, so they need the block boundaries the earlier rules never had to find.

   The obvious extractor — /([^{}]+)\{([^{}]*)\}/g — is CATASTROPHIC on this tree. At a
   nested or unbalanced brace the inner [^{}]*\} fails and the engine backtracks the outer
   [^{}]+ one character at a time across the preceding prose run. Measured: 10.3 SECONDS on
   one 238 KB article, and the whole-tree scan never finished at all. The linear pass below
   does the same job in ~2 s across 420 files. */
function cssBlocks(t) {
  /* A STACK, not a running variable. The first cut tracked the enclosing at-rule in a single
     `at` string and never cleared it when the wrapper closed, so every block after a
     `@media print { … }` inherited "print" and was silently exempted — and every block after
     `@media (max-width: 600px)` was reported as living inside it. A gate whose exemption
     leaks forward is worse than no exemption: it goes quiet exactly where a page has the most
     rules. Depth is tracked properly here and `at` names only true ancestors. */
  const out = []; const stack = []; let selStart = 0; let quote = '';
  for (let i = 0; i < t.length; i++) {
    if (quote) {
      if (t[i] === '\\') i++;
      else if (t[i] === quote) quote = '';
      continue;
    }
    if (t[i] === '"' || t[i] === "'") { quote = t[i]; continue; }
    const c = t.charCodeAt(i);
    if (c === 123 /* { */) {
      if (stack.length) stack[stack.length - 1].hadChild = true;
      stack.push({ sel: t.slice(selStart, i).trim(), start: i + 1, hadChild: false });
      selStart = i + 1;
    } else if (c === 125 /* } */) {
      const frame = stack.pop();
      if (frame && !frame.hadChild && frame.sel) {
        out.push({
          sel: frame.sel,
          body: t.slice(frame.start, i),
          at: stack.filter((x) => x.sel.startsWith('@')).map((x) => x.sel).join(' '),
          idx: frame.start,
        });
      }
      selStart = i + 1;
    }
  }
  return out;
}

/* The DECORATIVE vocabulary, widened in v1.135.2 after measuring. The glass rule's original
   list (card|panel|tile|bento|hero|badge|chip|widget) does not contain `.skill-item` — the
   exact card the owner pointed at on the homepage. Site-wide, 122 multi-flag decorative
   blocks sat OUTSIDE that vocabulary against 111 inside it, so a copy-paste of the glass
   selector would have missed more slop than it caught. */
const DECOR_SEL = /(card|panel|tile|bento|hero|badge|chip|widget|item|box|callout|stat|note|insight|metric|kpi|block|highlight|feature|quote|pill|tag)/i;
/* Functional UI is exempt everywhere. A drawer needs a radius, a dropdown needs a shadow,
   a focus ring needs a transition. Banning those would push authors to break real controls
   in order to satisfy a design rule that was never aimed at them. */
const FUNC_SEL = /(nav|navbar|modal|overlay|gate|search|palette|ticker|dropdown|tooltip|sticky|header|drawer|sheet|toast|banner|menu|btn|button|input|select|field|form|dialog|popover|inspector|hmi|tab|scroll|cursor|marquee|share)/i;

function decorBlocks(t) {
  return cssBlocks(t).filter((b) => /^(?:[.#[:]|html\b|body\b)/.test(b.sel) && DECOR_SEL.test(b.sel) && !FUNC_SEL.test(b.sel));
}

const PIXELS_PER_REM = 16;
const DECORATIVE_RULES = new Set(['colored-left-stripe', 'shadow-sole-affordance', 'large-radius']);
const GEOMETRY_SEL = /(?:mimic|flow-box|flow-block|control-block|logic-seq-block|trace-block|pipeline-stage|fullmap-block|target-block|sankey|iso-stage|mc-svg|mode-svg)\b/i;
const SAFETY_RAIL_SEL = /\.(?:rz-fire-tile\b|fire-iso-consequence\[data-state=|status-box\.(?:active|warning|error)\b|alarm-strip\.state-(?:normal|warn|alarm)\b|alarm-item\b|(?:cap-card|sb-box)\.(?:ok|warn|bad)\b|basis-card\.(?:current|study)\b)/;
const PAPER_DOCUMENTS = new Set(['article-9-paper.html']);

function lengths(value) {
  return [...value.matchAll(/(\d*\.?\d+)(px|rem)\b/gi)]
    .map(match => Number(match[1]) * (match[2].toLowerCase() === 'rem' ? PIXELS_PER_REM : 1));
}

function declarations(body, property) {
  return [...body.matchAll(new RegExp(`(?:^|;)\\s*(?:${property})\\s*:\\s*([^;{}]+)`, 'gi'))]
    .map(match => match[1].trim());
}

function resolvedLengths(value, tokens, visited = new Set()) {
  const references = [...value.matchAll(/var\(\s*(--[\w-]+)/g)]
    .filter(match => !visited.has(match[1]));
  return lengths(value).concat(references.flatMap(match =>
    resolvedLengths(tokens.get(match[1]) || '', tokens, new Set([...visited, match[1]]))));
}

function decorativeFindings(text, file, rule) {
  const css = stylesheetText(text, file);
  if (!css || PAPER_DOCUMENTS.has(file.split('/').at(-1))) return [];
  const allBlocks = cssBlocks(css);
  const hasRootGate = allBlocks.some(block => block.sel === '.root-gate' &&
    declarations(block.body, 'position').includes('fixed') && declarations(block.body, 'inset').includes('0'));
  const tokens = new Map();
  for (const match of css.matchAll(/(--[\w-]+)\s*:\s*([^;{}]+)/g)) {
    tokens.set(match[1], (tokens.get(match[1]) || '') + ' ' + match[2]);
  }
  return decorBlocks(css).filter(block => {
    if (hasRootGate && /^\.root-card(?:$|[\s.:\[])/.test(block.sel)) return false;
    if (/print|keyframes/i.test(block.at)) return false;
    if (GEOMETRY_SEL.test(block.sel)) return false;
    if (/aurora|image|img|photo|avatar|logo|thumb|portrait|figure/i.test(block.sel)) return false;
    const ancestors = allBlocks.filter(candidate => candidate.at === block.at &&
      candidate.sel.split(',').some(selector => block.sel === selector.trim() ||
        block.sel.endsWith(' ' + selector.trim()) ||
        block.sel.replace(/\.(?:warning|critical|error|warn|alarm)(?=[:.\s]|$)/g, '') === selector.trim() ||
        block.sel.startsWith(selector.trim() + '.') || block.sel.startsWith(selector.trim() + '[')));
    const inheritedBody = ancestors.map(candidate => candidate.body).join(';');
    const radii = declarations(inheritedBody, 'border-radius');
    if (radii.some(value => /^(50%|100%)\s*(?:!important)?$/.test(value))) return false;
    if (/(?:login-box|tipbox|tt-box|side-panel)\b/i.test(block.sel)) return false;
    if (rule === 'large-radius') {
      return declarations(block.body, 'border(?:-(?:top|bottom)-(?:left|right))?-radius')
        .some(value => resolvedLengths(value, tokens).some(length => length >= 8));
    }
    if (rule === 'colored-left-stripe') {
      if (SAFETY_RAIL_SEL.test(block.sel)) return false;
      return declarations(block.body, 'border-(?:left|inline-start)(?:-width)?')
        .some(value => resolvedLengths(value, tokens).some(length => length >= 3));
    }
    if (/:(hover|focus|focus-visible|active|visited|target)\b/.test(block.sel)) return false;
    const shadows = declarations(block.body, 'box-shadow');
    if (!shadows.some(value => !/^none\b/i.test(value))) return false;
    if (declarations(block.body, 'position').some(value => /^(sticky|fixed)$/.test(value))) return false;
    const border = declarations(inheritedBody, 'border').at(-1);
    return !border || /^(?:none|0(?:px)?)(?:\s|$)|\b(?:transparent|none)\b/i.test(border);
  });
}

/* Rule 22 scans STYLESHEET text only — a <style> block or a .css file. A print stylesheet
   that a page builds as a JS string for a PDF window legitimately paints white paper, and
   flagging it would push an author to produce grey PDFs. Measured: all four of this rule's
   original findings were exactly that. */
function stylesheetText(t, file) {
  if (file.endsWith('.css')) return t;
  if (!file.endsWith('.html')) return '';
  /* Strip <script> FIRST. article-7.html builds a print window with
     `'<style>body{…background:#ffffff…}'` inside a JS string; a naive <style> scan reads
     that as the page's own stylesheet and reports a white page background on an article
     that has none. A <style> authored inside a script is a template, not this page's CSS. */
  t = t.replace(/<script[\s\S]*?<\/script>/gi, ' ');
  let out = '', m;
  const re = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  while ((m = re.exec(t))) out += m[1] + '\n';
  return out;
}

// each rule: {id, test(text, file) -> match string | null}
const RULES = [
  { id: "inter-primary-font",
    test: (t) => (/font-family:\s*['"]?(Inter|Geist|Space Grotesk)\b/i.test(t) || /family=(Inter|Geist|Space\+Grotesk)\b/.test(t))
      ? "Inter/Geist/Space-Grotesk as a PRIMARY font (use 'IBM Plex Sans')" : null },
  { id: "anthropic-purple",
    /* v1.134.20 — this tested the literal `#8b5cf6` and nothing else, so it never saw the
       shared auth module, which authors the very same colour as `rgb(139, 92, 246)` across the
       login button, the user dropdown, the modal border and every focused input — on every
       page of the site. A ban that only recognises one spelling of the thing it bans is not a
       ban. Covers the hex, the rgb()/rgba() forms, and the violet-400 sibling #A78BFA the same
       component pairs it with. */
    test: (t) => {
      /* The aurora-mesh hero is §B PROTECTED and its stops legitimately include a violet.
         Widening this rule to rgb() notation in v1.134.20 made it flag that hero on every
         page that loads the shared stylesheets — the exact over-eager de-slop pass §B exists
         to prevent. So a translucent stop INSIDE a gradient() is not a finding: the pill this
         rule bans is an opaque accent on text, a fill or a border, never an alpha-0.15 wash
         under a 22-second drift. A solid `#A78BFA` anywhere still fails, gradient or not. */
      /* An ATTRIBUTE SELECTOR that matches the banned colour exists to REPAIR it —
         `[style*="rgb(139, 92, 246)"] { color:#6d28d9 !important }` repaints whatever a chart
         library injects inline. Flagging the repair as the offence would push an author to
         delete the only thing keeping the colour off the page. Naming a colour in a selector
         is not painting with it. */
      const scrubbed = String(t)
        .replace(/\[style\*=(["'])[^"']*\1\]/g, '')
        .replace(
        /(?:linear|radial|conic)-gradient\([^()]*(?:\([^()]*\)[^()]*)*\)/gi,
        (grad) => grad.replace(/rgba\(\s*(?:139\s*,\s*92\s*,\s*246|167\s*,\s*139\s*,\s*250)\s*,\s*0?\.\d+\s*\)/gi, ''));
      return (/#8b5cf6|#a78bfa|rgba?\(\s*139\s*,\s*92\s*,\s*246\s*[,)]|rgba?\(\s*167\s*,\s*139\s*,\s*250\s*[,)]/i.test(scrubbed))
        ? "Anthropic-purple (#8B5CF6 / #A78BFA, in any notation) — use a semantic token / mint #7DDDB4" : null;
    } },
  { id: "emoji-ui-icon",
    // Decorative PICTOGRAPH emoji as UI icons/headings/badges (sign #5). Whitelisted (kept): 🔒/🔓 lock
    // (gated-feature affordance), ⚠ warn, ⚡ energy, ★☆⭐ rating, regional-indicator FLAGS (country data),
    // arrows/checks/math (typographic, handled by their own idioms). Everything else in the pictograph
    // ranges = slop → use a Font Awesome / thin-line icon instead. `u` flag is mandatory (surrogate pairs).
    test: (t) => {
      /* v1.134.22 — an emoji in `console.log` is TERMINAL output from a build script, not a
         UI icon. generate-pdf.js is a Node tool nobody's browser ever loads; flagging its
         progress log put a real finding (a 📌 on an actual button) behind three that could
         never be seen by a user. Console arguments are stripped before the scan; anything
         drawn into the DOM is untouched. */
      t = String(t).replace(/console\.(?:log|info|warn|error|debug)\s*\((?:[^()"'`]|"[^"]*"|'[^']*'|`[^`]*`)*\)/g, '');
      const WHITELIST = new Set(["🔒","🔓","⚠","⚡","★","☆","⭐","✅","✓","✔","✗","✘","❌","➜","🌐","⚑","☀","☽","☾","☼"]);
      const PICTO = /[\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1FAFF}\u{2600}-\u{26FF}\u{2728}]/gu;
      const FLAG = /[\u{1F1E6}-\u{1F1FF}]/u;   // regional-indicator halves → country flags (data, kept)
      let m;
      while ((m = PICTO.exec(t))) {
        const c = m[0];
        if (WHITELIST.has(c) || FLAG.test(c)) continue;
        return `decorative emoji ${c} as UI (use a Font Awesome / thin-line icon)`;
      }
      return null;
    } },
  { id: "sparkle-emoji",
    // NB: the char-class MUST carry the `u` flag — without it, 🪄 (a surrogate pair) decays to two
    // lone surrogates and the class matches the \uD83E high-surrogate shared by 🧪🧠🧬 etc. (false hits).
    test: (t) => /[✨🪄]/u.test(t) || /fa-(magic|wand-magic|sparkles?)/.test(t) ? "sparkle/wand icon (AI tell)" : null },
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
    // Selector-aware: backdrop-blur on nav/modal/overlay/palette/sticky-header is standard FUNCTIONAL UI
    // (not slop). Only DECORATIVE surfaces (card/panel/tile/bento/hero/badge/chip/widget) count as
    // glassmorphism. Flag when ≥3 decorative surfaces carry blur.
    test: (t) => {
      const DECOR = /(card|panel|tile|bento|hero|badge|chip|widget|glass-(?!bg|blur))/i;
      const FUNC = /(nav|navbar|modal|overlay|gate|search|palette|ticker|dropdown|tooltip|sticky|header|drawer|sheet|toast|banner|menu)/i;
      // Resolve `backdrop-filter: var(--glass-blur)` indirection: if --glass-blur is DEFINED as a real
      // blur(...) anywhere in the file, substitute so token-glass can't hide from the blur( scan below.
      const def = t.match(/--glass-blur:\s*(blur\([^;]*\))/i);
      if (def) t = t.replace(/backdrop-filter:\s*var\(--glass-blur\)/gi, "backdrop-filter: " + def[1]);
      let decor = 0;
      const re = /([.#][^{}]{1,120}?)\{[^{}]*backdrop-filter:\s*[^;}]*blur\([^{}]*\}/gi;
      let m;
      while ((m = re.exec(t))) {
        const sel = m[1];
        if (DECOR.test(sel) && !FUNC.test(sel)) decor++;
      }
      return decor >= 3 ? `glassmorphism blur on ${decor} decorative surface(s)` : null;
    } },

  /* ── v1.135.0 — GUARD RULES ────────────────────────────────────────────────
     Four §A rules that measure ZERO on this tree today. They are cheap, they carry no
     backlog, and they exist so the patterns cannot come back the way the purple did.
     Shipped strict on arrival for exactly that reason: a rule added after a regression
     is a post-mortem; a rule added before one is a gate. Each names the §A rule it
     enforces so the tool and the standard cannot drift apart. */
  { id: "terminal-mock",                                             // §A rule 17
    test: (t) => /\b(terminal-window|fake-terminal|terminal-mock|term-dots|window-dots|traffic-lights|mac-window)\b/i.test(t)
      ? "decorative terminal-window mock — use a real embed or real output" : null },

  { id: "fake-testimonial",                                          // §A rule 18
    /* A SHAPE guard, not a truth check: no gate can know whether a quote is real. It
       asserts the site does not carry testimonial-shaped markup at all, which is the
       only machine-checkable half of the rule. Labelled honestly rather than implying
       the stronger claim. */
    test: (t) => /\b(testimonial|client-quote|customer-quote|review-card|star-rating-card)\b/i.test(t)
      ? "testimonial-shaped markup — this site invents no quotes" : null },

  { id: "not-x-its-y",                                               // §A rule 19
    /* Runs on PROSE, so tags, scripts and styles are stripped first — otherwise a class
       name or a JS string trips it. Deliberately narrow: it matches the specific slop
       formula, not every contrastive sentence, because a lossy copy rule that cries wolf
       gets muted and then protects nothing. */
    test: (t) => {
      const prose = t.replace(/<script[\s\S]*?<\/script>/gi, ' ')
                     .replace(/<style[\s\S]*?<\/style>/gi, ' ')
                     .replace(/<[^>]+>/g, ' ');
      const m = prose.match(/\bit(?:'|&#39;|&rsquo;|\u2019)?s not (?:just )?(?:a |an |the |about )?[^.,;\u2014-]{2,40}[,\u2014-]\s*it(?:'|&#39;|&rsquo;|\u2019)?s\b/i);
      return m ? `"it's not X, it's Y" copy formula: "${m[0].trim()}"` : null;
    } },

  { id: "pricing-tiers",                                             // §A rule 26
    test: (t) => /\b(pricing-tier|price-card|pricing-table|plan-card|tier-price)\b/i.test(t)
      ? "pricing-tier template markup — this site sells nothing" : null },

  { id: "standalone-orbs",                                           // §A rule 7
    /* The aurora-mesh hero is §B PROTECTED and is a gradient WASH on a container, not a
       circle. What this bans is the free-floating glowing disc: a round element that is
       nothing but blur and colour. Naming the shape (50% radius + blur/radial fill) is
       what keeps the protected hero out of it. */
    test: (t) => {
      /* NOT decorBlocks: the orb vocabulary IS the decorative signal, and a selector like
         `.bg-orb` carries none of the card/panel words. Requiring both missed the fixture
         this rule was written against. */
      const hits = cssBlocks(t).filter((b) =>
        /^[.#]/.test(b.sel)
        && /(^|[^a-z])(orb|blob|glow-circle|bg-glow)/i.test(b.sel)
        /* §B PROTECTED: the aurora-mesh hero IS a set of drifting radial washes and is the
           site's signature. It is named `aurora-*` everywhere it appears, so the exemption
           can be exact rather than a guess at opacity. */
        && !/aurora/i.test(b.sel)
        && !FUNC_SEL.test(b.sel)
        && /border-radius:\s*50%/.test(b.body)
        && /filter:\s*blur\(|radial-gradient/.test(b.body));
      return hits.length ? `${hits.length} standalone glowing orb(s): ${hits.slice(0, 3).map((h) => h.sel).join(', ')}` : null;
    } },

  { id: "white-body-bg",                                             // §A rule 22
    test: (t, f) => {
      const css = stylesheetText(t, f);
      if (!css) return null;
      if (PAPER_DOCUMENTS.has(f.split('/').at(-1))) return null;
      const hits = cssBlocks(css).filter((b) =>
        !/print/i.test(b.at)
        && /(^|,)\s*(html\s+)?body\s*(,|$)/i.test(b.sel)
        && /background(-color)?:\s*(#fff\b|#ffffff\b|white\b)/i.test(b.body));
      return hits.length ? `raw white page background on body (use the token background)` : null;
    } },

  { id: "animated-cta",                                              // §A rule 23
    /* Deliberately narrow, and the narrowing was earned. A first cut matching any
       arrow|cta|bounce selector flagged `.fp-arrow.active` on fuel-system.html — a P&ID
       flow indicator whose animation IS the reading, telling the operator the line is
       live. Banning that would delete information from a process diagram to satisfy a
       marketing-copy rule. So: a resting (never :hover) infinite bounce/float on a
       call-to-action, and nothing else. The §B Pixel-Rise scroll cue stays exempt. */
    test: (t) => {
      const hits = cssBlocks(t).filter((b) =>
        /(cta|hero-btn|scroll-down|scroll-cue|bounce-arrow)/i.test(b.sel)
        && !/:hover|:focus/.test(b.sel)
        && !/scroll-explore/i.test(b.sel)
        && /animation:[^;]*(bounce|float)[^;]*infinite/i.test(b.body));
      return hits.length ? `${hits.length} bouncing call-to-action: ${hits.slice(0, 3).map((h) => h.sel).join(', ')}` : null;
    } },

  { id: "excessive-hover",                                           // §A rule 24
    test: (t) => {
      const hits = decorBlocks(t).filter((b) =>
        /:hover/.test(b.sel)
        && /transform:\s*(translate|scale)/i.test(b.body)
        && /transition:\s*all/i.test(b.body));
      return hits.length ? `${hits.length} decorative hover(s) moving on \`transition: all\`: ${hits.slice(0, 3).map((h) => h.sel).join(', ')}` : null;
    } },

  ...Array.from(DECORATIVE_RULES, id => ({ id })),
];

const files = walk(ROOT);
const findings = [];
// Strip DOCUMENTATION prose before scanning: <code>/<pre> blocks (e.g. the public changelog quotes
// historical CSS like `<code>#8b5cf6</code>` while DESCRIBING the purge — documenting a tell is not
// committing it). Real usage lives in style="" / class="" / CSS rules, which survive this strip.
function stripDocProse(t) {
  return t
    .replace(/<code[\s\S]*?<\/code>/gi, "")
    .replace(/<pre[\s\S]*?<\/pre>/gi, "")
    /* v1.134.20 — the same principle now that .js is scanned: a block comment EXPLAINING why a
       banned token was purged is documentation, not a commitment of it. Without this the
       header that records the auth-component conversion would itself trip the rule it
       describes. Only /* *\/ comments are stripped — a line comment can sit at the end of a
       live declaration, so removing those could hide a real usage. */
    .replace(/\/\*[\s\S]*?\*\//g, "");
}
// Decode NUMERIC HTML entities (&#128214; / &#x1F4D6;) so an emoji written as an entity is caught by the
// same char-based rules as a literal one — a book pill authored as `&#128214;` renders 📖 all the same.
function decodeEntities(t) {
  return t.replace(/&#(\d+);/g, (_, d) => { try { return String.fromCodePoint(+d); } catch { return _; } })
          .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => { try { return String.fromCodePoint(parseInt(h, 16)); } catch { return _; } });
}
for (const f of files) {
  let t; try { t = decodeEntities(stripDocProse(readFileSync(f, "utf8"))); } catch { continue; }
  for (const r of RULES) {
    const blocks = DECORATIVE_RULES.has(r.id) ? decorativeFindings(t, f, r.id) : undefined;
    const m = blocks ? (blocks.length ? `${blocks.length} decorative block(s): ${blocks.map(block => block.sel).join(', ')}` : null) : r.test(t, f);
    if (!m) continue;
    const rel = f.replace(ROOT + "/", "");
    findings.push({ file: rel, rule: r.id, msg: m, blocks, monitor: false });
  }
}

// REQUIRED pages (absence is itself a tell)
for (const req of ["terms.html", "privacy.html"]) {
  if (!existsSync(join(ROOT, req))) findings.push({ file: req, rule: "missing-legal", msg: `${req} missing (required)` });
}
for (const file of OWNER_HOLDS) {
  findings.push({ file, rule: 'active-owner-hold', msg: 'UNVERIFIED — active owner hold; coordination and a post-owner rescan are required.', monitor: false });
}

const gating = findings.filter((f) => !f.monitor);
const monitored = findings.filter((f) => f.monitor);
const inventory = {
  files: files.map(file => file.replace(ROOT + '/', '')),
  excludedNames: SKIP,
  generatedTwinsExcluded: '*.min.*',
  activeOwnerHolds: OWNER_HOLDS.map(file => ({ file, status: 'UNVERIFIED', reason: 'Active owner hold; read-only scan does not certify the evolving source.' })),
  historicalEvidenceExcluded: ['changelog.html', 'standarization/Audit result/'],
  paperDocuments: [...PAPER_DOCUMENTS],
  functionalRailSelectors: SAFETY_RAIL_SEL.source,
  protectedGeometrySelectors: GEOMETRY_SEL.source,
  decorativeCoverage: 'Static CSS files and HTML style elements; runtime JS CSS and inline style attributes require separate review. Explicit paper documents, print media and functional geometry are protected.',
  generatorParity: 'Generation is not executed by this static audit; source ownership must be established separately.',
  limitation: 'Static detectors are not proof that all 26 design tells are absent; visual and content judgement remain required.',
};
if (JSON_OUTPUT) {
  console.log(JSON.stringify({ findings, inventory, summary: { gating: gating.length, monitored: monitored.length, filesWithFindings: new Set(findings.map(finding => finding.file)).size } }, null, 2));
  process.exit(STRICT && gating.length ? 1 : 0);
}
const group = (list) => {
  const by = {};
  for (const f of list) (by[f.rule] ||= []).push(f.file);
  return by;
};
console.log("── ANTI-VIBECODE AUDIT ──");
console.log(`Scanned ${files.length} source files. Excluded names: ${SKIP.join(', ')}; generated *.min.* twins. Use --json for inventory and all findings.`);
console.log(inventory.decorativeCoverage);
if (!findings.length) { console.log("No detected findings in this static scope; visual review still required. Not a ship clearance."); process.exit(0); }

for (const [rule, fs] of Object.entries(group(gating))) {
  console.log(`  ✗ ${rule}: ${fs.length} file(s) — ${fs.slice(0, 4).join(", ")}${fs.length > 4 ? " …" : ""}`);
}
console.log(`── ${gating.length} gating + ${monitored.length} monitored finding(s) across ${new Set(findings.map((f) => f.file)).size} file(s). See standarization/ANTI_VIBECODE_STANDARD.md`);
if (!gating.length) console.log("── no gating findings in this scope; monitored findings and visual review remain unresolved. Not a ship clearance.");
process.exit(STRICT && gating.length ? 1 : 0);
