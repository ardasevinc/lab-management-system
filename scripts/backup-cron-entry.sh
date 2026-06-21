#!/usr/bin/env sh
set -eu

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
  cat <<'EOF'
Usage: scripts/backup-cron-entry.sh

Print a host crontab line that runs the app container's SQLite backup verifier.
The verifier creates a SQLite backup with the current backup env, runs
PRAGMA integrity_check, and verifies core tables are readable.

Environment:
  BACKUP_CRON_SCHEDULE   Cron schedule. Default: 17 2 * * *
  BACKUP_CAPROVER_APP    CapRover app name. Default: miralab-lms
  BACKUP_DATABASE_URL    Container DATABASE_URL. Default: file:/app/data/lab.sqlite
  BACKUP_DIR             Container backup directory. Default: /app/data/backups
  BACKUP_RETENTION_DAYS  Retention window. Default: 30
  BACKUP_CRON_LOG        Host log file. Default: /var/log/miralab-lms-backup.log
  BACKUP_LOCK_PATH       Host flock path. Default: /tmp/miralab-lms-backup.lock
EOF
  exit 0
fi

schedule="${BACKUP_CRON_SCHEDULE:-17 2 * * *}"
caprover_app="${BACKUP_CAPROVER_APP:-miralab-lms}"
database_url="${BACKUP_DATABASE_URL:-file:/app/data/lab.sqlite}"
backup_dir="${BACKUP_DIR:-/app/data/backups}"
retention_days="${BACKUP_RETENTION_DAYS:-30}"
log_path="${BACKUP_CRON_LOG:-/var/log/miralab-lms-backup.log}"
lock_path="${BACKUP_LOCK_PATH:-/tmp/miralab-lms-backup.lock}"

quote_for_sh() {
  printf "'%s'" "$(printf "%s" "$1" | sed "s/'/'\\\\''/g")"
}

container_filter_q="$(quote_for_sh "name=^/srv-captain--$caprover_app\\.")"
database_url_q="$(quote_for_sh "$database_url")"
backup_dir_q="$(quote_for_sh "$backup_dir")"
retention_days_q="$(quote_for_sh "$retention_days")"
log_path_q="$(quote_for_sh "$log_path")"
lock_path_q="$(quote_for_sh "$lock_path")"
container_lookup="containers=\$(docker ps --filter $container_filter_q --format '{{.Names}}') && test -n \"\$containers\" && test \"\$(printf '%s\\n' \"\$containers\" | wc -l | tr -d ' ')\" = 1 && container=\"\$containers\""
backup_command="cd /app && DATABASE_URL=$database_url_q BACKUP_DIR=$backup_dir_q BACKUP_RETENTION_DAYS=$retention_days_q bun run verify:sqlite-backup"
locked_command="$container_lookup && docker exec \"\$container\" sh -lc $(quote_for_sh "$backup_command")"

printf "%s flock -n %s sh -lc %s >> %s 2>&1\n" \
  "$schedule" \
  "$lock_path_q" \
  "$(quote_for_sh "$locked_command")" \
  "$log_path_q"
