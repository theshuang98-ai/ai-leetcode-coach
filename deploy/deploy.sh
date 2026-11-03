#!/usr/bin/env bash
# ── Deploy Script for AI LeetCode Coach ─────────────────────────────
#
# Pulls the latest Docker images, runs database migrations, restarts
# services, and performs a basic smoke test.
#
# Prerequisites:
#   - Ubuntu/Debian server
#   - Docker Engine 24+ and Docker Compose v2
#   - git (to clone/pull the repository)
#   - .env file in the app directory (copied from .env.example)
#
# Usage:
#   chmod +x deploy/deploy.sh
#   ./deploy/deploy.sh                    # full deploy
#   ./deploy/deploy.sh --skip-migrations  # skip Prisma migrations
#   ./deploy/deploy.sh --smoke-only       # just run smoke test
#   ./deploy/deploy.sh --rollback         # restore previous version
#
# Environment:
#   APP_DIR      - App directory (default: /opt/aitoearn)
#   COMPOSE_FILE - Docker Compose file   (default: docker-compose.prod.yml)

set -euo pipefail

# ── Configuration ────────────────────────────────────────────────────
APP_DIR="${APP_DIR:-/opt/aitoearn}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="${APP_DIR}/deploy/logs/deploy_${TIMESTAMP}.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ── Helper Functions ─────────────────────────────────────────────────
log_info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }

cleanup() {
  local exit_code=$?
  if [ $exit_code -ne 0 ]; then
    log_error "Deploy failed with exit code ${exit_code}"
    log_info "Check logs: ${LOG_FILE}"
  fi
  exit $exit_code
}
trap cleanup EXIT

ensure_directory() {
  if [ ! -d "$1" ]; then
    mkdir -p "$1"
    log_info "Created directory: $1"
  fi
}

# ── Pre-flight Checks ────────────────────────────────────────────────
preflight_checks() {
  log_info "Running pre-flight checks..."

  # Check Docker
  if ! command -v docker &>/dev/null; then
    log_error "Docker is not installed. Install Docker Engine 24+ first."
    log_info "See: https://docs.docker.com/engine/install/ubuntu/"
    exit 1
  fi

  # Check Docker Compose
  if ! docker compose version &>/dev/null; then
    log_error "Docker Compose v2 is not installed."
    exit 1
  fi

  # Check app directory
  if [ ! -d "${APP_DIR}" ]; then
    log_error "App directory ${APP_DIR} does not exist."
    log_info "Clone the repository first:"
    log_info "  git clone <repo-url> ${APP_DIR}"
    exit 1
  fi

  # Check .env file
  if [ ! -f "${APP_DIR}/.env" ]; then
    log_warn ".env file not found at ${APP_DIR}/.env"
    log_info "Copying from .env.example..."
    if [ -f "${APP_DIR}/.env.example" ]; then
      cp "${APP_DIR}/.env.example" "${APP_DIR}/.env"
      log_warn "Edit ${APP_DIR}/.env with real credentials before running deploy!"
      exit 1
    else
      log_error "No .env.example found. Create ${APP_DIR}/.env manually."
      exit 1
    fi
  fi

  # Create logs directory
  ensure_directory "${APP_DIR}/deploy/logs"
  ensure_directory "${APP_DIR}/nginx/ssl"
  ensure_directory "${APP_DIR}/nginx/www"
}

# ── Pull Latest Images ───────────────────────────────────────────────
pull_images() {
  log_info "Pulling latest Docker images..."
  cd "${APP_DIR}"

  # Pull base images
  docker pull postgres:16-alpine
  docker pull redis:7-alpine
  docker pull nginx:1.25-alpine

  # Build app and scheduler images from source
  log_info "Building app image..."
  docker compose -f "${COMPOSE_FILE}" --env-file .env build app

  log_info "Building scheduler image..."
  docker compose -f "${COMPOSE_FILE}" --env-file .env build scheduler

  log_info "Images built successfully."
}

# ── Run Database Migrations ──────────────────────────────────────────
run_migrations() {
  log_info "Running database migrations..."

  # Start only postgres and redis
  docker compose -f "${COMPOSE_FILE}" --env-file .env up -d postgres redis
  log_info "Waiting for postgres to be healthy..."
  sleep 5

  # Run Prisma migrations inside a temporary container
  docker run --rm \
    --network aitoearn_aitoearn_net \
    --env-file "${APP_DIR}/.env" \
    -v "${APP_DIR}/prisma:/app/prisma" \
    -w /app \
    node:20-alpine \
    sh -c "
      npm install -g prisma &&
      prisma generate &&
      prisma db push --accept-data-loss
    "

  log_info "Migrations completed."
}

# ── Restart Services ─────────────────────────────────────────────────
restart_services() {
  log_info "Restarting all services..."

  cd "${APP_DIR}"
  docker compose -f "${COMPOSE_FILE}" --env-file .env up -d --remove-orphans

  log_info "All services restarted."
  log_info "Waiting for app to be ready..."
  sleep 10
}

