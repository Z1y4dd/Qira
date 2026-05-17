import Link from 'next/link';
import { ArabicText } from '@/components/arabic-text';
import { Button } from '@/components/ui/button';
import { HashAuthHandler } from '@/components/auth/hash-auth-handler';

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 px-4">
      <HashAuthHandler />
      <ArabicText as="h1" size="reader" className="text-4xl text-center">
        مرحباً بكم في قِراءة
      </ArabicText>
      <ArabicText size="ui" className="block max-w-md text-center text-muted-foreground">
        تطبيق القراءة العربية للأطفال — من 5 إلى 12 سنة
      </ArabicText>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Link href="/sign-up" className="w-full">
          <Button size="lg" className="w-full">
            <ArabicText size="ui">ابدأ</ArabicText>
          </Button>
        </Link>
        <Link href="/sign-in" className="w-full">
          <Button size="lg" variant="outline" className="w-full">
            <ArabicText size="ui">لديّ حساب — تسجيل الدخول</ArabicText>
          </Button>
        </Link>
      </div>

      <Link href="/privacy" className="text-sm text-muted-foreground hover:underline">
        <ArabicText size="caption">سياسة الخصوصية</ArabicText>
      </Link>
    </main>
  );
}
