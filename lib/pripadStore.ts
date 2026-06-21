'use client';

// EVIDENCE KLIENTŮ — od v0.44 SERVEROVÁ (Supabase, per poradce přes RLS), dříve localStorage.
// Veřejné API `usePripad()` zůstává STEJNÉ (8 konzumentů beze změny). Vnitřek: data ze serveru,
// optimistické zápisy (UI reaguje hned, na pozadí se uloží na server), `aktivniId` v localStorage
// (UI preference, ne data klienta) a JEDNORÁZOVÁ migrace starých localStorage klientů na server.

import { useCallback, useSyncExternalStore } from 'react';
import { nactiKlientyAction, ulozKlientaAction, smazKlientaServerAction } from '@/app/dataActions';

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
  // Co klient UŽ MÁ (pro analýzu pokrytí „co má vs. nemá"; co nelze odvodit z čísel, zadá poradce).
  maZivotni?: boolean;   // životní pojištění (ochrana příjmů)
  maAuto?: boolean;      // pojištění vozidla (POV / havarijní)
  maMajetek?: boolean;   // pojištění majetku/domácnosti
  maOdpovednost?: boolean; // pojištění odpovědnosti
  maStavebni?: boolean;  // stavební spoření
  // Současné KRYTÍ z existujících smluv (Kč) — pro přesnou mezeru „co smlouva kryje vs. potřeba".
  soucasneKrytiSmrt?: number;
  soucasneKrytiInvalidita?: number;
  soucasneKrytiZO?: number; // závažná onemocnění
  soucasneKrytiTN?: number; // trvalé následky úrazu
  // Ostatní
  rizikovyProfil?: 'konzervativni' | 'vyvazeny' | 'dynamicky';
  povolani?: string;
  zdravotniStav?: string;
  cile?: string;
  poznamky?: string; // volné poznámky poradce ke klientovi (CRM)
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

const AKTIVNI_KLIC = 'poradceai:aktivniKlient'; // jen UI preference (které id je aktivní)
const STARY_KLIC = 'poradceai:klienti';         // localStorage evidence (v0.19) — pro jednorázovou migraci
const STARY_SINGLE = 'poradceai:pripad';        // single-case (v0.18)
const PRAZDNO: Ulozeno = { klienti: [], aktivniId: null };

function novyId(): string {
  // MUSÍ být validní UUID — `klienti.id` je v DB typu UUID, jinak by serverový upsert tiše selhal.
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const b = crypto.getRandomValues(new Uint8Array(16));
      b[6] = (b[6] & 0x0f) | 0x40; // verze 4
      b[8] = (b[8] & 0x3f) | 0x80; // varianta
      const h = Array.from(b, (x) => x.toString(16).padStart(2, '0'));
      return `${h[0]}${h[1]}${h[2]}${h[3]}-${h[4]}${h[5]}-${h[6]}${h[7]}-${h[8]}${h[9]}-${h[10]}${h[11]}${h[12]}${h[13]}${h[14]}${h[15]}`;
    }
  } catch { /* fallback níže */ }
  // Krajní záchrana (bez Web Crypto) — stále validní UUID tvar.
  return '00000000-0000-4000-8000-' + Date.now().toString(16).padStart(12, '0').slice(-12);
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

// ── Modul-level store (sdílený pro všechny instance usePripad v dokumentu) ────
let stav: Ulozeno = PRAZDNO;
let nactenoFlag = false; // true = data ze serveru načtena (po loginu)
let nacitaSe = false;
const listeners = new Set<() => void>();

function emit(): void { listeners.forEach((l) => l()); }

function ulozAktivni(id: string | null): void {
  try {
    if (id) window.localStorage.setItem(AKTIVNI_KLIC, id);
    else window.localStorage.removeItem(AKTIVNI_KLIC);
  } catch { /* kvóta/soukromý režim — UI preference, neblokuje */ }
}

/** Aplikuje nový stav: paměť + perzistence aktivního id + notifikace. */
function commit(next: Ulozeno): void { stav = next; ulozAktivni(next.aktivniId); emit(); }

/**
 * Tvrdý reset modul-level stavu — volat při ODHLÁŠENÍ. Jinak by data poradce A zůstala v paměti
 * tabu (server-action redirect je jen soft navigace) a poradce B by je po přihlášení uviděl.
 * Logout dělá i `window.location` hard reload, tohle je druhá pojistka.
 */
