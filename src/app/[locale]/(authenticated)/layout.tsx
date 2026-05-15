// Phase 2 will add Supabase getUser() check and redirect to /sign-in if not authed.
// force-dynamic is set here so the CI gate (scripts/lint-force-dynamic.sh) proves
// the invariant before Phase 2 introduces the real auth surface.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
