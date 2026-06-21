#!/usr/bin/env sh
set -eu

image_tag="${DOCKER_RUNTIME_IMAGE_TAG:-lab-management-system:runtime-verify}"
container_name="${DOCKER_RUNTIME_CONTAINER_NAME:-lab-management-system-runtime-verify}"
host_port="${DOCKER_RUNTIME_HOST_PORT:-31817}"
data_dir="$(mktemp -d)"

cleanup() {
  docker rm -f "$container_name" >/dev/null 2>&1 || true
  rm -rf "$data_dir"

  if [ "${KEEP_DOCKER_RUNTIME_IMAGE:-0}" != "1" ]; then
    docker rmi "$image_tag" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

fail_with_logs() {
  echo "$1" >&2
  docker logs "$container_name" >&2 || true
  exit 1
}

assert_contains() {
  value="$1"
  expected="$2"
  message="$3"

  case "$value" in
    *"$expected"*) ;;
    *) fail_with_logs "$message" ;;
  esac
}

docker build --progress=plain -t "$image_tag" .
docker rm -f "$container_name" >/dev/null 2>&1 || true

docker run -d \
  --name "$container_name" \
  -p "127.0.0.1:$host_port:3001" \
  -v "$data_dir:/app/data" \
  -e APP_ENV=production \
  -e NODE_ENV=production \
  -e PORT=3001 \
  -e PUBLIC_APP_URL=https://lms.miralab.tr \
  -e CORS_ORIGINS=https://lms.miralab.tr \
  -e SESSION_COOKIE_SECURE=1 \
  -e DATABASE_URL=file:/app/data/lab.sqlite \
  -e SERVE_WEB=1 \
  -e WEB_DIST_DIR=/app/apps/web/dist \
  -e EMAIL_PROVIDER=ses \
  -e AWS_REGION=eu-central-1 \
  -e AWS_ACCESS_KEY_ID=runtime-verify \
  -e AWS_SECRET_ACCESS_KEY=runtime-verify \
  -e SES_FROM_NAME=MIRALAB \
  -e SES_FROM_EMAIL=no-reply@miralab.tr \
  -e SES_REPLY_TO=support@miralab.tr \
  -e SES_CONFIGURATION_SET=miralab-lms \
  -e DEV_SHOW_OTP=0 \
  -e OTP_RATE_LIMIT_WINDOW_SECONDS=900 \
  -e OTP_RATE_LIMIT_MAX_REQUESTS=5 \
  -e REMINDERS_ENABLED=1 \
  -e BOOKING_START_REMINDER_MINUTES=15 \
  -e BOOKING_ENDING_REMINDER_MINUTES=15 \
  -e NOTIFICATION_WORKER_INTERVAL_SECONDS=60 \
  -e NOTIFICATION_RETRY_DELAY_MINUTES=5 \
  -e NOTIFICATION_MAX_ATTEMPTS=3 \
  -e BACKUP_DATABASE_PATH=/app/data/lab.sqlite \
  -e BACKUP_DIR=/app/data/backups \
  -e BACKUP_RETENTION_DAYS=30 \
  "$image_tag" >/dev/null

health=""
for _ in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30; do
  if ! docker ps --format '{{.Names}}' | grep -Fx "$container_name" >/dev/null; then
    fail_with_logs "Docker runtime container exited before health check passed"
  fi

  health="$(curl -fsS "http://127.0.0.1:$host_port/health" 2>/dev/null || true)"
  case "$health" in
    *'"ok":true'*'"database":"ok"'*'"machines":1'*) break ;;
    *) sleep 1 ;;
  esac
done

assert_contains "$health" '"ok":true' "Docker runtime health check did not become healthy"
assert_contains "$health" '"database":"ok"' "Docker runtime health check did not report database readiness"
assert_contains "$health" '"machines":1' "Docker runtime did not seed machine inventory"

if [ ! -f "$data_dir/lab.sqlite" ]; then
  fail_with_logs "Docker runtime did not create SQLite database in the mounted data directory"
fi

unknown_html="$(curl -fsS -H 'Accept: text/html' "http://127.0.0.1:$host_port/definitely-missing")"
assert_contains "$unknown_html" 'id="root"' "Docker runtime did not serve the SPA for unknown HTML navigation"

machines_html="$(curl -fsS -H 'Accept: text/html' "http://127.0.0.1:$host_port/machines")"
assert_contains "$machines_html" 'id="root"' "Docker runtime did not serve the SPA for /machines HTML navigation"

api_body="$data_dir/api-machines-response.json"
api_status="$(curl -sS -o "$api_body" -w "%{http_code}" "http://127.0.0.1:$host_port/machines")"
if [ "$api_status" != "401" ]; then
  fail_with_logs "Docker runtime /machines API returned $api_status instead of 401"
fi
assert_contains "$(cat "$api_body")" "Authentication required" "Docker runtime /machines API did not preserve JSON auth failure"

favicon="$(curl -fsS "http://127.0.0.1:$host_port/favicon.svg")"
assert_contains "$favicon" "<svg" "Docker runtime did not serve root public assets before SPA fallback"

docker exec "$container_name" bun run verify:sqlite-backup >/dev/null

if ! find "$data_dir/backups" -type f -name 'lab-*.sqlite' -print -quit | grep -q .; then
  fail_with_logs "Docker runtime backup verifier did not write a SQLite backup to the mounted data directory"
fi

echo "verified Docker runtime: $image_tag on http://127.0.0.1:$host_port"
