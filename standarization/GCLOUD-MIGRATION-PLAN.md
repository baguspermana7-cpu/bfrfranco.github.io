# Plan: Migrate resistancezero.com from GCloud Account Lama ke Account Baru

> **Scheduled**: 27 April 2026
> **Created**: 20 April 2026
> **Status**: Pending

## Context

Website resistancezero.com sedang **DOWN**. Saat ini di-host di Google Cloud Run pada account `bagusdpermana7@gmail.com` (project: `indigo-medium-320901`). User ingin memindahkan hosting ke account baru `baguspermana7@gmail.com` (project: `resistancezero-a1403`) yang memiliki $300 free credit.

---

## Current Infrastructure (Account Lama)

| Component | Detail |
|-----------|--------|
| **GCloud Account** | `bagusdpermana7@gmail.com` |
| **Project ID** | `indigo-medium-320901` |
| **Cloud Run Service** | `bfrfranco-github-io` (us-central1, ACTIVE) |
| **Other Services** | `website-bagus` (asia-southeast2, DOWN), `website-bagus-us` (us-central1) |
| **Container** | `nginx:alpine` — static site on port 8080 |
| **Image** | `us-central1-docker.pkg.dev/indigo-medium-320901/cloud-run-source-deploy/...` |
| **Source** | GitHub `baguspermana7-cpu/bfrfranco.github.io` |
| **CI/CD** | Cloud Build — auto-deploy on git push |
| **Specs** | 1 CPU, 512MiB RAM, max 20 instances, request-based billing, concurrency 80 |
| **Env Vars** | None (static site) |
| **Domain** | resistancezero.com (Hostinger registrar, **Cloudflare DNS**) |
| **Cloudflare** | Zone `dc7836829de37eaa023f440ea2d06814`, NS: `elliot`/`poppy.ns.cloudflare.com` |
| **DNS Records** | A records to Google IPs (216.239.32.21, etc.) for Cloud Run domain mapping |

### Key Local Files
| File | Purpose |
|------|---------|
| `/home/baguspermana7/rz-work/Dockerfile` | `nginx:alpine`, copies nginx.conf + site, port 8080 |
| `/home/baguspermana7/rz-work/nginx.conf` | Production config: security headers, caching, gzip, directory blocking |
| `/home/baguspermana7/rz-work/standarization/EMAIL_DOMAIN_CONFIG.md` | Full domain/DNS/email setup reference |
| `/home/baguspermana7/rz-work/firebase-config.js` | API_BASE points to old Cloud Run URL |

---

## Target (Account Baru)

| Component | Detail |
|-----------|--------|
| **GCloud Account** | `baguspermana7@gmail.com` |
| **Project ID** | `resistancezero-a1403` |
| **Free Credit** | $300 |
| **APIs Enabled** | None yet (Cloud Run, Cloud Build, Artifact Registry all need enabling) |

---

## Migration Steps

### Phase 1: Setup Account Baru (Browser)

1. Login ke GCloud Console sebagai `baguspermana7@gmail.com`
2. Select project `resistancezero-a1403`
3. Enable APIs (klik Enable di masing-masing):
   - Cloud Run API
   - Cloud Build API
   - Artifact Registry API
4. Verify billing aktif dengan $300 credit

### Phase 2: Login gcloud CLI (Terminal)

```bash
export PATH="$HOME/google-cloud-sdk/bin:$PATH"
gcloud auth login baguspermana7@gmail.com
gcloud config set project resistancezero-a1403
gcloud config list
```

### Phase 3: Deploy Cloud Run Service (Terminal)

```bash
cd /home/baguspermana7/rz-work

gcloud run deploy bfrfranco-github-io \
  --source . \
  --region us-central1 \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --max-instances 20 \
  --concurrency 80 \
  --timeout 300 \
  --allow-unauthenticated \
  --cpu-boost
```

### Phase 4: Setup CI/CD (Browser)

1. Cloud Build > Triggers > Connect Repository
2. Connect `baguspermana7-cpu/bfrfranco.github.io`
3. Create trigger: on push to `main` > auto-deploy
4. Test with minor git push

### Phase 5: Map Custom Domain (Terminal)

```bash
gcloud run domain-mappings create \
  --service bfrfranco-github-io \
  --domain resistancezero.com \
  --region us-central1
```

### Phase 6: Update Cloudflare DNS

Login Cloudflare > DNS for resistancezero.com:
- Cloud Run domain mapping uses same Google IPs (216.239.32/34/36/38.21)
- If IPs unchanged, NO DNS changes needed
- Old account domain mapping must be DELETED first to release the domain

### Phase 7: Update firebase-config.js

Update API_BASE to new Cloud Run URL (new project number).

### Phase 8: Verify

- `https://resistancezero.com` loads
- SSL valid
- git push triggers auto-deploy
- Billing uses $300 credit

### Phase 9: Cleanup Old Account

- Delete domain mapping on old project
- Stop/delete unused Cloud Run services
- Only after new site confirmed working

---

## Verification Checklist

- [ ] APIs enabled di project `resistancezero-a1403`
- [ ] `gcloud run deploy` succeeds
- [ ] CI/CD trigger active
- [ ] Domain mapping resistancezero.com active
- [ ] DNS resolves correctly
- [ ] HTTPS + valid SSL
- [ ] firebase-config.js updated
- [ ] Site loads at resistancezero.com
- [ ] Old domain mapping removed

---

## Important Notes

- **Hostinger** (domain registrar): NO changes needed, nameservers point to Cloudflare
- **Cloudflare DNS**: A records may stay the same if Google assigns same IPs
- **GitHub repo unchanged**: just reconnect to new GCloud project
- **No database migration**: static site, no env vars
- **Email routing**: unaffected (Cloudflare email routing stays)
- **CRITICAL ORDER**: Delete old domain mapping BEFORE creating new one (same domain can't be mapped to two projects)
