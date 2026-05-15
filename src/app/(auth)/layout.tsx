// Public auth pages. No force-dynamic — these are static-renderable unless
// overridden by a child page (e.g., /verify-email reads cookies and IS dynamic).

import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Card className="p-8">{children}</Card>
      </div>
    </main>
  );
}
