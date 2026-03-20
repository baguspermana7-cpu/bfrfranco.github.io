# AI Social Autopost Playbook

This document captures the real methods tested during the Article 17 posting run, what worked, what failed, what should be improved, and how to reuse the approach for future social posting.

Scope of this playbook:
- Use AI to prepare, validate, and publish social posts
- Work from an already logged-in desktop browser session when official APIs are unavailable
- Keep evidence, logs, and verification artifacts
- Separate reliable methods from experimental ones

Reference campaign:
- Draft folder: `/home/baguspermana7/rz-work/Article/Post Draft/Article 17 - SEA DC Opportunity`
- Platforms attempted: `Mastodon`, `X`, `Quora`

## Final outcome from this run

What worked:
- `Mastodon`: successful
- `X`: successful

What did not complete:
- `Quora Post`: not fully completed
- `Quora Answer`: intentionally dropped later by request

Confirmed published outputs:
- Mastodon post 1: `https://mastodon.social/@bagusdpermana7/116250509195383242`
- Mastodon post 2: `https://mastodon.social/@bagusdpermana7/116250509236083110`
- Mastodon post 3: `https://mastodon.social/@bagusdpermana7/116250509298076426`
- X post verification path used: `https://x.com/bagusdwiperman9`

## Methods tested

### Method 1: Direct API via session token

Description:
- Extract authenticated web session data from the logged-in browser state
- Call the platform API directly without UI automation

Where it was used:
- `Mastodon`
- `X`

Result:
- `Mastodon`: worked well
- `X`: failed due anti-automation defense

Why Mastodon worked:
- Mastodon has a clean REST API
- The authenticated session token from the logged-in page was enough
- No aggressive anti-bot challenge blocked the request

Why X failed:
- Raw GraphQL call returned platform anti-automation error `226`
- Even with cookies, bearer token, and extracted query metadata, the request was still classified as automated

Lesson:
- API-first is the best path when the platform permits it
- For closed or adversarial platforms, direct calls from browser-derived tokens are fragile

### Method 2: Playwright Chromium with imported Firefox cookies

Description:
- Launch Chromium via Playwright
- Import cookies extracted from the active Firefox profile
- Open composer pages and automate typing/clicking

Where it was used:
- `X`
- `Quora`

Result:
- `X`: unreliable
- `Quora`: unreliable

Observed issues:
- `X`: black screen / partial load / compose state not always usable
- `X`: DraftJS editor sometimes visible but text did not reliably stick
- `Quora`: Cloudflare human verification appeared
- `Quora`: page routing and selector resolution were inconsistent

Root cause:
- Browser engine mismatch matters
- Session cookies alone do not fully recreate trusted browser state
- Bot detection is not just cookie-based; it also uses behavior, browser fingerprinting, and runtime checks

Lesson:
- Do not assume `cookie import = same logged-in browser`
- For adversarial sites, Playwright in a fresh Chromium context is often too synthetic

### Method 3: Selenium + copied Firefox profile

Description:
- Copy the active Firefox profile into `/tmp`
- Launch Firefox automation against that copied profile

Result:
- Failed during session startup

Observed issue:
- Firefox session creation failed on preference bootstrap
- Copied profile state conflicted with Selenium/geckodriver expectations

Lesson:
- Copying a large live Firefox profile is brittle
- It introduces preference, lock, compatibility, and runtime issues

### Method 4: Selenium Firefox fresh profile + imported cookies

Description:
- Launch Firefox engine directly through `geckodriver`
- Use a fresh automated browser profile
- Import cookies from the active Firefox session snapshot
- Navigate to live pages and automate interactions

Where it was used:
- `X`
- `Quora`

Result:
- `X`: worked
- `Quora`: page access worked, final posting flow still incomplete

Why this was the best method:
- Same browser engine family as the user’s real session
- Less synthetic than Chromium fallback in this environment
- Stable enough to reach live pages and interact with actual UI state

For X, this method reached:
- `https://x.com/compose/post`
- Text entry into the DraftJS composer
- Enabled `Post` button
- Successful click using scroll + JS click fallback
- Verification on profile page

For Quora, this method reached:
- `https://id.quora.com/`
- Home feed with authenticated state
- Ask/share composer prompt
- Post tab flow
- But final publish button handling remained unresolved in this run

Lesson:
- If the user is logged in on Firefox, Firefox-based automation is the best fallback when APIs are not available

### Method 5: Existing Firefox GUI control

Description:
- Control the already-open logged-in browser at OS level

Result:
- Not fully used in this run

Reason:
- Desktop session was `Wayland`
- Common GUI automation tools like `xdotool` were not available
- GUI-level automation on Wayland needs different tooling and more setup

Lesson:
- This remains a viable future path, but only after standardizing the desktop automation layer

## What is working vs not working

### Working now

`Mastodon`
- Best method: direct authenticated API
- Reliability: high
- Recommendation: keep API-first permanently

`X`
- Best method from this run: Selenium on Firefox engine with imported cookies
- Reliability: medium
- Recommendation: use only when official API is unavailable or unsuitable

### Partially working

`Quora`
- Authenticated home access: working
- Composer entry: partially working
- Final publish flow: not yet standardized

### Not working reliably

`X` direct web API emulation
- Anti-bot response makes it weak for repeatable automation

