/**
 * E2E Auth Helper
 *
 * Simulates authentication for Playwright E2E tests without requiring WeChat OAuth.
 *
 * Strategy:
 * 1. Create a valid NextAuth JWT and inject it as a cookie to bypass the middleware.
 * 2. Mock the `/api/auth/session` endpoint so the client-side SessionProvider believes
 *    the user is authenticated.
 * 3. Optionally mock data API endpoints to return deterministic test data.
 *
 * Usage:
 *   import { mockAuthenticatedSession } from './auth-helper';
 *   test.beforeEach(async ({ page }) => { await mockAuthenticatedSession(page); });
 */

import { createHmac } from 'crypto';
import type { Page } from '@playwright/test';

// ── Configuration ────────────────────────────────────────────────────

/** Mock user injected into the session JWT and session API response. */
export const MOCK_USER = {
  id: 'e2e-test-user-id',
  name: 'E2E Test User',
  email: 'e2e@test.local',
};

/** Secret must match the dev server's NEXTAUTH_SECRET (default in .env). */
const MOCK_SECRET = 'dev-secret-change-me';

// ── JWT Generation ───────────────────────────────────────────────────

/**
 * Creates a valid NextAuth v4 JWT token string.
 *
 * NextAuth JWT format (HS256):
 *   base64url(header).base64url(payload).base64url(signature)
 *
 * Payload fields mirror what NextAuth stores in the token:
 *   { id, openid, iat, exp, sub, name, email }
 */
function createSessionToken(secret: string): string {
  const header = {
    alg: 'HS256' as const,
    typ: 'JWT' as const,
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    ...MOCK_USER,
    openid: 'e2e-test-open-id',
    iat: now,
    exp: now + 86400, // 24 hours
    sub: MOCK_USER.id,
  };

  const headerEncoded = Buffer.from(JSON.stringify(header)).toString('base64url');
  const payloadEncoded = Buffer.from(JSON.stringify(payload)).toString('base64url');

  const signature = createHmac('sha256', secret)
    .update(`${headerEncoded}.${payloadEncoded}`)
    .digest('base64url');

  return `${headerEncoded}.${payloadEncoded}.${signature}`;
}

// ── Session API Mock Response ────────────────────────────────────────

const MOCK_SESSION_RESPONSE = {
  user: MOCK_USER,
  expires: new Date(Date.now() + 86400_000).toISOString(),
};

// ── Mock API Response Helpers ────────────────────────────────────────

/**
 * Example mock daily push data. The problems array matches the DailyProblem
 * interface expected by the daily push page.
 */
export const MOCK_DAILY_PUSH = {
  id: 'e2e-push-id',
  date: new Date().toISOString().split('T')[0],
  isComplete: false,
  problemCount: 3,
  completedCount: 0,
  problems: [
    {
      id: 101,
      leetcodeId: 1,
      title: 'Two Sum',
      titleCn: '两数之和',
      slug: 'two-sum',
      difficulty: 'Easy',
      difficultyScore: 1100,
      topic: 'Arrays & Hashing',
      userStatus: 'unsolved',
      userMastery: null,
      reviewCount: 0,
      nextReviewAt: null,
      isCompleted: false,
      isRated: false,
    },
    {
      id: 102,
      leetcodeId: 15,
      title: '3Sum',
      titleCn: '三数之和',
      slug: '3sum',
      difficulty: 'Medium',
      difficultyScore: 1500,
      topic: 'Two Pointers',
      userStatus: 'unsolved',
      userMastery: null,
      reviewCount: 0,
      nextReviewAt: null,
      isCompleted: false,
      isRated: false,
    },
    {
      id: 103,
      leetcodeId: 42,
      title: 'Trapping Rain Water',
      titleCn: '接雨水',
      slug: 'trapping-rain-water',
      difficulty: 'Hard',
      difficultyScore: 1900,
      topic: 'Sliding Window',
      userStatus: 'unsolved',
      userMastery: null,
      reviewCount: 0,
      nextReviewAt: null,
      isCompleted: false,
      isRated: false,
    },
  ],
};

/** Example mock dashboard data matching DashboardData interface. */
export const MOCK_DASHBOARD = {
  totalProgress: { solved: 12, total: 80, percent: 15 },
  topicHeatmap: {
    'Arrays & Hashing': { solved: 3, total: 15, avgMastery: 2.33 },
    'Two Pointers': { solved: 2, total: 8, avgMastery: 2.0 },
    'Sliding Window': { solved: 1, total: 6, avgMastery: 1.5 },
    'Binary Search': { solved: 2, total: 10, avgMastery: 2.5 },
    'Stack & Queue': { solved: 1, total: 5, avgMastery: 1.0 },
    'Trees & Graphs': { solved: 2, total: 18, avgMastery: 1.5 },
    'Dynamic Programming': { solved: 1, total: 12, avgMastery: 1.0 },
  },
  calendar: Array.from({ length: 30 }, (_, i) => ({
    date: new Date(Date.now() - (29 - i) * 86400_000)
      .toISOString()
      .split('T')[0],
    count: i < 5 ? 3 : i < 10 ? 2 : i < 20 ? 1 : 0,
  })),
  streak: 5,
  estimatedCompletion: {
    daysRemaining: 180,
    date: new Date(Date.now() + 180 * 86400_000)
      .toISOString()
      .split('T')[0],
  },
};

