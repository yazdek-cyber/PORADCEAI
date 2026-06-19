// Kalkulačky pro ÚVĚRY (hypotéky, spotřebitelské úvěry, refinancování).
// Čisté deterministické funkce — žádná AI. Slouží jako "nástroje", které AI volá
// při sestavování finančního plánu, aby čísla byla spočítaná, ne vymyšlená.
//
// Konvence: roční sazba se zadává jako desetinné číslo (0.049 = 4,9 % p.a.).
// Částky v Kč, doby v měsících (pokud není uvedeno jinak).

/** Měsíční úroková sazba z roční (prosté dělení 12, jak je u anuit v ČR zvykem). */
function mesicniSazba(rocniSazba: number): number {
  return rocniSazba / 12;
}

/**
 * Anuitní (konstantní) měsíční splátka úvěru.
 * Vzorec: P = J · i / (1 − (1+i)^−n), kde i = měsíční sazba, n = počet splátek.
 * Při nulové sazbě jde o prosté dělení jistiny počtem splátek.
 */
export function anuitniSplatka(jistina: number, rocniSazba: number, pocetMesicu: number): number {
  if (jistina <= 0 || pocetMesicu <= 0) return 0;
  const i = mesicniSazba(rocniSazba);
  if (i === 0) return jistina / pocetMesicu;
  return (jistina * i) / (1 - Math.pow(1 + i, -pocetMesicu));
}

export interface RadekKalendare {
  mesic: number;
  splatka: number;
  urok: number;
  umor: number; // splátka jistiny
  zustatek: number;
}

export interface SplatkovyKalendar {
  splatka: number;
  pocetMesicu: number;
  celkemZaplaceno: number;
  celkemUroky: number;
  radky: RadekKalendare[];
}

/**
 * Sestaví splátkový kalendář anuitního úvěru a součty (přeplatek = celkemUroky).
 * Poslední splátka se dorovná na haléře, aby zůstatek skončil přesně na nule.
 */
export function splatkovyKalendar(
  jistina: number,
  rocniSazba: number,
  pocetMesicu: number
): SplatkovyKalendar {
  const i = mesicniSazba(rocniSazba);
  const splatka = anuitniSplatka(jistina, rocniSazba, pocetMesicu);
  const radky: RadekKalendare[] = [];
  let zustatek = jistina;
  let celkemUroky = 0;

  for (let m = 1; m <= pocetMesicu; m++) {
    const urok = zustatek * i;
    let umor = splatka - urok;
    let aktualniSplatka = splatka;
    // Poslední měsíc: doplať přesně zbytek (eliminace zaokrouhlovacího zbytku).
    if (m === pocetMesicu || umor > zustatek) {
      umor = zustatek;
      aktualniSplatka = umor + urok;
    }
    zustatek = Math.max(0, zustatek - umor);
    celkemUroky += urok;
    radky.push({ mesic: m, splatka: aktualniSplatka, urok, umor, zustatek });
    if (zustatek <= 0) break;
  }

  const celkemZaplaceno = jistina + celkemUroky;
  return { splatka, pocetMesicu: radky.length, celkemZaplaceno, celkemUroky, radky };
}

export interface LimityCNB {
  /** Max. podíl měsíčních splátek všech úvěrů na čistém měsíčním příjmu (např. 0.45 = 45 %). */
  maxDSTI: number;
  /** Max. násobek čistého ROČNÍho příjmu pro celkový dluh (např. 8.5). */
  maxDTI: number;
  /** Max. LTV — podíl úvěru na hodnotě nemovitosti (např. 0.8 = 80 %). */
  maxLTV: number;
}

// Orientační regulatorní limity ČNB (doporučené hodnoty; mění se rozhodnutím ČNB).
// Slouží jako výchozí; konkrétní limity nech řídit daty/zadáním poradce.
export const VYCHOZI_LIMITY_CNB: LimityCNB = { maxDSTI: 0.45, maxDTI: 8.5, maxLTV: 0.8 };

export interface MaxUverVstup {
  cistyMesicniPrijem: number;
  stavajiciMesicniSplatky?: number; // splátky jiných úvěrů (pro DSTI)
  stavajiciCelkovyDluh?: number; // zůstatek jistin stávajících úvěrů (pro DTI)
  rocniSazba: number;
  pocetMesicu: number;
  hodnotaNemovitosti?: number; // pro LTV strop (volitelné)
  limity?: LimityCNB;
}

export interface MaxUverVystup {
  maxUver: number;
  /** Který limit je závazný (rozhoduje o výsledku). */
  rozhodujiciLimit: 'DSTI' | 'DTI' | 'LTV';
  dleDSTI: number;
  dleDTI: number;
  dleLTV: number | null;
  splatkaPriMaxUveru: number;
}

/**
 * Maximální výše úvěru podle regulatorních limitů (DSTI, DTI, příp. LTV).
 * Vrací nejnižší z limitů (ten je závazný) + rozpad.
 */
