// Cross-user E2E (AUTH-06 verification gate).
//
// Creates two parents via admin API, signs in Parent A in one context and
// creates a child, then signs in Parent B in a separate fresh context and
// asserts no data bleed. Cleans up both parents.
//
// Requires SUPABASE_SERVICE_ROLE_KEY in env (GitHub Secret in CI).

import { type BrowserContext, expect, test } from '@playwright/test';
import { createTestParent, deleteTestParent, type TestParent } from './_helpers/test-parents';

test.describe.serial('cross-user isolation', () => {
  let parentA: TestParent;
  let parentB: TestParent;

  test.beforeAll(async () => {
    parentA = await createTestParent();
    parentB = await createTestParent();
  });

  test.afterAll(async () => {
    if (parentA) await deleteTestParent(parentA.id);
    if (parentB) await deleteTestParent(parentB.id);
  });

  async function signIn(context: BrowserContext, parent: TestParent) {
    const page = await context.newPage();
    await page.goto('/sign-in');
    await page.fill('input[name="email"]', parent.email);
    await page.fill('input[name="password"]', parent.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/choose-child/);
    return page;
  }

  test('Parent A creates a child; Parent B does not see it', async ({ browser }) => {
    // Parent A — create child
    const ctxA = await browser.newContext();
    const pageA = await signIn(ctxA, parentA);

    await pageA.click('a[href="/profiles/new"]');
    await expect(pageA).toHaveURL(/\/profiles\/new/);
    const aName = `أحمد-${Math.random().toString(36).slice(2, 6)}`;
    await pageA.fill('input[name="displayName"]', aName);
    await pageA.fill('input[name="age"]', '7');
    await pageA.click('label[for="grade-1-2"]');
    await pageA.click('button[type="submit"]');
    await expect(pageA).toHaveURL(/\/choose-child/);
    await expect(pageA.getByText(aName)).toBeVisible();

    // Parent B — fresh context, should see zero children
    const ctxB = await browser.newContext();
    const pageB = await signIn(ctxB, parentB);
    await expect(pageB.getByText(aName)).toHaveCount(0);

    await ctxA.close();
    await ctxB.close();
  });

  test('Parent B cannot access /dashboard without active child', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await signIn(ctx, parentB);

    // Try to go directly to /dashboard without picking a child.
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/choose-child/);

    await ctx.close();
  });

  test('Forging qira_active_child cookie to another parents child is rejected', async ({
    browser,
  }) => {
    // Parent A — create a child, then grab the cookie value.
    const ctxA = await browser.newContext();
    const pageA = await signIn(ctxA, parentA);
    await pageA.click('a[href="/profiles/new"]');
    const aName = `ليلى-${Math.random().toString(36).slice(2, 6)}`;
    await pageA.fill('input[name="displayName"]', aName);
    await pageA.fill('input[name="age"]', '8');
    await pageA.click('label[for="grade-3-4"]');
    await pageA.click('button[type="submit"]');
    await pageA.getByText(aName).click(); // submits the "اختيار" form
    // Unplaced child is redirected to /placement/start by the (placement-gate) layout.
    await expect(pageA).toHaveURL(/\/(dashboard|placement\/start)/);

    const cookies = await ctxA.cookies();
    const active = cookies.find((c) => c.name === 'qira_active_child');
    expect(active?.value).toBeTruthy();
    await ctxA.close();

    // Parent B — sign in, forge the cookie to point at Parent A's child UUID.
    const ctxB = await browser.newContext();
    const pageB = await signIn(ctxB, parentB);
    await ctxB.addCookies([
      {
        name: 'qira_active_child',
        value: active?.value ?? '',
        domain: new URL(pageB.url()).hostname,
        path: '/',
      },
    ]);

    // /dashboard should redirect to /choose-child because RLS rejects the SELECT.
    await pageB.goto('/dashboard');
    await expect(pageB).toHaveURL(/\/choose-child/);
    await ctxB.close();
  });
});
