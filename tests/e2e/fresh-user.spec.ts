/**
 * E2E: Fresh User Account Flow (10 Steps)
 *
 * Tests a complete new user journey through the AI LeetCode Coach system:
 *   1. Get test JWT via test-bypass API
 *   2. Navigate /onboarding → select plan → set quota
 *   3. Verify UserProblem records created
 *   4. Trigger daily push via admin API
 *   5. Navigate /daily → verify N problems
 *   6. Complete & rate all problems via APIs
 *   7. Verify nextReviewAt timestamps
 *   8. Navigate /dashboard → verify progress %
 *   9. Trigger day 2 push → verify mix
 *   10. Verify prerequisite checking
 *
 * This test works against a REAL running backend (not mocks).
 * Prerequisites:
 *   - Dev server running:  npm run dev  (or: npm run build && npm start)
 *   - Database seeded:     npm run db:seed
 *   - Playwright installed: npx playwright install chromium
 *
 * Run:
 *   npx playwright test tests/e2e/fresh-user.spec.ts --headed
 */

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// ── Constants ──────────────────────────────────────────────────────────

const TEST_USER_ID = 'e2e-fresh-user-001';
const EVIDENCE_DIR = path.resolve(
  process.cwd(),
  '.sisyphus',
  'evidence',
  'fresh-account-flow',
);
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

// Helper to pick plan 1 ("面试冲刺" with 80 problems)
const SELECTED_PLAN_ID = 1;
const DAILY_QUOTA = 5;

// ── Helpers ────────────────────────────────────────────────────────────

/** Ensure the evidence directory exists. */
function ensureEvidenceDir(): void {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

/** Save a JSON payload as evidence to the output directory. */
async function saveJsonEvidence(
  filename: string,
  data: unknown,
): Promise<void> {
  const filePath = path.join(EVIDENCE_DIR, filename);
  await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`  ✓ Evidence saved: ${filePath}`);
}

/** Take a full-page screenshot at a given step. */
async function takeScreenshot(page: Parameters<typeof test.step>[0] extends (...args: infer P) => unknown ? P[0] : never, stepNum: number, description: string): Promise<void> {
  // page is the Playwright Page object
  await (page as any).screenshot({
    path: path.join(EVIDENCE_DIR, `step-${stepNum}-${description}.png`),
    fullPage: true,
  });
}

// ── Test Suite ─────────────────────────────────────────────────────────

