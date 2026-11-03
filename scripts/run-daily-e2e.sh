#!/usr/bin/env bash
# ── Daily E2E Fresh User Flow ───────────────────────────────────────────
# Runs the fresh-account E2E test suite against the running dev/staging server.
#
# Usage:
#   ./scripts/run-daily-e2e.sh              # uses .env for config
#   NODE_ENV=staging ./scripts/run-daily-e2e.sh
#
# This script is designed to be called from a daily cron job.
# It will NOT run in production.
#
# Exit codes:
#   0 — All tests passed
#   1 — Prerequisite check failed (e.g. production env, missing services)
#   2 — Test run failed

set -euo pipefail

# ── Colors for output ───────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ── Config ──────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Load .env if present (non-destructive — won't override existing env vars)
if [ -f "$PROJECT_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$PROJECT_DIR/.env"
  set +a
fi

NODE_ENV="${NODE_ENV:-development}"
EVIDENCE_DIR="$PROJECT_DIR/.sisyphus/evidence/fresh-account-flow"
TIMESTAMP=$(date '+%Y-%m-%d_%H-%M-%S')
REPORT_DIR="$EVIDENCE_DIR/report-$TIMESTAMP"

# ── Pre-flight checks ───────────────────────────────────────────────────

echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  Fresh User E2E — Daily Run${NC}"
echo -e "${CYAN}  Environment: ${NODE_ENV}${NC}"
echo -e "${CYAN}  Project:     ${PROJECT_DIR}${NC}"
echo -e "${CYAN}  Timestamp:   ${TIMESTAMP}${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""

# 1. Never run in production
if [ "$NODE_ENV" = "production" ]; then
  echo -e "${RED}✖ REFUSING to run in production (NODE_ENV=production).${NC}"
  echo "  This would create test users in the production database."
  echo "  Set NODE_ENV=development or NODE_ENV=staging to proceed."
  exit 1
fi

echo -e "${GREEN}✓ Environment check passed (NODE_ENV=${NODE_ENV})${NC}"

# 2. Check for required tools
if ! command -v npx &>/dev/null; then
  echo -e "${RED}✖ npx not found in PATH. Is Node.js installed?${NC}"
  exit 1
fi

if ! npx playwright --version &>/dev/null; then
  echo -e "${RED}✖ Playwright not found. Run: npm install${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Tools available${NC}"

# 3. Check that the dev server is running
if ! curl -sf "${NEXTAUTH_URL:-http://localhost:3000}/api/health" > /dev/null 2>&1; then
  echo -e "${YELLOW}⚠  Dev server not reachable at ${NEXTAUTH_URL:-http://localhost:3000}${NC}"
  echo "  Make sure your dev server is running: npm run dev"
  echo "  Or set PLAYWRIGHT_BASE_URL to a running instance."
  exit 1
fi
echo -e "${GREEN}✓ Dev server reachable${NC}"

# ── Setup evidence directory ────────────────────────────────────────────

mkdir -p "$EVIDENCE_DIR"
mkdir -p "$REPORT_DIR"
echo -e "${GREEN}✓ Evidence dir: ${EVIDENCE_DIR}${NC}"

# ── Run the E2E test ────────────────────────────────────────────────────

echo ""
echo -e "${CYAN}── Running fresh user E2E test suite ─────────────────────${NC}"
echo ""

cd "$PROJECT_DIR"

# Run with explicit output
set +e  # allow test failure to capture exit code
npx playwright test \
  tests/e2e/fresh-user.spec.ts \
  --output="$REPORT_DIR" \
  --reporter=list
EXIT_CODE=$?
set -e

# ── Post-run summary ────────────────────────────────────────────────────

echo ""
echo -e "${CYAN}── Results ──────────────────────────────────────────────${NC}"
echo ""

if [ $EXIT_CODE -eq 0 ]; then
  echo -e "${GREEN}✔ ALL TESTS PASSED${NC}"
else
  echo -e "${RED}✖ TESTS FAILED (exit code: ${EXIT_CODE})${NC}"
fi

# Copy evidence screenshots and JSON to timestamped report dir
if [ -d "$EVIDENCE_DIR" ]; then
  EVIDENCE_COUNT=$(find "$EVIDENCE_DIR" -maxdepth 1 -type f | wc -l)
  echo "  Evidence files: ${EVIDENCE_COUNT} (in ${EVIDENCE_DIR})"

  # Copy to timestamped report for history
  cp "$EVIDENCE_DIR"/step-*.png "$REPORT_DIR/" 2>/dev/null || true
  cp "$EVIDENCE_DIR"/step-*.json "$REPORT_DIR/" 2>/dev/null || true
  echo "  Report saved to: ${REPORT_DIR}"
fi

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"

exit $EXIT_CODE
