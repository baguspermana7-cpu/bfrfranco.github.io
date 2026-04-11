# MAINTENANCE-WORKFLOW.md
# Monthly & Triggered Maintenance Routines

---

## MONTHLY MAINTENANCE (Run 1st of each month)

### Phase 1: Health Check (15 min)
```bash
cd /home/baguspermana7/rz-work
python3 tools/"Auto Update All"/engine/health-check.py
# Review output: fix all CRITICAL before anything else
```

### Phase 2: Data Validation (30 min)
```bash
python3 tools/"Auto Update All"/engine/validate-stats.py
# Reviews all pages for statistics with dates >12 months ago
# Output: list of pages + specific stats to update
```

**Common stats that expire:**
- Uptime Institute annual survey results (published ~April each year)
- IDC DC market size numbers (updated quarterly)
- Gartner predictions (updated annually)
- Energy pricing benchmarks (US, EU, SEA — quarterly)
- Carbon intensity data (annually)
- DC construction cost indices (quarterly)

### Phase 3: SEO Health (15 min)
```bash
python3 tools/"Auto Update All"/engine/validate-seo.py
# Checks: meta tags present, schema valid, sitemap sync, search-index sync
```

Fix any pages where:
- `<title>` is missing or >65 chars
- `<meta name="description">` missing or >165 chars
- New pages not in sitemap.xml
- New pages not in search-index.json

### Phase 4: Link Check (20 min)
```bash
python3 tools/"Auto Update All"/engine/validate-links.py
# Finds: broken internal links, series nav disabled that should be enabled
```

Most common link issues:
- Article series nav "Next" link still disabled after next article published
- Hub pages (articles.html) referencing old article order
- Comparison pages linking to removed/renamed pages

### Phase 5: Consistency Check (15 min)
```bash
python3 tools/"Auto Update All"/engine/validate-consistency.py
# Checks: navbar pattern, footer presence, theme toggle, cookie banner
```

### Phase 6: Security Scan (10 min)
```bash
python3 tools/"Auto Update All"/engine/validate-security.py
# Checks: inline event handlers, hardcoded API keys, unsafe innerHTML usage
```

### Phase 7: Commit Maintenance Changes
```bash
git add -p  # Review each change before staging
git commit -m "chore: monthly maintenance $(date +%Y-%m)"
git push
```

---

## TRIGGERED MAINTENANCE

### After New Uptime Institute Report (April each year)
1. Read the new report (uptime.com/research-and-reports)
2. Update all articles citing Uptime statistics:
   - PUE averages (e.g., "global average PUE 1.58")
   - Outage rates and causes
   - Staffing and shortage numbers
3. Update calculator default values if benchmarks changed
4. Update sitemap `<lastmod>` for modified pages
5. git commit -m "fix: update Uptime Institute [year] statistics across articles"

### After Industry Incident or Breaking News
1. Check if any article angle is now disproven or outdated
2. Add `<div class="article-update-note">` block to relevant articles with new info
3. Update article `<meta name="date">` and sitemap lastmod
4. Create timely social posts (X Posts only, within 24 hours)

### After Security Incident
1. STOP all other work
2. Run: `python3 tools/"Auto Update All"/engine/validate-security.py`
3. Check: auth.js for exposed keys
4. Check: firebase-config.js, supabase-auth.js for exposed keys
5. Check: Any hardcoded API keys in HTML files
6. Fix CRITICAL issues before any push
7. If keys were exposed: rotate immediately (Supabase, Firebase, Gemini)

### After Adding New Page Type
1. Add pattern to SITE-TREE.md
2. Add validation rule to relevant engine script
3. Update AGENT-GUIDE.md if the pattern is new
4. Update standarization/ doc if needed

---

## DATA FRESHNESS RULES

| Data Type | Max Age | Source |
|-----------|---------|--------|
| PUE industry average | 12 months | Uptime Institute Annual Report |
| DC market size (GW) | 6 months | IDC, CBRE, JLL |
| Engineer shortage % | 12 months | Uptime/Gartner |
| Carbon intensity | 12 months | IEA, national grids |
| Energy pricing | 6 months | EIA, Eurostat, regional sources |
| Regulatory text | When law changes | EU/US/ASEAN regulators |
| Vendor product specs | Vendor-specific | Manufacturer pages |
| Compliance standards | When revised | ASHRAE, TIA, NFPA, ISO |

---

## IMPROVEMENT BACKLOG

When you identify improvements during maintenance, add them to:
`standarization/Improvement Plan/`

Format for new improvement ideas:
```markdown
## [Improvement Title]
**Type:** UI/UX | SEO | Performance | Content | Security
**Priority:** High | Medium | Low
**Affects:** [list of pages or systems]
**Description:** [what to improve and why]
**Effort:** [estimated lines changed or files affected]
```

---

## ROLLBACK PROCEDURE

If a maintenance commit breaks something:
```bash
# View recent commits
git log --oneline -10

# Revert specific commit
git revert [commit-hash]

# Or reset to previous state (DESTRUCTIVE — confirm first)
git reset --hard [commit-hash]
git push --force  # Only if not yet public on production
```

If .min files are corrupted:
```bash
# Rebuild from source
cleancss styles.css -o styles.min.css
terser script.js -o script.min.js --compress --mangle
terser auth.js -o auth.min.js --compress --mangle
cleancss styles-index.css -o styles-index.min.css
```
