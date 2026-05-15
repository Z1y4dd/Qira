// (picker) subtree — authenticated routes that DO NOT require an active child cookie.
// Used for /choose-child and /profiles/* (where the parent manages profiles).
// The outer (authenticated) layout already enforces requireParent + email-verified.

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function PickerLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
