'use client';

// SDÍLENÝ „PŘÍPAD KLIENTA" + EVIDENCE KLIENTŮ (v0.19).
// Profil klienta se zadá jednou a propíše se do plánu, kalkulaček, Rychlého návrhu, záznamu
// z jednání i na Domů. Nově: VÍCE pojmenovaných klientů s přepínačem (aktivní klient).
// Úložiště: localStorage prohlížeče (BEZ serveru / bez odeslání kamkoliv) — respektuje hranici,
// že reálná data klientů neopouštějí prohlížeč, dokud je poradce vědomě nepošle do plánu/AI.

import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';

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
  aktualizovano?: string;
}

export interface KlientZaznam {
  id: string;
  profil: Pripad;
  vytvoreno: string;
  aktualizovano: string;
}

interface Ulozeno {
  klienti: KlientZaznam[];
  aktivniId: string | null;
}

const KLIC = 'poradceai:klienti';
const STARY_KLIC = 'poradceai:pripad'; // single-case verze v0.18 (migrace)
const PRAZDNO: Ulozeno = { klienti: [], aktivniId: null };

function novyId(): string {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch { /* fallback níže */ }
  return 'k' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/** Je profil „prázdný"? (technická pole se nepočítají) */
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

/** Zobrazované jméno klienta v přepínači. */
export function jmenoKlienta(p: Pripad): string {
  return p.jmeno?.trim() || (jePripadPrazdny(p) ? 'Nový klient' : 'Klient bez jména');
}

function nacti(): Ulozeno {
  if (typeof window === 'undefined') return PRAZDNO;
  try {
    const s = window.localStorage.getItem(KLIC);
    if (s) return JSON.parse(s) as Ulozeno;
    // Migrace ze single-case verze (v0.18): jeden uložený případ → jeden klient.
    const stary = window.localStorage.getItem(STARY_KLIC);
    if (stary) {
      const profil = JSON.parse(stary) as Pripad;
      if (!jePripadPrazdny(profil)) {
        const kdy = profil.aktualizovano || new Date().toISOString();
        const z: KlientZaznam = { id: novyId(), profil, vytvoreno: kdy, aktualizovano: kdy };
        return { klienti: [z], aktivniId: z.id };
      }
    }
  } catch { /* poškozený JSON → prázdno */ }
  return PRAZDNO;
}

function zapis(u: Ulozeno): void {
  try { window.localStorage.setItem(KLIC, JSON.stringify(u)); } catch { /* kvóta */ }
}

// ── Modul-level store ───────────────────────────────────────────────────────
// Jeden sdílený stav pro VŠECHNY instance usePripad ve stejném dokumentu (přepínač
// v sidebaru i obsah stránky). `storage` event řeší jen jiné taby — uvnitř jednoho
// dokumentu se nespouští, proto vlastní pub/sub + useSyncExternalStore.
let stav: Ulozeno = PRAZDNO;
let inicializovano = false;
const listeners = new Set<() => void>();

function zajistiInit(): void {
  if (!inicializovano && typeof window !== 'undefined') {
    stav = nacti();
    inicializovano = true;
  }
}
function emit(): void { listeners.forEach((l) => l()); }
function commit(next: Ulozeno): void { stav = next; zapis(next); emit(); }

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === KLIC) { stav = nacti(); inicializovano = true; emit(); }
  });
}

function subscribe(cb: () => void): () => void {
  zajistiInit();
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}
function getSnapshot(): Ulozeno { zajistiInit(); return stav; }
function getServerSnapshot(): Ulozeno { return PRAZDNO; }

/**
 * React hook nad evidencí klientů (sdílený store). `nacteno` = po hydrataci na klientu.
 * `pripad` = profil aktivního klienta (nebo {}), aby stávající stránky fungovaly beze změny.
 * Všechny instance se synchronizují (přepnutí klienta v sidebaru ihned promítne i obsah stránky).
 */
export function usePripad() {
  const stavLoc = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [nacteno, setNacteno] = useState(false);
  useEffect(() => { setNacteno(true); }, []);

  const aktivni = stavLoc.klienti.find((k) => k.id === stavLoc.aktivniId) ?? null;
  const pripad: Pripad = aktivni?.profil ?? {};

  /** Uloží profil do AKTIVNÍHO klienta (když žádný není, založí ho). */
  const ulozPripad = useCallback((data: Pripad) => {
    zajistiInit();
    const now = new Date().toISOString();
    const profil: Pripad = { ...data, aktualizovano: now };
    let klienti = stav.klienti;
    let aktivniId = stav.aktivniId;
    if (aktivniId && klienti.some((k) => k.id === aktivniId)) {
      klienti = klienti.map((k) => (k.id === aktivniId ? { ...k, profil, aktualizovano: now } : k));
    } else {
      const id = novyId();
      klienti = [...klienti, { id, profil, vytvoreno: now, aktualizovano: now }];
      aktivniId = id;
    }
    commit({ klienti, aktivniId });
  }, []);

  const novyKlient = useCallback((jmeno?: string) => {
    zajistiInit();
    const now = new Date().toISOString();
    const id = novyId();
    const profil: Pripad = jmeno?.trim() ? { jmeno: jmeno.trim() } : {};
    commit({ klienti: [...stav.klienti, { id, profil, vytvoreno: now, aktualizovano: now }], aktivniId: id });
  }, []);

  const prepniKlienta = useCallback((id: string) => {
    zajistiInit();
    commit({ ...stav, aktivniId: id });
  }, []);

  const prejmenujKlienta = useCallback((id: string, jmeno: string) => {
    zajistiInit();
    const now = new Date().toISOString();
    commit({
      ...stav,
      klienti: stav.klienti.map((k) =>
        k.id === id ? { ...k, profil: { ...k.profil, jmeno: jmeno.trim() }, aktualizovano: now } : k),
    });
  }, []);

  const smazKlienta = useCallback((id: string) => {
    zajistiInit();
    const klienti = stav.klienti.filter((k) => k.id !== id);
    const aktivniId = stav.aktivniId === id ? (klienti[0]?.id ?? null) : stav.aktivniId;
    commit({ klienti, aktivniId });
  }, []);

  return {
    pripad, aktivni, klienti: stavLoc.klienti, aktivniId: stavLoc.aktivniId, nacteno,
    ulozPripad, novyKlient, prepniKlienta, prejmenujKlienta, smazKlienta,
  };
}
