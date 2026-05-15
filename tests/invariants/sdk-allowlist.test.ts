import { describe, test, expect } from 'vitest';
import { ALLOWED_HOST_PATTERNS, isAllowedHost } from '@/lib/sdk-allowlist';

describe('ALLOWED_HOST_PATTERNS', () => {
  test('is a non-empty readonly RegExp[] (compile-time shape pinned)', () => {
    expect(Array.isArray(ALLOWED_HOST_PATTERNS)).toBe(true);
    expect(ALLOWED_HOST_PATTERNS.length).toBeGreaterThan(0);
    for (const re of ALLOWED_HOST_PATTERNS) {
      expect(re).toBeInstanceOf(RegExp);
    }
  });

  test('does NOT include Google Fonts hosts (FOUND-03 anti-pattern)', () => {
    const fontsUrls = [
      'https://fonts.googleapis.com/css?family=Foo',
      'https://fonts.gstatic.com/s/example/foo.woff2',
    ];
    for (const url of fontsUrls) {
      expect(isAllowedHost(url, 'http://localhost:3000')).toBe(false);
    }
  });

  test('does NOT include common analytics/CDN hosts that snuck in elsewhere', () => {
    const blocked = [
      'https://www.google-analytics.com/g/collect',
      'https://cdn.jsdelivr.net/npm/foo',
      'https://api.posthog.com/capture',
      'https://sentry.io/api/123/store',
      'https://www.googletagmanager.com/gtm.js',
    ];
    for (const url of blocked) {
      expect(isAllowedHost(url, 'http://localhost:3000'), `${url} must not be allowed`).toBe(false);
    }
  });
});

describe('isAllowedHost', () => {
  const ORIGIN = 'http://localhost:3000';

  test('allows same-origin requests', () => {
    expect(isAllowedHost('http://localhost:3000/_next/static/chunks/foo.js', ORIGIN)).toBe(true);
    expect(isAllowedHost('http://localhost:3000/api/whatever', ORIGIN)).toBe(true);
  });

  test('allows production Supabase project URLs', () => {
    expect(isAllowedHost('https://abcdef.supabase.co/auth/v1/token', ORIGIN)).toBe(true);
    expect(isAllowedHost('https://abcdef.supabase.co/rest/v1/parents', ORIGIN)).toBe(true);
  });

  test('returns false for unparseable URLs', () => {
    expect(isAllowedHost('not a url', ORIGIN)).toBe(false);
  });
});