/** Example mock plans data. */
export const MOCK_PLANS = [
  {
    id: 1,
    name: '面试冲刺',
    totalProblems: 80,
    description: '覆盖大厂面试高频题，适合有一定基础的同学',
    topics: ['Arrays & Hashing', 'Two Pointers', 'Stack & Queue', 'Linked List'],
  },
  {
    id: 2,
    name: '基础巩固',
    totalProblems: 150,
    description: '系统学习所有算法题型，从入门到进阶',
    topics: ['Arrays & Hashing', 'Binary Search', 'Trees & Graphs', 'Dynamic Programming'],
  },
  {
    id: 3,
    name: '自定义计划',
    totalProblems: 0,
    description: '选择你需要的题型和题量，灵活定制',
  },
];

// ── Main Mock Setup ──────────────────────────────────────────────────

/**
 * Sets up session mocking for a Playwright page.
 *
 * Should be called in `test.beforeEach()`.
 *
 * What it does:
 * 1. Injects a valid NextAuth JWT cookie so the middleware allows access.
 * 2. Intercepts `/api/auth/session` to return mock user data.
 * 3. Intercepts `/api/auth/csrf` to return a mock CSRF token.
 *
 * Optionally, call `mockApiRoutes(page, options)` after this to mock
 * specific data API endpoints.
 */
export async function mockAuthenticatedSession(page: Page): Promise<void> {
  // ── 1. Intercept session API calls ────────────────────────────
  // The SessionProvider calls /api/auth/session on mount.
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_SESSION_RESPONSE),
    });
  });

  // ── 2. Intercept CSRF token calls ─────────────────────────────
  // NextAuth may request a CSRF token for sign-in flows.
  await page.route('**/api/auth/csrf', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ csrfToken: 'e2e-mock-csrf-token' }),
    });
  });

  // ── 3. Inject JWT cookie for middleware ───────────────────────
  // The middleware (middleware.ts) uses withAuth which checks the
  // next-auth.session-token JWT cookie. We inject a cryptographically
  // valid JWT to pass the `authorized({ token })` check.
  const token = createSessionToken(MOCK_SECRET);
  await page.context().addCookies([
    {
      name: 'next-auth.session-token',
      value: token,
      domain: 'localhost',
      path: '/',
    },
  ]);
}

/**
 * Mocks data API endpoints to return deterministic test data.
 *
 * Call this after `mockAuthenticatedSession()` if you want specific
 * data to be returned by the page's API calls.
 *
 * @param page - Playwright Page
 * @param options - Which APIs to mock (default: all)
 */
export async function mockApiRoutes(
  page: Page,
  options: {
    plans?: boolean;
    dailyPush?: boolean;
    dashboard?: boolean;
    paymentStatus?: boolean;
  } = {},
): Promise<void> {
  const defaults = {
    plans: true,
    dailyPush: true,
    dashboard: true,
    paymentStatus: true,
  };
  const opts = { ...defaults, ...options };

  // ── GET /api/plans ────────────────────────────────────────────
  if (opts.plans) {
    await page.route('**/api/plans', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_PLANS),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, userProblemCount: 80 }),
        });
      }
    });
  }

  // ── GET /api/daily-push ───────────────────────────────────────
  if (opts.dailyPush) {
    await page.route('**/api/daily-push', async (route) => {
      // Only intercept GET requests (not POST to /complete sub-route)
      if (
        route.request().method() === 'GET' &&
        !route.request().url().includes('/complete')
      ) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_DAILY_PUSH),
        });
      } else {
        await route.continue();
      }
    });

    // ── POST /api/daily-push/complete ───────────────────────────
    await page.route('**/api/daily-push/complete', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          completedIds: [101],
          isComplete: false,
        }),
      });
    });
  }

  // ── GET /api/dashboard ────────────────────────────────────────
  if (opts.dashboard) {
    await page.route('**/api/dashboard', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_DASHBOARD),
      });
    });
  }

  // ── GET /api/payment/status ───────────────────────────────────
  if (opts.paymentStatus) {
    await page.route('**/api/payment/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'free',
          trialEndsAt: null,
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
          stripeCustomerId: null,
        }),
      });
    });
  }

  // ── PUT /api/user/daily-quota ─────────────────────────────────
  await page.route('**/api/user/daily-quota', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, dailyQuota: 5 }),
    });
  });
}
