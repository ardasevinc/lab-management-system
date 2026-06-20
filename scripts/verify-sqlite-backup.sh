#!/usr/bin/env sh
set -eu

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "sqlite3 is required for backup verification" >&2
  exit 1
fi

backup_file="${1:-}"
if [ -z "$backup_file" ]; then
  backup_file="$(sh scripts/backup-sqlite.sh)"
fi

if [ ! -f "$backup_file" ]; then
  echo "backup file not found: $backup_file" >&2
  exit 1
fi

integrity_result="$(sqlite3 "$backup_file" "PRAGMA integrity_check;")"
if [ "$integrity_result" != "ok" ]; then
  echo "backup integrity check failed: $integrity_result" >&2
  exit 1
fi

machine_count="$(sqlite3 "$backup_file" "SELECT COUNT(*) FROM machines;")"
user_count="$(sqlite3 "$backup_file" "SELECT COUNT(*) FROM users;")"

case "$machine_count" in
  ''|*[!0-9]*|0)
    echo "backup verification failed: machines table is empty or unreadable" >&2
    exit 1
    ;;
esac

case "$user_count" in
  ''|*[!0-9]*|0)
    echo "backup verification failed: users table is empty or unreadable" >&2
    exit 1
    ;;
esac

echo "verified $backup_file"
