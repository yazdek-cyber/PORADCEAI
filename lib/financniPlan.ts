// ORCHESTRACE FINANČNÍHO PLÁNU (4 pilíře).
//
// Princip (drží pravdivost a vysvětlitelnost):
//   1) Z profilu klienta DETERMINISTICKY spočítáme relevantní kalkulačky
//      (úvěry/investice/penze/pojištění) — čísla jsou tak ověřitelná, ne vymyšlená.
//   2) Načteme produkty/sazby přes jednotné rozhraní (ruční/scraping/API), s rozumnými
//      defaulty, když zdroj zatím data nemá (skeleton funguje i naprázdno).
//   3) RAG: k pojištění (a později dalším doménám) přidáme úryvky z podmínek jako zdroje.
//   4) AI z těchto PODKLADŮ složí strukturovaný plán se zdroji a disclaimerem (gemini.ts).

import { uvery, investice, penze, pojisteni } from './kalkulacky';
import { nactiProduktyVse, type Produkt } from './sazby';

export type RizikovyProfil = 'konzervativni' | 'vyvazeny' | 'dynamicky';

export interface FinPlanProfil {
  vek: number;
  // Cashflow (měsíčně, Kč)
  cistyPrijem: number;
  vydaje: number;
  // Rezerva a investice
  rezervaNasporeno?: number;
  existujiciInvestice?: number;
  mesicniVkladInvestice?: number;
  // Závazky
  jineDluhy?: number; // zůstatek spotřebitelských úvěrů apod.
  mesicniSplatkyDluhu?: number;
  hypotekaZustatek?: number;
  hypotekaSazba?: number; // p.a. desetinně (0.049)
  hypotekaZbyvaMesicu?: number;
  // Rodina
  partner?: boolean;
  pocetDeti?: number;
  // Penze
  vekOdchodu?: number; // default 65
  penzeNasporeno?: number;
  penzeMesicniVklad?: number;
  cilovaRentaDuchod?: number; // měsíčně
  ocekavanaStatniPenze?: number; // měsíčně
  // Ostatní
  rizikovyProfil?: RizikovyProfil;
  povolani?: string;
  zdravotniStav?: string;
  cile?: string;
}

const RIZIKO: Record<RizikovyProfil, { vynos: number; volatilita: number }> = {
  konzervativni: { vynos: 0.03, volatilita: 0.06 },
  vyvazeny: { vynos: 0.055, volatilita: 0.11 },
  dynamicky: { vynos: 0.08, volatilita: 0.17 },
};

// Orientační defaulty, když zdroje sazeb zatím nemají data (skeleton).
const VYCHOZI_HYPO_TRZNI_SAZBA = 0.049;
const VYCHOZI_FORMY_INVESTIC: investice.InvesticniForma[] = [
  { nazev: 'ETF (pasivní)', ocekavanyVynos: 0.07, ter: 0.002, vstupniPoplatek: 0, volatilita: 0.16 },
  { nazev: 'Aktivní podílový fond', ocekavanyVynos: 0.06, ter: 0.018, vstupniPoplatek: 0.02, volatilita: 0.15 },
  { nazev: 'Doplňkové penzijní spoření', ocekavanyVynos: 0.04, ter: 0.01, vstupniPoplatek: 0, volatilita: 0.08 },
];
const NAKLAD_NA_DITE = 600_000; // orientační náklad na zaopatření/vzdělání 1 dítěte

export interface Vypocty {
  rezerva: ReturnType<typeof pojisteni.rezerva>;
  pojistnaPotreba: ReturnType<typeof pojisteni.pojistnaPotreba_DIME>;
  edoKryti: ReturnType<typeof pojisteni.pojistnaPotreba_eDO>;
  uvery: {
    maxUver: ReturnType<typeof uvery.maxUver>;
    refinancovani: ReturnType<typeof uvery.refinancovani> | null;
    trzniSazba: number;
  };
  investice: {
    horizontLet: number;
    monteCarlo: ReturnType<typeof investice.monteCarloProjekce>;
    srovnaniForem: ReturnType<typeof investice.srovnejFormy>;
  };
  penze: {
    projekce: ReturnType<typeof penze.projekcePenze>;
    mezera: ReturnType<typeof penze.mezeraVDuchodu>;
  };
  pouziteProdukty: { domena: string; pocet: number }[];
}

/** Zaokrouhlí Kč na celé (pro čistší podklady do promptu). */
function kc(x: number): number {
  return Math.round(x);
}

/**
 * Deterministicky spočítá podklady pro finanční plán ze všech 4 pilířů.
 * Načítá produkty přes jednotné rozhraní; chybí-li, použije rozumné defaulty.
 */
