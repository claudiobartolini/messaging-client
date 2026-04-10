# Infra Setup — skynet-gcp-network

Hand this file to Claude Code. Claude can run all the commands below directly.

---

## Context

We are deploying a messaging dashboard to GCP Cloud Run. The repository is
`https://github.com/claudiobartolini/messaging-client`.

The GCP project already exists: **`skynet-gcp-network`** (project number `507526882837`).

A GitHub PAT with Actions read/write permissions is available if needed for the
final step (setting secrets). Ask the user to provide it.

---

## Task 1 — Enable APIs + create service account

```bash
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  vpcaccess.googleapis.com \
  cloudresourcemanager.googleapis.com \
  iam.googleapis.com \
  --project=skynet-gcp-network

gcloud iam service-accounts create messaging-api \
  --display-name="Messaging API" \
  --project=skynet-gcp-network

gcloud projects add-iam-policy-binding skynet-gcp-network \
  --member="serviceAccount:messaging-api@skynet-gcp-network.iam.gserviceaccount.com" \
  --role="roles/cloudsql.client"

gcloud projects add-iam-policy-binding skynet-gcp-network \
  --member="serviceAccount:messaging-api@skynet-gcp-network.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## Task 2 — Cloud SQL (Postgres 16)

Choose a strong password for `DB_PASSWORD` and keep it safe.

```bash
gcloud sql instances create messaging-db \
  --database-version=POSTGRES_16 \
  --tier=db-f1-micro \
  --region=europe-west1 \
  --storage-auto-increase \
  --project=skynet-gcp-network

gcloud sql databases create messaging \
  --instance=messaging-db \
  --project=skynet-gcp-network

gcloud sql users create messaging \
  --instance=messaging-db \
  --password=CHOOSE_A_PASSWORD \
  --project=skynet-gcp-network
```

Get the instance connection name:

```bash
gcloud sql instances describe messaging-db \
  --project=skynet-gcp-network \
  --format='value(connectionName)'
# Expected format: skynet-gcp-network:europe-west1:messaging-db
```

Store the DATABASE_URL secret (replace `PASSWORD` and `INSTANCE_CONNECTION_NAME`):

```bash
echo -n "postgresql://messaging:PASSWORD@localhost/messaging?host=/cloudsql/INSTANCE_CONNECTION_NAME" \
  | gcloud secrets create DATABASE_URL \
    --data-file=- \
    --project=skynet-gcp-network
```

---

## Task 3 — Redis (Upstash)

1. Create a free Redis database at https://upstash.com
2. Copy the `rediss://` connection URL
3. Store it:

```bash
echo -n "rediss://YOUR_UPSTASH_URL" \
  | gcloud secrets create REDIS_URL \
    --data-file=- \
    --project=skynet-gcp-network
```

---

## Task 4 — Workload Identity Federation for GitHub Actions

This lets GitHub Actions authenticate to GCP without storing any long-lived keys.

```bash
# Create the identity pool
gcloud iam workload-identity-pools create "github-pool" \
  --project=skynet-gcp-network \
  --location=global \
  --display-name="GitHub Actions pool"

# Create the OIDC provider
gcloud iam workload-identity-pools providers create-oidc "github-provider" \
  --project=skynet-gcp-network \
  --location=global \
  --workload-identity-pool=github-pool \
  --display-name="GitHub provider" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --issuer-uri="https://token.actions.githubusercontent.com"

# Allow the specific GitHub repo to impersonate the service account
gcloud iam service-accounts add-iam-policy-binding \
  "messaging-api@skynet-gcp-network.iam.gserviceaccount.com" \
  --project=skynet-gcp-network \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/507526882837/locations/global/workloadIdentityPools/github-pool/attribute.repository/claudiobartolini/messaging-client"

# Get the WIF_PROVIDER value — copy this output, we need it
gcloud iam workload-identity-pools providers describe github-provider \
  --project=skynet-gcp-network \
  --location=global \
  --workload-identity-pool=github-pool \
  --format="value(name)"
```

The last command prints something like:
```
projects/507526882837/locations/global/workloadIdentityPools/github-pool/providers/github-provider
```

---

## Task 5 — Set GitHub Actions secrets

Once you have the WIF provider name from Task 4, set the two secrets on the
GitHub repo using the GitHub API. Ask the user for the GitHub PAT, then run:

```bash
GH_TOKEN="<PAT from user>"
REPO="claudiobartolini/messaging-client"

# Helper to encrypt and set a secret
set_secret() {
  # Get the repo's public key
  KEY_DATA=$(curl -s \
    -H "Authorization: Bearer ${GH_TOKEN}" \
    -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/${REPO}/actions/secrets/public-key")
  KEY_ID=$(echo "$KEY_DATA" | python3 -c "import sys,json; print(json.load(sys.stdin)['key_id'])")
  KEY=$(echo "$KEY_DATA" | python3 -c "import sys,json; print(json.load(sys.stdin)['key'])")

  # Encrypt with libsodium (requires: pip install PyNaCl)
  ENCRYPTED=$(python3 -c "
import base64, sys
from nacl import encoding, public
key = public.PublicKey(base64.b64decode('${KEY}'))
box = public.SealedBox(key)
encrypted = box.encrypt(b'$2')
print(base64.b64encode(encrypted).decode())
")

  curl -s -o /dev/null -w "%{http_code}" \
    -X PUT "https://api.github.com/repos/${REPO}/actions/secrets/$1" \
    -H "Authorization: Bearer ${GH_TOKEN}" \
    -H "Accept: application/vnd.github+json" \
    -d "{\"encrypted_value\":\"${ENCRYPTED}\",\"key_id\":\"${KEY_ID}\"}"
  echo " ✓ $1"
}

set_secret WIF_PROVIDER "projects/507526882837/locations/global/workloadIdentityPools/github-pool/providers/github-provider"
set_secret WIF_SERVICE_ACCOUNT "messaging-api@skynet-gcp-network.iam.gserviceaccount.com"
```

> Note: `pip install PyNaCl` is required for the encryption step.
> If unavailable, set the secrets manually in the browser at:
> https://github.com/claudiobartolini/messaging-client/settings/secrets/actions

---

## Deliverables — send back to Claudio when done

- [ ] Instance connection name (from Task 2)
- [ ] Confirmation that `DATABASE_URL` secret is in Secret Manager
- [ ] Confirmation that `REDIS_URL` secret is in Secret Manager
- [ ] WIF provider name (from Task 4)
- [ ] Confirmation that `WIF_PROVIDER` and `WIF_SERVICE_ACCOUNT` secrets are set on GitHub
