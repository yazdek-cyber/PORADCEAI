import type { Metadata } from 'next';
import './globals.css';
import AppShell from '@/components/AppShell';

export const metadata: Metadata = {
  title: 'PoradceAI — Asistent finančního poradce',
  description: 'AI asistent pro finanční poradenství: poradna nad pojistnými podmínkami, finanční plán (4 pilíře), kalkulačky a srovnání.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="cs" className="h-full antialiased">
      <body className="min-h-full text-slate-900">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