export async function pripravPodklady(profil: FinPlanProfil): Promise<Vypocty> {
  const vekOdchodu = profil.vekOdchodu ?? 65;
  const riziko = RIZIKO[profil.rizikovyProfil ?? 'vyvazeny'];
  const horizont = Math.max(1, vekOdchodu - profil.vek);

  // Načtení produktů napříč zdroji (ruční/scraping/api) — pro doložení a budoucí sazby.
  const [pojProd, uvProd, invProd, penProd] = await Promise.all([
    nactiProduktyVse('pojisteni').catch(() => [] as Produkt[]),
    nactiProduktyVse('uvery').catch(() => [] as Produkt[]),
    nactiProduktyVse('investice').catch(() => [] as Produkt[]),
    nactiProduktyVse('penze').catch(() => [] as Produkt[]),
  ]);

  // — REZERVA — (6 měsíců u OSVČ/nestabilního příjmu; tady jednotně 4 jako základ)
  const rezerva = pojisteni.rezerva(profil.vydaje, 4, profil.rezervaNasporeno ?? 0);

  // — POJIŠTĚNÍ — DIME potřeba krytí
  const rokyNahrady = Math.max(5, Math.min(20, 18 - 0)); // konzervativně do osamostatnění dětí
  const pojistnaPotreba = pojisteni.pojistnaPotreba_DIME({
    dluhy: profil.jineDluhy ?? 0,
    mesicniPrijem: profil.cistyPrijem,
    rokyNahradyPrijmu: (profil.pocetDeti ?? 0) > 0 ? rokyNahrady : 5,
    hypoteka: profil.hypotekaZustatek ?? 0,
    nakladyNaDeti: (profil.pocetDeti ?? 0) * NAKLAD_NA_DITE,
    jizKDispozici: profil.existujiciInvestice ?? 0,
  });

  // — ÚVĚRY — max úvěr dle příjmu + případné refinancování stávající hypotéky
  const trzniSazba =
    (uvProd.find((p) => typeof (p.parametry as { sazba?: number }).sazba === 'number')?.parametry as
      | { sazba?: number }
      | undefined)?.sazba ?? VYCHOZI_HYPO_TRZNI_SAZBA;

  const maxUver = uvery.maxUver({
    cistyMesicniPrijem: profil.cistyPrijem,
    stavajiciMesicniSplatky: profil.mesicniSplatkyDluhu ?? 0,
    rocniSazba: trzniSazba,
    pocetMesicu: 360,
  });

  let refinancovani: Vypocty['uvery']['refinancovani'] = null;
  if (profil.hypotekaZustatek && profil.hypotekaSazba && profil.hypotekaZbyvaMesicu) {
    refinancovani = uvery.refinancovani({
      zbyvajiciJistina: profil.hypotekaZustatek,
      zbyvajiciMesicu: profil.hypotekaZbyvaMesicu,
      stavajiciSazba: profil.hypotekaSazba,
      novaSazba: trzniSazba,
      poplatkyZaRefinancovani: 15_000,
    });
  }

  // — INVESTICE — Monte Carlo pravděpodobnost + srovnání forem
  const formy =
    invProd.length > 0
      ? invProd.map((p) => {
          const par = p.parametry as { ocekavanyVynos?: number; ter?: number; vstupniPoplatek?: number };
          return {
            nazev: p.nazev,
            ocekavanyVynos: par.ocekavanyVynos ?? riziko.vynos,
            ter: par.ter ?? 0.01,
            vstupniPoplatek: par.vstupniPoplatek ?? 0,
          } as investice.InvesticniForma;
        })
      : VYCHOZI_FORMY_INVESTIC;

  const mesicniVklad = profil.mesicniVkladInvestice ?? 0;
  const monteCarlo = investice.monteCarloProjekce({
    pocatecni: profil.existujiciInvestice ?? 0,
    mesicniVklad,
    roky: horizont,
    ocekavanyVynos: riziko.vynos,
    volatilita: riziko.volatilita,
    seed: 12345,
  });
  const srovnaniForem = investice.srovnejFormy(
    profil.existujiciInvestice ?? 0,
    mesicniVklad,
    horizont,
    formy
  );

  // — PENZE — projekce + mezera v důchodu
  const penzeVynos = RIZIKO[profil.rizikovyProfil ?? 'vyvazeny'].vynos;
  const projekce = penze.projekcePenze({
    aktualniKapital: profil.penzeNasporeno ?? 0,
    vlastniPrispevek: profil.penzeMesicniVklad ?? 0,
    rocniVynos: penzeVynos,
    aktualniVek: profil.vek,
    vekOdchodu,
  });
  const mezera = penze.mezeraVDuchodu({
    cilovaMesicniRenta: profil.cilovaRentaDuchod ?? Math.round(profil.cistyPrijem * 0.6),
    ocekavanaStatniPenze: profil.ocekavanaStatniPenze ?? 0,
    naprojektovanyKapital: projekce.nasporenyKapital,
    rocniVynosVDuchodu: 0.03,
    letVyplaty: 25,
  });

  // Doporučené pojistné částky dle praxe eDO (vedle DIME).
  const edoKryti = pojisteni.pojistnaPotreba_eDO({ mesicniCistyPrijem: profil.cistyPrijem, vek: profil.vek });

  return {
    rezerva,
    pojistnaPotreba,
    edoKryti,
    uvery: { maxUver, refinancovani, trzniSazba },
    investice: { horizontLet: horizont, monteCarlo, srovnaniForem },
    penze: { projekce, mezera },
    pouziteProdukty: [
      { domena: 'pojisteni', pocet: pojProd.length },
      { domena: 'uvery', pocet: uvProd.length },
      { domena: 'investice', pocet: invProd.length },
      { domena: 'penze', pocet: penProd.length },
    ],
  };
}

