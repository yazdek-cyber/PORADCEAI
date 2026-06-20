// Kalkulačky pro INVESTICE (jednorázové i pravidelné, vliv poplatků, inflace,
// pravděpodobnost výnosů přes Monte Carlo a srovnání investičních forem).
// Čisté deterministické funkce — Monte Carlo používá seedovaný generátor,
// takže výsledky jsou reprodukovatelné a testovatelné.
//
// Konvence: roční výnos/inflace/poplatek jako desetinné číslo (0.06 = 6 % p.a.).

/** Měsíční míra ekvivalentní roční (geometricky): (1+r)^(1/12) − 1. */
function mesicniMira(rocni: number): number {
  return Math.pow(1 + rocni, 1 / 12) - 1;
}

// ── Alokace a výnosy dle metodiky eDO/KFP (akademie finančního plánování) ──────

export interface Alokace {
  akcie: number;
  dluhopisy: number;
  hotovost: number;
}

/** Historické PRŮMĚRNÉ REÁLNÉ výnosy (USA, 100 let, nad inflaci) — metodika KFP. */
export const VYNOSY_REALNE: Alokace = { akcie: 0.0727, dluhopisy: 0.0181, hotovost: 0.0032 };

// Doporučená alokace dle horizontu (Morningstar lifetime, akcie/dluhopisy/hotovost).
// Portfolio se s blížícím cílem postupně zkonzervativňuje.
const ALOKACE_TABULKA: { doMin: number; akcie: number; dluhopisy: number; hotovost: number }[] = [
  { doMin: 1, akcie: 0.08, dluhopisy: 0.51, hotovost: 0.41 },
  { doMin: 2, akcie: 0.12, dluhopisy: 0.71, hotovost: 0.17 },
  { doMin: 4, akcie: 0.27, dluhopisy: 0.64, hotovost: 0.09 },
  { doMin: 6, akcie: 0.35, dluhopisy: 0.57, hotovost: 0.08 },
  { doMin: 8, akcie: 0.46, dluhopisy: 0.49, hotovost: 0.05 },
  { doMin: 10, akcie: 0.56, dluhopisy: 0.42, hotovost: 0.02 },
  { doMin: 12, akcie: 0.65, dluhopisy: 0.33, hotovost: 0.02 },
  { doMin: 14, akcie: 0.72, dluhopisy: 0.26, hotovost: 0.02 },
  { doMin: 16, akcie: 0.83, dluhopisy: 0.15, hotovost: 0.02 },
  { doMin: 21, akcie: 0.89, dluhopisy: 0.09, hotovost: 0.02 },
  { doMin: 26, akcie: 0.91, dluhopisy: 0.07, hotovost: 0.02 },
  { doMin: 31, akcie: 0.93, dluhopisy: 0.07, hotovost: 0.0 },
];

/** Doporučená alokace dle počtu let do cíle (Morningstar, metodika KFP). */
export function alokaceDleHorizontu(roky: number): Alokace {
  let vybrana = ALOKACE_TABULKA[0];
  for (const r of ALOKACE_TABULKA) {
    if (roky >= r.doMin) vybrana = r;
  }
  return { akcie: vybrana.akcie, dluhopisy: vybrana.dluhopisy, hotovost: vybrana.hotovost };
}

/** Vážený očekávaný (reálný) výnos portfolia dle alokace. */
export function ocekavanyVynosPortfolia(alokace: Alokace, vynosy: Alokace = VYNOSY_REALNE): number {
  return alokace.akcie * vynosy.akcie + alokace.dluhopisy * vynosy.dluhopisy + alokace.hotovost * vynosy.hotovost;
}

// Orientační roční volatilita tříd aktiv (směrodatná odchylka výnosů).
const VOLATILITA_TRIDY: Alokace = { akcie: 0.16, dluhopisy: 0.05, hotovost: 0.005 };

