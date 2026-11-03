# Monitoring Setup Guide

This document explains how to set up monitoring and alerting for the AitoEarn application.

---

## Table of Contents

1. [Sentry (Error Tracking)](#1-sentry-error-tracking)
2. [UptimeRobot (Availability Monitoring)](#2-uptimerobot-availability-monitoring)
3. [Health Check Endpoint](#3-health-check-endpoint)
4. [Database Backups](#4-database-backups)
5. [Alert Thresholds](#5-alert-thresholds)

---

## 1. Sentry (Error Tracking)

Sentry captures frontend JavaScript errors and backend exceptions, with context about the user and environment.

### Setup

1. **Create a Sentry account** at [sentry.io](https://sentry.io) (free tier available).

2. **Create a new project**:
   - Platform: **Next.js**
   - Name: `aitoearn-app`

3. **Get your DSN**:
   - Go to **Settings → Projects → aitoearn-app → Client Keys (DSN)**
   - Copy the DSN string (starts with `https://`)

4. **Set environment variables** (in `.env` and `.env.example`):

   ```bash
   NEXT_PUBLIC_SENTRY_DSN="https://xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx@sentry.io/xxxxxx"
   SENTRY_ORG="your-sentry-org"
   SENTRY_PROJECT="aitoearn-app"
   SENTRY_AUTH_TOKEN="your-auth-token"     # For source map uploads (keep secret)
   ```

5. **Install the Sentry SDK**:

   ```bash
   npm install @sentry/nextjs
   ```

   > **Note**: The SDK is not pre-installed. The app will work without it — Sentry calls gracefully no-op when the package is missing.

6. **Initialize Sentry in your app**:

   In your root layout or a client component:

   ```typescript
   import { initSentry } from '@/lib/monitoring/sentry';

   // In a useEffect or component mount:
   initSentry();
   ```

### Source Maps for Stack Traces

To get readable stack traces in production, upload source maps during your build:

```bash
npx sentry-cli sourcemaps inject --release "$(npx sentry-cli releases propose-version)" .next/static
npx sentry-cli sourcemaps upload --release "$(npx sentry-cli releases propose-version)" .next/static
```

Or, if using `@sentry/nextjs`, configure automatic upload in `next.config.js`:

```javascript
// next.config.js
const { withSentryConfig } = require('@sentry/nextjs');

const nextConfig = {
  // existing config
};

module.exports = withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
});
```

---

## 2. UptimeRobot (Availability Monitoring)

UptimeRobot checks your health endpoint every 5 minutes and sends alerts when the site is down.

### Setup

1. **Create an account** at [uptimerobot.com](https://uptimerobot.com) (free tier: 50 monitors).

2. **Add a new monitor**:
   - Monitor Type: **HTTP(s)**
   - Friendly Name: `AitoEarn Production`
   - URL: `https://yourdomain.com/api/health`
   - Interval: **5 minutes**
   - Timeout: **30 seconds**
   - Select alert contacts (email, SMS, etc.)

3. **Optional — Add Status Page** (free tier includes one):
   - Go to **My Settings → Status Pages**
   - Create a public status page at `status.yourdomain.com`

### What UptimeRobot Checks

The `/api/health` endpoint returns:

- **HTTP 200** — All services healthy (or Redis not configured — still OK)
- **HTTP 503** — Database unreachable (critical)

UptimeRobot will alert on any non-200 response or timeout.

---

## 3. Health Check Endpoint

The built-in health endpoint at `GET /api/health` returns:

```json
{
  "status": "ok",
  "service": "aitoearn-app",
  "timestamp": "2025-05-18T03:00:00.000Z",
  "uptime": 12345,
  "services": {
    "db": {
      "status": "connected",
      "latency": 2
    },
    "redis": {
      "status": "connected",
      "latency": 1
    }
  }
}
```

| Field | Description |
|-------|-------------|
| `status` | `ok`, `degraded` (Redis down), or `error` (DB down) |
| `services.db.status` | `connected`, `error`, or `not_configured` |
| `services.redis.status` | `connected`, `error`, or `not_configured` |
| `timestamp` | ISO 8601 timestamp |
| `uptime` | Process uptime in seconds |

### Using with Docker Healthchecks

The health endpoint can be used in `docker-compose.yml` as a container healthcheck:

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 15s
```

---

## 4. Database Backups

The backup script is at `scripts/backup.sh` and runs daily at 03:00 via cron/systemd timer.

See [`scripts/backup.sh`](./backup.sh) and [`scripts/setup-cron.sh`](./setup-cron.sh) for details.

### Manual Backup

```bash
# Basic backup
./scripts/backup.sh --db-name aitoearn --output-dir /tmp/backups

# Backup with Backblaze B2 upload
./scripts/backup.sh --db-name aitoearn --output-dir /tmp/backups --upload
```

### Restore from Backup

```bash
gunzip -c backups/aitoearn_20250518_030000.sql.gz | pg_restore \
  --host=localhost \
  --port=5432 \
  --username=aitoearn \
  --dbname=aitoearn
```

---

## 5. Alert Thresholds

### Sentry Alerts

Configure in Sentry Dashboard → **Alerts**:

| Alert Rule | Threshold | Action |
|-----------|-----------|--------|
| **New Error** | Any new error in production | Email + Slack notification |
| **Error Volume** | > 100 errors in 1 hour | Critical alert |
| **Crash Rate** | > 5% crash rate in 5 minutes | Critical alert |

#### Recommended Alert Rules

1. **New Issue Created**: Sent immediately on first occurrence of a new error type.
2. **Users Affected**: Alert when an error affects ≥ 10 users in 1 hour.
3. **Performance Degradation**: Alert if page load (LCP) exceeds 4 seconds for > 10% of users.

### UptimeRobot Alerts

| Condition | Action |
|-----------|--------|
| Down for 1 check cycle (5 min) | Email + push notification |
| SSL certificate expires in 14 days | Email reminder |
| SSL certificate expires in 7 days | Critical email |

### Health Check Integration

The health endpoint can be integrated with any monitoring tool that polls HTTP endpoints:

- **UptimeRobot**: Polls every 5 minutes, alerts on non-200
- **Better Uptime**: Same as UptimeRobot with on-call rotations
- **Checkly**: Browser checks + API checks in one platform
- **Grafana OnCall**: If you have Grafana Cloud, route alerts to Slack/PagerDuty

---

## Environment Variables Reference

Add to `.env` for monitoring:

```bash
# Sentry
NEXT_PUBLIC_SENTRY_DSN="https://xxxx@xxxx.ingest.sentry.io/project"
SENTRY_ORG="your-org-slug"
SENTRY_PROJECT="aitoearn-app"
SENTRY_AUTH_TOKEN="sntrys_XXXX"  # Keep secret!

# Backblaze B2 (for backup uploads)
BACKBLAZE_B2_KEY_ID="004XXXX"
BACKBLAZE_B2_APP_KEY="K001XXXX"
BACKBLAZE_B2_BUCKET="aitoearn-backups"
```
