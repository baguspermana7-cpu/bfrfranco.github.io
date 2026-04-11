# Auto Update All — ResistanceZero Maintenance Engine
# Last updated: 2026-04-11

This folder contains the complete maintenance and update engine for resistancezero.com.

---

## Quick Start

```bash
cd /home/baguspermana7/rz-work

# Full health check (runs all validators)
python3 tools/"Auto Update All"/engine/health-check.py

# Individual checks
python3 tools/"Auto Update All"/engine/validate-links.py
python3 tools/"Auto Update All"/engine/validate-seo.py
python3 tools/"Auto Update All"/engine/validate-consistency.py
python3 tools/"Auto Update All"/engine/validate-stats.py
python3 tools/"Auto Update All"/engine/validate-security.py
```

---

## What This Engine Does

1. **Health Checks** — Validates every page for broken links, missing meta, SEO issues, security vectors, and stale data
2. **Consistency Enforcement** — Ensures all pages have correct navbar, footer, theme toggle patterns
3. **Workflow Guides** — Step-by-step playbooks for creating articles, calculators, and updates
4. **Agent Prompts** — Ready-to-use prompts for common maintenance tasks
5. **Site Tree** — Living inventory of all 125+ pages

---

## File Structure

```
tools/Auto Update All/
├── README.md                    ← You are here
├── AGENT-GUIDE.md               ← Single file for agent context (READ THIS FIRST)
├── SITE-TREE.md                 ← Complete page inventory (125+ files)
├── engine/
│   ├── health-check.py          ← Master runner (calls all validators)
│   ├── validate-links.py        ← Internal link checker
│   ├── validate-seo.py          ← Meta, schema, sitemap sync
│   ├── validate-consistency.py  ← Navbar, footer, theme patterns
│   ├── validate-stats.py        ← Flags statistics >12 months old
│   └── validate-security.py    ← XSS vectors, hardcoded keys
├── workflows/
│   ├── ARTICLE-WORKFLOW.md      ← 18-step article build pipeline
│   ├── CALCULATOR-WORKFLOW.md   ← Calculator creation checklist
│   ├── FF-WORKFLOW.md           ← Future Forward article specifics
│   ├── POST-PUBLISH-WORKFLOW.md ← After publish: sitemap, search-index, drafts
│   └── MAINTENANCE-WORKFLOW.md  ← Monthly maintenance routine
└── prompts/
    ├── create-article.md        ← Paste to start a new article session
    ├── create-calculator.md     ← Paste to start a new calculator
    └── run-maintenance.md       ← Paste to run a maintenance session
```

---

## Critical Agent Rule

**Before any session involving rz-work: read `AGENT-GUIDE.md` first.**

It contains:
- Complete site architecture
- All naming conventions
- Workflow sequences
- What NOT to do (common mistakes)
- Server/environment setup
- Standards document index

---

## When to Run Maintenance

| Trigger | Action |
|---------|--------|
| New article published | Run validate-seo.py + validate-links.py |
| CSS/JS changed | Rebuild .min files, run validate-consistency.py |
| Monthly (1st of month) | Full health-check.py run |
| Industry reports updated (Q1/Q2) | Run validate-stats.py, update affected pages |
| Security concern | Run validate-security.py immediately |
| New calculator added | Run validate-seo.py to check sitemap/search-index |

---

## Health Report Output

`health-check.py` generates a report at:
`tools/Auto Update All/HEALTH-REPORT-YYYY-MM-DD.md`

Report sections:
- CRITICAL — must fix before any push
- WARNING — fix within 48 hours
- INFO — nice to have
- PASS — all good

---

## Continuing Improvement Philosophy

This engine is designed for **continuous improvement**, not just maintenance:

1. **Data stays valid** — Statistics flagged when >12 months old
2. **SEO stays current** — New AI engine patterns applied retroactively
3. **UI stays consistent** — Navbar/footer/theme patterns enforced across all pages
4. **Security stays clean** — XSS vectors and hardcoded keys detected early
5. **Content stays unique** — No derivative or outdated angles allowed

Every new article, calculator, or feature learned is folded back into the workflows and prompts so future work benefits automatically.
