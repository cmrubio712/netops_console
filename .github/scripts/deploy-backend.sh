#!/usr/bin/env bash
# Deploys backend/ to Hostinger as a Node.js Web App via the Hostinger REST API.
# Schemas pulled from the official hostinger-api-sdk generated docs, since the
# interactive API reference at developers.hostinger.com didn't render the
# request bodies reliably. This is a public repo, so error bodies are only
# printed where they can't contain live credentials (the upload-urls success
# response carries short-lived auth_key/rest_auth_key — never dumped).
set -euo pipefail

: "${HOSTINGER_API_TOKEN:?}"
: "${HOSTINGER_USERNAME:?}"
: "${HOSTINGER_BACKEND_DOMAIN:?}"

API_BASE="https://developers.hostinger.com"
ARCHIVE_NAME="backend-$(date +%s).zip"

# Runs a curl call with an explicit timeout so failures are deterministic
# rather than hanging until the job's own limit. Captures curl's own exit
# code separately from the HTTP status — set -e would otherwise kill the
# script on a curl-level failure (timeout, DNS) before this function's own
# error handling ever runs. Curl-level failures (timeout/DNS/reset) are
# retried a few times, since these have shown up intermittently on the
# GitHub-runner-to-Hostinger network path even when the request itself is
# fine — an HTTP-level error (4xx/5xx) is not retried, since that's a real
# response, not a network blip. On final failure, prints status/curl-exit
# and (unless told not to) the response body, then exits.
call() {
  local show_body_on_error="$1"; shift
  local tmp status curl_exit attempt

  for attempt in 1 2 3; do
    tmp=$(mktemp)
    set +e
    status=$(curl -s --max-time 120 -o "$tmp" -w "%{http_code}" "$@")
    curl_exit=$?
    set -e

    if [[ "$curl_exit" -eq 0 ]]; then
      break
    fi
    echo "curl itself failed (exit $curl_exit, e.g. timeout/DNS/connection reset) — attempt $attempt/3" >&2
    rm -f "$tmp"
    if [[ "$attempt" -eq 3 ]]; then
      exit 1
    fi
    sleep 5
  done

  if [[ "$status" -lt 200 || "$status" -ge 300 ]]; then
    echo "Request failed with HTTP $status" >&2
    if [[ "$show_body_on_error" == "show" ]]; then
      echo "Response body:" >&2
      cat "$tmp" >&2
    fi
    rm -f "$tmp"
    exit 1
  fi
  cat "$tmp"
  rm -f "$tmp"
}

echo "Archiving backend/ (excluding node_modules, dist, .git, .env)..."
cd backend
zip -rq "../$ARCHIVE_NAME" . -x "node_modules/*" -x "dist/*" -x ".git/*" -x ".env"
cd ..

echo "Requesting upload URL..."
UPLOAD_RESP=$(call show -X POST "$API_BASE/api/hosting/v1/files/upload-urls" \
  -H "Authorization: Bearer $HOSTINGER_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$HOSTINGER_USERNAME\",\"domain\":\"$HOSTINGER_BACKEND_DOMAIN\"}")

UPLOAD_URL=$(echo "$UPLOAD_RESP" | jq -r .url)
AUTH_KEY=$(echo "$UPLOAD_RESP" | jq -r .auth_key)
REST_AUTH_KEY=$(echo "$UPLOAD_RESP" | jq -r .rest_auth_key)

echo "Uploading $ARCHIVE_NAME via TUS..."
SIZE=$(stat -c%s "$ARCHIVE_NAME")

# Upload steps: never show body on error, since a failed request can still
# echo the X-Auth/X-Auth-Rest headers back.
call noshow -X POST "$UPLOAD_URL/$ARCHIVE_NAME?override=true" \
  -H "X-Auth: $AUTH_KEY" -H "X-Auth-Rest: $REST_AUTH_KEY" \
  -H "Tus-Resumable: 1.0.0" -H "Upload-Length: $SIZE" -H "Upload-Offset: 0" > /dev/null

call noshow -X PATCH "$UPLOAD_URL/$ARCHIVE_NAME?override=true" \
  -H "X-Auth: $AUTH_KEY" -H "X-Auth-Rest: $REST_AUTH_KEY" \
  -H "Tus-Resumable: 1.0.0" -H "Content-Type: application/offset+octet-stream" \
  -H "Upload-Offset: 0" --data-binary "@$ARCHIVE_NAME" > /dev/null

