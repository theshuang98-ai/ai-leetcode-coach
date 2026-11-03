// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * Playwright configuration for AI LeetCode Coach E2E tests.
 * @see https://playwright.dev/docs/test-configuration
 */
module.exports = defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
  ],

  // Timeout per test (ms)
  timeout: 60000,
  expect: {
    timeout: 15000,
  },

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // zh-CN locale for realistic rendering
    locale: 'zh-CN',
    // Desktop viewport
    viewport: { width: 1280, height: 800 },
    // Ignore HTTPS errors during local dev
    ignoreHTTPSErrors: true,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
