/**
 * Sentry error tracking configuration.
 *
 * This module provides a wrapper around the Sentry SDK for frontend error tracking.
 * Sentry is NOT auto-initialized — call `initSentry()` explicitly in your app root.
 *
 * Usage:
 *   import { initSentry, captureError } from '@/lib/monitoring/sentry';
 *   initSentry();
 *
 * Dependencies (install separately, not bundled by default):
 *   npm install @sentry/nextjs
 *
 * Environment variables:
 *   NEXT_PUBLIC_SENTRY_DSN  — Public DSN for frontend error reporting
 *   SENTRY_ORG              — Sentry org slug (optional, for source maps)
 *   SENTRY_PROJECT          — Sentry project slug (optional, for source maps)
 *   SENTRY_AUTH_TOKEN       — Auth token for source map uploads (server-side only)
 */

type SentryInstance = any;

let _sentry: SentryInstance | null = null;

/**
 * Lazily load the Sentry SDK. Returns null if `@sentry/nextjs` is not installed
 * or if loading fails. All calls are safe to use without the SDK installed.
 */
function getSentry(): SentryInstance | null {
  if (_sentry !== undefined) {
    return _sentry;
  }

  try {
    // Dynamic require so the app works without @sentry/nextjs installed
    _sentry = require('@sentry/nextjs');
  } catch {
    _sentry = null;
  }

  return _sentry;
}

export interface SentryConfig {
  dsn?: string;
  environment?: string;
  tracesSampleRate?: number;
  replaysSessionSampleRate?: number;
  replaysOnErrorSampleRate?: number;
}

const DEFAULT_CONFIG: SentryConfig = {
  environment: process.env.NODE_ENV || 'development',
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
};

/**
 * Initialize Sentry SDK for frontend error tracking.
 *
 * Call this once at the app root (e.g., in a client component or layout).
 * Safe to call multiple times — subsequent calls are no-ops.
 *
 * NOTE: This requires `@sentry/nextjs` to be installed.
 * See `scripts/monitoring-setup.md` for setup instructions.
 */
export function initSentry(config: SentryConfig = {}): void {
  const dsn = config.dsn || process.env.NEXT_PUBLIC_SENTRY_DSN;

  if (!dsn) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        '[Sentry] NEXT_PUBLIC_SENTRY_DSN not set. Sentry will not be initialized.',
      );
    }
    return;
  }

  const Sentry = getSentry();

  if (!Sentry) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        '[Sentry] @sentry/nextjs not installed. Skipping initialization.',
      );
    }
    return;
  }

  if (Sentry.isInitialized?.()) {
    return;
  }

  const merged: SentryConfig = { ...DEFAULT_CONFIG, ...config, dsn };

  Sentry.init({
    dsn,
    environment: merged.environment,
    tracesSampleRate: merged.tracesSampleRate,
    replaysSessionSampleRate: merged.replaysSessionSampleRate,
    replaysOnErrorSampleRate: merged.replaysOnErrorSampleRate,
  });

  console.warn('[Sentry] Initialized for environment:', merged.environment);
}

/**
 * Capture an exception and send it to Sentry.
 *
 * Gracefully no-ops if Sentry is not initialized or not installed.
 */
export function captureError(error: unknown, context?: Record<string, unknown>): void {
  const Sentry = getSentry();

  if (!Sentry?.captureException) {
    return;
  }

  Sentry.captureException(error, { extra: context });
}

/**
 * Set the current user context for Sentry events.
 */
export function setSentryUser(user: { id: string; email?: string; username?: string }): void {
  const Sentry = getSentry();

  if (!Sentry?.setUser) {
    return;
  }

  Sentry.setUser(user);
}

/**
 * Add a breadcrumb for user actions leading up to an error.
 */
export function addSentryBreadcrumb(
  message: string,
  category?: string,
  data?: Record<string, unknown>,
): void {
  const Sentry = getSentry();

  if (!Sentry?.addBreadcrumb) {
    return;
  }

  Sentry.addBreadcrumb({
    message,
    category: category || 'action',
    data,
    level: 'info',
  });
}
