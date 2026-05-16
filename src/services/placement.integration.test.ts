// Integration tests for placement service functions.
// Stubs for Wave 1 — Plan 03 fills the bodies with real DB calls.
// All test cases are test.todo() until the service layer is implemented.

import { describe, test } from 'vitest';

// These imports will be used when Plan 03 implements the functions:
// import { getPlacementState, startPlacement, recordPlacementAnswer, abortPlacement, resetPlacement } from '@/services/placement';

describe('getPlacementState()', () => {
  test.todo("returns 'not_started' when child has no attempts with kind='placement'");

  test.todo("returns 'in_progress' when child has a placement attempt with no finishedAt");

  test.todo("returns 'completed' when child has a placement attempt with finishedAt set and escape_hatched=false");

  test.todo("returns 'escape_hatched' when child has a placement attempt with escape_hatched=true");

  test.todo("returns 'not_started' after resetPlacement() soft-archives the prior attempt");
});
