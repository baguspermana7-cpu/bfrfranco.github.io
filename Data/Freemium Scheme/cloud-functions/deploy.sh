#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# ResistanceZero API — Cloud Run Deploy Script
# Usage: cd cloud-functions && bash deploy.sh
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

# ─── Configuration ─────────────────────────────────────────────
SERVICE_NAME="resistancezero-api"
REGION="us-central1"
GCP_PROJECT=""  # Leave empty to use current gcloud project

# ─── Colors ────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

echo -e "${GREEN}═══════════════════════════════════════════${NC}"
echo -e "${GREEN}  ResistanceZero API — Cloud Run Deployer  ${NC}"
echo -e "${GREEN}═══════════════════════════════════════════${NC}"
echo ""

# ─── Check prerequisites ──────────────────────────────────────
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}ERROR: gcloud CLI not found.${NC}"
    echo "Install: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check if authenticated
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null | head -1 | grep -q '@'; then
    echo -e "${YELLOW}Not authenticated. Running gcloud auth login...${NC}"
    gcloud auth login
fi

# Set project if specified
if [ -n "$GCP_PROJECT" ]; then
    gcloud config set project "$GCP_PROJECT"
fi

ACTIVE_PROJECT=$(gcloud config get-value project 2>/dev/null)
echo -e "GCP Project: ${GREEN}${ACTIVE_PROJECT}${NC}"
echo -e "Service:     ${GREEN}${SERVICE_NAME}${NC}"
echo -e "Region:      ${GREEN}${REGION}${NC}"
echo ""

# ─── Load .env ─────────────────────────────────────────────────
if [ ! -f .env ]; then
    echo -e "${RED}ERROR: .env file not found in current directory.${NC}"
    echo "Copy .env.example to .env and fill in your values."
    exit 1
fi

echo -e "${YELLOW}Loading environment variables from .env...${NC}"

# Parse .env into env.yaml for Cloud Run
# (env.yaml is in .dockerignore so it won't be included in the image)
python3 -c "
import re, sys
with open('.env') as f:
    for line in f:
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        m = re.match(r'^([A-Z_]+)=(.*)$', line)
        if m:
            key, val = m.group(1), m.group(2)
            # Strip surrounding quotes
            if val.startswith('\"') and val.endswith('\"'):
                val = val[1:-1]
            # Skip empty values
            if not val:
                continue
            # Escape for YAML
            print(f'{key}: \"{val}\"')
" > env.yaml 2>/dev/null || {
    # Fallback: manual parsing if python3 not available
    echo -e "${YELLOW}Python3 not found, parsing .env manually...${NC}"
    > env.yaml
    while IFS= read -r line; do
        # Skip comments and empty lines
        [[ -z "$line" || "$line" =~ ^# ]] && continue
        # Extract KEY=VALUE
        key="${line%%=*}"
        val="${line#*=}"
        # Strip quotes
        val="${val%\"}"
        val="${val#\"}"
        # Skip empty
        [ -z "$val" ] && continue
        echo "${key}: \"${val}\"" >> env.yaml
    done < .env
}

echo -e "${GREEN}Generated env.yaml with $(wc -l < env.yaml) variables${NC}"
echo ""

# ─── Show what will be deployed ────────────────────────────────
echo -e "${YELLOW}Environment variables to be set:${NC}"
while IFS= read -r line; do
    key="${line%%:*}"
    echo "  - $key"
done < env.yaml
echo ""

# ─── Confirm ───────────────────────────────────────────────────
read -p "Deploy $SERVICE_NAME to Cloud Run ($REGION)? [y/N] " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    rm -f env.yaml
    exit 0
fi

# ─── Deploy ────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}Deploying to Cloud Run...${NC}"
echo "This will use Cloud Build to build the Docker image and deploy."
echo ""

gcloud run deploy "$SERVICE_NAME" \
    --source . \
    --region "$REGION" \
    --platform managed \
    --allow-unauthenticated \
    --env-vars-file env.yaml \
    --memory 512Mi \
    --cpu 1 \
    --min-instances 0 \
    --max-instances 3 \
    --timeout 60 \
    --concurrency 80

# ─── Clean up ──────────────────────────────────────────────────
rm -f env.yaml

# ─── Get service URL ───────────────────────────────────────────
echo ""
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" --region "$REGION" --format="value(status.url)" 2>/dev/null)

if [ -n "$SERVICE_URL" ]; then
    echo -e "${GREEN}═══════════════════════════════════════════${NC}"
    echo -e "${GREEN}  DEPLOYMENT SUCCESSFUL${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════${NC}"
    echo ""
    echo -e "Service URL: ${GREEN}${SERVICE_URL}${NC}"
    echo -e "Health:      ${GREEN}${SERVICE_URL}/health${NC}"
    echo -e "Webhook:     ${GREEN}${SERVICE_URL}/api/webhook/mayar${NC}"
    echo ""
    echo -e "${YELLOW}NEXT STEPS:${NC}"
    echo "1. Test health: curl ${SERVICE_URL}/health"
    echo "2. Update firebase-config.js:"
    echo "   const API_BASE = '${SERVICE_URL}';"
    echo "3. Redeploy static site (from Sandbox/):"
    echo "   gcloud run deploy resistancezero --source . --region us-central1"
    echo "4. Update Mayar webhook URL in Mayar Dashboard:"
    echo "   ${SERVICE_URL}/api/webhook/mayar"
    echo ""
else
    echo -e "${RED}Could not retrieve service URL. Check deployment status:${NC}"
    echo "  gcloud run services list --region $REGION"
fi
