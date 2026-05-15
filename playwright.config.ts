import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for Qira.
 *
 * Four projects exercise the same specs on the matrix that matters for
 * an Arabic-first kid app: Chromium + WebKit (Safari/iOS), desktop +
 * mobile widths. RTL bugs frequently surface only on WebKit-mobile.
 *
 * Set PLAYWRIGHT_BASE_URL to test against a deployed Vercel URL
 * (used by Phase 1 plan 01-06 deploy verification).
 */

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  expect: {
    toHaveScreenshot: {
      maxDiffPixels: 100,
    },
  },
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    locale: 'ar',
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium-mobile',
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'webkit-desktop',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'webkit-mobile',
      use: { ...devices['iPhone 14'] },
    },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'pnpm dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
});
