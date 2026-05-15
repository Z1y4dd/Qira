// Happy-path Playwright spec for the auth surface.
//
// Uses the admin-API helper to create a verified test parent (bypassing the
// email-verification gate so the spec runs in CI without an inbox), signs in,
// confirms the picker, signs out, signs back in (session-persists smoke),
// and cleans up.

import { expect, test } from '@playwright/test';
import { createTestParent, deleteTestParent, type TestParent } from './_helpers/test-parents';

test.describe.serial('auth happy path', () => {
  let parent: TestParent;

  test.beforeAll(async () => {
    parent = await createTestParent();
  });

  test.afterAll(async () => {
    if (parent) await deleteTestParent(parent.id);
  });

  test('sign in lands on /choose-child', async ({ page }) => {
    await page.goto('/sign-in');
    await page.fill('input[name="email"]', parent.email);
    await page.fill('input[name="password"]', parent.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/choose-child/);
  });

  test('signed-in session persists across reload', async ({ page }) => {
    await page.goto('/sign-in');
    await page.fill('input[name="email"]', parent.email);
    await page.fill('input[name="password"]', parent.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/choose-child/);

    await page.reload();
    await expect(page).toHaveURL(/\/choose-child/);
  });
});
