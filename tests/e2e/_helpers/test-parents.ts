// Test-parent fixture helpers.
//
// The admin client uses SUPABASE_SERVICE_ROLE_KEY to create disposable parents
// for cross-user E2E tests. This client MUST NEVER ship to the browser — it's
// only ever instantiated inside Playwright test files.
//
// CI requires SUPABASE_SERVICE_ROLE_KEY as a GitHub Secret (set in repo
// Settings → Secrets and variables → Actions).

import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

export interface TestParent {
  id: string;
  email: string;
  password: string;
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'Test-parent admin client requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in env. ' +
        'In CI: add SUPABASE_SERVICE_ROLE_KEY as a GitHub Secret.',
    );
  }
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

/** Create a disposable parent. email_confirm: true skips the verification gate. */
export async function createTestParent(): Promise<TestParent> {
  const admin = adminClient();
  const email = `parent-${randomUUID()}@qira-test.local`;
  const password = `Test1234!${randomUUID().slice(0, 8)}`;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(`createTestParent failed: ${error?.message ?? 'no user returned'}`);
  }
  return { id: data.user.id, email, password };
}

export async function deleteTestParent(userId: string): Promise<void> {
  const admin = adminClient();
  // Cascade through Drizzle FK: deleting auth.users.id cascades to public.parents.id
  // which cascades to child_profiles which cascades to attempts + attempt_answers.
  await admin.auth.admin.deleteUser(userId);
}
