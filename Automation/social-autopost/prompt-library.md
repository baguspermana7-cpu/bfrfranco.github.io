# Prompt Library For AI Social Autopost

This file contains reusable prompts for future autopost runs. These prompts assume the AI has access to:
- draft files
- browser automation tools
- desktop/browser session context
- artifact storage

## 1. Campaign operator prompt

Use this to run a normal autopost campaign:

```text
Read the social draft folder for this article and prepare platform-specific posts for X, Mastodon, and Quora.

Requirements:
- validate each draft against platform limits
- do not rewrite unless needed for fit, clarity, or compliance
- prefer official APIs where available
- if API is not available, use browser automation against the browser/session that is already logged in on this machine
- verify every successful post with a URL, screenshot, or page-state proof
- save failure artifacts for any unsuccessful attempt
- keep a concise log of what worked, what failed, and why

Execution order:
1. inspect draft files
2. confirm best posting strategy per platform
3. publish one platform at a time
4. verify each platform before moving to the next
5. summarize outcomes with links and blockers
```

## 2. Platform strategy prompt

Use this before any automation starts:

```text
Determine the best posting method for each target platform using this priority:
1. official API
2. browser automation using the same browser family as the active logged-in session
3. GUI automation fallback

For each platform, output:
- chosen method
- why that method is preferred
- key technical risks
- success verification plan
- fallback if the first method fails
```

## 3. Browser automation prompt

Use this when the AI needs to drive the site through a logged-in browser session:

```text
Automate posting through the live authenticated browser context on this machine.

Rules:
- do not assume fresh Chromium is trusted just because cookies are present
- prefer the same browser engine family as the current authenticated session
- save a screenshot and HTML snapshot before publish if the DOM is unstable
- after publish, verify using a stable profile page, permalink, or visible content proof
- if you encounter CAPTCHA, Cloudflare, or human verification, pause the automation path, save artifacts, and classify it as a manual checkpoint blocker
```

## 4. Debug prompt for a failing platform

Use this when a platform flow is failing:

```text
The current posting path is failing. Do not keep brute-forcing the same interaction.

Instead:
1. identify whether the blocker is auth, anti-bot, selector instability, overlay interception, or localization
2. save current HTML and screenshot artifacts
3. inspect the live DOM around the target editor and publish button
4. propose the smallest targeted patch to the current method
5. rerun only that platform, not the whole campaign
6. update the working/not-working matrix
```

## 5. Prompt for X

```text
Publish the prepared X post from the draft folder.

Requirements:
- verify character count first
- open the authenticated compose flow
- ensure the DraftJS editor actually contains the intended text before clicking Post
- if the Post button is blocked by an overlay, use a safe DOM-level click fallback
- after publishing, verify success by checking the account profile or direct permalink evidence
- save screenshots before and after post
```

## 6. Prompt for Mastodon

```text
Publish the prepared Mastodon posts as a thread.

Requirements:
- prefer API-first if an authenticated token can be derived safely from the live session
- post in order
- capture resulting URLs
- confirm the thread items exist
- if API-first fails, fall back to browser automation
```

## 7. Prompt for Quora

```text
Publish the prepared Quora post using the authenticated browser session.

Requirements:
- expect localization differences in labels and button text
- expect Cloudflare or human verification checkpoints
- save screenshots and HTML after opening the composer
- verify that text is actually in the editor before searching for the final publish button
- if the final publish button is ambiguous, inspect all visible buttons and classify the blocker rather than guessing blindly
- do not treat Quora as unattended-safe unless the full composer-to-publish flow has been verified in this exact environment
```

## 8. Prompt for artifact discipline

```text
For every platform attempt, store:
- timestamp
- chosen method
- pre-publish screenshot
- failure screenshot if any
- failure HTML if any
- post-publish screenshot
- final URL or verification proof

At the end, produce:
- success matrix
- failure matrix
- next improvements
```

## 9. Prompt for documentation after the run

```text
Document the run as an engineering retrospective.

Include:
- methods attempted
- why each method was chosen
- what worked
- what failed
- exact blocker type
- lessons learned
- recommended default path per platform
- future improvements
- reusable prompt templates
```

## 10. Recommended master prompt

Use this as the default reusable master prompt:

```text
Use AI to publish this article across the target social platforms.

You must operate like an engineering system, not like a generic assistant.

Objectives:
- read the post drafts from the provided folder
- validate each platform draft
- choose the best publish method per platform
- publish one platform at a time
- verify each post
- save artifacts for both success and failure
- document lessons learned for reuse

Method priority:
1. official API if reliable
2. browser automation using the same browser family as the authenticated session
3. GUI-level automation only as fallback

Rules:
- never assume cookie import recreates full platform trust
- do not keep retrying the same broken interaction without collecting artifacts
- if anti-bot, CAPTCHA, or Cloudflare appears, classify it explicitly
- if selector issues appear, inspect live DOM around the actual editor and publish button
- after a success, verify with a stable profile page, post URL, or visible text proof
- after a failure, save screenshots, HTML, and error notes

Deliverables:
- posted URLs
- what worked / what failed
- a reusable playbook update
```
