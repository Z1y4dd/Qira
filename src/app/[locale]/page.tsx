import { getTranslations } from "next-intl/server";

export default async function LocalePage() {
  const t = await getTranslations("landing");

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 px-4">
      <h1 className="text-4xl font-naskh">{t("welcome")}</h1>
      {/* shadcn Button will be added in Task 1.7 */}
    </main>
  );
}
