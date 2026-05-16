// Placement route group layout.
// force-dynamic: every placement page reads cookies and calls the DB —
// no page in this group can be statically pre-rendered.

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function PlacementLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto w-full max-w-2xl">{children}</div>
    </main>
  );
}