export function resetPripadStore(): void {
  stav = PRAZDNO;
  nactenoFlag = false;
  nacitaSe = false;
  try { window.localStorage.removeItem(AKTIVNI_KLIC); } catch { /* ignore */ }
  emit();
}

/** Jednorázové načtení STARÝCH localStorage klientů (pro migraci na server). */
function nactiStareLokalni(): KlientZaznam[] {
  try {
    const s = window.localStorage.getItem(STARY_KLIC);
    if (s) {
      const parsed = JSON.parse(s);
      if (parsed && Array.isArray(parsed.klienti)) {
        return parsed.klienti.filter(
          (k: unknown): k is KlientZaznam =>
            !!k && typeof k === 'object'
            && typeof (k as KlientZaznam).id === 'string'
            && !!(k as KlientZaznam).profil && typeof (k as KlientZaznam).profil === 'object',
        );
      }
    }
    const single = window.localStorage.getItem(STARY_SINGLE);
    if (single) {
      const profil = JSON.parse(single) as Pripad;
      if (!jePripadPrazdny(profil)) {
        const kdy = profil.aktualizovano || new Date().toISOString();
        return [{ id: novyId(), profil, vytvoreno: kdy, aktualizovano: kdy }];
      }
    }
  } catch { /* poškozený JSON → nic k migraci */ }
  return [];
}

async function nactiZeServeru(): Promise<void> {
  if (nacitaSe || nactenoFlag) return;
  nacitaSe = true;
  try {
    let aktivni: string | null = null;
    try { aktivni = window.localStorage.getItem(AKTIVNI_KLIC); } catch { /* ignore */ }

    let klienti = await nactiKlientyAction();

    // Jednorázová migrace: server prázdný + lokálně existují klienti → nahraj je na server.
    if (klienti.length === 0) {
      const stari = nactiStareLokalni();
      if (stari.length) {
        const vysledky = await Promise.allSettled(stari.map((k) => ulozKlientaAction(k.id, k.profil)));
        klienti = stari;
        // localStorage zálohu smaž JEN když VŠECHNY uploady prošly — jinak data ponech k dalšímu pokusu.
        const vseOk = vysledky.every((r) => r.status === 'fulfilled' && r.value?.ok);
        if (vseOk) {
          try { window.localStorage.removeItem(STARY_KLIC); window.localStorage.removeItem(STARY_SINGLE); } catch { /* ignore */ }
        } else {
          console.error('Migrace klientů na server částečně selhala — localStorage záloha ponechána.');
        }
      }
    }

    const aktivniId = klienti.some((k) => k.id === aktivni) ? aktivni : (klienti[0]?.id ?? null);
    stav = { klienti, aktivniId };
  } catch {
    // Nepřihlášený / chyba — necháme prázdno. Datové akce sami přesměrují na /login (verifySession).
    stav = PRAZDNO;
  } finally {
    nactenoFlag = true;
    nacitaSe = false;
    emit();
  }
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  if (typeof window !== 'undefined' && !nactenoFlag && !nacitaSe) void nactiZeServeru();
  return () => { listeners.delete(cb); };
}
function getSnapshot(): Ulozeno { return stav; }
function getServerSnapshot(): Ulozeno { return PRAZDNO; }
function getNacteno(): boolean { return nactenoFlag; }
function getNactenoServer(): boolean { return false; }

/** Pomocná: nahlas chybu serverového uložení (optimistický zápis už proběhl v UI). */
function hlasChybu(akce: string) {
  return (r: { ok: boolean; error?: string }) => {
    if (!r.ok) console.error(`Serverové uložení selhalo (${akce}):`, r.error);
  };
}

/**
 * React hook nad evidencí klientů. `nacteno` = po načtení ze serveru (po loginu).
 * `pripad` = profil aktivního klienta (nebo {}). Zápisy jsou OPTIMISTICKÉ: UI se aktualizuje
 * hned, na pozadí se uloží na server. Tvar API je shodný s předchozí localStorage verzí.
 */
