// Minimal root layout — <html> and <body> are rendered by [locale]/layout.tsx
// This shape is compatible with next-intl's canonical [locale] routing pattern.
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