/**
 * Odhad volatility portfolia dle alokace (konzervativně bez korelací — váženým součtem,
 * tj. mírně nadhodnoceno). Aby Monte Carlo bralo výnos i kolísavost ze STEJNÉHO zdroje (horizont).
 */
export function volatilitaPortfolia(alokace: Alokace, vol: Alokace = VOLATILITA_TRIDY): number {
  return alokace.akcie * vol.akcie + alokace.dluhopisy * vol.dluhopisy + alokace.hotovost * vol.hotovost;
}

/** Očekávaný reálný výnos portfolia doporučeného pro daný horizont (statická alokace, KFP). */
export function ocekavanyVynosDleHorizontu(roky: number): number {
  return ocekavanyVynosPortfolia(alokaceDleHorizontu(roky));
}

// AFP/KFP tabulka očekávaných REÁLNÝCH výnosů dle doby do cíle (vč. zkonzervativňování
// portfolia v čase = glide path). Pro CÍL (jednorázový výběr) a pro RENTU (dlouhé čerpání).
const VYNOS_CILE: { r: number; v: number }[] = [
  { r: 1, v: 0.021 }, { r: 2, v: 0.023 }, { r: 3, v: 0.025 }, { r: 4, v: 0.027 },
  { r: 5, v: 0.029 }, { r: 7, v: 0.032 }, { r: 10, v: 0.037 }, { r: 15, v: 0.044 },
  { r: 20, v: 0.05 }, { r: 25, v: 0.054 }, { r: 30, v: 0.057 },
];
const VYNOS_RENTA: { r: number; v: number }[] = [
  { r: 0, v: 0.046 }, { r: 1, v: 0.047 }, { r: 2, v: 0.048 }, { r: 4, v: 0.048 },
  { r: 5, v: 0.049 }, { r: 7, v: 0.05 }, { r: 10, v: 0.051 }, { r: 15, v: 0.054 },
  { r: 20, v: 0.057 }, { r: 25, v: 0.06 }, { r: 30, v: 0.062 },
];

function vyhledejVynos(tabulka: { r: number; v: number }[], roky: number): number {
  let v = tabulka[0].v;
  for (const radek of tabulka) if (roky >= radek.r) v = radek.v;
  return v;
}

/** Očekávaný reálný výnos pro investici na CÍL za daný počet let (AFP glide-path). */
export function ocekavanyVynosCile(roky: number): number {
  return vyhledejVynos(VYNOS_CILE, roky);
}

/** Očekávaný reálný výnos pro RENTU (dlouhodobé čerpání) dle doby do začátku (AFP). */
export function ocekavanyVynosRenta(roky: number): number {
  return vyhledejVynos(VYNOS_RENTA, roky);
}

/** Budoucí hodnota jednorázové investice po složeném úročení. */
export function budouciHodnota(pocatecni: number, rocniVynos: number, roky: number): number {
  return pocatecni * Math.pow(1 + rocniVynos, roky);
}

/**
 * Budoucí hodnota pravidelné měsíční investice (spoření) — FV anuity.
 * Vklady na konci měsíce, úročení měsíční mírou odvozenou z roční.
 */
export function budouciHodnotaPravidelna(
  mesicniVklad: number,
  rocniVynos: number,
  roky: number
): number {
  const n = Math.round(roky * 12);
  const i = mesicniMira(rocniVynos);
  if (i === 0) return mesicniVklad * n;
  return mesicniVklad * ((Math.pow(1 + i, n) - 1) / i);
}

/** Reálná (dnešní) hodnota budoucí částky po odečtení inflace. */
export function realnaHodnota(nominalni: number, rocniInflace: number, roky: number): number {
  return nominalni / Math.pow(1 + rocniInflace, roky);
}

export interface DopadPoplatkuVystup {
  hrubaHodnota: number; // bez poplatků
  cistaHodnota: number; // po odečtení ročního poplatku (TER) z výnosu
  ztrataNaPoplatcich: number;
  podilZtraty: number; // ztráta / hrubá hodnota
}

