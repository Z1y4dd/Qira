// Cross-parent placement isolation (T-3-rls-cross-parent gate).
//
// Verifies that Parent A's placement attempt rows are NOT visible to Parent B,
// and that forging the qira_active_child cookie to point at Parent A's child
// does NOT grant Parent B access to Parent A's placement data.
//
// Plan 06 Task 6.3 fills the test bodies. This stub exists from Wave 0 so the
// spec file is discoverable and the T-3-rls-cross-parent acceptance path is clear.

import { test } from '@playwright/test';

// These imports will be used when Plan 06 fills the test bodies:
// import { createTestParent, deleteTestParent, type TestParent } from './_helpers/test-parents';

test.describe.serial('placement cross-parent isolation', () => {
  test.fixme(
    'Parent A completes placement, Parent B cannot read A\'s attempts row',
    async () => {
      // Plan 06 fills this body.
      //
      // Sketch:
      //   - parentA = await createTestParent()
      //   - parentB = await createTestParent()
      //   - Sign in as Parent A, create a child, complete placement flow
      //   - Sign in as Parent B in a fresh browser context
      //   - Assert: Parent B's DB query for Parent A's child_id returns 0 rows
      //   - RLS EXISTS-subquery on attempts should reject access
      //   - Assert: navigating to /placement/{parentA_attemptId}/result redirects to /choose-child
    },
  );

  test.fixme(
    "Parent B forges qira_active_child cookie to A's child UUID → redirected to /choose-child",
    async () => {
      // Plan 06 fills this body.
      //
      // Sketch:
      //   - Sign in as Parent A, create child, set active child cookie
      //   - Extract cookie value (Parent A's child UUID)
      //   - Sign in as Parent B in fresh context
      //   - Inject forged qira_active_child cookie pointing at Parent A's child
      //   - Navigate to /dashboard → expect redirect to /choose-child
      //   - (RLS rejects the SELECT on child_profiles because parent_id ≠ auth.uid())
    },
  );
});
