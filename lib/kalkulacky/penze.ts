// Kalkulačky pro PENZE / důchod (doplňkové penzijní spoření, projekce kapitálu,
// renta z naspořeného, mezera v důchodu). Čisté deterministické funkce.
//
// Konvence: roční výnos jako desetinné číslo; částky v Kč/měsíc, není-li uvedeno jinak.

import { budouciHodnota, budouciHodnotaPravidelna } from './investice';

export interface StatniPrispevekParametry {
  /** Minimální měsíční příspěvek účastníka pro nárok (Kč). */
  minProNarok: number;
  /** Sazba státního příspěvku z příspěvku účastníka. */
  sazba: number;
  /** Strop měsíčního státního příspěvku (Kč). */
  strop: number;
}

// Výchozí parametry dle reformy účinné od 1.7.2024:
// 20 % z příspěvku účastníka, nárok od 500 Kč, max. 340 Kč (dosažen při 1700 Kč).
// Parametry jsou konfigurovatelné, aby šlo reagovat na změnu legislativy.
export const VYCHOZI_STATNI_PRISPEVEK: StatniPrispevekParametry = {
  minProNarok: 500,
  sazba: 0.2,
  strop: 340,
};

/** Měsíční státní příspěvek k doplňkovému penzijnímu spoření (DPS). */
export function statniPrispevekDPS(
  mesicniPrispevek: number,
  p: StatniPrispevekParametry = VYCHOZI_STATNI_PRISPEVEK
): number {
  if (mesicniPrispevek < p.minProNarok) return 0;
  return Math.min(p.strop, mesicniPrispevek * p.sazba);
}

export interface ProjekcePenzeVstup {
  aktualniKapital?: number; // už naspořeno
  vlastniPrispevek: number; // měsíční příspěvek účastníka
  prispevekZamestnavatele?: number; // měsíční příspěvek zaměstnavatele
  zapocistStatniPrispevek?: boolean; // default true (DPS)
  rocniVynos: number;
  aktualniVek: number;
  vekOdchodu: number; // typicky 65
}

export interface ProjekcePenzeVystup {
  letDoOdchodu: number;
  mesicniStatniPrispevek: number;
  celkemMesicneSpori: number; // vlastní + zaměstnavatel + stát
  nasporenyKapital: number; // v dnešní hodnotě (reálně), počítá-li se reálným výnosem dle metodiky KFP
  vlozenoCelkem: number; // součet vkladů (bez výnosu)
  vynosCelkem: number;
}

/**
 * Projekce naspořeného kapitálu k důchodu z pravidelného spoření
 * (vlastní + zaměstnavatel + případně státní příspěvek), zhodnoceného výnosem.
 */
export function projekcePenze(v: ProjekcePenzeVstup): ProjekcePenzeVystup {
  const let_ = Math.max(0, v.vekOdchodu - v.aktualniVek);
  const stat = (v.zapocistStatniPrispevek ?? true) ? statniPrispevekDPS(v.vlastniPrispevek) : 0;
  const mesicne = v.vlastniPrispevek + (v.prispevekZamestnavatele ?? 0) + stat;

  const zPravidelnych = budouciHodnotaPravidelna(mesicne, v.rocniVynos, let_);
  const zKapitalu = budouciHodnota(v.aktualniKapital ?? 0, v.rocniVynos, let_);
  const kapital = zPravidelnych + zKapitalu;

  const vlozeno = (v.aktualniKapital ?? 0) + mesicne * Math.round(let_ * 12);
  return {
    letDoOdchodu: let_,
    mesicniStatniPrispevek: stat,
    celkemMesicneSpori: mesicne,
    nasporenyKapital: kapital,
    vlozenoCelkem: vlozeno,
    vynosCelkem: kapital - vlozeno,
  };
}

/**
 * Měsíční renta, kterou lze čerpat z kapitálu po dobu letVyplaty let, přičemž
 * zbytek se dál zhodnocuje rocniVynos. Anuita s úročením (kapitál na konci = 0).
 */
export function mesicniRentaZKapitalu(
  kapital: number,
  rocniVynos: number,
  letVyplaty: number
): number {
  const n = Math.round(letVyplaty * 12);
  if (n <= 0) return 0;
  const i = Math.pow(1 + rocniVynos, 1 / 12) - 1;
  if (i === 0) return kapital / n;
  return (kapital * i) / (1 - Math.pow(1 + i, -n));
}

// Pravidlo KFP/AFP: z 1 mil. Kč majetku ≈ 5 000 Kč měsíční renty → koeficient 200
// (renta dlouhodobě udržitelná, inflace kompenzována rozpouštěním jistiny ~20–30 let).
export const KOEFICIENT_RENTY = 200;

/** Majetek potřebný pro cílovou měsíční rentu dle pravidla KFP (renta × 200). */
export function majetekProRentu(mesicniRenta: number, koeficient = KOEFICIENT_RENTY): number {
  return Math.max(0, mesicniRenta * koeficient);
}

/** Měsíční renta dosažitelná z majetku dle pravidla KFP (majetek / 200). */
export function rentaZMajetku(majetek: number, koeficient = KOEFICIENT_RENTY): number {
  return koeficient > 0 ? Math.max(0, majetek / koeficient) : 0;
}

export interface MezeraVDuchoduVstup {
  cilovaMesicniRenta: number; // kolik chce klient měsíčně mít navíc v důchodu
  ocekavanaStatniPenze?: number; // odhad státního důchodu (měsíčně)
  naprojektovanyKapital: number; // z projekcePenze
  rocniVynosVDuchodu: number;
  letVyplaty: number; // jak dlouho čerpat (např. 25)
}

export interface MezeraVDuchoduVystup {
  potrebnaRentaZeSporeni: number; // cíl − státní penze
  dosazitelnaRenta: number; // z naprojektovaného kapitálu
  mesicniMezera: number; // kolik chybí měsíčně (0 = pokryto)
  potrebnyKapital: number; // kolik kapitálu by cíl vyžadoval
  pokryto: boolean;
}

/**
 * Mezera v důchodu: porovná cílovou rentu (po odečtení státní penze) s tím,
 * co umožní naprojektovaný kapitál, a spočítá chybějící kapitál i měsíční mezeru.
 */
export function mezeraVDuchodu(v: MezeraVDuchoduVstup): MezeraVDuchoduVystup {
  const potrebnaRenta = Math.max(0, v.cilovaMesicniRenta - (v.ocekavanaStatniPenze ?? 0));
  const dosazitelna = mesicniRentaZKapitalu(v.naprojektovanyKapital, v.rocniVynosVDuchodu, v.letVyplaty);
  const mezera = Math.max(0, potrebnaRenta - dosazitelna);

  // Kolik kapitálu by cílová renta vyžadovala (inverze rentní anuity).
  const n = Math.round(v.letVyplaty * 12);
  const i = Math.pow(1 + v.rocniVynosVDuchodu, 1 / 12) - 1;
  const potrebnyKapital =
    i === 0 ? potrebnaRenta * n : (potrebnaRenta * (1 - Math.pow(1 + i, -n))) / i;

  return {
    potrebnaRentaZeSporeni: potrebnaRenta,
    dosazitelnaRenta: dosazitelna,
    mesicniMezera: mezera,
    potrebnyKapital,
    pokryto: mezera <= 0,
  };
}
