import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";

export default async function LocalePage() {
  const t = await getTranslations("landing");

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 px-4">
      <h1 className="text-4xl font-naskh">{t("welcome")}</h1>
      <Button size="lg">{t("cta_explore")}</Button>
    </main>
  );
}
