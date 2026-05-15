import createMiddleware from 'next-intl/middleware';

export default createMiddleware({
  locales: ['ar'],
  defaultLocale: 'ar',
  localePrefix: 'always',
});

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)'],
};
