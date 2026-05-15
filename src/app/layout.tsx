import { Cairo, Noto_Naskh_Arabic } from 'next/font/google';
import './globals.css';

const naskh = Noto_Naskh_Arabic({
  subsets: ['arabic'],
  weight: ['400', '500', '700'],
  variable: '--font-naskh',
  display: 'swap',
});

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  weight: ['400', '600', '700'],
  variable: '--font-cairo',
  display: 'swap',
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={`${naskh.variable} ${cairo.variable}`}>
      <body className="font-naskh antialiased">{children}</body>
    </html>
  );
}
