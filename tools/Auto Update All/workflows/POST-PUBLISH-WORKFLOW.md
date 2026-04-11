# POST-PUBLISH-WORKFLOW.md
# Everything that MUST happen after any new page is published
# Never skip steps — this is what keeps the site consistent

---

## After Publishing a New ARTICLE

### Immediate (same session)

```
1. [ ] articles.html — new card at TOP of grid, set badge "NEW"
       Change previous "NEW" badge to article number (e.g. "25")
       Update ticker: add new article (date + title), keep max 5 entries
       Update <head> prefetch links: article-N/N-1/N-2

2. [ ] article-N-1.html — enable "Next" series nav link:
       Change: href="#" style="opacity:0.4;pointer-events:none;"
       To:     href="article-N.html"

3. [ ] sitemap.xml — add entry:
       <url>
         <loc>https://resistancezero.com/article-N.html</loc>
         <lastmod>YYYY-MM-DD</lastmod>
         <changefreq>monthly</changefreq>
         <priority>0.8</priority>
       </url>

4. [ ] search-index.json — add entry at end of array:
       {"id": NEXT_ID, "title": "...", "url": "article-N.html", "type": "article", ...}
       Current max id as of 2026-04-11: 82

5. [ ] Post drafts — create 11 files at Article/Post Draft/Article N/:
       A{N}-x-post-1.md, A{N}-x-post-2.md, A{N}-x-post-3.md
       A{N}-mastodon-1.md, A{N}-mastodon-2.md, A{N}-mastodon-3.md
       A{N}-linkedin.md, A{N}-medium.md, A{N}-quora.md
       A{N}-facebook.md, A{N}-tiktok-script.md

6. [ ] Hero image — verify exists: assets/article-N-hero.webp
       If missing: process via Pillow (WebP, quality=80, max 1200px)

7. [ ] Build check:
       curl http://localhost:8081/article-N.html → 200
       curl http://localhost:8081/assets/article-N-hero.webp → 200

8. [ ] git add + commit + push
       git add article-N.html articles.html article-N-1.html sitemap.xml search-index.json
       git add "Article/Post Draft/Article N/"
       git add assets/article-N-hero.webp
       git commit -m "feat: publish article-N — [title]"
       git push
```

---

## After Publishing a New CALCULATOR (Standalone)

```
1. [ ] sitemap.xml — add entry (priority 0.7 for calculators)
2. [ ] search-index.json — add entry (type: "calculator")
3. [ ] index.html — add to calculators section if featured there
4. [ ] articles.html — add to tools/calculators section if listed
5. [ ] Dark mode toggle test — toggle works, icon swaps, localStorage persists
6. [ ] Disclaimer present and accurate
7. [ ] git commit + push
```

---

## After Publishing a NEW COMPARISON PAGE

```
1. [ ] sitemap.xml — add entry
2. [ ] search-index.json — add entry (type: "comparison")
3. [ ] Link to relevant articles and pillar pages
4. [ ] git commit + push
```

---

## After ANY CSS/JS Change

```
1. [ ] If styles.css changed:
       cleancss styles.css -o styles.min.css
       (if index.html affected) cleancss styles-index.css -o styles-index.min.css

2. [ ] If script.js changed:
       terser script.js -o script.min.js --compress --mangle

3. [ ] If auth.js changed:
       terser auth.js -o auth.min.js --compress --mangle

4. [ ] Visual check:
       Dark mode: [data-theme="dark"] overrides working
       Light mode: no invisible text, proper contrast
       Mobile: navbar hamburger, responsive layout

5. [ ] git commit: "chore: rebuild minified CSS/JS"
```

---

## Monthly Maintenance (Run 1st of each month)

```
1. [ ] python3 tools/"Auto Update All"/engine/health-check.py
       Review HEALTH-REPORT-YYYY-MM-DD.md output
       Fix all CRITICAL items before committing

2. [ ] Check for outdated statistics:
       python3 tools/"Auto Update All"/engine/validate-stats.py
       Update any stats >12 months old

3. [ ] Check all links work:
       python3 tools/"Auto Update All"/engine/validate-links.py

4. [ ] Security scan:
       python3 tools/"Auto Update All"/engine/validate-security.py

5. [ ] Update SITE-TREE.md if new pages were added

6. [ ] git commit -m "chore: monthly maintenance [month year]"
```

---

## Posting Schedule (Reference)

After publishing, post drafts should go out in this order:
1. X (Twitter) — Post 1 immediately on publish day
2. Mastodon — Post 1 same day
3. LinkedIn — Within 24 hours of publish
4. X — Post 2 next day
5. Mastodon — Post 2 next day
6. Medium — Within 48 hours (after humanizing)
7. Quora — Find relevant question, answer within 72 hours
8. Facebook — Within 72 hours
9. X — Post 3 one week after publish
10. Mastodon — Post 3 one week after
11. TikTok — Schedule when creating video (separate process)
