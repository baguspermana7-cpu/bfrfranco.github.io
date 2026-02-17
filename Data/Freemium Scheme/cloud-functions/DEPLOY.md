# Deploy ResistanceZero API to Google Cloud Run

## Architecture

```
resistancezero.com (static site)     resistancezero-api (Express API)
        │                                     │
   Cloud Run (nginx)                   Cloud Run (Node.js)
   us-central1                         us-central1
        │                                     │
        └───── firebase-config.js ────────────┘
                  API_BASE = "<api-url>"
```

- **Static site**: Already deployed via `Sandbox/Dockerfile` (nginx)
- **API backend**: `cloud-functions/Dockerfile` (Node.js) — this deployment guide

## Prerequisites

1. **Google Cloud SDK** installed
   ```bash
   # Windows: Download from https://cloud.google.com/sdk/docs/install
   # Or via winget:
   winget install Google.CloudSDK
   ```

2. **GCP Project** with billing enabled
   - Current project: Check `gcloud config get-value project`

3. **APIs enabled**:
   ```bash
   gcloud services enable run.googleapis.com cloudbuild.googleapis.com
   ```

4. **.env file** configured with real credentials (see `.env.example`)

## Quick Deploy (One Command)

```bash
cd "Sandbox/Data/Freemium Scheme/cloud-functions"
bash deploy.sh
```

The script reads `.env`, generates Cloud Run env vars, and deploys.

## Manual Deploy (Step by Step)

### Step 1: Authenticate

```bash
gcloud auth login
gcloud config set project YOUR_GCP_PROJECT_ID
```

### Step 2: Deploy

```bash
cd "Sandbox/Data/Freemium Scheme/cloud-functions"

gcloud run deploy resistancezero-api \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 3 \
  --set-env-vars "FIREBASE_PROJECT_ID=resistancezero-a5ad5" \
  --set-env-vars "FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@resistancezero-a5ad5.iam.gserviceaccount.com" \
  --set-env-vars "SUPABASE_URL=https://bizrikfjfyxtxykuipvv.supabase.co" \
  --set-env-vars "MAYAR_API_BASE=https://api.mayar.id/hl/v1" \
  --set-env-vars "FROM_EMAIL=ResistanceZero <noreply@resistancezero.com>" \
  --set-env-vars "PORT=8080" \
  --set-env-vars "ADMIN_EMAILS=bagusdpermana7@gmail.com"
```

Then set secrets separately (values with special characters):
```bash
# Supabase service role key
gcloud run services update resistancezero-api --region us-central1 \
  --update-env-vars "SUPABASE_SERVICE_ROLE_KEY=<your-key>"

# Mayar API key
gcloud run services update resistancezero-api --region us-central1 \
  --update-env-vars "MAYAR_API_KEY=<your-key>"

# Firebase private key (use single quotes to preserve \n)
gcloud run services update resistancezero-api --region us-central1 \
  --update-env-vars 'FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nMII...\n-----END PRIVATE KEY-----\n'

# Allowed origins
gcloud run services update resistancezero-api --region us-central1 \
  --update-env-vars "ALLOWED_ORIGINS=https://resistancezero.com"
```

### Step 3: Verify

```bash
# Get service URL
gcloud run services describe resistancezero-api --region us-central1 --format="value(status.url)"

# Test health endpoint
curl https://resistancezero-api-XXXXX.us-central1.run.app/health
```

Expected response:
```json
{"status":"ok","version":"2.0.0","auth":"firebase","timestamp":"2026-02-17T..."}
```

## Post-Deploy Steps

### 1. Update Frontend API_BASE

Edit `Sandbox/firebase-config.js`:
```javascript
const API_BASE = 'https://resistancezero-api-XXXXX.us-central1.run.app';
```

### 2. Redeploy Static Site

```bash
cd Sandbox
gcloud run deploy resistancezero --source . --region us-central1
```

### 3. Update Mayar Webhook URL

Go to **Mayar Dashboard** > Settings > Webhook, set URL to:
```
https://resistancezero-api-XXXXX.us-central1.run.app/api/webhook/mayar
```

### 4. Test End-to-End

```bash
# Health check
curl https://resistancezero-api-XXXXX.us-central1.run.app/health

# Test CORS (from browser console on resistancezero.com)
fetch('https://resistancezero-api-XXXXX.us-central1.run.app/health')
  .then(r => r.json()).then(console.log)
```

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `FIREBASE_PROJECT_ID` | Yes | Firebase project ID |
| `FIREBASE_CLIENT_EMAIL` | Yes* | Service account email |
| `FIREBASE_PRIVATE_KEY` | Yes* | Service account private key |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key |
| `MAYAR_API_KEY` | Yes | Mayar API bearer token |
| `MAYAR_WEBHOOK_TOKEN` | No | For webhook verification (unused currently) |
| `MAYAR_API_BASE` | No | Defaults to `https://api.mayar.id/hl/v1` |
| `RESEND_API_KEY` | No | Email service (graceful skip if missing) |
| `FROM_EMAIL` | No | Sender email address |
| `PORT` | No | Defaults to 8080 (Cloud Run sets this) |
| `ALLOWED_ORIGINS` | Yes | Comma-separated allowed CORS origins |
| `ADMIN_EMAILS` | Yes | Comma-separated admin email addresses |

*On Cloud Run in the same GCP project as Firebase, Application Default Credentials (ADC) work automatically. Set `FIREBASE_PROJECT_ID` only and skip the service account credentials.

## Troubleshooting

**CORS errors**: Ensure `ALLOWED_ORIGINS` includes `https://resistancezero.com`

**Firebase auth fails**: Check `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY` are set. On Cloud Run, if using ADC, ensure the default service account has Firebase Admin role.

**Webhook not received**: Check Mayar webhook URL points to `/api/webhook/mayar` (not just `/webhook`). The service must be `--allow-unauthenticated`.

**View logs**:
```bash
gcloud run services logs read resistancezero-api --region us-central1 --limit 50
```
