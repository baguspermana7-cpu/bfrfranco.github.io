# Social Autopost — ResistanceZero

Unified social media posting automation for ResistanceZero article distribution.

## Architecture

```
post_social.py          ← CLI orchestrator (plan/post/verify/report)
  ├── scripts/
  │   ├── common.py     ← Shared: driver, cookies, typing, CAPTCHA solver, capture
  │   ├── mastodon_adapter.py  ← Mastodon API posting (thread support)
  │   ├── x_adapter.py         ← X/Twitter Selenium Firefox posting
  │   └── quora_adapter.py     ← Quora Selenium + Cloudflare auto-solve/checkpoint
  ├── .env              ← Credentials (gitignored)
  ├── .env.example      ← Template
  └── artifacts/        ← Run artifacts (screenshots, HTML, JSON)
```

## Platform Methods

| Platform | Method | Reliability | Notes |
|----------|--------|-------------|-------|
| **Mastodon** | REST API + access token | High | Thread support via in_reply_to_id |
| **X** | Selenium Firefox + cookies | Medium | Cookie injection from Firefox snapshot |
| **Quora** | Selenium Firefox + cookies | Low-Medium | Auto CAPTCHA solve + human checkpoint fallback |

## Setup

### 1. Python environment

```bash
cd /home/baguspermana7/rz-work/Automation/social-autopost
python3 -m venv venv
source venv/bin/activate
pip install selenium
```

### 2. Configure .env

```bash
cp .env.example .env
# Edit .env with your actual credentials
```

**Mastodon token**: Go to mastodon.social → Settings → Development → click your app → copy "Your access token"

**Cookie file**: Export Firefox cookies using Cookie Quick Manager extension. Save as JSON.

### 3. Draft files

Place draft files in your article's post draft directory:

```
Article/Post Draft/Article XX/
  ├── x-post.txt           (single X post)
  ├── x-post-1.txt         (or multiple X posts)
  ├── x-post-2.txt
  ├── mastodon-post-1.txt  (Mastodon thread)
  ├── mastodon-post-2.txt
  ├── mastodon-post-3.txt
  └── quora-post.txt       (Quora post)
```

## Usage

### Plan (dry run)

```bash
source venv/bin/activate
python post_social.py plan --draft-dir "/path/to/drafts"
```

### Post to all platforms

```bash
python post_social.py post --draft-dir "/path/to/drafts"
```

### Post to specific platforms

```bash
python post_social.py post --draft-dir "/path/to/drafts" --platforms mastodon,x
python post_social.py post --draft-dir "/path/to/drafts" --platforms mastodon
python post_social.py post --draft-dir "/path/to/drafts" --platforms quora
```

### Verify posts exist

```bash
python post_social.py verify --draft-dir "/path/to/drafts"
```

### View results from a previous run

```bash
python post_social.py report --run-dir artifacts/post-20260320-143000
```

### JSON output

Add `--json` to any command for machine-readable output.

## Example: Post Article 22 Drafts

```bash
source venv/bin/activate
python post_social.py post \
  --draft-dir "/home/baguspermana7/rz-work/Article/Post Draft/Article 22" \
  --platforms mastodon,x
```

## Cloudflare / CAPTCHA Handling

For Quora (and potentially other sites with Cloudflare):

1. **Auto-solve** is attempted first — the script finds the Turnstile iframe checkbox and clicks it
2. If auto-solve fails, **human checkpoint** activates — the script pauses and waits for you to solve the CAPTCHA in the browser window
3. After solving, the script automatically resumes

## Artifacts

Each run creates a timestamped directory under `artifacts/`:

```
artifacts/post-20260320-143000/
  ├── run.json        ← Full manifest with results
  ├── mastodon/
  │   └── result.json
  ├── x/
  │   ├── x_post_1_posted.png
  │   ├── x_verify.png
  │   └── result.json
  └── quora/
      ├── quora_home.png
      ├── quora_posted.png
      └── result.json
```

## For Claude Code

When the user asks to post articles, use this workflow:

```bash
# 1. Check what's ready
cd /home/baguspermana7/rz-work/Automation/social-autopost
source venv/bin/activate
python post_social.py plan --draft-dir "/path/to/drafts"

# 2. Post
python post_social.py post --draft-dir "/path/to/drafts" --platforms mastodon,x

# 3. Verify
python post_social.py verify --draft-dir "/path/to/drafts"
```
