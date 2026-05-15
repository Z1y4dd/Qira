import { expect, test } from '@playwright/test';
import { ALLOWED_HOST_PATTERNS } from '../../src/lib/sdk-allowlist';

/**
 * Runtime proof that no Qira surface fires a request outside the SDK
 * allowlist. Belt-and-suspenders for COMP-LEGAL-01 and FOUND-03.
 *
 * Subscribes to page.on('request') BEFORE goto so the very first paint's
 * requests are captured.
 */

function isAllowed(url: string, pageOrigin: string): boolean {
  try {
    const u = new URL(url);
    if (u.origin === pageOrigin) return true;
    return ALLOWED_HOST_PATTERNS.some((re) => re.test(u.host));
  } catch {
    return false;
  }
}

test.describe('network audit @ /', () => {
  test('no requests outside the SDK allowlist', async ({ page, baseURL }) => {
    const pageOrigin = new URL(baseURL ?? 'http://localhost:3000').origin;
    const violations: string[] = [];

    page.on('request', (req) => {
      const url = req.url();
      if (!isAllowed(url, pageOrigin)) {
        violations.push(url);
      }
    });

    await page.goto('/');
    // Wait for any deferred network activity that might fire after first paint.
    await page.waitForLoadState('networkidle');

    expect(violations, `Non-allowlisted requests detected: ${violations.join(', ')}`).toEqual([]);
  });

  test('zero Google Fonts hosts (FOUND-03 explicit guard)', async ({ page }) => {
    const googleFontsHits: string[] = [];

    page.on('request', (req) => {
      const u = req.url();
      if (u.includes('googleapis.com') || u.includes('gstatic.com')) {
        googleFontsHits.push(u);
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    expect(
      googleFontsHits,
      `Fonts must be served same-origin (next/font/google self-hosts); these hit Google: ${googleFontsHits.join(', ')}`,
    ).toEqual([]);
  });
});
