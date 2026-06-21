// POKRYTÍ KLIENTA — „co klient má vs. co nemá" napříč VŠEMI odvětvími, která poradce řeší.
// Jádro SLUŽBY: klient má zajištěno VŠE. Část se odvodí z čísel (rezerva, investice, penze, úvěry),
// pojistné/spořicí produkty zadá poradce (nelze odvodit). Každá oblast odkazuje na nástroj, kde ji řešit.
// Čistá funkce → snadno testovatelná, používá ji checklist i kokpit případu.

import type { Pripad } from '@/lib/pripadStore';

export type PoleKryti = 'maZivotni' | 'maAuto' | 'maMajetek' | 'maOdpovednost' | 'maStavebni';

export interface OblastPokryti {
  id: string;
  nazev: string;
  popis: string;
  kryto: boolean;
  /** true = odvozeno z čísel (needitovatelné); false = zadává poradce (zaškrtávací). */
  odvozeno: boolean;
  /** klíč v Pripad pro zaškrtávací oblasti */
  pole?: PoleKryti;
  /** nástroj, kde oblast řešit (provázanost) */
  href: string;
}

export function pokrytiKlienta(p: Pripad): OblastPokryti[] {
  const vydaje = p.vydaje ?? 0;
  const maHypo = (p.hypotekaZustatek ?? 0) > 0;
  return [
    { id: 'rezerva', nazev: 'Likvidní rezerva', popis: 'doporučeno 6× měsíční výdaje',
      kryto: vydaje > 0 && (p.rezervaNasporeno ?? 0) >= vydaje * 6, odvozeno: true, href: '/kalkulacky' },
    { id: 'zivot', nazev: 'Životní pojištění', popis: 'ochrana příjmů (invalidita, smrt, PN, ZO)',
      kryto: !!p.maZivotni, odvozeno: false, pole: 'maZivotni', href: '/plan' },
    { id: 'auto', nazev: 'Pojištění vozidla', popis: 'povinné ručení / havarijní',
      kryto: !!p.maAuto, odvozeno: false, pole: 'maAuto', href: '/pripad' },
    { id: 'majetek', nazev: 'Pojištění majetku', popis: 'domácnost / nemovitost',
      kryto: !!p.maMajetek, odvozeno: false, pole: 'maMajetek', href: '/pripad' },
    { id: 'odpovednost', nazev: 'Pojištění odpovědnosti', popis: 'občanská / z výkonu povolání',
      kryto: !!p.maOdpovednost, odvozeno: false, pole: 'maOdpovednost', href: '/pripad' },
    { id: 'investice', nazev: 'Tvorba majetku', popis: 'pravidelná investice / portfolio',
      kryto: (p.mesicniVkladInvestice ?? 0) > 0 || (p.existujiciInvestice ?? 0) > 0, odvozeno: true, href: '/kalkulacky' },
    { id: 'penze', nazev: 'Penzijní zajištění', popis: 'DPS / renta na důchod',
      kryto: (p.penzeMesicniVklad ?? 0) > 0 || (p.penzeNasporeno ?? 0) > 0, odvozeno: true, href: '/kalkulacky' },
    { id: 'stavebko', nazev: 'Stavební spoření', popis: 'spoření se státní podporou / na bydlení',
      kryto: !!p.maStavebni, odvozeno: false, pole: 'maStavebni', href: '/kalkulacky' },
    { id: 'uvery', nazev: 'Úvěry ošetřeny', popis: 'rozumná sazba, bez drahých dluhů',
      kryto: (!maHypo || (p.hypotekaSazba != null && p.hypotekaSazba < 6)) && (p.jineDluhy ?? 0) === 0, odvozeno: true, href: '/kalkulacky' },
  ];
}

/** Kolik oblastí je pokryto / celkem. */
export function skorePokryti(p: Pripad): { kryto: number; celkem: number } {
  const o = pokrytiKlienta(p);
  return { kryto: o.filter((x) => x.kryto).length, celkem: o.length };
}