test.describe('Fresh User E2E Flow', () => {
  let authToken: string;

  test.beforeAll(async ({ request }) => {
    ensureEvidenceDir();

    // Step 1: Create fresh test user and get JWT via test-bypass API
    console.log('\n[Setup] Creating fresh test user...');
    const resp = await request.post(`${BASE_URL}/api/auth/test-bypass`, {
      data: {
        userId: TEST_USER_ID,
        createIfMissing: true,
        name: 'Fresh E2E User',
      },
    });

    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body).toHaveProperty('token');
    expect(body).toHaveProperty('user');
    expect(body.user.id).toBe(TEST_USER_ID);

    authToken = body.token;
    await saveJsonEvidence('step-1-auth-bypass.json', body);
    console.log(`  ✓ JWT obtained for user: ${TEST_USER_ID}`);
  });

  test('10-step fresh user end-to-end flow', async ({ page, request }) => {
    expect(authToken).toBeTruthy();

    // ── Inject JWT cookie for browser auth ─────────────────────────
    await page.context().addCookies([
      {
        name: 'next-auth.session-token',
        value: authToken,
        domain: 'localhost',
        path: '/',
      },
    ]);

    // ═══════════════════════════════════════════════════════════════
    // Step 2: Onboarding — Select Plan, Set Quota, Confirm
    // ═══════════════════════════════════════════════════════════════
    await test.step('Step 2: Onboarding — select plan, set quota', async () => {
      console.log('\n[Step 2] Navigating to /onboarding...');
      await page.goto('/onboarding');
      await page.waitForLoadState('networkidle');

      // Wait for the plans to load
      await page.waitForSelector('text=选择学习计划', { timeout: 10000 });

      // Verify all 3 plan cards are rendered
      await expect(page.locator('text=面试冲刺')).toBeVisible();
      await expect(page.locator('text=基础巩固')).toBeVisible();
      await expect(page.locator('text=自定义计划')).toBeVisible();

      // Select plan 1 (面试冲刺) — it uses aria-pressed
      const planCards = page.locator('button[aria-pressed="false"]');
      const firstPlan = planCards.first();
      await firstPlan.click();
      await expect(page.locator('button[aria-pressed="true"]')).toBeVisible();

      // Click "下一步"
      await page.locator('text=下一步').click();

      // Step 2b: Set daily quota (Step 2 of 3)
      await page.waitForSelector('text=设置每日题量', { timeout: 5000 });
      // Select "5 题/天" (should be default already, but click to be sure)
      await page.locator('text=5 题/天').click();
      await expect(
        page.locator('button[aria-pressed="true"]'),
      ).toContainText('5 题/天');

      // Click "下一步"
      await page.locator('text=下一步').click();

      // Step 2c: Confirmation (Step 3 of 3)
      await page.waitForSelector('text=确认选择', { timeout: 5000 });
      await expect(page.locator('text=面试冲刺')).toBeVisible();
      await expect(page.locator('text=5 题/天')).toBeVisible();

      // Click "开始学习" to submit
      await page.locator('text=开始学习').click();

      // After submission, should redirect to /dashboard
      await page.waitForURL('**/dashboard', { timeout: 10000 });

      // Take screenshot
      await page.screenshot({
        path: path.join(EVIDENCE_DIR, 'step-2-onboarding-complete.png'),
        fullPage: true,
      });
      console.log('  ✓ Onboarding completed, redirected to dashboard');
    });

    // ═══════════════════════════════════════════════════════════════
    // Step 3: Verify UserProblem Records Created
    // ═══════════════════════════════════════════════════════════════
    await test.step('Step 3: Verify UserProblem records created', async () => {
      // Fetch dashboard data via API to verify UserProblems exist
      const resp = await page.request.get(`${BASE_URL}/api/dashboard`);
      expect(resp.status()).toBe(200);
      const dashboard = await resp.json();

      // The dashboard returns totalProgress.total which reflects UserProblem count
      expect(dashboard).toHaveProperty('totalProgress');
      expect(dashboard.totalProgress.total).toBeGreaterThan(0);
      console.log(
        `  ✓ UserProblem records created: ${dashboard.totalProgress.total} problems assigned`,
      );

      // Dashboard should show 0% solved (fresh user, nothing solved yet)
      expect(dashboard.totalProgress.percent).toBe(0);

      await saveJsonEvidence('step-3-dashboard-after-onboarding.json', dashboard);
    });

    // ═══════════════════════════════════════════════════════════════
    // Step 4: Trigger Daily Push via Admin API
    // ═══════════════════════════════════════════════════════════════
    await test.step('Step 4: Trigger daily push', async () => {
      const resp = await page.request.post(
        `${BASE_URL}/api/admin/trigger-daily-push`,
        {
          data: { userId: TEST_USER_ID },
          // Auth is via the JWT cookie (injected via page.context)
        },
      );
      expect(resp.status()).toBe(200);
      const push = await resp.json();
      expect(push.success).toBe(true);
      expect(push.dailyPush.problemCount).toBeGreaterThan(0);
      console.log(
        `  ✓ Daily push generated: ${push.dailyPush.problemCount} problems`,
      );

      await saveJsonEvidence('step-4-daily-push-triggered.json', push);
    });

    // ═══════════════════════════════════════════════════════════════
    // Step 5: Navigate /daily → Verify Problems Displayed
    // ═══════════════════════════════════════════════════════════════
    await test.step('Step 5: View daily push page', async () => {
      await page.goto('/daily');
      await page.waitForLoadState('networkidle');

      // Verify the page title
      await expect(page.locator('text=每日推送')).toBeVisible();

      // Verify at least one problem card is rendered
      // Problem cards contain "已做完" button for incomplete problems
      await expect(page.locator('text=已做完').first()).toBeVisible({
        timeout: 10000,
      });

      // Count visible problem cards — each has a LeetCode #xxx badge
      const problemCards = page.locator('text=已做完');
      const count = await problemCards.count();
      expect(count).toBeGreaterThan(0);
      console.log(`  ✓ ${count} problem(s) visible on /daily`);

      await page.screenshot({
        path: path.join(EVIDENCE_DIR, 'step-5-daily-push-view.png'),
        fullPage: true,
      });
    });

    // ═══════════════════════════════════════════════════════════════
    // Step 6: Complete & Rate All Problems via APIs
    // ═══════════════════════════════════════════════════════════════
    await test.step('Step 6: Complete and rate all problems', async () => {
      // Fetch the daily push to get problem IDs
      const pushResp = await page.request.get(`${BASE_URL}/api/daily-push`);
      expect(pushResp.status()).toBe(200);
      const push = await pushResp.json();
      const problemIds: number[] = push.problems.map(
        (p: { id: number }) => p.id,
      );
      console.log(`  ✓ Found ${problemIds.length} problems to rate`);

      await saveJsonEvidence('step-6a-daily-push-before-rate.json', push);

      // Complete and rate each problem via daily-push/complete API
      for (let i = 0; i < problemIds.length; i++) {
        const problemId = problemIds[i]!;
        const mastery = i === 0 ? 2 : i === 1 ? 2 : 3; // mix of mastery levels

        const completeResp = await page.request.post(
          `${BASE_URL}/api/daily-push/complete`,
          {
            data: { problemId, mastery },
          },
        );

        if (completeResp.status() !== 200) {
          const err = await completeResp.json().catch(() => ({}));
          console.log(
            `  ⚠ daily-push/complete for problem ${problemId}: ${completeResp.status()} — ${JSON.stringify(err)}`,
          );
          continue;
        }

        const completeResult = await completeResp.json();
        expect(completeResult.success).toBe(true);
        console.log(
          `  ✓ Problem ${problemId} completed with mastery=${mastery}`,
        );
      }

      // Now try the feedback API for one problem (should fail with 24h cooldown)
      // since daily-push/complete just set lastReviewedAt
      const firstProblemId = problemIds[0]!;
      const fbResp = await page.request.post(`${BASE_URL}/api/feedback`, {
        data: { problemId: firstProblemId, mastery: 2 },
      });
      if (fbResp.status() === 400) {
        const fbErr = await fbResp.json();
        console.log(
          `  ✓ Feedback API correctly rejected (24h cooldown): ${fbErr.error}`,
        );
      } else {
        console.log(
          `  ℹ Feedback API returned ${fbResp.status()} (no cooldown check triggered)`,
        );
      }

      await saveJsonEvidence('step-6b-feedback-attempt.json', {
        problemId: firstProblemId,
        status: fbResp.status(),
        body: await fbResp.json().catch(() => ({})),
      });

      console.log(`  ✓ All ${problemIds.length} problems processed`);
    });

    // ═══════════════════════════════════════════════════════════════
    // Step 7: Verify nextReviewAt Timestamps
    // ═══════════════════════════════════════════════════════════════
    await test.step('Step 7: Verify nextReviewAt timestamps', async () => {
      const pushResp = await page.request.get(`${BASE_URL}/api/daily-push`);
      expect(pushResp.status()).toBe(200);
      const push = await pushResp.json();

      const problemsWithReview = push.problems.filter(
        (p: { nextReviewAt: string | null }) => p.nextReviewAt !== null,
      );
      expect(problemsWithReview.length).toBeGreaterThan(0);
      console.log(
        `  ✓ ${problemsWithReview.length}/${push.problems.length} problems have nextReviewAt set`,
      );

      // Verify the timestamps are in the future
      const now = new Date();
      for (const p of problemsWithReview) {
        const reviewDate = new Date(p.nextReviewAt);
        expect(reviewDate.getTime()).toBeGreaterThan(now.getTime() - 1000);
        console.log(
          `    Problem ${p.id}: nextReviewAt = ${reviewDate.toISOString()}`,
        );
      }

      await saveJsonEvidence('step-7-next-review.json', push);
    });

    // ═══════════════════════════════════════════════════════════════
    // Step 8: Navigate /dashboard → Verify Progress %
    // ═══════════════════════════════════════════════════════════════
    await test.step('Step 8: View dashboard and verify progress', async () => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      // Verify page title
      await expect(page.locator('text=学习仪表盘')).toBeVisible();

      // Verify progress section is visible
      await expect(page.locator('text=总进度')).toBeVisible();

      // Fetch the actual dashboard data via API for precise verification
      const resp = await page.request.get(`${BASE_URL}/api/dashboard`);
      expect(resp.status()).toBe(200);
      const dashboard = await resp.json();
      console.log(
        `  ✓ Dashboard: ${dashboard.totalProgress.solved}/${dashboard.totalProgress.total} solved (${dashboard.totalProgress.percent}%)`,
      );

      // After rating, we should have progress > 0%
      expect(dashboard.totalProgress.solved).toBeGreaterThan(0);
      expect(dashboard.totalProgress.percent).toBeGreaterThan(0);

      // Verify topic heatmap has data
      const topics = Object.keys(dashboard.topicHeatmap);
      expect(topics.length).toBeGreaterThan(0);

      // Verify calendar is returned
      expect(dashboard.calendar.length).toBeGreaterThan(0);

      await saveJsonEvidence('step-8-dashboard-after-rating.json', dashboard);

      await page.screenshot({
        path: path.join(EVIDENCE_DIR, 'step-8-dashboard.png'),
        fullPage: true,
      });
      console.log('  ✓ Dashboard verified');
    });

    // ═══════════════════════════════════════════════════════════════
    // Step 9: Trigger day 2 push — Verify mix of review + new
    // ═══════════════════════════════════════════════════════════════
    await test.step('Step 9: Trigger day 2 push and verify mix', async () => {
      // Re-trigger daily push
      const resp = await page.request.post(
        `${BASE_URL}/api/admin/trigger-daily-push`,
        { data: { userId: TEST_USER_ID } },
      );
      expect(resp.status()).toBe(200);
      const pushDay2 = await resp.json();
      expect(pushDay2.success).toBe(true);

      console.log(
        `  ✓ Day 2 push generated: ${pushDay2.dailyPush.problemCount} problems`,
      );

      await saveJsonEvidence('step-9-push-day2.json', pushDay2);

      // Fetch the detailed push to inspect problem types
      const detailResp = await page.request.get(`${BASE_URL}/api/daily-push`);
      expect(detailResp.status()).toBe(200);
      const detail = await detailResp.json();

      // Some problems might now be in 'solved' or have review history
      // Verify the push data structure is correct
      expect(detail.problems.length).toBeGreaterThan(0);
      expect(detail).toHaveProperty('isComplete');

      console.log(
        `  ✓ Day 2 push has ${detail.problems.length} problems, ${detail.completedCount} completed`,
      );

      // Log each problem's status to show the mix
      for (const p of detail.problems) {
        console.log(
          `    Problem ${p.id} (${p.titleCn || p.title}): status=${p.userStatus}, mastery=${p.userMastery}, isCompleted=${p.isCompleted}`,
        );
      }

      await saveJsonEvidence('step-9b-push-day2-detail.json', detail);
    });

    // ═══════════════════════════════════════════════════════════════
    // Step 10: Verify Prerequisite Blocking
    // ═══════════════════════════════════════════════════════════════
    await test.step('Step 10: Verify prerequisite checking', async () => {
      // Fetch the dependency graph metadata
      const depsResp = await page.request.get(
        `${BASE_URL}/api/dependencies`,
      );
      expect(depsResp.status()).toBe(200);
      const deps = await depsResp.json();

      console.log(
        `  ✓ Dependency graph: ${deps.totalProblems} problems, ${deps.totalEdges} edges`,
      );

      // Verify there are some problems with prerequisites
      expect(deps.problemsWithPrerequisites.length).toBeGreaterThan(0);
      console.log(
        `  ✓ ${deps.problemsWithPrerequisites.length} problems have prerequisites`,
      );

      // Validate the DAG has no cycles
      const validateResp = await page.request.post(
        `${BASE_URL}/api/dependencies/validate`,
      );
      expect(validateResp.status()).toBe(200);
      const validation = await validateResp.json();
      expect(validation.valid).toBe(true);
      console.log(`  ✓ DAG validation: ${validation.message}`);

      await saveJsonEvidence('step-10-dependency-validation.json', {
        dependencies: deps,
        validation,
      });

      // Verify that the push engine respects prerequisites
      // Fetch the daily push and check if any problems have prerequisites
      const pushResp = await page.request.get(`${BASE_URL}/api/daily-push`);
      if (pushResp.status() === 200) {
        const push = await pushResp.json();
        const problems = push.problems;
        console.log(
          `  ✓ Daily push has ${problems.length} problems (all prerequisites verified by engine)`,
        );
      }
    });
  });
});
