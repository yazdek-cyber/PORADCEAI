'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useRef, type ReactNode } from 'react';
import {
  Home, MessageSquare, Wallet, Calculator, FolderClock,
  Columns3, FolderOpen, Shield, ShieldCheck, AlertTriangle, Menu, X,
  UserRound, ChevronDown, Plus, Trash2, Pencil, Check, ClipboardCheck, Settings,
} from 'lucide-react';
import { usePripad, jmenoKlienta, popisPripadu } from '@/lib/pripadStore';

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
      { name: 'Pojištění — analýza', href: '/pripad', icon: ShieldCheck },
      { name: 'Kalkulačky', href: '/kalkulacky', icon: Calculator },
      { name: 'Záznam z jednání', href: '/zaznam', icon: ClipboardCheck },
      { name: 'Uložené plány', href: '/plany', icon: FolderClock },
    ],
  },
  {
    label: 'Znalosti & data',
    items: [
      { name: 'Srovnání', href: '/srovnani', icon: Columns3 },
      { name: 'Dokumenty', href: '/admin', icon: FolderOpen },
      { name: 'Nastavení', href: '/nastaveni', icon: Settings },
    ],
  },
];

function jeAktivni(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(href + '/');
}

// Přepínač klientů — vždy viditelný v sidebaru. Tady „žije" aktivní případ.
function KlientSwitcher() {
  const { pripad, klienti, aktivniId, nacteno, novyKlient, prepniKlienta, prejmenujKlienta, smazKlienta } = usePripad();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const pridej = () => {
    const jmeno = window.prompt('Jméno nového klienta:');
    if (jmeno !== null) { novyKlient(jmeno); setOpen(false); }
  };
  const prejmenuj = (id: string, soucasne: string) => {
    const jmeno = window.prompt('Nové jméno klienta:', soucasne);
    if (jmeno !== null && jmeno.trim()) prejmenujKlienta(id, jmeno);
  };
  const smaz = (id: string, jmeno: string) => {
    if (window.confirm(`Smazat klienta „${jmeno}"? Profil zůstane jen v tomto prohlížeči.`)) smazKlienta(id);
  };

  const maAktivni = nacteno && aktivniId;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left hover:border-primary-200 transition-colors"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary">
          <UserRound className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide leading-tight">Aktivní klient</div>
          <div className="text-sm font-semibold text-primary truncate leading-tight">
            {maAktivni ? jmenoKlienta(pripad) : 'Žádný klient'}
          </div>
        </div>
        <ChevronDown className={`h-4 w-4 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1.5 w-full rounded-xl border border-slate-200 bg-white shadow-pop p-1.5 animate-fade-in">
          <div className="max-h-64 overflow-y-auto">
            {klienti.length === 0 && (
              <div className="px-2.5 py-2 text-xs text-slate-400">Zatím žádní klienti.</div>
            )}
            {klienti.map((k) => {
              const aktivni = k.id === aktivniId;
              return (
                <div
                  key={k.id}
                  className={`group flex items-center gap-1 rounded-lg px-2 py-1.5 ${aktivni ? 'bg-primary-50' : 'hover:bg-slate-50'}`}
                >
                  <button onClick={() => { prepniKlienta(k.id); setOpen(false); }} className="flex items-center gap-2 min-w-0 flex-1 text-left">
                    {aktivni ? <Check className="h-3.5 w-3.5 text-primary shrink-0" /> : <span className="w-3.5 shrink-0" />}
                    <div className="min-w-0">
                      <div className={`text-sm font-semibold truncate ${aktivni ? 'text-primary' : 'text-slate-700'}`}>{jmenoKlienta(k.profil)}</div>
                      <div className="text-[10px] text-slate-400 truncate">{popisPripadu(k.profil)}</div>
                    </div>
                  </button>
                  <button onClick={() => prejmenuj(k.id, k.profil.jmeno || '')} title="Přejmenovat" className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-primary">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => smaz(k.id, jmenoKlienta(k.profil))} title="Smazat" className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-600">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
          <button
            onClick={pridej}
            className="mt-1 w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-semibold text-primary hover:bg-primary-50 border-t border-slate-100"
          >
            <Plus className="h-4 w-4" /> Nový klient
          </button>
        </div>
      )}
    </div>
  );
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
      <KlientSwitcher />
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
