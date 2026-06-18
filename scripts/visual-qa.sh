#!/usr/bin/env bash
set -euo pipefail

WEB_URL="${WEB_URL:-http://localhost:5173}"
API_URL="${API_URL:-http://localhost:3001}"
EMAIL="${EMAIL:-admin@miralab.tr}"
SESSION="${SESSION:-lms-visual-qa}"
OUT_DIR="${OUT_DIR:-/tmp/lms-visual-qa/$(date +%Y%m%d-%H%M%S)}"

if ! command -v agent-browser >/dev/null 2>&1; then
  echo "agent-browser is required for visual QA." >&2
  exit 1
fi

if ! command -v bun >/dev/null 2>&1; then
  echo "bun is required for visual QA login setup." >&2
  exit 1
fi

mkdir -p "$OUT_DIR"

curl -fsS "$API_URL/health" >/dev/null
curl -fsSI "$WEB_URL" >/dev/null

cleanup() {
  agent-browser --session "$SESSION" close >/dev/null 2>&1 || true
}
trap cleanup EXIT

capture() {
  local width="$1"
  local height="$2"
  local route="$3"
  local name="$4"
  local wait_text="$5"

  agent-browser --session "$SESSION" set viewport "$width" "$height" >/dev/null
  agent-browser --session "$SESSION" open "$WEB_URL$route" >/dev/null
  agent-browser --session "$SESSION" wait --text "$wait_text" >/dev/null
  agent-browser --session "$SESSION" screenshot "$OUT_DIR/$name.png" >/dev/null
}

TOKEN="$(
  API_URL="$API_URL" EMAIL="$EMAIL" bun -e '
    const base = process.env.API_URL;
    const email = process.env.EMAIL;
    const otp = await fetch(`${base}/auth/request-otp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    }).then((response) => response.json());

    if (!otp.devCode) {
      throw new Error("DEV_SHOW_OTP must be enabled for local visual QA login.");
    }

    const session = await fetch(`${base}/auth/verify-otp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, code: otp.devCode }),
    }).then((response) => response.json());

    process.stdout.write(session.token);
  '
)"

agent-browser --session "$SESSION" set viewport 1440 1000 >/dev/null
agent-browser --session "$SESSION" open "$WEB_URL/login" >/dev/null
agent-browser --session "$SESSION" wait --text "MIRALAB" >/dev/null
agent-browser --session "$SESSION" screenshot "$OUT_DIR/auth-desktop.png" >/dev/null

agent-browser --session "$SESSION" eval "localStorage.setItem('lab_session_token', '$TOKEN')" >/dev/null

capture 1440 1000 "/schedule" "schedule-desktop" "Schedule"
capture 1024 1366 "/schedule" "schedule-tablet" "Schedule"
capture 390 844 "/schedule" "schedule-mobile" "Schedule"
capture 1440 1000 "/machines" "machines-desktop" "Machine inventory"
capture 390 844 "/machines" "machines-mobile" "Machine inventory"
capture 1440 1000 "/admin" "admin-overview-desktop" "Admin overview"
capture 390 844 "/admin" "admin-overview-mobile" "Admin overview"
capture 1440 1000 "/admin/users" "admin-users-desktop" "Members"
capture 390 844 "/admin/users" "admin-users-mobile" "Members"
capture 1440 1000 "/admin/maintenance" "admin-maintenance-desktop" "Maintenance"
capture 390 844 "/admin/maintenance" "admin-maintenance-mobile" "Maintenance"

echo "visual QA screenshots: $OUT_DIR"
