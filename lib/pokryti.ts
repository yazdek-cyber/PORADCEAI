// POKRYTÍ KLIENTA — „co klient má vs. co nemá" napříč oblastmi. Jádro SLUŽBY: klient má zajištěno VŠE.
// Část se odvodí z čísel (rezerva, penze, investice, úvěry), pojistné krytí zadá poradce (nelze odvodit).
// Čistá funkce → snadno testovatelná, používá ji checklist i kokpit případu.

import type { Pripad } from '@/lib/pripadStore';

export interface OblastPokryti {
  id: 'rezerva' | 'zivot' | 'majetek' | 'penze' | 'investice' | 'uvery';
  nazev: string;
  popis: string;
  kryto: boolean;
  /** true = odvozeno z čísel (needitovatelné); false = zadává poradce (zaškrtávací). */
  odvozeno: boolean;
  /** klíč v Pripad pro zaškrtávací oblasti */
  pole?: 'maZivotni' | 'maMajetek';
}

export function pokrytiKlienta(p: Pripad): OblastPokryti[] {
  const vydaje = p.vydaje ?? 0;
  const maHypo = (p.hypotekaZustatek ?? 0) > 0;
  return [
    {
      // Práh 6× — shodně s doporučenou rezervou v plánu (pojisteni.rezerva ..., 6) a panelem mezer,
      // ať si kokpit a plán u téhož klienta neprotiřečí.
      id: 'rezerva', nazev: 'Likvidní rezerva', popis: 'doporučeno 6× měsíční výdaje',
      kryto: vydaje > 0 && (p.rezervaNasporeno ?? 0) >= vydaje * 6, odvozeno: true,
    },
    {
      id: 'zivot', nazev: 'Životní pojištění', popis: 'ochrana příjmů (invalidita, smrt, PN)',
      kryto: !!p.maZivotni, odvozeno: false, pole: 'maZivotni',
    },
    {
      id: 'majetek', nazev: 'Pojištění majetku', popis: 'domácnost / nemovitost / odpovědnost',
      kryto: !!p.maMajetek, odvozeno: false, pole: 'maMajetek',
    },
    {
      id: 'penze', nazev: 'Penzijní zajištění', popis: 'DPS / renta na důchod',
      kryto: (p.penzeMesicniVklad ?? 0) > 0 || (p.penzeNasporeno ?? 0) > 0, odvozeno: true,
    },
    {
      id: 'investice', nazev: 'Tvorba majetku', popis: 'pravidelná investice / portfolio',
      kryto: (p.mesicniVkladInvestice ?? 0) > 0 || (p.existujiciInvestice ?? 0) > 0, odvozeno: true,
    },
    {
      // Chybějící sazba neznamená „ošetřeno" — vyžaduj zadanou sazbu < 6 %.
      id: 'uvery', nazev: 'Úvěry ošetřeny', popis: 'rozumná sazba, bez drahých dluhů',
      kryto: (!maHypo || (p.hypotekaSazba != null && p.hypotekaSazba < 6)) && (p.jineDluhy ?? 0) === 0, odvozeno: true,
    },
  ];
}

/** Kolik oblastí je pokryto / celkem. */
export function skorePokryti(p: Pripad): { kryto: number; celkem: number } {
  const o = pokrytiKlienta(p);
  return { kryto: o.filter((x) => x.kryto).length, celkem: o.length };
}
