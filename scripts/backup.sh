#!/usr/bin/env bash
# ── PostgreSQL Database Backup Script ──────────────────────────────────
#
# Creates a compressed pg_dump of the database and optionally uploads it
# to Backblaze B2 (or any S3-compatible object storage).
#
# Usage:
#   ./scripts/backup.sh --db-name aitoearn --output-dir /tmp/backups
#   ./scripts/backup.sh --db-name aitoearn --output-dir /tmp/backups --upload
#
# Options:
#   --db-name NAME        Database name to back up (default: aitoearn)
#   --output-dir DIR      Directory to write the backup file (default: ./backups)
#   --upload              Upload to Backblaze B2 after dump (requires env vars)
#   --help                Show this help message
#
# Environment variables (for --upload):
#   BACKBLAZE_B2_KEY_ID      Backblaze B2 Application Key ID
#   BACKBLAZE_B2_APP_KEY     Backblaze B2 Application Key
#   BACKBLAZE_B2_BUCKET      Backblaze B2 bucket name
#   PGHOST                   PostgreSQL host (default: localhost)
#   PGPORT                   PostgreSQL port (default: 5432)
#   PGUSER                   PostgreSQL user (default: aitoearn)
#   PGPASSWORD               PostgreSQL password
#
# Requirements:
#   - pg_dump (PostgreSQL client tools)
#   - gzip
#   - Optional: aws CLI (for Backblaze B2 upload, S3-compatible endpoint)
# ────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── Defaults ───────────────────────────────────────────────────────────
DB_NAME="${DB_NAME:-aitoearn}"
OUTPUT_DIR="${OUTPUT_DIR:-./backups}"
UPLOAD=false
PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-aitoearn}"

# ── Parse arguments ────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --db-name)
      DB_NAME="$2"
      shift 2
      ;;
    --output-dir)
      OUTPUT_DIR="$2"
      shift 2
      ;;
    --upload)
      UPLOAD=true
      shift
      ;;
    --help)
      sed -n '/^# ── /,/^───/p' "$0" | head -n -1
      exit 0
      ;;
    *)
      echo "ERROR: Unknown option: $1"
      echo "Usage: $0 [--db-name NAME] [--output-dir DIR] [--upload]"
      exit 1
      ;;
  esac
done

# ── Validate requirements ──────────────────────────────────────────────
if ! command -v pg_dump &>/dev/null; then
  echo "ERROR: pg_dump not found. Install PostgreSQL client tools."
  exit 1
fi

if ! command -v gzip &>/dev/null; then
  echo "ERROR: gzip not found."
  exit 1
fi

# ── Create output directory ────────────────────────────────────────────
mkdir -p "${OUTPUT_DIR}"

# ── Generate filename ──────────────────────────────────────────────────
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="${DB_NAME}_${TIMESTAMP}.sql.gz"
FILEPATH="${OUTPUT_DIR}/${FILENAME}"

echo "=== Database Backup ==="
echo "  Database:  ${DB_NAME}"
echo "  Host:      ${PGHOST}:${PGPORT}"
echo "  User:      ${PGUSER}"
echo "  Output:    ${FILEPATH}"
echo ""

# ── Dump and compress ──────────────────────────────────────────────────
echo "Dumping database..."
PGPASSWORD="${PGPASSWORD:-}" pg_dump \
  --host="${PGHOST}" \
  --port="${PGPORT}" \
  --username="${PGUSER}" \
  --dbname="${DB_NAME}" \
  --format=custom \
  --verbose \
  2>/dev/null | gzip > "${FILEPATH}"

DUMP_EXIT=$?

if [[ ${DUMP_EXIT} -ne 0 ]]; then
  echo "ERROR: pg_dump failed with exit code ${DUMP_EXIT}"
  rm -f "${FILEPATH}"
  exit 1
fi

# Verify the output file
if [[ ! -s "${FILEPATH}" ]]; then
  echo "ERROR: Backup file is empty"
  rm -f "${FILEPATH}"
  exit 1
fi

echo "Backup created: ${FILEPATH} ($(du -h "${FILEPATH}" | cut -f1))"

# ── Upload to Backblaze B2 ─────────────────────────────────────────────
if [[ "${UPLOAD}" == true ]]; then
  B2_KEY_ID="${BACKBLAZE_B2_KEY_ID:-}"
  B2_APP_KEY="${BACKBLAZE_B2_APP_KEY:-}"
  B2_BUCKET="${BACKBLAZE_B2_BUCKET:-}"

  if [[ -z "${B2_KEY_ID}" || -z "${B2_APP_KEY}" || -z "${B2_BUCKET}" ]]; then
    echo ""
    echo "WARNING: --upload requested but B2 credentials not set."
    echo "Set the following environment variables:"
    echo "  BACKBLAZE_B2_KEY_ID"
    echo "  BACKBLAZE_B2_APP_KEY"
    echo "  BACKBLAZE_B2_BUCKET"
    echo "Skipping upload."
    exit 0
  fi

  if ! command -v aws &>/dev/null; then
    echo ""
    echo "WARNING: 'aws' CLI not found. Cannot upload to B2."
    echo "Install it via: pip install awscli"
    echo "Or configure the S3 endpoint manually."
    exit 0
  fi

  echo ""
  echo "Uploading to Backblaze B2..."
  echo "  Bucket: s3://${B2_BUCKET}/backups/"

  AWS_ACCESS_KEY_ID="${B2_KEY_ID}" \
  AWS_SECRET_ACCESS_KEY="${B2_APP_KEY}" \
  aws s3 cp \
    "${FILEPATH}" \
    "s3://${B2_BUCKET}/backups/${FILENAME}" \
    --endpoint-url "https://s3.us-west-004.backblazeb2.com"

  UPLOAD_EXIT=$?
  if [[ ${UPLOAD_EXIT} -eq 0 ]]; then
    echo "Upload complete."
  else
    echo "ERROR: Upload failed (exit code ${UPLOAD_EXIT})"
    exit 1
  fi
fi

echo ""
echo "=== Backup Complete ==="
