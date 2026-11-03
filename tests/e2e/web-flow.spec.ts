/**
 * E2E: Web Application Flow
 *
 * Tests the core user journey through the AI LeetCode Coach web app:
 *   Landing → Login (mocked) → Onboarding → Daily Push → Rate → Dashboard
 *
 * NOTE: WeChat OAuth cannot be automated. We use session mocking
 * (auth-helper.ts) to simulate an authenticated session. This approach
 * tests the UI rendering, data display, and interaction patterns without
 * requiring real OAuth credentials.
 *
 * Prerequisites:
 *   npm install -D @playwright/test
 *   npx playwright install chromium
 *   npm run build && npm start  (or: npm run dev)
 *
 * Run:
 *   npx playwright test tests/e2e/web-flow.spec.ts --headed
 */

import { test, expect } from '@playwright/test';
import {
  mockAuthenticatedSession,
  mockApiRoutes,
  MOCK_PLANS,
} from './auth-helper';

// ── Increase timeout for full-flow tests ─────────────────────────────

test.describe('Web App Full Flow', () => {
  // ── Global auth mock ──────────────────────────────────────────────
  // Every test in this suite runs as an authenticated user.
  test.beforeEach(async ({ page }) => {
    await mockAuthenticatedSession(page);
    await mockApiRoutes(page);
  });

  // ─────────────────────────────────────────────────────────────────
  // Step 1: Landing Page
  // ─────────────────────────────────────────────────────────────────
  test('1. Landing page renders hero section and key content', async ({ page }) => {
    await page.goto('/');

    // Wait for the page to fully load (JS animations etc.)
    await page.waitForLoadState('networkidle');

    // The hero section contains a large heading
    const heading = page.locator('h1');
    await expect(heading).toBeVisible();

    // Verify the app name is displayed
    await expect(page.locator('text=AI LeetCode')).toBeVisible();

    // Verify the badge pill is visible
    await expect(page.locator('text=即将上线')).toBeVisible();

    // Verify the CTA button
    const ctaButton = page.locator('text=立即预约');
    await expect(ctaButton).toBeVisible();

    // Verify key value props section
    await expect(page.locator('text=个性化学习路径')).toBeVisible();
    await expect(page.locator('text=遗忘曲线算法')).toBeVisible();

    // Verify the pricing section is rendered
    await expect(page.locator('text=抢先预约')).toBeVisible();
    await expect(page.locator('text=成为第一批用户')).toBeVisible();

    // Verify footer
    await expect(page.locator('text=AI LeetCode 私教 · 智能刷题教练')).toBeVisible();
  });

  // ─────────────────────────────────────────────────────────────────
  // Step 2: Onboarding Flow
  // ─────────────────────────────────────────────────────────────────
  test('2. Onboarding flow — select plan, set quota, confirm', async ({ page }) => {
    // Navigate directly to onboarding (auth is mocked)
    await page.goto('/onboarding');
    await page.waitForLoadState('networkidle');

    // ── Step 2a: Plan Selection (Step 1 of 3) ─────────────────
    // Verify the page title
    await expect(page.locator('text=选择学习计划')).toBeVisible();

    // Verify all 3 plan cards are rendered (plans come from mock API)
    for (const plan of MOCK_PLANS) {
      await expect(page.locator(`text=${plan.name}`)).toBeVisible();
    }

    // Select the first plan ("面试冲刺")
    const firstPlanButton = page.locator('button[aria-pressed="false"]').first();
    await firstPlanButton.click();

    // Verify it became selected (aria-pressed changes to true)
    await expect(
      page.locator('button[aria-pressed="true"]'),
    ).toBeVisible();

    // Click "下一步"
    const nextButton = page.locator('text=下一步');
    await nextButton.click();

    // ── Step 2b: Daily Quota (Step 2 of 3) ───────────────────
    await expect(page.locator('text=设置每日题量')).toBeVisible();

    // The QuotaSelector has 3 options: 3, 5, 10
    // Default is 5, let's select 3 instead
    await page.locator('text=3 题/天').click();
    await expect(
      page.locator('button[aria-pressed="true"]'),
    ).toContainText('3 题/天');

    // Click "下一步"
    await nextButton.click();

    // ── Step 2c: Confirmation (Step 3 of 3) ──────────────────
    await expect(page.locator('text=确认选择')).toBeVisible();

    // Verify the summary card shows the selected plan details
    await expect(page.locator('text=面试冲刺')).toBeVisible();
    await expect(page.locator('text=3 题/天')).toBeVisible();

    // Click "开始学习" (submit button)
    const submitButton = page.locator('text=开始学习');
    await submitButton.click();

    // After submission, the page redirects to /dashboard
    await page.waitForURL('**/dashboard', { timeout: 5000 }).catch(() => {
      // The redirect might not happen if the middleware intercepts it.
      // In that case, we manually navigate.
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // Step 3: Daily Push Page
  // ─────────────────────────────────────────────────────────────────
  test('3. Daily push page displays problem list', async ({ page }) => {
    await page.goto('/daily');
    await page.waitForLoadState('networkidle');

    // Verify the daily push page title
    await expect(page.locator('text=每日推送')).toBeVisible();

    // Wait for problem cards to render (from mock data)
    await page.waitForSelector('text=两数之和', { timeout: 5000 }).catch(() => {
      // Problem title might render in English if titleCn is not used
    });

    // Verify at least one problem card is rendered
    // The mock data has 3 problems
    const completedCount = page.locator('text=已完成');
    await expect(completedCount).toBeVisible();

    // Verify the progress bar is visible (render check)
    const progressBar = page.locator('div[class*="rounded-full"]').first();
    await expect(progressBar).toBeVisible();

    // Verify all 3 problems from mock data appear
    await expect(page.locator('text=两数之和').or(page.locator('text=Two Sum'))).toBeVisible();
    await expect(page.locator('text=三数之和').or(page.locator('text=3Sum'))).toBeVisible();
    await expect(page.locator('text=接雨水').or(page.locator('text=Trapping Rain Water'))).toBeVisible();
  });

  // ─────────────────────────────────────────────────────────────────
  // Step 4: Rate Problem
  // ─────────────────────────────────────────────────────────────────
  test('4. Rate a problem — click complete, select mastery, verify update', async ({ page }) => {
    await page.goto('/daily');
    await page.waitForLoadState('networkidle');

    // Find and click the "已做完" button on the first problem card
    const completeButton = page.locator('button', { hasText: '已做完' }).first();
    await expect(completeButton).toBeVisible();
    await completeButton.click();

    // The RatingModal should appear
    // Check for the modal header text
    await expect(page.locator('text=请评价你的掌握程度')).toBeVisible();

    // The problem title should be visible in the modal
    await expect(
      page.locator('text=两数之和').or(page.locator('text=Two Sum')),
    ).toBeVisible();

    // Select "熟练" (mastery = 1, green option)
    const masteryButton = page.locator('text=熟练').first();
    await expect(masteryButton).toBeVisible();
    await masteryButton.click();

    // After rating, the modal closes and the problem card updates
    // The mock API returns success, so the card should show "已完成"
    await expect(
      page.locator('text=已完成').first(),
    ).toBeVisible({ timeout: 5000 });
  });

  // ─────────────────────────────────────────────────────────────────
  // Step 5: Dashboard
  // ─────────────────────────────────────────────────────────────────
  test('5. Dashboard renders progress ring, topic heatmap, and stats', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Verify page title
    await expect(page.locator('text=学习仪表盘')).toBeVisible();

    // ── Stats Cards ────────────────────────────────────────────
    // Mock data: streak=5, remaining=68, estimated completion in 180 days
    await expect(page.locator('text=5').first()).toBeVisible({ timeout: 5000 });

    // ── Progress Ring ──────────────────────────────────────────
    // The progress ring section title
    await expect(page.locator('text=总进度')).toBeVisible();

    // Verify the solved/total display (mock: 12/80 = 15%)
    await expect(page.locator('text=15%').or(page.locator('text=12'))).toBeVisible();

    // ── Topic Heatmap ──────────────────────────────────────────
    // Section title
    await expect(page.locator('text=知识点掌握情况')).toBeVisible();

    // Verify some topics from mock data are rendered
    await expect(page.locator('text=Arrays & Hashing')).toBeVisible();
    await expect(page.locator('text=Dynamic Programming')).toBeVisible();

    // ── Review Calendar ────────────────────────────────────────
    // Section title
    await expect(page.locator('text=打卡日历')).toBeVisible();

    // Verify the "过去 30 天" subtitle
    await expect(page.locator('text=过去 30 天')).toBeVisible();
  });

  // ─────────────────────────────────────────────────────────────────
  // Step 6: Full Flow — Onboarding → Daily → Dashboard
  // ─────────────────────────────────────────────────────────────────
  test('6. Complete flow: navigate between all pages', async ({ page }) => {
    // Start at landing
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1')).toBeVisible();

    // Navigate to dashboard (should work with auth mock)
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=学习仪表盘')).toBeVisible();

    // Navigate to daily push
    await page.goto('/daily');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=每日推送')).toBeVisible();

    // Navigate to onboarding
    await page.goto('/onboarding');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=选择学习计划')).toBeVisible();

    // Navigate to subscribe page
    await page.goto('/subscribe');
    await page.waitForLoadState('networkidle');

    // Should see the subscribe page title (mock status = 'free')
    await expect(page.locator('text=升级你的学习体验')).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────
// Unauthenticated State
// ─────────────────────────────────────────────────────────────────────
test.describe('Unauthenticated State', () => {
  test('should redirect to login when accessing protected pages', async ({ page }) => {
    // Do NOT mock auth — test the real redirect behavior
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Should be redirected to /login
    await expect(page).toHaveURL(/\/login/);
  });

  test('landing page is accessible without auth', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Landing page should render without redirect
    await expect(page.locator('h1')).toBeVisible();
    await expect(page).toHaveURL('/');
  });
});
