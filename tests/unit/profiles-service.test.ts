// Unit tests for the profiles Service Layer — validation + AuthError branches only.
// Full DB integration is covered by the Playwright cross-user E2E in Slice 6.

import { describe, expect, test } from 'vitest';
import {
  CreateChildProfileInput,
  SignInInput,
  SignUpInput,
} from '@/lib/auth-schemas';
import { AuthError } from '@/services/profiles';

describe('AuthError', () => {
  test('carries a typed reason', () => {
    const err = new AuthError('UNAUTHENTICATED');
    expect(err).toBeInstanceOf(Error);
    expect(err.reason).toBe('UNAUTHENTICATED');
    expect(err.name).toBe('AuthError');
  });

  test('serializes to all three reasons', () => {
    for (const reason of ['UNAUTHENTICATED', 'UNVERIFIED', 'NO_ACTIVE_CHILD'] as const) {
      expect(new AuthError(reason).reason).toBe(reason);
    }
  });
});

describe('SignUpInput', () => {
  test('accepts valid email + strong password', () => {
    const ok = SignUpInput.safeParse({ email: 'parent@example.com', password: 'abcd1234' });
    expect(ok.success).toBe(true);
  });

  test('rejects invalid email with Arabic message', () => {
    const fail = SignUpInput.safeParse({ email: 'not-an-email', password: 'abcd1234' });
    expect(fail.success).toBe(false);
    if (!fail.success) {
      expect(fail.error.flatten().fieldErrors.email?.[0]).toMatch(/صحيحاً|صحيح/);
    }
  });

  test('rejects password without latin char', () => {
    const fail = SignUpInput.safeParse({ email: 'p@example.com', password: '12345678' });
    expect(fail.success).toBe(false);
  });

  test('rejects password without digit', () => {
    const fail = SignUpInput.safeParse({ email: 'p@example.com', password: 'abcdefgh' });
    expect(fail.success).toBe(false);
  });

  test('rejects short password', () => {
    const fail = SignUpInput.safeParse({ email: 'p@example.com', password: 'ab12' });
    expect(fail.success).toBe(false);
  });
});

describe('SignInInput', () => {
  test('accepts any non-empty password (sign-in does not enforce strength)', () => {
    const ok = SignInInput.safeParse({ email: 'p@example.com', password: 'x' });
    expect(ok.success).toBe(true);
  });
});

describe('CreateChildProfileInput', () => {
  test('accepts valid input', () => {
    const ok = CreateChildProfileInput.safeParse({
      displayName: 'أحمد',
      age: 7,
      gradeBand: '1-2',
    });
    expect(ok.success).toBe(true);
  });

  test('rejects age below 5', () => {
    const fail = CreateChildProfileInput.safeParse({
      displayName: 'أحمد',
      age: 4,
      gradeBand: '1-2',
    });
    expect(fail.success).toBe(false);
  });

  test('rejects age above 12', () => {
    const fail = CreateChildProfileInput.safeParse({
      displayName: 'أحمد',
      age: 13,
      gradeBand: '1-2',
    });
    expect(fail.success).toBe(false);
  });

  test('rejects unknown grade band', () => {
    const fail = CreateChildProfileInput.safeParse({
      displayName: 'أحمد',
      age: 7,
      gradeBand: 'unknown',
    });
    expect(fail.success).toBe(false);
  });

  test('rejects empty display name', () => {
    const fail = CreateChildProfileInput.safeParse({
      displayName: '',
      age: 7,
      gradeBand: '1-2',
    });
    expect(fail.success).toBe(false);
  });

  test('rejects display name longer than 30 chars', () => {
    const fail = CreateChildProfileInput.safeParse({
      displayName: 'أحمد'.repeat(10),
      age: 7,
      gradeBand: '1-2',
    });
    expect(fail.success).toBe(false);
  });

  test('coerces numeric string age', () => {
    const ok = CreateChildProfileInput.safeParse({
      displayName: 'أحمد',
      age: '7',
      gradeBand: '1-2',
    });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.age).toBe(7);
  });
});