/**
 * Zformátuje spočítané podklady do přehledného textu pro AI syntézu.
 * AI z tohoto staví plán — čísla bere ODSUD (nepočítá je sama).
 */
export function formatujPodklady(profil: FinPlanProfil, v: Vypocty): string {
  const f = (x: number) => kc(x).toLocaleString('cs-CZ');
  const pct = (x: number) => (x * 100).toFixed(1) + ' %';
  const radky: string[] = [];

  radky.push('## REZERVA');
  radky.push(`- Doporučená rezerva (${v.rezerva.mesicu} měs. výdajů): ${f(v.rezerva.doporucenaRezerva)} Kč`);
  radky.push(`- Chybí do rezervy: ${f(v.rezerva.chybiDoRezervy)} Kč`);

  radky.push('## POJIŠTĚNÍ (potřeba krytí, metoda DIME)');
  radky.push(`- Náhrada příjmu: ${f(v.pojistnaPotreba.nahradaPrijmu)} Kč`);
  radky.push(`- Hypotéka: ${f(v.pojistnaPotreba.hypoteka)} Kč · Ostatní dluhy: ${f(v.pojistnaPotreba.dluhy)} Kč · Děti: ${f(v.pojistnaPotreba.deti)} Kč`);
  radky.push(`- DOPORUČENÁ pojistná částka (po odečtení zdrojů): ${f(v.pojistnaPotreba.doporucenaPojistnaCastka)} Kč`);
  radky.push('### Doporučené pojistné částky dle praxe eDO');
  radky.push(`- Smrt: ${f(v.edoKryti.smrt)} Kč · Invalidita: ${f(v.edoKryti.invalidita)} Kč (3× roční příjem)`);
  radky.push(`- Závažná onemocnění: ${f(v.edoKryti.zavazneOnemocneni)} Kč (1× roční příjem) · Trvalé následky úrazu: ${f(v.edoKryti.trvaleNasledkyUrazu)} Kč`);
  radky.push(`- Pracovní neschopnost: měsíční dorovnání ${f(v.edoKryti.pracovniNeschopnostMesicniDorovnani)} Kč`);

  radky.push('## ÚVĚRY');
  radky.push(`- Tržní sazba (použitá): ${pct(v.uvery.trzniSazba)}`);
  radky.push(`- Max. úvěr dle příjmu (30 let): ${f(v.uvery.maxUver.maxUver)} Kč (rozhoduje ${v.uvery.maxUver.rozhodujiciLimit}), splátka ${f(v.uvery.maxUver.splatkaPriMaxUveru)} Kč`);
  if (v.uvery.refinancovani) {
    const r = v.uvery.refinancovani;
    radky.push(`- Refinancování: měsíční úspora ${f(r.mesicniUspora)} Kč, celková úspora ${f(r.celkovaUsporaNaUrocich)} Kč, návratnost ${r.navratnostMesicu ?? '–'} měs., vyplatí se: ${r.vyplati ? 'ANO' : 'NE'}`);
  } else {
    radky.push('- Refinancování: nezadána stávající hypotéka k posouzení.');
  }

  radky.push(`## INVESTICE (horizont ${v.investice.horizontLet} let, Monte Carlo)`);
  const mc = v.investice.monteCarlo;
  radky.push(`- Pesimistický (p10): ${f(mc.p10)} Kč · Medián (p50): ${f(mc.median)} Kč · Optimistický (p90): ${f(mc.p90)} Kč`);
  if (mc.pravdepodobnostCile != null) radky.push(`- Pravděpodobnost dosažení cíle: ${pct(mc.pravdepodobnostCile)}`);
  radky.push('- Srovnání forem (čistá hodnota po poplatcích):');
  for (const s of v.investice.srovnaniForem) {
    radky.push(`  ${s.poradi}. ${s.nazev}: ${f(s.cistaHodnota)} Kč (ztráta na poplatcích vs. hrubé: ${f(s.ztrataNaPoplatcichVsHrube)} Kč)`);
  }

  radky.push('## PENZE');
  radky.push(`- Let do důchodu: ${v.penze.projekce.letDoOdchodu} · Měsíčně spoří: ${f(v.penze.projekce.celkemMesicneSpori)} Kč (z toho stát ${f(v.penze.projekce.mesicniStatniPrispevek)} Kč)`);
  radky.push(`- Naspořený kapitál k důchodu: ${f(v.penze.projekce.nasporenyKapital)} Kč`);
  radky.push(`- Mezera v důchodu: ${v.penze.mezera.pokryto ? 'POKRYTO' : f(v.penze.mezera.mesicniMezera) + ' Kč/měs. CHYBÍ'} · Potřebný kapitál pro cíl: ${f(v.penze.mezera.potrebnyKapital)} Kč`);

  return radky.join('\n');
}
