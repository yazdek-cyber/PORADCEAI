// Kalkulačky pro POJIŠTĚNÍ (potřeba krytí, metoda DIME, finanční rezerva).
// Čisté deterministické funkce — určují DOPORUČENOU výši krytí; konkrétní produkty
// a podmínky pak dodá RAG nad pojistnými podmínkami.

export interface RezervaVystup {
  doporucenaRezerva: number;
  mesicu: number;
  chybiDoRezervy: number; // kolik ještě chybí k doporučené výši
}

/**
 * Finanční rezerva (nouzový fond) = násobek měsíčních výdajů.
 * Standard 3–6 měsíců; u OSVČ/nestabilního příjmu spíš 6.
 */
export function rezerva(mesicniVydaje: number, mesicu = 4, jizNasporeno = 0): RezervaVystup {
  const doporucena = mesicniVydaje * mesicu;
  return {
    doporucenaRezerva: doporucena,
    mesicu,
    chybiDoRezervy: Math.max(0, doporucena - jizNasporeno),
  };
}

/**
 * Pojistná potřeba — PŘÍJMOVÁ metoda: kolik je třeba, aby krytí nahradilo
 * čistý příjem živitele po zvolený počet let (jednoduché, hrubé krytí výpadku).
 */
export function pojistnaPotreba_prijmova(rocniCistyPrijem: number, rokyKryti: number): number {
  return Math.max(0, rocniCistyPrijem * rokyKryti);
}

export interface DimeVstup {
  /** D — Debt: ostatní dluhy mimo hypotéku (úvěry, kreditky). */
  dluhy: number;
  /** I — Income: čistý měsíční příjem živitele. */
  mesicniPrijem: number;
  /** Počet let, po které má krytí nahrazovat příjem (do osamostatnění rodiny). */
  rokyNahradyPrijmu: number;
  /** M — Mortgage: zůstatek hypotéky. */
  hypoteka: number;
  /** E — Education: odhad nákladů na vzdělání/zaopatření dětí. */
  nakladyNaDeti: number;
  /** Co už je k dispozici (úspory, stávající životní pojistky) — odečte se. */
  jizKDispozici?: number;
}

export interface DimeVystup {
  dluhy: number;
  nahradaPrijmu: number;
  hypoteka: number;
  deti: number;
  hrubaPotreba: number;
  jizKDispozici: number;
  doporucenaPojistnaCastka: number; // hrubá potřeba − již k dispozici
}

/**
 * Pojistná potřeba — metoda DIME (Debt, Income, Mortgage, Education).
 * Sečte závazky a budoucí potřeby rodiny, odečte stávající zdroje a vrátí
 * doporučenou pojistnou částku pro případ smrti/trvalých následků živitele.
 */
export function pojistnaPotreba_DIME(v: DimeVstup): DimeVystup {
  const nahradaPrijmu = Math.max(0, v.mesicniPrijem * 12 * v.rokyNahradyPrijmu);
  const hruba = v.dluhy + nahradaPrijmu + v.hypoteka + v.nakladyNaDeti;
  const kDispozici = v.jizKDispozici ?? 0;
  return {
    dluhy: v.dluhy,
    nahradaPrijmu,
    hypoteka: v.hypoteka,
    deti: v.nakladyNaDeti,
    hrubaPotreba: hruba,
    jizKDispozici: kDispozici,
    doporucenaPojistnaCastka: Math.max(0, hruba - kDispozici),
  };
}
