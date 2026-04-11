# run-maintenance.md
# Paste this at the start of a maintenance session
# Use monthly OR when specific issues arise

---

## Session Context

I need to run maintenance on resistancezero.com. Start by reading:
1. Read `/home/baguspermana7/rz-work/tools/Auto Update All/AGENT-GUIDE.md`

Then run the full health check:
```bash
cd /home/baguspermana7/rz-work && python3 -m http.server 8081 &
python3 tools/"Auto Update All"/engine/health-check.py
```

Review the generated `HEALTH-REPORT-YYYY-MM-DD.md` file.

Fix issues in this priority order:
1. **CRITICAL** — Fix all before doing anything else
2. **WARNING** — Fix within this session if possible
3. **INFO** — Log for next session if time doesn't allow

**Specific maintenance tasks for this session:**
[ ] [Add specific tasks here — e.g., "Update Uptime Institute 2025 PUE stats"]
[ ] [e.g., "Enable Next link on article-26 once article-27 is published"]
[ ] [e.g., "Check all compare pages still have valid links"]

**After all fixes:**
```bash
git add -p  # Review each change
git commit -m "chore: maintenance [YYYY-MM]"
git push
```

Then run `/save-session` to capture this maintenance session.

---

## Common Maintenance Patterns

### Update a statistic across multiple pages
```bash
# Find all pages mentioning the stat
grep -r "global average PUE" /home/baguspermana7/rz-work --include="*.html" -l

# Update each file — use Edit tool, don't use sed
```

### Enable a series nav link
```html
<!-- Find this in article-N-1.html: -->
<a href="#" style="opacity:0.4;pointer-events:none;" class="series-nav-link series-nav-next">

<!-- Replace with: -->
<a href="article-N.html" class="series-nav-link series-nav-next">
```

### Add missing sitemap entry
```xml
<!-- Add before </urlset> in sitemap.xml: -->
<url>
  <loc>https://resistancezero.com/PAGE.html</loc>
  <lastmod>YYYY-MM-DD</lastmod>
  <changefreq>monthly</changefreq>
  <priority>0.7</priority>
</url>
```

### Rebuild minified files
```bash
cd /home/baguspermana7/rz-work
cleancss styles.css -o styles.min.css
terser script.js -o script.min.js --compress --mangle
# Only if index.html CSS changed:
cleancss styles-index.css -o styles-index.min.css
```
