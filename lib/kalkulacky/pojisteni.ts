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

export interface RezervaUrovneVystup {
  kratkodoba: number; // 3× měsíční výdaje — neočekávané výdaje / krátkodobý výpadek
  ztrataPrace: number; // 6× — průměrná doba hledání práce ~½ roku (tržní konsensus KFP)
  dlouhodobaNemoc: number; // 12× — po roce nemoci zpravidla invalidní důchod
}

/** Likvidní rezerva ve třech úrovních dle metodiky KFP (nesčítají se — bere se nejvyšší relevantní). */
export function rezervaUrovne(mesicniVydaje: number): RezervaUrovneVystup {
  return {
    kratkodoba: mesicniVydaje * 3,
    ztrataPrace: mesicniVydaje * 6,
    dlouhodobaNemoc: mesicniVydaje * 12,
  };
}

// Snížení potřeby pojistné částky o sociální dávky (orientačně dle metodiky EFPA/KFP).
export const SNIZENI_INVALIDITA = 2_000_000; // invalidní důchod
export const SNIZENI_SIROTCI = 1_000_000; // sirotčí důchod na každé dítě
export const SNIZENI_VDOVSKY = 2_000_000; // vdovský důchod (jen sezdaní s dětmi)

export interface EfpaVstup {
  /** Měsíční deficit rodinného rozpočtu při ÚMRTÍ živitele (výpadek příjmu po poklesu výdajů). */
  mesicniDeficitSmrt: number;
  /** Měsíční deficit při INVALIDITĚ živitele (výdaje ~120 % minus zbylý příjem/dávka). */
  mesicniDeficitInvalidita: number;
  pocetDeti: number;
  sezdany: boolean;
  soucasnyMajetek?: number;
  koeficient?: number; // default 200 (1 mil. Kč na 5 000 Kč měsíční renty)
}

export interface EfpaVystup {
  potrebaSmrtHruba: number;
  potrebaInvaliditaHruba: number;
  smrt: number; // doporučená PČ pro případ smrti (po odečtení dávek a majetku)
  invalidita: number; // doporučená PČ pro plnou invaliditu
  trvaleNasledkyUrazu: number; // ½ potřeby invalidity (TNÚ od 10 % poškození)
}

/**
 * Pojistná potřeba metodou EFPA/KFP: potřebný majetek = měsíční deficit × koeficient (200),
 * snížený o sociální dávky (invalidní/sirotčí/vdovský důchod) a o současný majetek.
 * TNÚ = ½ potřeby invalidity (cílí na ~60 % stupeň poškození).
 */
export function pojistnaPotreba_EFPA(v: EfpaVstup): EfpaVystup {
  const koef = v.koeficient ?? 200;
  const majetek = v.soucasnyMajetek ?? 0;

  const potrebaSmrtHruba = Math.max(0, v.mesicniDeficitSmrt) * koef;
  const snizeniSmrt =
    v.pocetDeti * SNIZENI_SIROTCI + (v.sezdany && v.pocetDeti > 0 ? SNIZENI_VDOVSKY : 0) + majetek;
  const smrt = Math.max(0, potrebaSmrtHruba - snizeniSmrt);

  const potrebaInvaliditaHruba = Math.max(0, v.mesicniDeficitInvalidita) * koef;
  const invalidita = Math.max(0, potrebaInvaliditaHruba - (SNIZENI_INVALIDITA + majetek));

  return {
    potrebaSmrtHruba,
    potrebaInvaliditaHruba,
    smrt,
    invalidita,
    trvaleNasledkyUrazu: Math.round(invalidita / 2),
  };
}

export interface EdoKrytiVstup {
  mesicniCistyPrijem: number;
  vek: number;
}

export interface EdoKrytiVystup {
  smrt: number; // 3× roční čistý příjem
  invalidita: number; // 3× roční čistý příjem
  zavazneOnemocneni: number; // 1× roční čistý příjem
  pracovniNeschopnostMesicniDorovnani: number; // ~40 % příjmu (dorovnání nemocenské)
  trvaleNasledkyUrazu: number; // dle věku (eDO praxe)
}

/**
 * Doporučené pojistné částky podle PRAXE eDO (z jejich metodiky finanční analýzy):
 * smrt i invalidita 3× roční čistý příjem, závažná onemocnění 1× roční příjem,
 * pracovní neschopnost = měsíční dorovnání rozdílu nemocenská/příjem (~40 %),
 * trvalé následky úrazu dle věku. Slouží vedle metody DIME jako „eDO nastavení".
 */
export function pojistnaPotreba_eDO(v: EdoKrytiVstup): EdoKrytiVystup {
  const rocni = Math.max(0, v.mesicniCistyPrijem * 12);
  return {
    smrt: 3 * rocni,
    invalidita: 3 * rocni,
    zavazneOnemocneni: rocni,
    pracovniNeschopnostMesicniDorovnani: Math.round(v.mesicniCistyPrijem * 0.4),
    trvaleNasledkyUrazu: v.vek < 45 ? 2_000_000 : 1_000_000,
  };
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