echo "Auto-detecting build settings from the uploaded archive..."
SETTINGS=$(call show -G \
  "$API_BASE/api/hosting/v1/accounts/$HOSTINGER_USERNAME/websites/$HOSTINGER_BACKEND_DOMAIN/nodejs/builds/settings/from-archive" \
  -H "Authorization: Bearer $HOSTINGER_API_TOKEN" \
  --data-urlencode "archive_path=$ARCHIVE_NAME")
echo "Detected: $SETTINGS"

NODE_VERSION=$(echo "$SETTINGS" | jq -r '.node_version // 22')
APP_TYPE=$(echo "$SETTINGS" | jq -r '.app_type // "server"')
ROOT_DIR=$(echo "$SETTINGS" | jq -r '.root_directory // "."')
PKG_MANAGER=$(echo "$SETTINGS" | jq -r '.package_manager // "npm"')
# The API wants the npm script name (e.g. "build"), not the full "npm run build".
BUILD_SCRIPT=$(echo "$SETTINGS" | jq -r '.build_script // "build"')
ENTRY_FILE=$(echo "$SETTINGS" | jq -r '.entry_file // "server.js"')

# Hostinger's build infra has shown intermittent server-side failures even
# against a clean compile — a build with no errors in its own compile log has
# come back state:"failed" with nothing diagnosable surfaced via the API, and
# the exact same archive/settings have succeeded on other runs with no code
# change in between. That points to transient infra flakiness rather than a
# deterministic bug, so retry the build+poll cycle against the already-
# uploaded archive a few times before giving up — no need to re-upload.
run_build_attempt() {
  echo "Starting build (node $NODE_VERSION, app_type $APP_TYPE)..."
  local build_resp build_uuid state builds build_obj i
  build_resp=$(call show -X POST "$API_BASE/api/hosting/v1/accounts/$HOSTINGER_USERNAME/websites/$HOSTINGER_BACKEND_DOMAIN/nodejs/builds" \
    -H "Authorization: Bearer $HOSTINGER_API_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"node_version\": $NODE_VERSION,
      \"app_type\": \"$APP_TYPE\",
      \"root_directory\": \"$ROOT_DIR\",
      \"output_directory\": \"dist\",
      \"build_script\": \"$BUILD_SCRIPT\",
      \"entry_file\": \"$ENTRY_FILE\",
      \"package_manager\": \"$PKG_MANAGER\",
      \"source_type\": \"archive\",
      \"source_options\": {\"archive_path\": \"$ARCHIVE_NAME\"}
    }")
  echo "$build_resp"
  build_uuid=$(echo "$build_resp" | jq -r .uuid)

  # A completed build doesn't automatically restart the running process —
  # Hostinger treats "build" and "restart" as separate operations. Without an
  # explicit restart, the new build can sit finished-but-not-live indefinitely.
  echo "Waiting for build $build_uuid to finish (states: pending, running, completed, failed)..."
  for i in $(seq 1 30); do
    builds=$(call noshow "$API_BASE/api/hosting/v1/accounts/$HOSTINGER_USERNAME/websites/$HOSTINGER_BACKEND_DOMAIN/nodejs/builds" \
      -H "Authorization: Bearer $HOSTINGER_API_TOKEN")
    build_obj=$(echo "$builds" | jq -c --arg uuid "$build_uuid" '.data[] | select(.uuid == $uuid)')
    state=$(echo "$build_obj" | jq -r '.state')

    if [[ "$state" == "completed" ]]; then
      echo "Build completed after ~$((i * 5))s. Restarting the app..."
      call show -X POST "$API_BASE/api/hosting/v1/accounts/$HOSTINGER_USERNAME/websites/$HOSTINGER_BACKEND_DOMAIN/nodejs/server/restart" \
        -H "Authorization: Bearer $HOSTINGER_API_TOKEN" > /dev/null
      echo "Restart triggered."
      return 0
    fi
    if [[ "$state" == "failed" ]]; then
      echo "Build failed server-side. Full build record: $build_obj" >&2
      return 1
    fi

    sleep 5
  done

  echo "Build didn't reach a terminal state (last seen: '$state') within 150s. Full build record: $build_obj" >&2
  return 1
}

MAX_ATTEMPTS=3
for attempt in $(seq 1 "$MAX_ATTEMPTS"); do
  if run_build_attempt; then
    exit 0
  fi
  echo "Build attempt $attempt/$MAX_ATTEMPTS failed." >&2
  if [[ "$attempt" -eq "$MAX_ATTEMPTS" ]]; then
    echo "All $MAX_ATTEMPTS build attempts failed. Check hPanel's Node.js app dashboard, or fall back to the manual upload path documented in docs/architecture.md." >&2
    exit 1
  fi
  sleep 15
done