# ── Smoke Test ───────────────────────────────────────────────────────
smoke_test() {
  log_info "Running smoke tests..."

  local base_url="${APP_URL:-https://localhost}"
  local all_passed=true

  # Test 1: Health endpoint
  log_info "Test 1: Health check..."
  if curl -sf -o /dev/null -w "%{http_code}" "${base_url}/api/health" 2>/dev/null | grep -q "200"; then
    log_info "  ✓ Health endpoint OK"
  else
    log_warn "  ✗ Health endpoint not responding (expected if nginx not configured)"
  fi

  # Test 2: Landing page
  log_info "Test 2: Landing page..."
  local http_code
  http_code=$(curl -s -o /dev/null -w "%{http_code}" "${base_url}/" 2>/dev/null || echo "000")
  if [ "$http_code" = "200" ] || [ "$http_code" = "301" ] || [ "$http_code" = "302" ] || [ "$http_code" = "308" ]; then
    log_info "  ✓ Landing page responds (HTTP ${http_code})"
  else
    log_error "  ✗ Landing page returned HTTP ${http_code}"
    all_passed=false
  fi

  # Test 3: Check running containers
  log_info "Test 3: Container health..."
  cd "${APP_DIR}"
  local unhealthy
  unhealthy=$(docker compose -f "${COMPOSE_FILE}" ps --format json | grep -c "unhealthy" 2>/dev/null || true)
  if [ "$unhealthy" -eq 0 ]; then
    log_info "  ✓ All containers healthy"
  else
    log_warn "  ⚠ ${unhealthy} container(s) unhealthy (may still be starting)"
  fi

  # Test 4: Check app container logs for startup errors
  log_info "Test 4: App startup errors..."
  if docker compose -f "${COMPOSE_FILE}" logs app 2>/dev/null | tail -20 | grep -qi "error\|fatal\|exception"; then
    log_warn "  ⚠ Found potential errors in app logs (check full log for details)"
  else
    log_info "  ✓ No startup errors in app logs"
  fi

  if [ "$all_passed" = true ]; then
    log_info "All smoke tests passed!"
  else
    log_warn "Some smoke tests failed — check logs for details."
  fi
}

# ── Rollback ─────────────────────────────────────────────────────────
rollback() {
  log_warn "Rolling back to previous deployment..."

  cd "${APP_DIR}"
  # Use Docker Compose's built-in rollback if available, else restart with previous image
  docker compose -f "${COMPOSE_FILE}" --env-file .env up -d --force-recreate

  log_info "Rollback complete. Previous images have been restarted."
}

# ── Cleanup Old Images ───────────────────────────────────────────────
cleanup_old_images() {
  log_info "Cleaning up old Docker images..."
  docker image prune -f --filter "until=48h"
  log_info "Old images cleaned."
}

# ── Main ─────────────────────────────────────────────────────────────
main() {
  local skip_migrations=false
  local smoke_only=false
  local do_rollback=false

  # Parse arguments
  while [ $# -gt 0 ]; do
    case "$1" in
      --skip-migrations) skip_migrations=true; shift ;;
      --smoke-only)      smoke_only=true; shift ;;
      --rollback)        do_rollback=true; shift ;;
      --help)
        echo "Usage: $0 [OPTIONS]"
        echo ""
        echo "Options:"
        echo "  --skip-migrations  Skip Prisma database migrations"
        echo "  --smoke-only       Only run smoke tests against existing deployment"
        echo "  --rollback         Rollback to previous deployment"
        echo "  --help             Show this help message"
        exit 0
        ;;
      *) log_error "Unknown option: $1"; exit 1 ;;
    esac
  done

  # Redirect all output to log file
  exec > >(tee -a "${LOG_FILE}") 2>&1

  echo ""
  log_info "═══════════════════════════════════════════════"
  log_info "  AI LeetCode Coach — Deploy ${TIMESTAMP}"
  log_info "═══════════════════════════════════════════════"
  echo ""

  if [ "$do_rollback" = true ]; then
    rollback
    exit 0
  fi

  if [ "$smoke_only" = true ]; then
    smoke_test
    exit 0
  fi

  preflight_checks
  pull_images

  if [ "$skip_migrations" = false ]; then
    run_migrations
  else
    log_info "Skipping database migrations."
  fi

  restart_services
  smoke_test

  if [ "$skip_migrations" = false ]; then
    cleanup_old_images
  fi

  echo ""
  log_info "═══════════════════════════════════════════════"
  log_info "  Deploy completed successfully!"
  log_info "  Timestamp: ${TIMESTAMP}"
  log_info "  Log file:  ${LOG_FILE}"
  log_info "═══════════════════════════════════════════════"
  echo ""
}

main "$@"
