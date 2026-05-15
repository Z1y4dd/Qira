import Link from 'next/link';
import { ArabicText } from '@/components/arabic-text';
import { Button } from '@/components/ui/button';

// Public route. Placeholder Arabic content — to be reviewed by a legal
// specialist before public launch (tracked as a pre-launch checklist item
// in .planning).
export default function PrivacyPage() {
  return (
    <main className="min-h-screen px-4 py-16">
      <article className="mx-auto max-w-2xl space-y-8">
        <header className="space-y-2 text-center">
          <ArabicText as="h1" size="reader" className="text-3xl block">
            سياسة الخصوصية
          </ArabicText>
          <ArabicText size="caption" className="block text-muted-foreground">
            محتوى مبدئي — سيُراجَع من قبل متخصّص قانوني قبل الإطلاق العام.
          </ArabicText>
        </header>

        <section className="space-y-3">
          <ArabicText as="h2" size="ui" className="text-xl font-semibold block">
            ما الذي نجمعه؟
          </ArabicText>
          <div className="space-y-3">
            <ArabicText as="p" size="ui">
              <strong>عن الوالد/الوالدة:</strong> البريد الإلكتروني فقط — للتسجيل وإعادة تعيين كلمة
              المرور. لا نطلب الاسم، ولا رقم الهاتف، ولا العنوان.
            </ArabicText>
            <ArabicText as="p" size="ui">
              <strong>عن الطفل:</strong> الاسم الظاهر الذي تختاره أنت (مثل «أحمد» — لا يلزم أن يكون
              الاسم الكامل)، والعمر بين 5 و12 سنة، والصف الدراسي التقريبي، والنصوص التي قرأها الطفل
              وإجاباته على أسئلة الفهم.
            </ArabicText>
          </div>
        </section>

        <section className="space-y-3">
          <ArabicText as="h2" size="ui" className="text-xl font-semibold block">
            مع من نشاركها؟
          </ArabicText>
          <ArabicText as="p" size="ui">
            لا نشاركها. لا نستخدم خدمات التتبّع أو الإعلانات على صفحات الأطفال. خدمتنا الوحيدة من طرف
            ثالث هي مزوّد البنية التحتية (Supabase) لتشغيل قاعدة البيانات والمصادقة.
          </ArabicText>
        </section>

        <section className="space-y-3">
          <ArabicText as="h2" size="ui" className="text-xl font-semibold block">
            كيف يمكنك تصدير البيانات أو حذفها؟
          </ArabicText>
          <ArabicText as="p" size="ui">
            من صفحة «إدارة الملف» لأيّ طفل، يمكنك تصدير بياناته كملفّ JSON أو حذف ملفّه بالكامل. الحذف
            فوريّ ولا يمكن التراجع عنه — يشمل حذف الملف الشخصي وكلّ سجلّ القراءة المرتبط به.
          </ArabicText>
        </section>

        <section className="space-y-3">
          <ArabicText as="h2" size="ui" className="text-xl font-semibold block">
            ملفّات تعريف الارتباط (Cookies)
          </ArabicText>
          <ArabicText as="p" size="ui">
            نستخدم ملفّات تعريف ارتباط ضرورية فقط لتشغيل تسجيل الدخول وتذكّر الطفل النشط. لا نستخدم أيّ
            ملفّات تعريف ارتباط للتتبّع أو الإحصاء.
          </ArabicText>
        </section>

        <section className="space-y-3">
          <ArabicText as="h2" size="ui" className="text-xl font-semibold block">
            التواصل
          </ArabicText>
          <ArabicText as="p" size="ui">
            لأيّ سؤال يخصّ بيانات طفلك أو حسابك، تواصل معنا عبر: <bdi dir="ltr">privacy@qira.app</bdi>{' '}
            (سيُضاف بريد رسمي قبل الإطلاق).
          </ArabicText>
        </section>

        <footer className="space-y-3 border-t pt-6">
          <ArabicText size="caption" className="block text-muted-foreground">
            تاريخ آخر تحديث: 2026-05-15
          </ArabicText>
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArabicText size="caption">العودة للصفحة الرئيسية</ArabicText>
            </Button>
          </Link>
        </footer>
      </article>
    </main>
  );
}
