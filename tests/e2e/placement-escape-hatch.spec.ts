// Escape hatch visibility spec (PLAC-06 — "during AND after placement").
//
// Verifies that the EscapeHatch component is visible on every placement screen
// and on the result screen after assessment completes.
//
// Plan 04 Task 4.x fills the hatch into actual screens (PassageScreen, QuestionScreen,
// result page). Plan 05 wires the abort action. Plan 06 fills these test bodies.

import { test } from '@playwright/test';

test.describe('placement escape hatch visibility', () => {
  test.fixme('hatch visible on /placement/start', async () => {
    // Plan 06 fills this body.
    //
    // Sketch:
    //   - Sign in as a parent, create an unplaced child, set as active child
    //   - Navigate to /placement/start
    //   - expect(page.getByRole('button', { name: /هذا صعب/ })).toBeVisible()
    //   - expect(page.getByRole('button', { name: /هذا سهل/ })).toBeVisible()
  });

  test.fixme('hatch visible on passage screen', async () => {
    // Plan 06 fills this body.
    //
    // Sketch:
    //   - Start a placement attempt, navigate to first passage screen
    //   - expect(page.getByRole('button', { name: /هذا صعب/ })).toBeVisible()
    //   - expect(page.getByRole('button', { name: /هذا سهل/ })).toBeVisible()
  });

  test.fixme('hatch visible on question screen', async () => {
    // Plan 06 fills this body.
    //
    // Sketch:
    //   - Continue through passage, tap "أنا جاهز", land on first question screen
    //   - expect(page.getByRole('button', { name: /هذا صعب/ })).toBeVisible()
    //   - expect(page.getByRole('button', { name: /هذا سهل/ })).toBeVisible()
  });

  test.fixme(
    "hatch visible on /placement/{attemptId}/result after placement completes — SC4 'after placement'",
    async () => {
      // Plan 06 fills this body.
      //
      // Sketch:
      //   - Complete all 15 placement items (simulate via direct navigation or fast-path)
      //   - Land on the result screen /placement/{attemptId}/result
      //   - expect(page.getByRole('button', { name: /هذا صعب/ })).toBeVisible()
      //   - expect(page.getByRole('button', { name: /هذا سهل/ })).toBeVisible()
      //   - This tests SC4: hatch is visible AFTER placement completes, not just during
    },
  );

  test.fixme(
    'hatch visible on (active)/dashboard for already-placed child — Phase 4 reuse',
    async () => {
      // Plan 06 fills this body (or Phase 4 spec handles it).
      //
      // Sketch:
      //   - Child has a completed placement attempt (placed at level N)
      //   - Navigate to /dashboard
      //   - EscapeHatch renders in mode="reader" (Phase 4 reuse via mode prop)
      //   - expect(page.getByRole('button', { name: /هذا صعب/ })).toBeVisible()
    },
  );
});
