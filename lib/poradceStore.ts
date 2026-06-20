'use client';

// BRANDING / PROFIL PORADCE — pro hlavičku a patičku klientských výstupů (PDF) a záznam z jednání.
// Úložiště: localStorage (BEZ serveru). Logo se ukládá jako data URL (base64). Per-tenant branding
// bude později vázané na workspace; teď stačí lokální profil poradce.

import { useState, useEffect, useCallback } from 'react';

export interface Poradce {
  jmeno?: string;
  osvedceni?: string; // číslo osvědčení ČNB
  telefon?: string;
  email?: string;
  firma?: string;
  logo?: string; // data URL (PNG/SVG/JPG)
}

const KLIC = 'poradceai:poradce';

function nacti(): Poradce {
  if (typeof window === 'undefined') return {};
  try {
    const s = window.localStorage.getItem(KLIC);
    return s ? (JSON.parse(s) as Poradce) : {};
  } catch {
    return {};
  }
}

export function usePoradce() {
  const [poradce, setPoradce] = useState<Poradce>({});
  const [nacteno, setNacteno] = useState(false);

  useEffect(() => {
    setPoradce(nacti());
    setNacteno(true);
    const onStorage = (e: StorageEvent) => { if (e.key === KLIC) setPoradce(nacti()); };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const ulozPoradce = useCallback((data: Poradce) => {
    setPoradce(data);
    try { window.localStorage.setItem(KLIC, JSON.stringify(data)); } catch { /* kvóta (velké logo) */ }
  }, []);

  return { poradce, nacteno, ulozPoradce };
}
