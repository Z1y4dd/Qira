import { notFound } from "next/navigation";
import { Noto_Naskh_Arabic, Cairo } from "next/font/google";
import "../globals.css";

const naskh = Noto_Naskh_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "700"],
  variable: "--font-naskh",
  display: "swap",
});

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["400", "600", "700"],
  variable: "--font-cairo",
  display: "swap",
});

const SUPPORTED_LOCALES = ["ar"] as const;
type Locale = (typeof SUPPORTED_LOCALES)[number];

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Type-safe locale check
  if (!SUPPORTED_LOCALES.includes(locale as Locale)) {
    notFound();
  }

  return (
    <html
      lang={locale}
      dir="rtl"
      className={`${naskh.variable} ${cairo.variable}`}
    >
      <body className="font-naskh antialiased">{children}</body>
    </html>
  );
}
