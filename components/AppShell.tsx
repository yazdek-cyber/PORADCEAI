'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, type ReactNode } from 'react';
import {
  Home, MessageSquare, FolderKanban, Wallet, Calculator, FolderClock,
  Columns3, FolderOpen, Shield, AlertTriangle, Menu, X, FileText,
} from 'lucide-react';

// Navigace seskupená podle logiky práce poradce: rozcestník → poradna (znalosti) →
// PŘÍPAD klienta (profil/plán/kalkulačky/uložené) → srovnání → dokumenty.
type NavItem = { name: string; href: string; icon: typeof Home };
type NavGroup = { label?: string; items: NavItem[] };

const NAV: NavGroup[] = [
  {
    items: [
      { name: 'Domů', href: '/', icon: Home },
      { name: 'Poradna', href: '/poradna', icon: MessageSquare },
    ],
  },
  {
    label: 'Případ klienta',
    items: [
      { name: 'Finanční plán', href: '/plan', icon: Wallet },
      { name: 'Rychlý návrh', href: '/pripad', icon: FileText },
      { name: 'Kalkulačky', href: '/kalkulacky', icon: Calculator },
      { name: 'Uložené plány', href: '/plany', icon: FolderClock },
    ],
  },
  {
    label: 'Znalosti & data',
    items: [
      { name: 'Srovnání', href: '/srovnani', icon: Columns3 },
      { name: 'Dokumenty', href: '/admin', icon: FolderOpen },
    ],
  },
];

function jeAktivni(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(href + '/');
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);
  const [mobilOtevreno, setMobilOtevreno] = useState(false);

  useEffect(() => {
    fetch('/api/check-config')
      .then((res) => res.json())
      .then((data) => setIsConfigured(data.configured))
      .catch(() => setIsConfigured(false));
  }, []);

  // Zavři mobilní zásuvku při přechodu na jinou stránku.
  useEffect(() => { setMobilOtevreno(false); }, [pathname]);

  const Znacka = (
    <Link href="/" className="flex items-center gap-2.5">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white shadow-soft">
        <Shield className="h-5 w-5 text-accent" />
      </div>
      <div className="leading-tight">
        <span className="block text-base font-bold tracking-tight text-primary">
          Poradce<span className="text-accent">AI</span>
        </span>
        <span className="block text-[10px] font-semibold text-slate-400 -mt-0.5">Asistent poradce</span>
      </div>
    </Link>
  );

  const Navigace = (
    <nav className="flex flex-col gap-5">
      {NAV.map((group, gi) => (
        <div key={gi} className="flex flex-col gap-1">
          {group.label && (
            <div className="px-3 mb-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              {group.label}
            </div>
          )}
          {group.items.map((item) => {
            const Icon = item.icon;
            const active = jeAktivni(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200 ${
                  active
                    ? 'bg-primary text-white shadow-soft'
                    : 'text-slate-600 hover:bg-primary-50 hover:text-primary'
                }`}
              >
                <Icon className={`h-4.5 w-4.5 shrink-0 ${active ? 'text-accent' : 'text-slate-400 group-hover:text-primary'}`} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      {/* Sidebar — desktop */}
      <aside className="hidden lg:flex flex-col w-64 shrink-0 border-r border-slate-200/70 bg-white/70 backdrop-blur-sm px-4 py-5 print:hidden">
        <div className="px-2 mb-7">{Znacka}</div>
        {Navigace}
        <div className="mt-auto pt-6 px-3 text-[10px] text-slate-400">v0.18 · alfa</div>
      </aside>

      {/* Mobilní horní lišta */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-40 flex items-center justify-between border-b border-slate-200/70 bg-white/90 backdrop-blur-md px-4 h-14 print:hidden">
        {Znacka}
        <button
          onClick={() => setMobilOtevreno((v) => !v)}
          aria-label="Menu"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
        >
          {mobilOtevreno ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobilní zásuvka */}
      {mobilOtevreno && (
        <div className="lg:hidden fixed inset-0 z-30 print:hidden">
          <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={() => setMobilOtevreno(false)} />
          <div className="absolute top-14 left-0 bottom-0 w-72 max-w-[85%] bg-white shadow-pop px-4 py-5 overflow-y-auto animate-fade-in">
            {Navigace}
          </div>
        </div>
      )}

      {/* Hlavní obsah */}
      <div className="flex-1 min-w-0 flex flex-col">
        {isConfigured === false && (
          <div className="bg-amber-50 border-b border-amber-200 py-2 px-4 lg:px-8 mt-14 lg:mt-0 print:hidden">
            <div className="mx-auto max-w-6xl flex items-center justify-between gap-3 text-xs sm:text-sm text-amber-800">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                <span><strong>Konfigurace chybí!</strong> Vytvořte <code>.env.local</code> s klíči pro Gemini a Supabase.</span>
              </div>
              <Link href="/admin" className="text-xs font-bold text-amber-900 underline hover:text-amber-700 shrink-0">Nastavit</Link>
            </div>
          </div>
        )}
        <main className={`flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 ${isConfigured === false ? '' : 'mt-14 lg:mt-0'} animate-fade-in`}>
          {children}
        </main>
      </div>
    </div>
  );
}
