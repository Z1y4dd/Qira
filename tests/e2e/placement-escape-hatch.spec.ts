// Escape hatch visibility + interaction spec (PLAC-06 — "during AND after placement").
//
// Verifies that the EscapeHatch component is visible on every placement screen
// and on the result screen after assessment completes.
//
// Plan 05 wires the abort action. This spec verifies:
//   1. Hatch buttons visible on /placement/start
//   2. Hatch buttons visible on the passage screen
//   3. Hatch buttons visible on the question screen
//   4. Confirmation dialog appears on tap; Cancel keeps the attempt running
//   5. Confirmation Confirm aborts + routes to result with fallback level
//   6. Hatch buttons visible on result screen (SC4 / PLAC-06 runtime gate)
//   7. RSC wire payload for /placement/{attemptId} does NOT contain isCorrect/is_correct/correct-choice ID
//
// Requires:
//   - NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in env
//   - pnpm db:seed:placement must have been run (15 placeholder questions)
//   - Dev server running on http://localhost:3000 (managed by playwright webServer config)

import { createClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';
import { createTestParent, deleteTestParent, type TestParent } from './_helpers/test-parents';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'Escape-hatch spec requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY',
    );
  }
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

/** Sign in as parent via the UI — returns after /choose-child is reached. */
async function signIn(
  page: import('@playwright/test').Page,
  parent: TestParent,
): Promise<void> {
  await page.goto('/sign-in');
  await page.fill('input[name="email"]', parent.email);
  await page.fill('input[name="password"]', parent.password);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/choose-child/);
}

/**
 * Create a child via the UI and select it (sets qira_active_child cookie).
 * Returns the child UUID from the URL after selection.
 */
async function createAndSelectChild(
  page: import('@playwright/test').Page,
): Promise<string> {
  const childName = `ولد-${Math.random().toString(36).slice(2, 6)}`;

  await page.click('a[href="/profiles/new"]');
  await expect(page).toHaveURL(/\/profiles\/new/);
  await page.fill('input[name="displayName"]', childName);
  await page.fill('input[name="age"]', '8');
  await page.click('label[for="grade-3-4"]');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/choose-child/);

  // Select the child — submits a form that sets qira_active_child cookie and redirects /dashboard
  await page.getByText(childName).click();
  await expect(page).toHaveURL(/\/dashboard/);

  // Extract the child ID from the profile manage link in the page, or from cookies
  const cookies = await page.context().cookies();
  const activeCookie = cookies.find((c) => c.name === 'qira_active_child');
  if (!activeCookie?.value) throw new Error('qira_active_child cookie not set after child selection');
  return activeCookie.value;
}

/** Navigate to /placement/start. The placement-gate layout will redirect unplaced children here. */
async function navigateToPlacementStart(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/placement/start');
  await expect(page).toHaveURL(/\/placement\/start/);
}

/** Start the placement assessment — click ابدأ التقييم. */
async function startPlacement(page: import('@playwright/test').Page): Promise<string> {
  await page.click('button[type="submit"]');
  // Should redirect to /placement/{attemptId}
  await expect(page).toHaveURL(/\/placement\/[0-9a-f-]{36}/);
  const url = page.url();
  const match = url.match(/\/placement\/([0-9a-f-]{36})/);
  return match?.[1] ?? '';
}

