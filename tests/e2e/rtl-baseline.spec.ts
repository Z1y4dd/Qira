import { expect, test } from '@playwright/test';

/**
 * RTL baseline — the architectural invariants that every Arabic-rendering
 * route must satisfy from commit 1. Visual regression captures the
 * cumulative effect (font, direction, layout, leading) in one screenshot.
 */

test.describe('RTL baseline @ /', () => {
  test('html declares lang=ar dir=rtl', async ({ page }) => {
    await page.goto('/');
    const html = page.locator('html');
    await expect(html).toHaveAttribute('lang', 'ar');
    await expect(html).toHaveAttribute('dir', 'rtl');
  });

  test('body computed font-family resolves to Noto Naskh Arabic', async ({ page }) => {
    await page.goto('/');
    const fontFamily = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
    expect(fontFamily, `body font-family must include a Naskh face, got: ${fontFamily}`).toMatch(/Naskh/i);
  });

  test('the welcome heading is wrapped in <bdi> (ArabicText primitive invariant)', async ({ page }) => {
    await page.goto('/');
    const headingBdi = page.locator('h1 bdi').first();
    await expect(headingBdi).toBeVisible();
    await expect(headingBdi).toContainText('مرحباً');
  });

  test('landing visual baseline', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveScreenshot('home-rtl.png', { fullPage: true });
  });
});
