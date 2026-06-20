'use client';

// SDÍLENÝ „PŘÍPAD KLIENTA" (v0.18) — datové propojení napříč stránkami.
// Profil klienta se zadá jednou (typicky ve Finančním plánu) a propíše se do kalkulaček,
// Rychlého návrhu i na Domů. Úložiště: localStorage prohlížeče (BEZ serveru / bez odeslání
// kamkoliv) — respektuje hranici „žádná reálná data klientů neopouštějí prohlížeč“ mimo
// případy, kdy je poradce vědomě pošle do plánu. Sazby v procentech (UI-friendly).

import { useState, useEffect, useCallback } from 'react';

export interface Pripad {
  jmeno?: string;
  vek?: number;
  // Cashflow (měsíčně, Kč)
  cistyPrijem?: number;
  vydaje?: number;
  // Rezerva a investice
  rezervaNasporeno?: number;
  existujiciInvestice?: number;
  mesicniVkladInvestice?: number;
  // Závazky
  hypotekaZustatek?: number;
  hypotekaSazba?: number; // v PROCENTECH (5.9)
  hypotekaZbyvaMesicu?: number;
  jineDluhy?: number;
  mesicniSplatkyDluhu?: number;
  // Rodina
  partner?: boolean;
  pocetDeti?: number;
  // Penze
  vekOdchodu?: number;
  penzeNasporeno?: number;
  penzeMesicniVklad?: number;
  cilovaRentaDuchod?: number;
  ocekavanaStatniPenze?: number;
  // Ostatní
  rizikovyProfil?: 'konzervativni' | 'vyvazeny' | 'dynamicky';
  povolani?: string;
  zdravotniStav?: string;
  cile?: string;
  aktualizovano?: string; // ISO datum poslední změny
}

const KLIC = 'poradceai:pripad';

function nactiZeStorage(): Pripad {
  if (typeof window === 'undefined') return {};
  try {
    const s = window.localStorage.getItem(KLIC);
    return s ? (JSON.parse(s) as Pripad) : {};
  } catch {
    return {};
  }
}

/** Je profil „prázdný"? (jen technická pole se nepočítají) */
export function jePripadPrazdny(p: Pripad | null | undefined): boolean {
  if (!p) return true;
  return Object.entries(p).every(([k, v]) =>
    k === 'aktualizovano' || v === undefined || v === null || v === '');
}

/** Krátký popis případu pro seznamy/odznaky. */
export function popisPripadu(p: Pripad): string {
  if (jePripadPrazdny(p)) return 'Prázdný případ';
  const cast = [
    p.jmeno?.trim() || null,
    p.vek ? `${p.vek} let` : null,
    p.cistyPrijem ? `${p.cistyPrijem.toLocaleString('cs-CZ')} Kč/měs` : null,
    typeof p.pocetDeti === 'number' && p.pocetDeti > 0 ? `${p.pocetDeti} děti` : null,
  ].filter(Boolean);
  return cast.join(' · ') || 'Klient';
}

/**
 * React hook nad sdíleným případem. `nacteno` = už proběhla hydratace z localStorage
 * (do té doby je `pripad` prázdný, aby SSR a první render seděly).
 */
export function usePripad() {
  const [pripad, setPripad] = useState<Pripad>({});
  const [nacteno, setNacteno] = useState(false);

  useEffect(() => {
    setPripad(nactiZeStorage());
    setNacteno(true);
    const onStorage = (e: StorageEvent) => {
      if (e.key === KLIC) setPripad(nactiZeStorage());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const ulozPripad = useCallback((data: Pripad) => {
    const next: Pripad = { ...data, aktualizovano: new Date().toISOString() };
    setPripad(next);
    try { window.localStorage.setItem(KLIC, JSON.stringify(next)); } catch { /* ignoruj kvótu */ }
  }, []);

  const vymazPripad = useCallback(() => {
    setPripad({});
    try { window.localStorage.removeItem(KLIC); } catch { /* noop */ }
  }, []);

  return { pripad, nacteno, ulozPripad, vymazPripad };
}
