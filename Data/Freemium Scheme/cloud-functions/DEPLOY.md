# Deploy to Google Cloud Run

## Prerequisites
- gcloud CLI installed and authenticated
- Project: your GCP project ID
- Region: asia-southeast2 (Jakarta)

## 1. First-time setup
```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
gcloud config set run/region asia-southeast2
```

## 2. Build & deploy
```bash
cd cloud-functions

gcloud run deploy resistancezero-api \
  --source . \
  --region asia-southeast2 \
  --allow-unauthenticated \
  --set-env-vars "SUPABASE_URL=https://xxx.supabase.co" \
  --set-env-vars "SUPABASE_ANON_KEY=eyJ..." \
  --set-env-vars "SUPABASE_SERVICE_ROLE_KEY=eyJ..." \
  --set-env-vars "MAYAR_API_KEY=your_key" \
  --set-env-vars "MAYAR_API_BASE=https://api.mayar.id/hl/v1" \
  --set-env-vars "ALLOWED_ORIGINS=https://resistancezero.com" \
  --set-env-vars "ADMIN_EMAILS=bagus@resistancezero.com"
```

## 3. Get the URL
After deploy, Cloud Run gives you a URL like:
`https://resistancezero-api-xxxxx-et.a.run.app`

## 4. Register webhook in Mayar
Go to Mayar Dashboard > Settings > Webhook, register:
`https://resistancezero-api-xxxxx-et.a.run.app/api/webhook/mayar`

## 5. Test
```bash
curl https://resistancezero-api-xxxxx-et.a.run.app/health
```