export function usePripad() {
  const stavLoc = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const nacteno = useSyncExternalStore(subscribe, getNacteno, getNactenoServer);

  const aktivni = stavLoc.klienti.find((k) => k.id === stavLoc.aktivniId) ?? null;
  const pripad: Pripad = aktivni?.profil ?? {};

  /** Uloží profil do AKTIVNÍHO klienta (když žádný není, založí ho). Vrací id (synchronně). */
  const ulozPripad = useCallback((data: Pripad): string => {
    const now = new Date().toISOString();
    const profil: Pripad = { ...data, aktualizovano: now };
    let klienti = stav.klienti;
    let aktivniId = stav.aktivniId;
    let id = aktivniId;
    if (aktivniId && klienti.some((k) => k.id === aktivniId)) {
      klienti = klienti.map((k) => (k.id === aktivniId ? { ...k, profil, aktualizovano: now } : k));
    } else {
      id = novyId();
      klienti = [...klienti, { id, profil, vytvoreno: now, aktualizovano: now }];
      aktivniId = id;
    }
    commit({ klienti, aktivniId });
    void ulozKlientaAction(id as string, profil).then(hlasChybu('ulozPripad'));
    return id as string;
  }, []);

  const novyKlient = useCallback((jmeno?: string) => {
    const now = new Date().toISOString();
    const id = novyId();
    const profil: Pripad = jmeno?.trim() ? { jmeno: jmeno.trim() } : {};
    commit({ klienti: [...stav.klienti, { id, profil, vytvoreno: now, aktualizovano: now }], aktivniId: id });
    void ulozKlientaAction(id, profil).then(hlasChybu('novyKlient'));
  }, []);

  /**
   * Serverem POTVRZENÉ založení klienta: nejdřív uloží na server a teprve PŘI ÚSPĚCHU přidá lokálně
   * a nastaví aktivním. Tím klient nikdy „nezmizí" po reloadu kvůli tiše selhanému zápisu.
   */
  const novyKlientServer = useCallback(async (jmeno?: string): Promise<{ ok: boolean; error?: string; id?: string }> => {
    const now = new Date().toISOString();
    const id = novyId();
    const profil: Pripad = jmeno?.trim() ? { jmeno: jmeno.trim() } : {};
    const r = await ulozKlientaAction(id, profil);
    if (!r.ok) return { ok: false, error: r.error };
    commit({ klienti: [...stav.klienti, { id, profil, vytvoreno: now, aktualizovano: now }], aktivniId: id });
    return { ok: true, id };
  }, []);

  const prepniKlienta = useCallback((id: string) => {
    commit({ ...stav, aktivniId: id });
  }, []);

  const prejmenujKlienta = useCallback((id: string, jmeno: string) => {
    const now = new Date().toISOString();
    let profilNovy: Pripad | null = null;
    const klienti = stav.klienti.map((k) => {
      if (k.id !== id) return k;
      profilNovy = { ...k.profil, jmeno: jmeno.trim(), aktualizovano: now };
      return { ...k, profil: profilNovy, aktualizovano: now };
    });
    commit({ ...stav, klienti });
    if (profilNovy) void ulozKlientaAction(id, profilNovy).then(hlasChybu('prejmenujKlienta'));
  }, []);

  const smazKlienta = useCallback((id: string) => {
    const klienti = stav.klienti.filter((k) => k.id !== id);
    const aktivniId = stav.aktivniId === id ? (klienti[0]?.id ?? null) : stav.aktivniId;
    commit({ klienti, aktivniId });
    void smazKlientaServerAction(id).then(hlasChybu('smazKlienta'));
  }, []);

  /** Sloučí změny do profilu KONKRÉTNÍHO klienta (dle id), nezávisle na aktivním. */
  const aktualizujKlienta = useCallback((id: string, zmeny: Partial<Pripad>) => {
    const now = new Date().toISOString();
    let profilNovy: Pripad | null = null;
    const klienti = stav.klienti.map((k) => {
      if (k.id !== id) return k;
      profilNovy = { ...k.profil, ...zmeny, aktualizovano: now };
      return { ...k, profil: profilNovy, aktualizovano: now };
    });
    commit({ ...stav, klienti });
    if (profilNovy) void ulozKlientaAction(id, profilNovy).then(hlasChybu('aktualizujKlienta'));
  }, []);

  return {
    pripad, aktivni, klienti: stavLoc.klienti, aktivniId: stavLoc.aktivniId, nacteno,
    ulozPripad, novyKlient, novyKlientServer, prepniKlienta, prejmenujKlienta, smazKlienta, aktualizujKlienta,
  };
}
