import { ArabicText } from '@/components/arabic-text';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 px-4">
      <ArabicText as="h1" size="reader" className="text-4xl">
        مرحباً بكم في قِراءة
      </ArabicText>
      <Button size="lg">
        <ArabicText size="ui">ابدأ</ArabicText>
      </Button>
    </main>
  );
}
