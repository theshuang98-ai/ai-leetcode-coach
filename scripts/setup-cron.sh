#!/usr/bin/env bash
# ── Cron Job Setup Script ──────────────────────────────────────────────
#
# Installs systemd timers (preferred) or crontab entries for:
#   1. Daily PostgreSQL backup at 03:00
#   2. Hourly Redis BGSAVE (optional, Redis persists automatically)
#
# This script should be run ONCE during initial server setup.
#
# Usage:
#   sudo ./scripts/setup-cron.sh
#
# Or to preview without installing:
#   DRY_RUN=1 ./scripts/setup-cron.sh
#
# ────────────────────────────────────────────────────────────────────────

set -euo pipefail

DRY_RUN="${DRY_RUN:-0}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# ── Color helpers ──────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; }

# ── Check prerequisites ────────────────────────────────────────────────
if [[ "${DRY_RUN}" -eq 0 ]]; then
  if [[ "$(id -u)" -ne 0 ]]; then
    # If not root, try to set up user-level crontab only
    warn "Not running as root. Only user-level crontab will be configured."
    warn "Systemd timers require sudo."
  fi
fi

# ── 1. Daily PostgreSQL Backup ────────────────────────────────────────
info "Setting up daily PostgreSQL backup at 03:00 ..."

BACKUP_SCRIPT="${SCRIPT_DIR}/backup.sh"
BACKUP_LOG="${PROJECT_DIR}/logs/backup.log"

if [[ ! -f "${BACKUP_SCRIPT}" ]]; then
  error "Backup script not found: ${BACKUP_SCRIPT}"
  exit 1
fi

# Ensure log directory exists
mkdir -p "${PROJECT_DIR}/logs"

# ── Determine method: systemd timer vs crontab ─────────────────────────
USE_SYSTEMD=false
if command -v systemctl &>/dev/null && [[ "$(id -u)" -eq 0 ]]; then
  USE_SYSTEMD=true
fi

if [[ "${USE_SYSTEMD}" == true ]]; then
  # ── Systemd service ──────────────────────────────────────────────────
  info "Using systemd timers (preferred)."

  SERVICE_FILE="/etc/systemd/system/aitoearn-backup.service"
  TIMER_FILE="/etc/systemd/system/aitoearn-backup.timer"

  if [[ "${DRY_RUN}" -eq 1 ]]; then
    echo "  Would create: ${SERVICE_FILE}"
    echo "  Would create: ${TIMER_FILE}"
  else
    cat > "${SERVICE_FILE}" <<SERVICEEOF
[Unit]
Description=AitoEarn Daily Database Backup
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=${BACKUP_SCRIPT} --db-name aitoearn --output-dir ${PROJECT_DIR}/backups --upload
WorkingDirectory=${PROJECT_DIR}
StandardOutput=append:${BACKUP_LOG}
StandardError=append:${BACKUP_LOG}
EnvironmentFile=${PROJECT_DIR}/.env

[Install]
WantedBy=multi-user.target
SERVICEEOF

    cat > "${TIMER_FILE}" <<TIMEREOF
[Unit]
Description=Run AitoEarn backup daily at 03:00

[Timer]
OnCalendar=*-*-* 03:00:00
Persistent=true
RandomizedDelaySec=300

[Install]
WantedBy=timers.target
TIMEREOF

    systemctl daemon-reload
    systemctl enable aitoearn-backup.timer
    systemctl start aitoearn-backup.timer
    info "Systemd timer installed and started."
  fi
else
  # ── Crontab fallback ────────────────────────────────────────────────
  info "Using crontab."

  CRON_JOB="0 3 * * * ${BACKUP_SCRIPT} --db-name aitoearn --output-dir ${PROJECT_DIR}/backups --upload >> ${BACKUP_LOG} 2>&1"

  if [[ "${DRY_RUN}" -eq 1 ]]; then
    echo "  Would add cron job: ${CRON_JOB}"
  else
    # Add to crontab if not already present
    (crontab -l 2>/dev/null || true) | grep -v "${BACKUP_SCRIPT}" > /tmp/aitoearn_crontab.new
    echo "${CRON_JOB}" >> /tmp/aitoearn_crontab.new
    crontab /tmp/aitoearn_crontab.new
    rm -f /tmp/aitoearn_crontab.new
    info "Crontab entry added."
  fi
fi

# ── 2. Redis BGSAVE (informational only) ──────────────────────────────
info ""
info "Redis persistence note:"
info "  Redis is configured to save automatically via its own"
info "  save directives in redis.conf (snapshotting)."
info "  If you want an explicit BGSAVE cron entry, uncomment"
info "  the line below in your crontab:"
info ""
info "  # 0 * * * * redis-cli BGSAVE"
echo ""

# ── 3. Summary ────────────────────────────────────────────────────────
info "=== Setup Summary ==="
info "  Backup script:    ${BACKUP_SCRIPT}"
info "  Backup schedule:  Daily at 03:00"
info "  Backup output:    ${PROJECT_DIR}/backups/"
info "  Log file:         ${BACKUP_LOG}"
info ""

if [[ "${USE_SYSTEMD}" == true ]] && [[ "${DRY_RUN}" -eq 0 ]]; then
  info "Check timer status: systemctl status aitoearn-backup.timer"
  info "View next run:       systemctl list-timers aitoearn-backup.timer"
elif [[ "${DRY_RUN}" -eq 0 ]]; then
  info "Check crontab:      crontab -l"
fi

info "Done."