export function maxUver(v: MaxUverVstup): MaxUverVystup {
  const limity = v.limity ?? VYCHOZI_LIMITY_CNB;
  const stavajici = v.stavajiciMesicniSplatky ?? 0;

  // DSTI: kolik z příjmu zbývá na novou splátku → zpětně dopočítáme jistinu.
  const volnaSplatka = Math.max(0, v.cistyMesicniPrijem * limity.maxDSTI - stavajici);
  const i = mesicniSazba(v.rocniSazba);
  const dleDSTI =
    i === 0
      ? volnaSplatka * v.pocetMesicu
      : (volnaSplatka * (1 - Math.pow(1 + i, -v.pocetMesicu))) / i;

  // DTI: celkový dluh ≤ násobek ročního příjmu → prostor pro NOVÝ úvěr = strop − stávající jistina.
  const rocniPrijem = v.cistyMesicniPrijem * 12;
  const dleDTI = Math.max(0, rocniPrijem * limity.maxDTI - (v.stavajiciCelkovyDluh ?? 0));

  // LTV: jen pokud známe hodnotu nemovitosti.
  const dleLTV = v.hodnotaNemovitosti ? v.hodnotaNemovitosti * limity.maxLTV : null;

  const kandidati: { limit: MaxUverVystup['rozhodujiciLimit']; hodnota: number }[] = [
    { limit: 'DSTI', hodnota: dleDSTI },
    { limit: 'DTI', hodnota: dleDTI },
  ];
  if (dleLTV !== null) kandidati.push({ limit: 'LTV', hodnota: dleLTV });

  const vitez = kandidati.reduce((a, b) => (b.hodnota < a.hodnota ? b : a));
  const maxU = Math.max(0, Math.floor(vitez.hodnota));

  return {
    maxUver: maxU,
    rozhodujiciLimit: vitez.limit,
    dleDSTI: Math.floor(dleDSTI),
    dleDTI: Math.floor(dleDTI),
    dleLTV: dleLTV === null ? null : Math.floor(dleLTV),
    splatkaPriMaxUveru: anuitniSplatka(maxU, v.rocniSazba, v.pocetMesicu),
  };
}

export interface RefinancovaniVstup {
  zbyvajiciJistina: number;
  zbyvajiciMesicu: number;
  stavajiciSazba: number;
  novaSazba: number;
  poplatkyZaRefinancovani?: number; // jednorázové náklady (poplatky, odhad, sankce)
}

export interface RefinancovaniVystup {
  stavajiciSplatka: number;
  novaSplatka: number;
  mesicniUspora: number;
  celkovaUsporaNaUrocich: number; // za zbývající dobu, po odečtení poplatků
  navratnostMesicu: number | null; // za kolik měsíců se poplatky vrátí; null když nešetří
  vyplati: boolean;
}

/**
 * Refinancování: porovná stávající a novou sazbu na zbývající jistině/době,
 * spočítá měsíční úsporu a návratnost jednorázových poplatků (break-even).
 */
export function refinancovani(v: RefinancovaniVstup): RefinancovaniVystup {
  const poplatky = v.poplatkyZaRefinancovani ?? 0;
  const stavajiciSplatka = anuitniSplatka(v.zbyvajiciJistina, v.stavajiciSazba, v.zbyvajiciMesicu);
  const novaSplatka = anuitniSplatka(v.zbyvajiciJistina, v.novaSazba, v.zbyvajiciMesicu);
  const mesicniUspora = stavajiciSplatka - novaSplatka;

  const urokyStare = splatkovyKalendar(v.zbyvajiciJistina, v.stavajiciSazba, v.zbyvajiciMesicu).celkemUroky;
  const urokyNove = splatkovyKalendar(v.zbyvajiciJistina, v.novaSazba, v.zbyvajiciMesicu).celkemUroky;
  const celkovaUspora = urokyStare - urokyNove - poplatky;

  const navratnost = mesicniUspora > 0 ? Math.ceil(poplatky / mesicniUspora) : null;
  return {
    stavajiciSplatka,
    novaSplatka,
    mesicniUspora,
    celkovaUsporaNaUrocich: celkovaUspora,
    navratnostMesicu: navratnost,
    vyplati: celkovaUspora > 0 && mesicniUspora > 0,
  };
}

/**
 * RPSN (roční procentní sazba nákladů) jako efektivní roční úroková míra
 * z reálných peněžních toků: čerpání mínus poplatky na začátku, pak splátky.
 * Hledáme měsíční IRR (bisekce) a anualizujeme: (1+IRR)^12 − 1.
 */
export function rpsn(
  jistina: number,
  rocniSazba: number,
  pocetMesicu: number,
  vstupniPoplatky = 0,
  mesicniPoplatky = 0
): number {
  const splatka = anuitniSplatka(jistina, rocniSazba, pocetMesicu) + mesicniPoplatky;
  // Cashflow z pohledu klienta: +čistá vyplacená částka v t0, −splátky dále.
  const cisteVyplaceno = jistina - vstupniPoplatky;
  if (cisteVyplaceno <= 0 || splatka <= 0) return 0;

  const npv = (mesicniMira: number): number => {
    let suma = cisteVyplaceno;
    for (let m = 1; m <= pocetMesicu; m++) {
      suma -= splatka / Math.pow(1 + mesicniMira, m);
    }
    return suma;
  };

  // Bisekce na [0, 1] měsíční míry (1 = 100 %/měsíc, dostatečně velký strop).
  let lo = 0;
  let hi = 1;
  for (let k = 0; k < 200; k++) {
    const mid = (lo + hi) / 2;
    const val = npv(mid);
    if (Math.abs(val) < 1e-6) {
      lo = hi = mid;
      break;
    }
    // NPV ROSTE s rostoucí mírou (odečítáme klesající diskontovaný součet splátek):
    // npv(mid) > 0 → míra je příliš vysoká → sniž horní mez, jinak zvyš dolní.
    if (val > 0) hi = mid;
    else lo = mid;
  }
  const mesicniIRR = (lo + hi) / 2;
  return Math.pow(1 + mesicniIRR, 12) - 1;
}
