// Cross-parent placement isolation (T-3-rls-cross-parent gate).
//
// Verifies that Parent A's placement attempt rows are NOT visible to Parent B,
// and that forging the qira_active_child cookie to point at Parent A's child
// does NOT grant Parent B access to Parent A's placement data.

import { type BrowserContext, expect, test } from '@playwright/test';
import { createTestParent, deleteTestParent, type TestParent } from './_helpers/test-parents';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function signIn(context: BrowserContext, parent: TestParent) {
  const page = await context.newPage();
  await page.goto('/sign-in');
  await page.fill('input[name="email"]', parent.email);
  await page.fill('input[name="password"]', parent.password);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/choose-child/);
  return page;
}

/**
 * Create a child via UI, select it, and start placement.
 * Returns the child UUID and the attemptId from the URL.
 */
async function createChildAndStartPlacement(context: BrowserContext, parent: TestParent) {
  const page = await signIn(context, parent);
  const childName = `طفل-${Math.random().toString(36).slice(2, 6)}`;

  await page.click('a[href="/profiles/new"]');
  await expect(page).toHaveURL(/\/profiles\/new/);
  await page.fill('input[name="displayName"]', childName);
  await page.fill('input[name="age"]', '8');
  await page.click('label[for="grade-3-4"]');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/choose-child/);

  // Select the child — gate redirects to /placement/start
  await page.getByText(childName).click();
  await expect(page).toHaveURL(/\/(dashboard|placement\/start)/);

  // Grab the child UUID from the active-child cookie
  const cookies = await context.cookies();
  const activeCookie = cookies.find((c) => c.name === 'qira_active_child');
  if (!activeCookie?.value) throw new Error('qira_active_child cookie not set');
  const childId = activeCookie.value;

  // Navigate to /placement/start and start the assessment
  await page.goto('/placement/start');
  await expect(page).toHaveURL(/\/placement\/start/);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/placement\/[0-9a-f-]{36}/);

  const url = page.url();
  const match = url.match(/\/placement\/([0-9a-f-]{36})/);
  const attemptId = match?.[1] ?? '';

  return { page, childId, attemptId };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

test.describe.serial('placement cross-parent isolation', () => {
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

  // -------------------------------------------------------------------------
  // Test 1: Parent A's placement attempt is not accessible to Parent B
  // -------------------------------------------------------------------------
  test("Parent A starts placement; Parent B cannot access A's attempt URL", async ({ browser }) => {
    // Parent A — create child + start placement
    const ctxA = await browser.newContext();
    const { attemptId } = await createChildAndStartPlacement(ctxA, parentA);
    expect(attemptId).toBeTruthy();

    // Parent B — sign in in a fresh context, try to navigate to Parent A's attempt URL
    const ctxB = await browser.newContext();
    const pageB = await signIn(ctxB, parentB);

    // Attempt to access Parent A's placement attempt URL
    await pageB.goto(`/placement/${attemptId}`);
    // RLS causes the attempt lookup to fail → server redirects to /choose-child
    // (getNextPlacementItem throws AuthError('NO_ACTIVE_CHILD') for missing attempt)
    await expect(pageB).toHaveURL(/\/(choose-child|sign-in|placement\/start)/);

    // Crucially: Parent B does NOT see Parent A's passage or question content
    // The URL is not /placement/{attemptId} (no access to the attempt)
    expect(pageB.url()).not.toMatch(new RegExp(`/placement/${attemptId}$`));

    // Also try the result URL — should likewise redirect
    await pageB.goto(`/placement/${attemptId}/result`);
    await expect(pageB).toHaveURL(/\/(choose-child|sign-in|placement\/start)/);
    expect(pageB.url()).not.toMatch(new RegExp(`/placement/${attemptId}/result$`));

    await ctxA.close();
    await ctxB.close();
  });

  // -------------------------------------------------------------------------
  // Test 2: Forging qira_active_child to Parent A's child UUID → /choose-child
  // -------------------------------------------------------------------------
  test("Parent B forges qira_active_child cookie to A's child UUID → redirected to /choose-child", async ({
    browser,
  }) => {
    // Parent A — create a child and grab the cookie
    const ctxA = await browser.newContext();
    const { childId } = await createChildAndStartPlacement(ctxA, parentA);
    expect(childId).toBeTruthy();
    await ctxA.close();

    // Parent B — sign in in fresh context
    const ctxB = await browser.newContext();
    const pageB = await signIn(ctxB, parentB);

    // Forge Parent A's child UUID into Parent B's qira_active_child cookie
    await ctxB.addCookies([
      {
        name: 'qira_active_child',
        value: childId,
        domain: new URL(pageB.url()).hostname,
        path: '/',
      },
    ]);

    // Navigate to /dashboard — RLS rejects the child_profiles SELECT because parent_id ≠ auth.uid()
    // requireActiveChild throws AuthError('NO_ACTIVE_CHILD') → layout redirects to /choose-child
    await pageB.goto('/dashboard');
    await expect(pageB).toHaveURL(/\/choose-child/);

    await ctxB.close();
  });
});
