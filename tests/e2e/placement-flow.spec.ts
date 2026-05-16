// Placement flow — happy path E2E spec (PLAC-01 + PLAC-05).
//
// Covers the full placement loop from unplaced child → result screen → parent
// profile view. Plan 06 Task 6.3 fills the test bodies.
//
// VALIDATION.md grep target: `pnpm e2e --grep "placement-flow"` lists these 3 cases.

import { test } from '@playwright/test';

test.describe('placement flow — happy path', () => {
  test.fixme(
    'Unplaced child navigates to /dashboard → redirected to /placement/start (PLAC-01 gate)',
    async () => {
      // Plan 06 fills this body.
      //
      // Sketch:
      //   - Sign in as parent, create a new child with no placement attempt
      //   - Set active child cookie (by selecting child on /choose-child)
      //   - Navigate directly to /dashboard
      //   - expect(page).toHaveURL(/\/placement\/start/)
      //   - The (authenticated) layout's placement-state gate issues the redirect
    },
  );

  test.fixme(
    "Full 15-question loop completes → result screen renders 'اخترنا لك المستوى' with a level number inside <bdi dir='ltr'> (PLAC-05)",
    async () => {
      // Plan 06 fills this body.
      //
      // Sketch:
      //   - Sign in as parent, create unplaced child, navigate to /placement/start
      //   - Click "ابدأ التقييم" (start assessment)
      //   - For each of the 5 passages: read the passage, tap "أنا جاهز", answer all 3 questions
      //   - After question 15, expect navigation to /placement/{attemptId}/result
      //   - expect(page.getByText(/اخترنا لك المستوى/)).toBeVisible()
      //   - expect(page.locator('bdi[dir="ltr"]')).toContainText(/\d+/)
      //   - Level number is inside a <bdi dir="ltr"> for correct bidirectional digit rendering
    },
  );

  test.fixme(
    "Parent on /profiles/[childId]/manage sees 'المستوى المُعيَّن: ٤' (or similar) after child completes placement (PLAC-05 parent visibility)",
    async () => {
      // Plan 06 fills this body.
      //
      // Sketch:
      //   - Prerequisite: child has completed placement (use prior test state or re-run fast-path)
      //   - Navigate to /profiles/{childId}/manage as parent
      //   - expect(page.getByText(/المستوى المُعيَّن/)).toBeVisible()
      //   - expect(page.getByText(/\d+/)).toBeVisible() (assigned level number shown)
      //   - Placement status card shows "completed" state, not "not started"
    },
  );
});
