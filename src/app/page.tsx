import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 px-4">
      <h1 className="text-4xl font-naskh">مرحباً بكم في قِراءة</h1>
      <Button size="lg">ابدأ</Button>
    </main>
  );
}
