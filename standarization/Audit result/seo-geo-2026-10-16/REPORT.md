# Getting resistancezero.com found, read and recommended by AI
### SEO + GEO strategy and audit, 2026-10-16 (site v3.22.5, tree `f494d442d`)

> **Owner's goal:** *"Agar website saya ramai dan banyak direkomendasi oleh AI"*: more visitors and, above all,
> more citations and recommendations from ChatGPT, Claude, Perplexity, Gemini, Google AI Overviews / AI Mode and Bing Copilot.
>
> **How to read this:** §1 is the whole story on one page. §2 lists the evidence. §3–§6 are the playbooks. §7 is the content roadmap,
> §8 covers measurement and §9 is the 30/60/90-day plan. Paste-ready ledger rows are in `LEDGER_ROWS.md`, script specs are in
> `AUTOMATION.md`, and every external source is listed in `SOURCES.md`.
>
> **Legend:** Impact **H/M/L** · Effort **H/M/L** · Who: **AUTO** (a tool script), **CONTENT** (writing), **OWNER** (a manual
> action only the owner can take, such as an account, a decision or a post). ✅ = verified on the tree or the live site today.
> ◐ = inferred (the source is stated, and so is why it is not proof).
>
> Produced by a research agent (Opus) on 2026-10-16; the harness refused the agent's own file writes, so the main session saved the four files verbatim.

## 1. Executive summary

### Where the site stands today
The site is well built for machines and almost invisible to people and AI. It already has more technical SEO than most sites
in the niche: static HTML bodies that render without JavaScript, valid JSON-LD on every article, canonical tags, IndexNow, a sitemap
generated from an inventory, `llms.txt`, and `robots.txt` open to every AI search crawler. `tools/audit-seo.py` reports **0 errors on 177 pages**.

It still does not show up where answers get made:

| Probe (2026-10-16) | Result | |
|---|---|---|
| `PJM 6 GW shortfall 2027 data centers` (article-25's topic) | 9/9 results are **introl.com** in 7 languages | ✅ |
| `xAI Colossus 122 days` (article-23) | Wikipedia, introl, DCF, TechRadar | ✅ |
| `PFAS two-phase immersion cooling vapor release` (article-26, 11,420 words) | USPTO patents, DCF (sponsored), DCD | ✅ |
| `data center liquid cooling PUE calculator` | 10/10 are Vertiv locale copies of one post | ✅ |
| `"Bagus Dwi Permana" data center` | nothing about the person or the site | ✅ |
| `"resistancezero"` | Elipse E3 docs for the electrical parameter *ResistanceZero* | ✅ |
| `site:resistancezero.com` (search tool and Bing HTML) | no pages returned | ◐ not an index count; only GSC or Bing WMT can say |

**What this means:** the bottleneck is no longer markup. It is three things:
1. **Entity and authority.** Nothing on the web says who Bagus Dwi Permana is, or that ResistanceZero is a source.
2. **The best assets are hidden or hard to quote.** The 43 incident dossiers are `noindex`, and 101 FAQ answers sit in invisible JSON.
3. **Nobody can tell whether anything works.** There is no AI-visibility measurement, and none of the 230 post drafts carries a UTM tag.

### The 5 moves that matter most
| # | Move | Why it matters for AI recommendation | I | E | Who |
|---|---|---|---|---|---|
| 1 | **Publish the incident library as public, indexable briefs** (the full dossier can stay gated) | "What caused the OVHcloud SBG2 fire?" is exactly what people ask AI. Today 43 dossiers and the hub are `noindex, nofollow`, so they cannot be cited | H | M | OWNER decision → AUTO+CONTENT |
| 2 | **Make the author one entity**: one `Person` `@id`, one job title, full `sameAs` (LinkedIn, GitHub, ORCID, Medium…), a linked byline, an author page | Engines identify an expert by matching the same entity across places. Today: 0 `@id`s, 4 job titles, a plain-text byline | H | L–M | AUTO+OWNER |
| 3 | **Turn hidden answers into visible, quotable ones**: render the 101 FAQ Q&As visibly, and add a sourced "Key numbers" block under each H1 | Google requires structured data to match visible text. FAQ rich results were retired in May 2026, so hidden FAQ now earns nothing. Visible, sourced, self-contained answers are what retrieval lifts | H | L | AUTO+CONTENT |
| 4 | **Measure first**: GSC *Generative AI performance*, Bing WMT *AI Performance* (shows cited URLs + grounding queries), a GA4 AI channel, UTMs, enforced HTTPS | Without these, none of the other moves can be judged | H (enabler) | L | OWNER+AUTO |
| 5 | **Earn presence where engines source**: genuine expert participation on Reddit/LinkedIn/YouTube, Show HN for the labs, Medium via Import (canonical), an incident dataset with a DOI | Community platforms took **52.5 %** of 1M+ AI citations (Otterly, Jan–Feb 2026). A site nobody discusses is not recommended, it is unknown | H | M (ongoing) | OWNER+CONTENT |

### Expected impact, stated honestly
No one can promise placement in AI answers. Google says no third-party tool has access to its ranking or AI systems. What can be said with evidence:
- Moves 1 and 3 add indexable, quotable surface on topics where the site has real depth. Today that surface is blocked or invisible.
- Move 2 is the precondition for being named as a source. A May 2026 study found that schema alone did not lift AI citations.
- Move 4 turns "is it working?" into numbers within about 30 days.
- Move 5 compounds over time.

**Realistic 90-day milestone:** non-zero Copilot citations in Bing WMT, GSC impressions on the incident briefs, and at least 1 tracked AI-assistant referral session per week in GA4. A traffic number before measurement exists would be invented.

## 2. Current-state audit, with evidence

### 2.1 Already right (keep it, do not re-raise)
| Area | Evidence | |
|---|---|---|
| Bodies are server-side HTML | live `article-28.html`: 107,510 B, **4,276 words visible after stripping script/style/svg**. The hero shows 5 key figures | ✅ |
| AI crawlers allowed | `robots.txt` puts `*`, GPTBot, ClaudeBot, OAI-SearchBot, PerplexityBot, Google-Extended, CCBot… in one shared group with `Allow: /`. Live fetches as GPTBot/ClaudeBot/PerplexityBot/OAI-SearchBot all return **200** | ✅ |
| Valid JSON-LD | 28/28 articles: TechnicalArticle + BreadcrumbList + FAQPage, 0 parse failures | ✅ |
| Canonical/hreflang | article-28: self canonical, `hreflang` en + x-default | ✅ |
| Metadata, descriptions, dates, orphans, OG | ledger rows A–E, 1–7, 10, 2 are CLOSED with gates | ✅ |
| www → apex | `https://www.resistancezero.com/` → 301 | ✅ |
| Methodology pages | 43 `manual/*.html`; `tco-calculator.html` links `manual/tco.html` | ✅ |
| References | 22/28 articles have a References/Sources section; 4–32 external links each | ✅ |
| Glossary depth | 360 `id="term-…"` anchors, 16,478 words; article-28 deep-links 11 terms | ✅ |
| Crawler contract | `crawler_audit.py --strict` PASS (`included 180, noindex 74, excluded-directory 42`) | ✅ |
| GA4 | `G-GED7FX8RTV` via a guarded loader, `index.html:21-23` | ✅ |

### 2.2 What is wrong, and what fixing it changes (numbering = LEDGER_ROWS)

**F11 — 101 FAQ answers exist only in JSON-LD.** ✅ FAQPage is on 28/28 articles with 101 questions. The first-question text appears 0 times outside `<script>` in article-1, article-23 and article-26, and a fragment match finds only 1 of 101 visible (article-21). The cause is in the standard: `SEO_OPTIMIZATION_STANDARD.md` §FAQ Schema (Idea 33) → Placement puts the block "in `<head>`", and `tools/inject-schema-faq-howto.py` writes it there. Google lists "Making sure your structured data matches the visible text on the page" as a fundamental. Google's changelog says FAQ rich results are no longer shown, and the docs were removed on 12 June 2026. So the hidden FAQ earns nothing and carries policy risk. **Fixing it** makes 101 short, self-contained Q&As visible and quotable.

**F12 — The incident library is `noindex, nofollow`.** ✅ `dc-incidents.html` and all 43 `incident-*.html` carry it. They have been root-gated since `d291ee100` (2026-07-31). The hub has no JSON-LD, and 0 incidents are in the sitemap or `llms.txt` (consistent with the standard's rule at line 321). Live, the full HTML is still served: `incident-ovhcloud-sbg2-fire-2021.html` returns 200 with 246,711 B. Incident timelines with root causes, dates and sources are the most citation-shaped content on the site. **Fixing it** follows the owner's own `datahallAI.html` precedent (row 10): a public brief, with the deep content gated. *Side note, not SEO:* the gated body is in the served HTML, so the gate only hides it from people who don't view source.

**F13 — The author is not one entity.** ✅
- 0 pages declare a Person `@id`.
- `jobTitle` varies: "Engineering Operations Manager" on most articles, "Data Center Operations Lead" on article-9, "Independent Researcher" on articles.html, a 3-title array on index, and none on article-11 and article-12.
- Article `sameAs` is [LinkedIn, resistancezero.com], while index has [LinkedIn, GitHub]. There is no ORCID or Medium.
- The byline is plain text (0 author links in article-28), with no `rel="author"`.

Google's author best practice is an author `url` pointing to a ProfilePage. **Fixing it** turns the site's strongest E-E-A-T asset (12+ years of hands-on DC operations) into a signal engines can verify.

**F14 — HTTP is served, not redirected.** ✅ `curl -I http://resistancezero.com/` returns `200 OK` (so does `/article-28.html`). Fix (OWNER): Settings → Pages → Enforce HTTPS. Verify: the first line becomes `301`.

**F15 — No AI-visibility measurement.** ✅ for the repo, ◐ for the accounts. No runbook mentions GSC's Generative AI report, Bing's AI Performance report (preview since Feb 2026) or a GA4 AI channel. Bing verification exists (`BingSiteAuth.xml`, msvalidate).

**F16 — Syndication cannot be attributed, and Medium copies risk duplicating the originals.** ✅ 0 of 230 draft `.md` files contain `utm_`. Only 15 of 52 Medium drafts mention import/canonical.

**F17 — The brand collides with an engineering term, and the person has no footprint.** ◐ See the probes in §1. Fix: use "ResistanceZero" consistently with a disambiguator, and add an `Organization` `@id` with `founder` → Person and `sameAs`.

**F18 — The ledger's `dateModified` rule and the tree disagree.** ✅ Ledger row 3 says `dateModified` is "deliberately absent", but 23 of 28 articles carry it, 17 of them equal to `datePublished`. article-26 has 58 commit dates, including a substantive vapour-pressure correction, and nothing visible says so. Fix: an author-maintained `<section id="revisions">`, with `dateModified` emitted only from its newest entry.

**F19 — The glossary schema covers 20 of 360 terms.** ✅ Low impact, low effort.

**F20 — `llms-full.txt` is 2,873,225 B live (~700k tokens).** ✅ That is larger than any context window, which defeats its stated "one-shot loading" purpose. Split it per section or cap it. Low.

**F21 — `audit-seo.py` still applies the withdrawn 30–60-char title rule.** ✅ 50 of its 52 warnings come from it. Replace it with "subject survives the ~60-char cut".

**F22 — Most articles have no answer-first summary.** ✅ (phrase match) Only 11 of 28 contain a takeaway, TL;DR or key-numbers block. The query winner (introl) opens with `## TL;DR` and closes with role-based `## Key Takeaways`.

**F23 — IndexNow is manual.** ✅ `.github/workflows/` has only `supabase-keepalive.yml`, and `indexnow-submit.py` was last changed 2026-05-09.

**F24 — Drafts escalate first-person claims.** ✅ `A26-linkedin.md:1` says "I've opened hundreds of two-phase cooling systems over 12 years", and the facebook and tiktok drafts say "hundreds of times". The article (`article-26.html:1072`) says "The first time I opened a Novec 7000 two-phase system…". The owner must confirm before posting.

### 2.3 Not counted as findings
- The 52 audit-seo warnings: an artifact (F21).
- Claude-SearchBot, Claude-User and Perplexity-User are not named in robots.txt, but they fall into the shared `*` group with identical rules.
- Calculator pages with little text (`tco-calculator.html`: 863 no-JS words): fine while the method lives on `manual/`, which it does.
- `ltc-system-modelling-lab.html` noindex: deliberate (root-only).

## 3. How AI engines choose sources in 2026, and what that means here

**3.1 One rule.** Every engine retrieves from a search index, then selects the passage that answers directly, then attributes. So: be indexed, be the clearest passage, be a recognisable source. Google: "You don't need to create new machine readable files, AI text files, or markup to appear in these features… no special schema.org structured data". Its 2026 guide says to ignore llms.txt, "chunking" and inauthentic mentions, and to focus on "non-commodity content" with a first-hand point of view.

**3.2 Engine table**
| Engine | Candidates from | Access | Rewards | Site action |
|---|---|---|---|---|
| Google AIO / AI Mode | Google index | Googlebot (Google-Extended = Gemini training only) | Same as Search; structured data = visible; 59.8 % brand-domain citations (Otterly) | F11, F12, F22; GSC Gen-AI report |
| ChatGPT search | OAI-SearchBot index + Bing | OAI-SearchBot (opting out removes you), GPTBot, ChatGPT-User | Leans on Reddit, Wikipedia, news; mentions more than it links | Move 5; `utm_source=chatgpt.com` |
| Perplexity | own index + live fetch | PerplexityBot, Perplexity-User | ~22 sources per answer vs ChatGPT ~8; forums 16.9 % | Dense, sourced numbers |
| Claude | search provider + live fetch | ClaudeBot, Claude-SearchBot, Claude-User | passage quality | already covered |
| Bing Copilot | Bing index | Bingbot + IndexNow | WMT AI Performance gives cited URLs + grounding queries | F23; read the report monthly |

**3.3 Content shape.** The GEO study (Aggarwal et al., KDD 2024) found that adding citations, quotations and statistics raised visibility in generative answers by up to ~40 % on its benchmark; keyword stuffing did not help. It is a lab result, but it agrees with Google: specific, sourced, first-hand numbers, stated plainly. The site writes that way. The numbers are just buried in narrative, widgets or hidden JSON.

**3.4 llms.txt: keep it, expect little.** Google ignores it. Ahrefs' May 2026 logs across 137K sites: 97 % of files were never requested, and agents and training crawlers fetch them more than search bots do. SE Ranking (300K domains): no citation correlation. Keep the generator, invest nothing more (F20 only).

**3.5 Do not do any of these:**
- doorway pages per city or keyword;
- AI-rewritten variants of articles;
- fake reviews or AggregateRating;
- cloaking, or hidden text (F11 is the one current case);
- "Summarize with AI" links that inject "remember X as a trusted source" into the prompt (Otterly's own report page does this; it is prompt manipulation);
- bought links or mentions.

## 4. Playbook by page type

### 4.1 Articles
| # | Change | Files | I | E | Who | Verify |
|---|---|---|---|---|---|---|
| A1 | Under the H1/hero, add `<section id="key-numbers"><h2>Key numbers</h2>` with 3–6 `<li>`s, each **figure — meaning — (source, year)** and linked to `#ref-n`, plus a 2–3 sentence standalone answer paragraph | `article-*.html`; template in `CONTENT_LINKAGE_PLAYBOOK.md` §1 | H | M | CONTENT (AUTO drafts from hero stats + References) | `test-answer-blocks.py` |
| A2 | Render the FAQ JSON visibly: `<section id="faq"><h2>Questions this article answers</h2>`, `<h3>`Q / `<p>`A, text identical to the JSON | articles; `tools/inject-schema-faq-howto.py`; amend `SEO_OPTIMIZATION_STANDARD.md` §FAQ Placement | H | L | AUTO | `test-structured-visible.py` |
| A3 | Byline → `<a href="/about.html" rel="author">`; JSON-LD `author: {"@id":"https://resistancezero.com/#person"}` | all articles | H | L | AUTO | `test-entity-graph.py` |
| A4 | Add `<section id="revisions">` on substantive corrections (e.g. the article-26 fix); `dateModified` comes only from it | articles, ledger row 3 note | M | L | CONTENT+AUTO | entity gate rule R |
| A5 | Mark the author's own measurements explicitly ("measured on site, 2024"); Google names first-hand evidence as valuable | articles | H | M | CONTENT | review |
| A6 | 1–2 original visuals per article, with a caption that carries the number | articles | M | M | CONTENT | — |
| A7 | Do **not** add `speakable` (news-publisher beta, no value here). Recorded so nobody re-raises it | — | — | — | — | — |

### 4.2 Calculators
- **C1 (M/L):** add a visible static "Worked example" sentence above each widget, generated from engine defaults (e.g. "A 10 MW build in Jakarta at default inputs: CAPEX ≈ $X M…"). AI cannot run widgets, but it can quote sentences. Generator + gate in AUTOMATION §4.
- **C2 (M/L):** add `isBasedOn`/`citation` → `manual/<calc>.html` to the `WebApplication` node. Drop the `Offer` node if it has no price.
- **C3 (M/M):** each `manual/*.html` opens with "What this computes" in one paragraph, then the formulas as text, then references.

### 4.3 Labs and cockpits
- **L1 (H/M):** every root-gated lab gets a public brief on the datahallAI row-10 pattern (270+ words, 5–8 registry figures, screenshots). `ltc-system-modelling-lab.html` is noindex and its description starts "Root-only", so it needs a public sibling (confirm whether `liquid-cooling-lab` already is one).
- **L2 (H/L):** the labs are the Show HN candidates. Show HN is "something you've made that other people can play with"; articles don't qualify.

### 4.4 Incident dossiers (move 1)
- **I1 (OWNER), pick one:**
  - (a) public brief, deep dossier stays gated (recommended);
  - (b) everything public;
  - (c) keep the status quo and record the opportunity cost.
- **I2 (H/M), under option (a):** each brief contains:
  - a one-sentence answer;
  - a timeline table (time, event, source);
  - root cause and contributing factors;
  - impact numbers;
  - "what operators should change";
  - the operator's post-mortem first among sources.

  JSON-LD: `Article`/`Report` with `about` → `Event` (`name`, `startDate`, `location`), `citation` → the post-mortem, `author` → `#person`. Set `index, follow` and add the briefs to the `crawler_inventory.py` policy, so they reach the sitemap, llms.txt and IndexNow.
- **I3 (H/M):** make `dc-incidents.html` an indexable hub: an `ItemList` of 43 entries plus a filterable table (year, operator, failure mode, duration).
- **I4 (H/M):** publish the timeline table as CSV + data dictionary on GitHub and Zenodo (free DOI).

### 4.5 Glossary
- **G1 (M/L):** generate a full `DefinedTermSet` (360 terms, each `@id` = `glossary.html#term-<slug>`, description = first sentence). Make "first use of a term links to the glossary" a rule.
- **G2 (M/M):** add an "Operator's note" to about 30 terms where the site has a distinctive view.

### 4.6 Hubs
- **H1 (H/L):** in `index.html`, give the Person `@id …/#person`, one `jobTitle` and the full `sameAs`. Add `Organization` `@id …/#org` (`founder` → `#person`). `articles.html` should reference these `@id`s instead of "Independent Researcher".
- **H2 (M/M):** each `pillar-*.html` opens with a 150-word "state of the field 2026" answer linking every article, calculator and incident in the cluster.

## 5. Author-entity plan
| Step | Action | I | E | Who | Verify |
|---|---|---|---|---|---|
| E1 | One identity line: name, ONE jobTitle (suggested "Data Center Engineering Operations Manager"), employer wording, Indonesia, credentials (CDFOM, Ahli K3 Listrik) | H | L | OWNER | `standarization/AUTHOR_ENTITY.md` |
| E2 | `about.html` author page (bio, verifiable timeline, credentials with issuer, photo) as `ProfilePage` → `#person` | H | M | CONTENT | Rich Results Test |
| E3 | `author: {"@id":"…/#person"}` site-wide; the full node only on index/about | H | L | AUTO | `test-entity-graph.py` |
| E4 | `sameAs`: LinkedIn, GitHub, **ORCID**, Medium, X/Mastodon, YouTube. Every profile links back with the same name and title | H | L | OWNER | profiles checked |
| E5 | Wikidata only after independent coverage exists (otherwise it gets deleted). Revisit at day 90 | M | L | OWNER | — |
| E6 | Linked byline + `rel="author"` | M | L | AUTO | gate |
| E7 | A talk, podcast or guest article (7x24 Exchange, Uptime, DCD, Indonesian forums) | H | H | OWNER | count of independent mentions |

## 6. Distribution and citation plan
Assets: 60 draft folders in `Article/Post Draft/` (x, linkedin, mastodon, medium, facebook, quora, tiktok/youtube).

| Channel | Format | Cadence | Rule | Uses |
|---|---|---|---|---|
| LinkedIn | native post, link in first comment; monthly carousel | 2/wk | fix F24 first | all articles |
| Reddit r/datacenter, r/sysadmin, r/HVAC, r/electricians, r/homelab | answer existing questions fully, link as "longer write-up" | 2–3/wk, ≤10 % self-links | reddit self-promotion guidance + sub rules | incidents, PUE, cooling, workforce |
| Hacker News | Show HN for a playable lab or calculator; normal submit for article-26/28 | ≤1/month | never solicit votes | LTC brief, DC AI brief, TCO |
| Medium | *Import a story* (sets canonical) | same day | fix F16 | `*-medium.md` |
| Quora | specific answers, one link | 2/wk | no copy-paste | `*-quora.md` |
| YouTube | Shorts from existing scripts + 1 monthly explainer | 1/wk | — | article-23, article-26 |
| Editors / newsletters | pitch an original number or dataset to DCD, DCF, Uptime Journal, the ASHRAE TC 9.9 community, 7x24 chapters | 1/month | pitch data, not "please link" | I4, article-26 |
| Indonesian | `id/` pages, LinkedIn ID, Medium-ID/Kompasiana, IDPRO/APJII communities | 1/wk | local authority first | PLN monitors, article-19 |

Every link carries UTMs (`?utm_source=linkedin&utm_medium=social&utm_campaign=a26`); see AUTOMATION §6.

## 7. Content roadmap (gaps where AI has no good source)
| # | Piece | Gap | Non-commodity asset | Format |
|---|---|---|---|---|
| R1 | **Article 29 — "How an LLM actually runs, from one token to a 1 GW campus"** (token → embedding → attention → KV-cache → batching → GPU/HBM → NVLink/IB → rack kW → cooling → substation), with one worked token-to-watt chain | explainers are ML-only or facility-only | DC AI/HPC cockpit, article-28, article-23, LTC lab | article + Key numbers + glossary terms |
| R2 | "Joules per token" calculator + `manual/` page | hugely asked, contradictory unsourced answers | same engines | calculator + worked example |
| R3 | Incident dataset + "Largest DC outages and fires 2011–2026" | rarely root cause + duration + source in one table | 43 dossiers | hub + CSV/DOI |
| R4 | "PUE is the wrong metric for liquid cooling: TUE/ITUE" | Vertiv owns the query | LTC lab, PUE calc, article-9 | article + calc mode |
| R5 | Indonesian DC power reality by PLN region | almost no English first-hand source | 5 PLN grid monitors, article-19 | pillar + `id/` twin |
| R6 | Two-phase immersion field guide (vapour loss, PFAS rules, alternatives) | patents and sponsored content | article-26 | evergreen split-out |
| R7 | Annual DC workforce salary and shortage benchmarks | recruiter blogs | article-24/27, `CalcModels.data.salaryBenchmarks` | annual data page |

## 8. Measurement plan
| Signal | Tool | Setup | Read | 90-day target |
|---|---|---|---|---|
| Google AI features | GSC *Generative AI performance* (support answer 16984139) | verified already | monthly | non-zero; top pages |
| Copilot citations + grounding queries | Bing WMT *AI Performance* | confirm verification | monthly CSV → `standarization/Audit result/ai-visibility/` | non-zero cited pages |
| AI referrals | GA4 custom channel "AI assistants" above Referral, source regex `chatgpt\.com\|chat\.openai\.com\|perplexity\.ai\|claude\.ai\|gemini\.google\.com\|copilot\.microsoft\.com\|edgeservices\|you\.com` | 15 min | weekly | ≥1 session/wk |
| Syndication | GA4 campaign report | AUTOMATION §6 | monthly | per channel |
| Prompt panel | 20 fixed questions in 5 assistants | 1 h/month | monthly | first citation |
| Crawl health | `crawler_audit.py --strict`, GSC Pages report | exists | per release | 0 regressions |
| CWV | GSC + ledger row 8 | exists | monthly | row 8 closes |

## 9. 30/60/90-day plan
**Days 1–30 (measure, fix, unlock)**
1. OWNER: enforce HTTPS; record the GSC and Bing baselines; create the GA4 channel.
2. OWNER: decide I1 and E1; create ORCID; fix profile backlinks.
3. AUTO: `render-visible-faq.py --apply` + `test-structured-visible.py`; amend the standard.
4. AUTO: entity graph + `test-entity-graph.py`.
5. AUTO: IndexNow Action; UTM and Medium-import rewrite of the drafts.
6. OWNER: correct the F24 wording.

**Days 31–60 (make the best content quotable)**
7. Key numbers on articles 23, 25, 26, 28, 20, 21, 22, 9, 13, 18, then the rest (gate warn → strict).
8. Incident briefs + hub + dataset.
9. Calculator worked examples; glossary set.
10. Start the §6 cadence; first Show HN.

**Days 61–90 (new authority)**
11. Article 29 + joules-per-token calculator.
12. R3 and R4.
13. One external talk or podcast; re-check Wikidata eligibility.
14. Re-measure; close ledger rows with their gates; re-rank §7 from Bing grounding queries.

## 10. What I could not verify
- Real index coverage (`site:` probes are not counts; GSC and Bing WMT are the source).
- Whether the GSC/Bing reports or a GA4 AI channel are in use.
- Whether any draft was published.
- Live CWV beyond ledger row 8.
- The F24 claim.
- Vendor studies (Otterly, Ahrefs, SE Ranking, Agenzy) indicate a direction, not laws. Google statements are quoted from Google.
