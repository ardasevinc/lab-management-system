#!/usr/bin/env sh
set -eu

image_tag="${DOCKER_VERIFY_IMAGE_TAG:-lab-management-system:predeploy}"

cleanup() {
  if [ "${KEEP_DOCKER_VERIFY_IMAGE:-0}" != "1" ]; then
    docker rmi "$image_tag" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

docker build --progress=plain -t "$image_tag" .

healthcheck="$(docker inspect "$image_tag" --format '{{json .Config.Healthcheck}}')"
case "$healthcheck" in
  *'/health'*)
    ;;
  *)
    echo "Docker image healthcheck must probe /health" >&2
    exit 1
    ;;
esac

image_env="$(docker inspect "$image_tag" --format '{{range .Config.Env}}{{println .}}{{end}}')"
for expected in \
  "DATABASE_URL=file:/app/data/lab.sqlite" \
  "BACKUP_DATABASE_PATH=/app/data/lab.sqlite" \
  "BACKUP_DIR=/app/data/backups"
do
  if ! printf "%s\n" "$image_env" | grep -Fx "$expected" >/dev/null; then
    echo "Docker image env missing: $expected" >&2
    exit 1
  fi
done

docker run --rm "$image_tag" sh -lc \
  'test -d /app/data/backups &&
   test ! -f apps/api/.env &&
   test ! -f apps/web/.env &&
   test ! -f apps/api/data/lab.sqlite &&
   test -f apps/web/.env.production'

echo "verified Docker build: $image_tag"
