#!/usr/bin/env sh
set -eu

database_path="${BACKUP_DATABASE_PATH:-}"
if [ -z "$database_path" ] && [ "${DATABASE_URL:-}" != "" ]; then
  case "$DATABASE_URL" in
    file:*)
      database_path="${DATABASE_URL#file:}"
      ;;
    *)
      echo "DATABASE_URL must use file: for SQLite backups" >&2
      exit 1
      ;;
  esac
fi
database_path="${database_path:-/app/data/lab.sqlite}"

backup_dir="${BACKUP_DIR:-/app/data/backups}"
retention_days="${BACKUP_RETENTION_DAYS:-30}"

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "sqlite3 is required for backups" >&2
  exit 1
fi

if [ ! -f "$database_path" ]; then
  echo "database file not found: $database_path" >&2
  exit 1
fi

mkdir -p "$backup_dir"

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
tmp_file="$backup_dir/lab-$stamp.sqlite.tmp"
backup_file="$backup_dir/lab-$stamp.sqlite"

cleanup_tmp() {
  rm -f "$tmp_file"
}
trap cleanup_tmp EXIT

sqlite3 "$database_path" ".backup '$tmp_file'"
mv "$tmp_file" "$backup_file"
trap - EXIT

case "$retention_days" in
  ''|*[!0-9]*)
    ;;
  *)
    find "$backup_dir" -type f -name 'lab-*.sqlite' -mtime "+$retention_days" -delete
    ;;
esac

echo "$backup_file"
