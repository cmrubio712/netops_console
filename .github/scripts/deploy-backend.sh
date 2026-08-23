#!/usr/bin/env bash
# Deploys backend/ to Hostinger as a Node.js Web App via the Hostinger REST API.
# Schemas pulled from the official hostinger-api-sdk generated docs, since the
# interactive API reference at developers.hostinger.com didn't render the
# request bodies reliably. Untested against a live Hostinger account as of
# writing (no app/token exists yet) — expect to debug the first real run.
set -euo pipefail

: "${HOSTINGER_API_TOKEN:?}"
: "${HOSTINGER_USERNAME:?}"
: "${HOSTINGER_BACKEND_DOMAIN:?}"

API_BASE="https://developers.hostinger.com"
ARCHIVE_NAME="backend-$(date +%s).zip"

echo "Archiving backend/ (excluding node_modules, dist, .git, .env)..."
cd backend
zip -rq "../$ARCHIVE_NAME" . -x "node_modules/*" -x "dist/*" -x ".git/*" -x ".env"
cd ..

echo "Requesting upload URL..."
UPLOAD_RESP=$(curl -sf -X POST "$API_BASE/api/hosting/v1/files/upload-urls" \
  -H "Authorization: Bearer $HOSTINGER_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$HOSTINGER_USERNAME\",\"domain\":\"$HOSTINGER_BACKEND_DOMAIN\"}")

UPLOAD_URL=$(echo "$UPLOAD_RESP" | jq -r .url)
AUTH_KEY=$(echo "$UPLOAD_RESP" | jq -r .auth_key)
REST_AUTH_KEY=$(echo "$UPLOAD_RESP" | jq -r .rest_auth_key)

echo "Uploading $ARCHIVE_NAME via TUS..."
SIZE=$(stat -c%s "$ARCHIVE_NAME")

curl -sf -X POST "$UPLOAD_URL/$ARCHIVE_NAME?override=true" \
  -H "X-Auth: $AUTH_KEY" -H "X-Auth-Rest: $REST_AUTH_KEY" \
  -H "Tus-Resumable: 1.0.0" -H "Upload-Length: $SIZE" -H "Upload-Offset: 0" > /dev/null

curl -sf -X PATCH "$UPLOAD_URL/$ARCHIVE_NAME?override=true" \
  -H "X-Auth: $AUTH_KEY" -H "X-Auth-Rest: $REST_AUTH_KEY" \
  -H "Tus-Resumable: 1.0.0" -H "Content-Type: application/offset+octet-stream" \
  -H "Upload-Offset: 0" --data-binary "@$ARCHIVE_NAME" > /dev/null

echo "Auto-detecting build settings from the uploaded archive..."
SETTINGS=$(curl -sf -G \
  "$API_BASE/api/hosting/v1/accounts/$HOSTINGER_USERNAME/websites/$HOSTINGER_BACKEND_DOMAIN/nodejs/builds/settings/from-archive" \
  -H "Authorization: Bearer $HOSTINGER_API_TOKEN" \
  --data-urlencode "archive_path=$ARCHIVE_NAME")

NODE_VERSION=$(echo "$SETTINGS" | jq -r '.node_version // 22')
APP_TYPE=$(echo "$SETTINGS" | jq -r '.app_type // "server"')
ROOT_DIR=$(echo "$SETTINGS" | jq -r '.root_directory // "."')
PKG_MANAGER=$(echo "$SETTINGS" | jq -r '.package_manager // "npm"')

echo "Starting build (node $NODE_VERSION, app_type $APP_TYPE)..."
curl -sf -X POST "$API_BASE/api/hosting/v1/accounts/$HOSTINGER_USERNAME/websites/$HOSTINGER_BACKEND_DOMAIN/nodejs/builds" \
  -H "Authorization: Bearer $HOSTINGER_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"node_version\": $NODE_VERSION,
    \"app_type\": \"$APP_TYPE\",
    \"root_directory\": \"$ROOT_DIR\",
    \"output_directory\": \"dist\",
    \"build_script\": \"npm run build\",
    \"entry_file\": \"server.js\",
    \"package_manager\": \"$PKG_MANAGER\",
    \"source_type\": \"archive\",
    \"source_options\": {\"archive_path\": \"$ARCHIVE_NAME\"}
  }"

echo
echo "Build started. Check hPanel's Node.js app dashboard for build status/logs."
