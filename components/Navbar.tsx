'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessageSquare, FileText, FolderOpen, Shield, AlertTriangle } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function Navbar() {
  const pathname = usePathname();
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if configuration is set by hitting a fast check API or checking env on load
    fetch('/api/check-config')
      .then((res) => res.json())
      .then((data) => setIsConfigured(data.configured))
      .catch(() => setIsConfigured(false));
  }, []);

  const navItems = [
    {
      name: 'Ptám se',
      href: '/',
      icon: MessageSquare,
      active: pathname === '/' || pathname === '/chat',
    },
    {
      name: 'Řeším případ',
      href: '/pripad',
      icon: FileText,
      active: pathname === '/pripad',
    },
    {
      name: 'Dokumenty',
      href: '/admin',
      icon: FolderOpen,
      active: pathname === '/admin',
    },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/80 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white">
              <Shield className="h-5 w-5 text-accent" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-primary">Poradce<span className="text-accent">AI</span></span>
              <span className="block text-xs font-semibold text-slate-400 -mt-1">Alfa Asistent</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex space-x-1 sm:space-x-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${
                    item.active
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-primary'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${item.active ? 'text-accent' : ''}`} />
                  <span className="hidden sm:inline">{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Warning banner if env variables are missing */}
      {isConfigured === false && (
        <div className="bg-amber-50 border-y border-amber-200 py-2 px-4">
          <div className="mx-auto max-w-7xl flex items-center justify-between gap-3 text-xs sm:text-sm text-amber-800">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <span>
                <strong>Konfigurace chybí!</strong> Vytvořte soubor <code>.env.local</code> s platnými klíči pro Gemini a Supabase.
              </span>
            </div>
            <Link
              href="/admin"
              className="text-xs font-bold text-amber-900 underline hover:text-amber-700 shrink-0"
            >
              Nastavit
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
