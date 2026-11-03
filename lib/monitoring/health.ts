/**
 * Health check utility — verifies connectivity to critical services.
 *
 * Used by the `/api/health` endpoint to report service status.
 * All checks are non-throwing and return structured status objects.
 */

import { prisma } from '@/lib/prisma';

export interface ServiceStatus {
  status: 'connected' | 'error' | 'not_configured';
  latency?: number;
  error?: string;
}

export interface HealthReport {
  status: 'ok' | 'degraded' | 'error';
  service: string;
  version?: string;
  timestamp: string;
  uptime: number;
  services: {
    db: ServiceStatus;
    redis: ServiceStatus;
  };
}

/**
 * Check PostgreSQL connectivity by running a trivial query.
 * Returns the status and latency in milliseconds.
 */
async function checkDatabase(): Promise<ServiceStatus> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      status: 'connected',
      latency: Date.now() - start,
    };
  } catch (err) {
    return {
      status: 'error',
      error: err instanceof Error ? err.message : 'Unknown database error',
    };
  }
}

/**
 * Check Redis connectivity.
 *
 * Uses dynamic import of `ioredis` so the app works without it installed.
 * Returns `not_configured` if REDIS_URL is missing, or if ioredis is not installed.
 */
async function checkRedis(): Promise<ServiceStatus> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    return { status: 'not_configured' };
  }

  let Redis: typeof import('ioredis').default;
  try {
    Redis = (await import('ioredis')).default;
  } catch {
    return {
      status: 'not_configured',
      error: 'ioredis package not installed',
    };
  }

  const start = Date.now();
  const client = new Redis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    retryStrategy: () => null, // disable retry for health check
  });

  try {
    await client.connect();
    await client.ping();
    return {
      status: 'connected',
      latency: Date.now() - start,
    };
  } catch (err) {
    return {
      status: 'error',
      error: err instanceof Error ? err.message : 'Unknown Redis error',
    };
  } finally {
    try {
      client.disconnect();
    } catch {
      // ignore disconnect errors
    }
  }
}

/**
 * Run all health checks and return a comprehensive report.
 *
 * The overall status is:
 *   - 'ok'       when all services are connected
 *   - 'degraded' when non-critical services (Redis) are down or not configured
 *   - 'error'    when the database is unreachable
 */
export async function getHealthReport(): Promise<HealthReport> {
  const [db, redis] = await Promise.all([checkDatabase(), checkRedis()]);

  let overallStatus: HealthReport['status'] = 'ok';
  if (db.status === 'error') {
    overallStatus = 'error';
  } else if (redis.status === 'error') {
    overallStatus = 'degraded';
  }

  return {
    status: overallStatus,
    service: 'aitoearn-app',
    version: process.env.NEXT_PUBLIC_APP_VERSION || undefined,
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    services: {
      db,
      redis,
    },
  };
}