`Playwright Chromium + imported Firefox cookies`
- Too fragile for platforms with stronger runtime trust checks

`Copied Firefox profile automation`
- Too brittle to recommend

## Why X succeeded but Quora did not

`X`
- We had a stable compose URL
- We had stable DOM anchors like:
  - `data-testid="tweetTextarea_0"`
  - `data-testid="tweetButtonInline"`
- Verification path was simple:
  - go to user profile
  - confirm snippet appears in page source

`Quora`
- UI was localized to Indonesian
- Composer flow was multi-step and less stable
- Post publish button label/state was less obvious after composer opened
- Some sessions encountered Cloudflare or anti-bot friction
- DOM was more component-heavy and less deterministic

## Recommended architecture for future AI autopost

### Rule 1: Use per-platform adapters

Do not build one generic “social post bot”.

Build one adapter per platform:
- `mastodon_adapter`
- `x_adapter`
- `quora_adapter`

Each adapter should define:
- login/session strategy
- draft constraints
- publish strategy
- success verification strategy
- fallback strategy

### Rule 2: Prefer official APIs when they exist

Priority order:
1. Official API with scoped auth
2. Browser automation on the same engine family as the user’s active browser
3. GUI automation only if browser automation cannot complete the flow

### Rule 3: Separate planning from posting

The AI flow should be:
1. Read article/post drafts
2. Validate length and platform fit
3. Produce final per-platform post text
4. Confirm target platform strategy
5. Publish
6. Verify
7. Save evidence

### Rule 4: Keep artifacts for every attempt

For each platform attempt, save:
- screenshot before publish
- screenshot after publish
- HTML snapshot on failure
- final URL or proof of success
- error classification

### Rule 5: Build manual checkpoint mode

Some platforms will require human intervention for:
- CAPTCHA
- Cloudflare
- suspicious login challenge
- 2FA

The automation framework should support:
- pause
- notify human
- resume after challenge is cleared

## Standard operating flow

### Phase A: Content preparation

Input:
- article URL
- per-platform drafts
- user publishing instructions

Checks:
- X character count
- Mastodon character count
- Quora formatting cleanup
- hashtags and link placement
- locale or language expectations

### Phase B: Session readiness

Checks:
- which browser holds the active session
- session type: X11 or Wayland
- whether cookies can be exported
- whether official API exists

### Phase C: Platform execution

Per platform:
- select best method
- publish
- verify
- save output

### Phase D: Reporting

Return:
- what was posted
- URLs
- what failed
- why it failed
- next improvement items

## Improvement backlog

### High priority

- Add persistent reusable code under workspace, not `/tmp`
- Build a clean cookie-export utility
- Add a `manual checkpoint` mode for Quora and other sites with Cloudflare/CAPTCHA
- Add structured logging and artifact folders by platform/date
- Add success verification functions per platform

### Medium priority

- Add localization dictionaries for English/Indonesian UI labels
- Add screenshot-diff or DOM-diff debug steps
- Add per-platform retry policy with bounded attempts
- Add safer post de-duplication checks

### Lower priority

- Add GUI automation fallback for Wayland
- Add scheduling support
- Add post queue support for multi-article campaigns

## Reusable implementation pattern

### Best current pattern

For `Mastodon`:
- Use API-first

For `X`:
- Use Firefox engine automation with imported cookies

For `Quora`:
- Use Firefox engine automation
- Expect manual checkpoint capability
- Do not treat it as fully unattended until the composer/publish flow is hardened

## Proposed folder structure

Recommended permanent structure:

```text
/home/baguspermana7/rz-work/Automation/social-autopost/
  README.md
  prompt-library.md
  scripts/
    firefox_publish_article17.py
    publish_article17_playwright.mjs
  artifacts/
    2026-03-18/
      x/
      mastodon/
      quora/
```

## Detailed prompts to use with AI

See:
- `/home/baguspermana7/rz-work/Automation/social-autopost/prompt-library.md`

## Concrete lessons from this run

1. `API-first beats UI automation` when the platform allows it.
2. `Cookie import is not equivalent to full session trust`.
3. `Browser-engine alignment matters`. Firefox session work should prefer Firefox automation.
4. `Quora is operationally harder than X` in this environment, despite X being more hostile at API level.
5. `Save artifacts early`. Without screenshots and HTML snapshots, the debugging loop is much slower.
6. `Per-platform logic is mandatory`. A universal posting script is the wrong abstraction.

## Recommended decision tree

Use this in future runs:

1. Is there an official publish API?
   - If yes, use it.
   - If no, continue.
2. Which browser currently holds the authenticated session?
   - Use that browser family first.
3. Can cookies alone recreate enough trust?
   - If yes, use browser automation.
   - If no, use manual checkpoint or GUI automation.
4. Is the platform protected by Cloudflare/CAPTCHA?
   - If yes, require resumable workflow.
5. Can success be verified from a predictable URL?
   - If no, add stronger evidence capture.

## Current recommendation

Production-worthy today:
- `Mastodon API flow`
- `Firefox Selenium X flow`

Experimental:
- `Quora Firefox flow`

Do not use as default:
- `Raw X API emulation`
- `Playwright Chromium + imported Firefox cookies`
- `Copied Firefox profile automation`
