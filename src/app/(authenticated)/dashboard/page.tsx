import { ArabicText } from '@/components/arabic-text';

// Placeholder dashboard — Slice 5 swaps this out for the personalized greeting
// using the active child's display name. For now it just confirms the gate
// works: visiting /dashboard while authenticated and verified lands here.
export default function DashboardPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <ArabicText as="h1" size="reader" className="text-3xl">
        لوحة التحكم
      </ArabicText>
    </main>
  );
}
