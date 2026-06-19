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
  const pocet = v.pocetSimulaci ?? 5000;
  const rng = generatorNahod(v.seed ?? 12345);
  const n = Math.round(v.roky * 12);
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