/** Assert both escape hatch buttons are visible. */
async function assertHatchVisible(page: import('@playwright/test').Page): Promise<void> {
  await expect(page.getByRole('button', { name: 'هذا صعب' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'هذا سهل' })).toBeVisible();
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

test.describe.serial('placement escape hatch', () => {
  let parent: TestParent;

  test.beforeAll(async () => {
    parent = await createTestParent();
  });

  test.afterAll(async () => {
    if (parent) await deleteTestParent(parent.id);
  });

  // -------------------------------------------------------------------------
  // Test 1: hatch visible on /placement/start
  // -------------------------------------------------------------------------
  test('hatch visible on /placement/start', async ({ page }) => {
    await signIn(page, parent);
    await createAndSelectChild(page);
    await navigateToPlacementStart(page);
    await assertHatchVisible(page);
  });

  // -------------------------------------------------------------------------
  // Test 2: hatch visible on passage screen
  // -------------------------------------------------------------------------
  test('hatch visible on passage screen', async ({ page }) => {
    await signIn(page, parent);
    // Child was already created in test 1 and has no placement. Select again.
    // Re-navigate to choose-child and select the existing child.
    await page.goto('/choose-child');
    // Click whichever child is there (the one we created)
    await page.locator('button[type="submit"]').first().click();
    await expect(page).toHaveURL(/\/dashboard/);

    await navigateToPlacementStart(page);
    await startPlacement(page);
    // Should now be on the passage screen (first item = passage show)
    await assertHatchVisible(page);
  });

  // -------------------------------------------------------------------------
  // Test 3: hatch visible on question screen (after tapping أنا جاهز)
  // -------------------------------------------------------------------------
  test('hatch visible on question screen', async ({ page }) => {
    await signIn(page, parent);
    await page.goto('/choose-child');
    await page.locator('button[type="submit"]').first().click();
    await expect(page).toHaveURL(/\/dashboard/);

    await navigateToPlacementStart(page);
    await startPlacement(page);

    // Advance past the passage by clicking أنا جاهز
    await page.getByRole('button', { name: 'أنا جاهز' }).click();
    await expect(page).toHaveURL(/\/placement\/[0-9a-f-]{36}\?showPassage=0/);

    await assertHatchVisible(page);
  });

  // -------------------------------------------------------------------------
  // Test 4: confirmation dialog appears; Cancel keeps the attempt running
  // -------------------------------------------------------------------------
  test('confirmation dialog Cancel keeps the attempt at the same URL', async ({ page }) => {
    await signIn(page, parent);
    await page.goto('/choose-child');
    await page.locator('button[type="submit"]').first().click();
    await expect(page).toHaveURL(/\/dashboard/);

    await navigateToPlacementStart(page);
    await startPlacement(page);

    const urlBeforeEscape = page.url();

    // Tap هذا صعب
    await page.getByRole('button', { name: 'هذا صعب' }).click();

    // AlertDialog should appear
    await expect(page.getByText('هل أنت متأكد؟')).toBeVisible();

    // Tap إلغاء — dialog closes, URL unchanged
    await page.getByRole('button', { name: 'إلغاء' }).click();
    await expect(page.getByText('هل أنت متأكد؟')).not.toBeVisible();

    // URL should be the same passage screen (no redirect)
    expect(page.url()).toBe(urlBeforeEscape);
  });

  // -------------------------------------------------------------------------
  // Test 5: Confirm aborts the attempt and routes to result with fallback level
  // -------------------------------------------------------------------------
  test('confirmation Confirm aborts and routes to result with fallback level', async ({ page }) => {
    await signIn(page, parent);
    await page.goto('/choose-child');
    await page.locator('button[type="submit"]').first().click();
    await expect(page).toHaveURL(/\/dashboard/);

    await navigateToPlacementStart(page);
    const attemptId = await startPlacement(page);

    // Tap هذا صعب
    await page.getByRole('button', { name: 'هذا صعب' }).click();
    await expect(page.getByText('هل أنت متأكد؟')).toBeVisible();

    // Tap تأكيد
    await page.getByRole('button', { name: 'تأكيد' }).click();

    // Should redirect to /placement/{attemptId}/result
    await expect(page).toHaveURL(new RegExp(`/placement/${attemptId}/result`), { timeout: 15_000 });

    // Result page should show fallback level
    await expect(page.getByText(/اخترنا لك المستوى/)).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Test 6: hatch visible on result screen after escape-hatched (SC4 / PLAC-06)
  // -------------------------------------------------------------------------
  test('hatch visible on result screen after placement ends — SC4 PLAC-06', async ({ page }) => {
    // This test creates a fresh child so it can reach the result screen via abort
    await signIn(page, parent);

    // Create a second child
    const childName2 = `بنت-${Math.random().toString(36).slice(2, 6)}`;
    await page.click('a[href="/profiles/new"]');
    await page.fill('input[name="displayName"]', childName2);
    await page.fill('input[name="age"]', '7');
    await page.click('label[for="grade-1-2"]');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/choose-child/);
    await page.getByText(childName2).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await navigateToPlacementStart(page);
    const attemptId = await startPlacement(page);

    // Escape-hatch abort to reach result
    await page.getByRole('button', { name: 'هذا سهل' }).click();
    await expect(page.getByText('هل أنت متأكد؟')).toBeVisible();
    await page.getByRole('button', { name: 'تأكيد' }).click();

    await expect(page).toHaveURL(new RegExp(`/placement/${attemptId}/result`), { timeout: 15_000 });

    // Both hatch buttons must be visible on the result page — SC4 runtime verification
    await assertHatchVisible(page);
  });

  // -------------------------------------------------------------------------
  // Test 7: RSC wire payload does NOT contain isCorrect / is_correct / correct-choice ID
  //         (T-3-bundle-leak runtime gate — complement to the grep invariant)
  // -------------------------------------------------------------------------
  test('RSC wire payload on /placement/{attemptId} does not contain correct-choice information', async ({
    page,
  }) => {
    // Create a fresh child for this test
    await signIn(page, parent);

    const childName3 = `ولد٣-${Math.random().toString(36).slice(2, 6)}`;
    await page.click('a[href="/profiles/new"]');
    await page.fill('input[name="displayName"]', childName3);
    await page.fill('input[name="age"]', '9');
    await page.click('label[for="grade-3-4"]');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/choose-child/);
    await page.getByText(childName3).click();
    await expect(page).toHaveURL(/\/dashboard/);

    // Start placement — lands on passage screen
    await navigateToPlacementStart(page);
    await startPlacement(page);

    // Advance to the question screen so the RSC payload contains question/choice data
    await page.getByRole('button', { name: 'أنا جاهز' }).click();
    await expect(page).toHaveURL(/\/placement\/[0-9a-f-]{36}\?showPassage=0/);

    // Capture the RSC wire payload on a page reload
    const responsePromise = page.waitForResponse(
      (res) => res.url().includes('/placement/') && res.status() === 200,
    );
    await page.reload();
    const response = await responsePromise;
    const body = await response.text();

    // Assert the payload does not contain correctness fields
    expect(body, 'RSC payload must not contain "isCorrect"').not.toContain('"isCorrect"');
    expect(body, 'RSC payload must not contain "is_correct"').not.toContain('"is_correct"');

    // Assert the correct-choice ID is not in the payload.
    // Query the DB for the first placeholder question's correct choice ID.
    const admin = adminClient();
    const { data: choiceData, error: choiceError } = await admin
      .from('choices')
      .select('id')
      .eq('is_correct', 1)
      .in(
        'question_id',
        (
          await admin
            .from('questions')
            .select('id')
            .eq('is_placeholder', true)
            .order('position', { ascending: true })
            .limit(1)
        ).data?.map((q: { id: string }) => q.id) ?? [],
      )
      .limit(1);

    if (!choiceError && choiceData?.[0]) {
      const correctChoiceId: string = (choiceData[0] as { id: string }).id;
      expect(
        body,
        `RSC payload must not contain the correct-choice UUID (${correctChoiceId})`,
      ).not.toContain(correctChoiceId);
    }
  });

  // -------------------------------------------------------------------------
  // Phase 4 placeholder — reader-mode escape hatch (NOT implemented in Plan 05)
  // -------------------------------------------------------------------------
  test.fixme(
    'hatch visible on /reader/{storyId} — Phase 4 reader-mode reuse',
    async () => {
      // Phase 4 fills this body.
      //
      // Sketch:
      //   - Sign in as an already-placed child
      //   - Navigate to a reader story URL
      //   - EscapeHatch renders in mode="reader"
      //   - expect(page.getByRole('button', { name: 'هذا صعب' })).toBeVisible()
      //   - expect(page.getByRole('button', { name: 'هذا سهل' })).toBeVisible()
    },
  );
});