/**
 * Vliv průběžného ročního poplatku (TER) na výsledek — porovná hrubý a čistý
 * výnos. Čistý výnos = hrubý − TER (zjednodušený, ale standardní odhad).
 */
export function dopadPoplatku(
  pocatecni: number,
  mesicniVklad: number,
  rocniVynos: number,
  ter: number,
  roky: number
): DopadPoplatkuVystup {
  const hruba =
    budouciHodnota(pocatecni, rocniVynos, roky) +
    budouciHodnotaPravidelna(mesicniVklad, rocniVynos, roky);
  const cistyVynos = rocniVynos - ter;
  const cista =
    budouciHodnota(pocatecni, cistyVynos, roky) +
    budouciHodnotaPravidelna(mesicniVklad, cistyVynos, roky);
  const ztrata = hruba - cista;
  return {
    hrubaHodnota: hruba,
    cistaHodnota: cista,
    ztrataNaPoplatcich: ztrata,
    podilZtraty: hruba > 0 ? ztrata / hruba : 0,
  };
}

/** Deterministický generátor (mulberry32) — pro reprodukovatelné Monte Carlo. */
function generatorNahod(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standardní normální rozdělení přes Box–Muller z uniformního generátoru. */
function normal(rng: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export interface KolikInvestovatVystup {
  jednorazove: number; // kolik vložit dnes jednorázově, aby cíl vyšel
  mesicni: number; // nebo kolik investovat měsíčně (bez počáteční částky)
  cil: number;
  roky: number;
  rocniVynos: number;
}

/**
 * Kolik je třeba investovat pro dosažení cíle (AFP „jak splnit cíl"):
 * buď jednorázově dnes (současná hodnota cíle), nebo pravidelně měsíčně (vklad anuity).
 * Zohledňuje už naspořenou částku určenou na tento cíl.
 */
export function kolikInvestovat(
  cil: number,
  roky: number,
  rocniVynos: number,
  jizNasporeno = 0
): KolikInvestovatVystup {
  const letBezp = Math.max(0, roky);
  const zbyva = Math.max(0, cil - budouciHodnota(jizNasporeno, rocniVynos, letBezp));
  const jednorazove = zbyva / Math.pow(1 + rocniVynos, letBezp);
  // n ≥ 1 → ochrana proti dělení nulou (při horizontu 0 vyjde měsíční = celá chybějící částka).
  const n = Math.max(1, Math.round(letBezp * 12));
  const i = mesicniMira(rocniVynos);
  const mesicni = i === 0 ? zbyva / n : (zbyva * i) / (Math.pow(1 + i, n) - 1);
  return { jednorazove, mesicni, cil, roky, rocniVynos };
}

export interface MonteCarloVstup {
  pocatecni: number;
  mesicniVklad: number;
  roky: number;
  ocekavanyVynos: number; // střední roční výnos (např. 0.06)
  volatilita: number; // roční směrodatná odchylka (např. 0.15)
  cilovaCastka?: number; // pro výpočet pravděpodobnosti dosažení cíle
  pocetSimulaci?: number; // default 5000
  seed?: number; // pro reprodukovatelnost; default 12345
}

export interface MonteCarloVystup {
  median: number; // p50
  p10: number; // pesimistický scénář
  p25: number;
  p75: number;
  p90: number; // optimistický scénář
  prumer: number;
  pravdepodobnostCile: number | null; // podíl simulací, které dosáhly cíle
  pocetSimulaci: number;
}

/**
 * Monte Carlo projekce investice: simuluje pocetSimulaci náhodných cest
 * (měsíční výnosy ~ Normal(měsíční střední, měsíční vol.)) a vrací rozdělení
 * koncových hodnot (percentily) + pravděpodobnost dosažení cílové částky.
 * Toto je "pravděpodobnost výnosu" — realistická místo jednoho bodového čísla.
 */
export function monteCarloProjekce(v: MonteCarloVstup): MonteCarloVystup {
  const pocet = Math.max(1, Math.floor(v.pocetSimulaci ?? 5000)); // ochrana proti prázdnému poli/NaN
  const rng = generatorNahod(v.seed ?? 12345);
  const n = Math.max(0, Math.round(v.roky * 12));
  const mesMira = mesicniMira(v.ocekavanyVynos);
  const mesVol = v.volatilita / Math.sqrt(12);

  const vysledky: number[] = new Array(pocet);
  let dosahlo = 0;
  for (let s = 0; s < pocet; s++) {
    let hodnota = v.pocatecni;
    for (let m = 0; m < n; m++) {
      const vynosMesice = mesMira + mesVol * normal(rng);
      hodnota = hodnota * (1 + vynosMesice) + v.mesicniVklad;
    }
    vysledky[s] = hodnota;
    if (v.cilovaCastka != null && hodnota >= v.cilovaCastka) dosahlo++;
  }
  vysledky.sort((a, b) => a - b);
  const perc = (p: number) => vysledky[Math.min(pocet - 1, Math.floor((p / 100) * pocet))];
  const prumer = vysledky.reduce((a, b) => a + b, 0) / pocet;

  return {
    median: perc(50),
    p10: perc(10),
    p25: perc(25),
    p75: perc(75),
    p90: perc(90),
    prumer,
    pravdepodobnostCile: v.cilovaCastka != null ? dosahlo / pocet : null,
    pocetSimulaci: pocet,
  };
}

export interface InvesticniForma {
  nazev: string; // např. "Aktivní podílový fond", "ETF", "Penzijní fond"
  ocekavanyVynos: number; // hrubý roční
  ter: number; // průběžný roční poplatek
  vstupniPoplatek?: number; // jednorázový % z vkladů (0.02 = 2 %)
  volatilita?: number; // pro orientaci o riziku
}

export interface SrovnaniFormyVystup extends InvesticniForma {
  cistaHodnota: number;
  vlozeno: number;
  cistyZisk: number;
  ztrataNaPoplatcichVsHrube: number;
  poradi: number; // 1 = nejlepší čistý výsledek
}

/**
 * Srovnání investičních forem na stejném zadání (počáteční + pravidelná částka,
 * horizont). Zohlední TER i vstupní poplatek a seřadí dle čisté výsledné hodnoty.
 * Toto je "srovnání forem, poplatků a struktur".
 */
export function srovnejFormy(
  pocatecni: number,
  mesicniVklad: number,
  roky: number,
  formy: InvesticniForma[]
): SrovnaniFormyVystup[] {
  const vlozeno = pocatecni + mesicniVklad * Math.round(roky * 12);
  const spocteno = formy.map((f) => {
    const vstupni = f.vstupniPoplatek ?? 0;
    // Vstupní poplatek ubere z každého vkladu (zjednodušeně z počátku i průběhu).
    const cistyPocatecni = pocatecni * (1 - vstupni);
    const cistyMesicni = mesicniVklad * (1 - vstupni);
    const cistyVynos = f.ocekavanyVynos - f.ter;
    const cistaHodnota =
      budouciHodnota(cistyPocatecni, cistyVynos, roky) +
      budouciHodnotaPravidelna(cistyMesicni, cistyVynos, roky);
    const hrube =
      budouciHodnota(pocatecni, f.ocekavanyVynos, roky) +
      budouciHodnotaPravidelna(mesicniVklad, f.ocekavanyVynos, roky);
    return {
      ...f,
      cistaHodnota,
      vlozeno,
      cistyZisk: cistaHodnota - vlozeno,
      ztrataNaPoplatcichVsHrube: hrube - cistaHodnota,
      poradi: 0,
    };
  });
  spocteno.sort((a, b) => b.cistaHodnota - a.cistaHodnota);
  spocteno.forEach((s, idx) => (s.poradi = idx + 1));
  return spocteno;
}
