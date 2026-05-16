// Placement flow — happy path E2E spec (PLAC-01 + PLAC-05).
//
// Covers the full placement loop from unplaced child → result screen → parent
// profile view.
//
// VALIDATION.md grep target: `pnpm e2e --grep "placement-flow"` lists these 3 cases.
//
// Requires:
//   - NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in env
//   - pnpm db:seed:placement must have been run (15 placeholder questions)
//   - Dev server running on http://localhost:3000 (managed by playwright webServer config)

import { expect, test } from '@playwright/test';
import { createTestParent, deleteTestParent, type TestParent } from './_helpers/test-parents';

// ---------------------------------------------------------------------------
// Shared state (serial describe — reuse parent + child across all 3 tests)
// ---------------------------------------------------------------------------

let parent: TestParent;
let childId: string;
let attemptId: string;

test.describe.serial('placement flow — happy path', () => {
  test.beforeAll(async () => {
    parent = await createTestParent();
  });

  test.afterAll(async () => {
    if (parent) await deleteTestParent(parent.id);
  });

  // -------------------------------------------------------------------------
  // Test 1: PLAC-01 gate redirect
  // -------------------------------------------------------------------------
  test('Unplaced child navigates to /dashboard → redirected to /placement/start (PLAC-01 gate)', async ({
    page,
  }) => {
    // Sign in as parent
    await page.goto('/sign-in');
    await page.fill('input[name="email"]', parent.email);
    await page.fill('input[name="password"]', parent.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/choose-child/);

    // Create a child profile
    const childName = `طفل-${Math.random().toString(36).slice(2, 6)}`;
    await page.click('a[href="/profiles/new"]');
    await expect(page).toHaveURL(/\/profiles\/new/);
    await page.fill('input[name="displayName"]', childName);
    await page.fill('input[name="age"]', '8');
    await page.click('label[for="grade-3-4"]');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/choose-child/);

    // Select the child — sets qira_active_child cookie, redirects to /dashboard.
    // The (placement-gate) layout immediately redirects unplaced children to /placement/start.
    await page.getByText(childName).click();
    await expect(page).toHaveURL(/\/placement\/start/);

    // Grab child UUID from cookie for subsequent tests
    const cookies = await page.context().cookies();
    const activeCookie = cookies.find((c) => c.name === 'qira_active_child');
    if (!activeCookie?.value) throw new Error('qira_active_child cookie not set');
    childId = activeCookie.value;

    // Directly navigate to /dashboard — gate should redirect back to placement
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/placement\/start/);
  });

  // -------------------------------------------------------------------------
  // Test 2: PLAC-05 — full 15-question loop + result screen
  // -------------------------------------------------------------------------
  test("Full 15-question loop completes → result screen renders 'اخترنا لك المستوى' with a level number inside <bdi dir='ltr'> (PLAC-05)", async ({
    page,
  }) => {
    // Sign in
    await page.goto('/sign-in');
    await page.fill('input[name="email"]', parent.email);
    await page.fill('input[name="password"]', parent.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/choose-child/);

    // The child created in Test 1 is unplaced. Select it.
    await page.goto('/choose-child');
    await page.locator('button[type="submit"]').first().click();
    // Gate redirects to placement/start
    await expect(page).toHaveURL(/\/placement\/start/);

    // Start assessment
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/placement\/[0-9a-f-]{36}/);

    // Capture the attemptId
    const url = page.url();
    const match = url.match(/\/placement\/([0-9a-f-]{36})/);
    attemptId = match?.[1] ?? '';
    expect(attemptId).toBeTruthy();

    // Loop: 5 passages × 3 questions each = 15 questions total
    // For each passage: read passage → click أنا جاهز → answer 3 questions
    for (let passageIdx = 0; passageIdx < 5; passageIdx++) {
      // Passage screen — click أنا جاهز to advance to questions
      await expect(page.getByRole('button', { name: 'أنا جاهز' })).toBeVisible({ timeout: 10_000 });
      await page.getByRole('button', { name: 'أنا جاهز' }).click();

      // Answer 3 questions for this passage
      for (let qIdx = 0; qIdx < 3; qIdx++) {
        // Wait for a choice card to appear
        await expect(page.locator('button[type="submit"]').first()).toBeVisible({ timeout: 10_000 });

        // Check if we've reached the result page already (shouldn't happen mid-loop, but guard)
        if (page.url().includes('/result')) break;

        // Tap the first choice card
        await page.locator('button[type="submit"]').first().click();

        // After the last question (passageIdx=4, qIdx=2), expect redirect to result
        if (passageIdx === 4 && qIdx === 2) {
          await expect(page).toHaveURL(new RegExp(`/placement/${attemptId}/result`), {
            timeout: 15_000,
          });
        } else if (!page.url().includes('/result')) {
          // Wait for next screen to load
          await page.waitForURL(/\/placement\/[0-9a-f-]{36}/, { timeout: 10_000 });
        }
      }

      if (page.url().includes('/result')) break;
    }

    // Assert result screen
    await expect(page).toHaveURL(new RegExp(`/placement/${attemptId}/result`), { timeout: 15_000 });

    // Result copy: "اخترنا لك المستوى"
    await expect(page.getByText(/اخترنا لك المستوى/)).toBeVisible();

    // Level number inside <bdi dir="ltr"> with a Western digit
    await expect(page.locator('bdi[dir="ltr"]').filter({ hasText: /^\d+$/ }).first()).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Test 3: PLAC-05 parent visibility — manage page shows assigned level
  // -------------------------------------------------------------------------
  test("Parent on /profiles/[childId]/manage sees 'المستوى المُعيَّن:' after child completes placement (PLAC-05 parent visibility)", async ({
    page,
  }) => {
    // Child must have completed placement from Test 2
    expect(childId).toBeTruthy();

    // Sign in as parent (re-auth in fresh page)
    await page.goto('/sign-in');
    await page.fill('input[name="email"]', parent.email);
    await page.fill('input[name="password"]', parent.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/choose-child/);

    // Navigate to the manage page for this child
    await page.goto(`/profiles/${childId}/manage`);
    await expect(page).toHaveURL(new RegExp(`/profiles/${childId}/manage`));

    // The 'حالة التقييم' card should show 'المستوى المُعيَّن:' for a completed placement
    await expect(page.getByText(/المستوى المُعيَّن/)).toBeVisible();

    // The level number should be inside a <bdi dir="ltr"> element
    await expect(page.locator('bdi[dir="ltr"]').filter({ hasText: /^\d+$/ }).first()).toBeVisible();

    // Also verify the child can now access /dashboard (placed child passes the gate)
    await page.goto('/choose-child');
    await page.locator('button[type="submit"]').first().click();
    // Placed child should reach /dashboard, not be redirected to placement
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
