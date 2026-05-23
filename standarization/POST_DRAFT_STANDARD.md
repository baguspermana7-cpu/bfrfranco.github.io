# POST DRAFT STANDARD

> **Status**: Active · v1 · 2026-05-24
> **Scope**: Every public HTML page shipped to resistancezero.com that
> deserves promotion must have a corresponding `Article/Post Draft/<slug>/`
> folder containing per-platform copy.
> **Mandate**: Codifies the handoff-mandate (2026-05-23) requirement that
> every shipped artefact gets propagated into the social-distribution lane.

---

## Folder location

```
Article/Post Draft/
├── <Page Slug Title Case>/
│   ├── linkedin.md       # required — ≤3000 chars
│   ├── medium.md         # required — SEO title ≤74 chars, free-tier safe
│   ├── x-post-1.md       # required — ≤280 chars (the hook)
│   ├── x-post-2.md       # optional — architecture / detail follow-up
│   ├── x-post-3.md       # optional — numbers / stat follow-up
│   ├── mastodon-1.md     # required — ≤500 chars (the hook)
│   ├── mastodon-2.md     # optional
│   ├── mastodon-3.md     # optional
│   ├── facebook.md       # required for high-traffic pages
│   ├── quora.md          # required for technical / answer-shaped pages
│   └── tiktok-script.md  # optional — 45-60 s talking-head script
```

## Mandatory files per page type

| Page type | linkedin | medium | x-1 | mastodon-1 | facebook | quora | tiktok |
|-----------|----------|--------|-----|------------|----------|-------|--------|
| Article (long-form) | ✅ | ✅ | ✅ | ✅ | ✅ | optional | optional |
| Calculator / tool | ✅ | ✅ | ✅ | ✅ | optional | optional | optional |
| Concept page (Pro tier) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | optional |
| Pillar / landing | ✅ | optional | ✅ | ✅ | optional | optional | optional |
| Compare page | optional | optional | ✅ | ✅ | optional | optional | optional |
| Hub (Knowledge Labs etc.) | ✅ | ✅ | ✅ | ✅ | optional | optional | optional |

## Per-platform rules

### LinkedIn
- Long-form ≤3000 chars.
- Open with a stat or a tension. Never open with "I'm excited to share."
- Five hashtags max, at the end only.
- "Link in comments" pattern (LinkedIn algorithm de-prioritises link-in-post).
- Personal voice. First person OK. Avoid corporate boilerplate.

### Medium
- SEO title ≤74 chars (Google SERP cap).
- Subtitle is mandatory.
- 5 tags maximum.
- **Free-tier**: do NOT use markdown bold (`**`). Medium free-tier renders weak. Use italics or section headers for emphasis.
- Run through a humaniser pass before publishing (per the existing mandate from Article 14 onward).
- Always cite primary sources inline.

### X / Twitter
- Hard cap 280 chars per post (Mastodon's 500 is the larger floor; X is the constraint).
- Threads of 2-3 posts only — never more (engagement drops sharply after 3).
- One link per thread, at the end, not in the hook.
- No emoji-spam. One emoji at most, only if it adds signal.

### Mastodon
- ≤500 chars per post.
- Two-line opening; technical detail second.
- Engineer-to-engineer tone. Low spin.
- Hashtag conventions: CamelCase only (`#DataCenter` not `#datacenter`) for screen-reader compatibility.

### Facebook
- ≤2000 chars.
- Conversational.
- No hashtags (Facebook de-prioritises them).
- Lead with a stat call-out.
- End with a genuine question — not a CTA.

### Quora
- Answer the question; do not pitch.
- ≤2 internal links per answer.
- Cite the underlying research / standard.
- Disclose author (link byline) only at the bottom.

### TikTok
- 45-60 seconds.
- Three-act structure: problem → architecture/answer → number that sticks.
- On-screen text for every spoken line.
- No royalty-free music slop. If audio is needed, instrument-grade synth or silence.

---

## When to create the folder

**Hard rule**: same commit as the page that ships, OR within the same session.
Never let a page ship without its draft folder. Per the handoff mandate this
is non-negotiable.

If a session ends with a shipped page lacking drafts, the next session MUST
generate them as a doc-propagation commit before any new feature work.

## When to refresh existing drafts

If a page evolves through ≥1 minor version (e.g. `spares-readiness-calculator`
went v1.11 → v1.16), the existing drafts are STALE and must be refreshed to
reflect the new capabilities and headline numbers.

## Char-count discipline

Every file should declare its target char count in a header comment and the
draft body should be within ±5% of that target. Use:

```
**Char count target**: ≤280
**Char count target**: ≤500
**Char count target**: ≤2000
```

A pre-publish sanity check is the author's responsibility, not the draft's.

## Reference voice

The reference voice is:

- Engineer-to-engineer
- Low-spin
- Cite primary sources
- Honesty about limitations beats hype every time
- No "I'm excited to share" / "thrilled to announce" / "humbled by"
- No emoji-spam, no rocket-ship 🚀, no fire 🔥

See existing drafts in `Article/Post Draft/Article 26 - PFAS Investigation/`
and `Article/Post Draft/AI Maintenance/` as canonical examples.

## Sync with CONTENT_LINKAGE_PLAYBOOK

Drafts are the social-distribution leg of CONTENT_LINKAGE_PLAYBOOK.
A page that has sitemap + search-index + llms.txt + OG-image entries
but no post drafts is incompletely propagated. The draft folder is the
last gate before a page is considered shipped.

---

## Changelog

- **v1 — 2026-05-24** — Codified per handoff mandate. AI Maintenance,
  Article 26, and Article 19 are canonical reference examples.
