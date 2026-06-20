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
  // Cíle klienta (KFP finanční mapa): bydlení, vzdělání dětí, auto, finanční nezávislost…
  cileSeznam?: FinCil[];
  // Ostatní
  rizikovyProfil?: RizikovyProfil;
  povolani?: string;
  zdravotniStav?: string;
  cile?: string; // volný textový popis cílů (doplněk k cileSeznam)
}

export interface FinCil {
  nazev: string;
  castka: number; // cílová částka (dnešní hodnota)
  roky: number; // za kolik let
  nasporeno?: number; // už naspořeno na tento cíl
}

// Celý plán počítá v REÁLNÝCH hodnotách (dnešní hodnota peněz, výnosy NAD inflaci) — dle
// metodiky KFP. Výnosy odpovídají historickým reálným (akcie 7,27 %, dluhopisy 1,81 %),
// volatilita je roční směrodatná odchylka (v reálných i nominálních termínech ~stejná).
const RIZIKO: Record<RizikovyProfil, { vynos: number; volatilita: number }> = {
  konzervativni: { vynos: 0.025, volatilita: 0.06 },
  vyvazeny: { vynos: 0.045, volatilita: 0.11 },
  dynamicky: { vynos: 0.065, volatilita: 0.17 },
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
  rezervaUrovne: ReturnType<typeof pojisteni.rezervaUrovne>;
  pojistnaPotreba: ReturnType<typeof pojisteni.pojistnaPotreba_DIME>;
  edoKryti: ReturnType<typeof pojisteni.pojistnaPotreba_eDO>;
  efpaKryti: ReturnType<typeof pojisteni.pojistnaPotreba_EFPA>;
  uvery: {
    maxUver: ReturnType<typeof uvery.maxUver>;
    refinancovani: ReturnType<typeof uvery.refinancovani> | null;
    trzniSazba: number;
  };
  investice: {
    horizontLet: number;
    doporucenaAlokace: ReturnType<typeof investice.alokaceDleHorizontu>;
    ocekavanyVynosKFP: number; // reálný výnos dle horizontu (AFP glide-path)
    monteCarlo: ReturnType<typeof investice.monteCarloProjekce>;
    srovnaniForem: ReturnType<typeof investice.srovnejFormy>;
  };
  cile: {
    nazev: string;
    castka: number;
    roky: number;
    alokace: ReturnType<typeof investice.alokaceDleHorizontu>;
    vynos: number;
    jednorazove: number;
    mesicni: number;
  }[];
  penze: {
    projekce: ReturnType<typeof penze.projekcePenze>;
    mezera: ReturnType<typeof penze.mezeraVDuchodu>;
    potrebnyKapitalRentaKFP: number; // majetek pro cílovou rentu dle pravidla ×200
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

  // — REZERVA — dle KFP konsensus 6× měsíční výdaje (+ tři úrovně 3/6/12×).
  const rezerva = pojisteni.rezerva(profil.vydaje, 6, profil.rezervaNasporeno ?? 0);
  const rezervaUrovne = pojisteni.rezervaUrovne(profil.vydaje);

  // — POJIŠTĚNÍ — DIME potřeba krytí
  // Roky náhrady příjmu: s dětmi do osamostatnění (zjednodušeně 18), bez dětí kratší (5).
  const ROKY_NAHRADY_S_DETMI = 18;
  const pojistnaPotreba = pojisteni.pojistnaPotreba_DIME({
    dluhy: profil.jineDluhy ?? 0,
    mesicniPrijem: profil.cistyPrijem,
    rokyNahradyPrijmu: (profil.pocetDeti ?? 0) > 0 ? ROKY_NAHRADY_S_DETMI : 5,
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
    stavajiciCelkovyDluh: (profil.hypotekaZustatek ?? 0) + (profil.jineDluhy ?? 0),
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
  // KFP/AFP: doporučená alokace dle horizontu (Morningstar) a očekávaný reálný výnos
  // (glide-path). Projekci řídíme metodikou KFP (výnos dle horizontu), kolísavost dle
  // rizikového profilu klienta.
  const doporucenaAlokace = investice.alokaceDleHorizontu(horizont);
  const ocekavanyVynosKFP = investice.ocekavanyVynosCile(horizont);
  // Výnos i volatilita ze STEJNÉHO zdroje (alokace dle horizontu) — konzistentní projekce.
  const monteCarlo = investice.monteCarloProjekce({
    pocatecni: profil.existujiciInvestice ?? 0,
    mesicniVklad,
    roky: horizont,
    ocekavanyVynos: ocekavanyVynosKFP,
    volatilita: investice.volatilitaPortfolia(doporucenaAlokace),
    seed: 12345,
  });
  const srovnaniForem = investice.srovnejFormy(
    profil.existujiciInvestice ?? 0,
    mesicniVklad,
    horizont,
    formy
  );

  // — CÍLE — pro každý cíl spočítáme doporučenou alokaci a kolik na něj investovat (KFP).
  const cile = (profil.cileSeznam ?? []).map((c) => {
    const vynos = investice.ocekavanyVynosCile(c.roky);
    const ki = investice.kolikInvestovat(c.castka, c.roky, vynos, c.nasporeno ?? 0);
    return {
      nazev: c.nazev,
      castka: c.castka,
      roky: c.roky,
      alokace: investice.alokaceDleHorizontu(c.roky),
      vynos,
      jednorazove: ki.jednorazove,
      mesicni: ki.mesicni,
    };
  });

  // — PENZE — projekce + mezera v důchodu
  const penzeVynos = RIZIKO[profil.rizikovyProfil ?? 'vyvazeny'].vynos;
  const projekce = penze.projekcePenze({
    aktualniKapital: profil.penzeNasporeno ?? 0,
    vlastniPrispevek: profil.penzeMesicniVklad ?? 0,
    rocniVynos: penzeVynos,
    aktualniVek: profil.vek,
    vekOdchodu,
  });
  const cilovaRenta = profil.cilovaRentaDuchod ?? Math.round(profil.cistyPrijem * 0.6);
  const mezera = penze.mezeraVDuchodu({
    cilovaMesicniRenta: cilovaRenta,
    ocekavanaStatniPenze: profil.ocekavanaStatniPenze ?? 0,
    naprojektovanyKapital: projekce.nasporenyKapital,
    rocniVynosVDuchodu: investice.ocekavanyVynosRenta(0), // ~4,6 % reálně v době čerpání (AFP)
    letVyplaty: 25,
  });
  // KFP pravidlo ×200: majetek potřebný pro cílovou rentu nad rámec státní penze.
  const potrebnyKapitalRentaKFP = penze.majetekProRentu(
    Math.max(0, cilovaRenta - (profil.ocekavanaStatniPenze ?? 0))
  );

  // Doporučené pojistné částky dle praxe eDO (3× příjem) a dle metodiky EFPA (koeficient 200).
  const edoKryti = pojisteni.pojistnaPotreba_eDO({ mesicniCistyPrijem: profil.cistyPrijem, vek: profil.vek });
  const efpaKryti = pojisteni.pojistnaPotreba_EFPA({
    mesicniDeficitSmrt: Math.round(profil.cistyPrijem * 0.8), // výpadek příjmu po poklesu výdajů
    mesicniDeficitInvalidita: Math.round(profil.cistyPrijem * 1.2), // výdaje ~120 % (invalidní důchod řeší odečet)
    pocetDeti: profil.pocetDeti ?? 0,
    sezdany: profil.partner ?? false,
    soucasnyMajetek: profil.existujiciInvestice ?? 0,
  });

  return {
    rezerva,
    rezervaUrovne,
    pojistnaPotreba,
    edoKryti,
    efpaKryti,
    uvery: { maxUver, refinancovani, trzniSazba },
    investice: { horizontLet: horizont, doporucenaAlokace, ocekavanyVynosKFP, monteCarlo, srovnaniForem },
    cile,
    penze: { projekce, mezera, potrebnyKapitalRentaKFP },
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
  radky.push('_Všechny částky jsou v dnešní hodnotě peněz (reálné, výnosy nad inflaci) — metodika KFP._');

  radky.push('## REZERVA (likvidní, metodika KFP)');
  radky.push(`- Doporučená rezerva (${v.rezerva.mesicu}× měs. výdaje): ${f(v.rezerva.doporucenaRezerva)} Kč · Chybí: ${f(v.rezerva.chybiDoRezervy)} Kč`);
  radky.push(`- Úrovně: krátkodobá 3× ${f(v.rezervaUrovne.kratkodoba)} Kč · ztráta práce 6× ${f(v.rezervaUrovne.ztrataPrace)} Kč · dlouhodobá nemoc 12× ${f(v.rezervaUrovne.dlouhodobaNemoc)} Kč (nesčítají se)`);

  radky.push('## POJIŠTĚNÍ (potřeba krytí, metoda DIME)');
  radky.push(`- Náhrada příjmu: ${f(v.pojistnaPotreba.nahradaPrijmu)} Kč`);
  radky.push(`- Hypotéka: ${f(v.pojistnaPotreba.hypoteka)} Kč · Ostatní dluhy: ${f(v.pojistnaPotreba.dluhy)} Kč · Děti: ${f(v.pojistnaPotreba.deti)} Kč`);
  radky.push(`- DOPORUČENÁ pojistná částka (po odečtení zdrojů): ${f(v.pojistnaPotreba.doporucenaPojistnaCastka)} Kč`);
  radky.push('### Doporučené pojistné částky dle praxe eDO');
  radky.push(`- Smrt: ${f(v.edoKryti.smrt)} Kč · Invalidita: ${f(v.edoKryti.invalidita)} Kč (3× roční příjem)`);
  radky.push(`- Závažná onemocnění: ${f(v.edoKryti.zavazneOnemocneni)} Kč (1× roční příjem) · Trvalé následky úrazu: ${f(v.edoKryti.trvaleNasledkyUrazu)} Kč`);
  radky.push(`- Pracovní neschopnost: měsíční dorovnání ${f(v.edoKryti.pracovniNeschopnostMesicniDorovnani)} Kč`);
  radky.push('### Pojistné částky dle metodiky EFPA/KFP (koeficient 200 − sociální dávky)');
  radky.push(`- Smrt: ${f(v.efpaKryti.smrt)} Kč (hrubá potřeba ${f(v.efpaKryti.potrebaSmrtHruba)} Kč − dávky/majetek)`);
  radky.push(`- Invalidita: ${f(v.efpaKryti.invalidita)} Kč · Trvalé následky úrazu: ${f(v.efpaKryti.trvaleNasledkyUrazu)} Kč (½ invalidity)`);

  radky.push('## ÚVĚRY');
  radky.push(`- Tržní sazba (použitá): ${pct(v.uvery.trzniSazba)}`);
  radky.push(`- Max. úvěr dle příjmu (30 let): ${f(v.uvery.maxUver.maxUver)} Kč (rozhoduje ${v.uvery.maxUver.rozhodujiciLimit}), splátka ${f(v.uvery.maxUver.splatkaPriMaxUveru)} Kč`);
  if (v.uvery.refinancovani) {
    const r = v.uvery.refinancovani;
    radky.push(`- Refinancování: měsíční úspora ${f(r.mesicniUspora)} Kč, celková úspora ${f(r.celkovaUsporaNaUrocich)} Kč, návratnost ${r.navratnostMesicu ?? '–'} měs., vyplatí se: ${r.vyplati ? 'ANO' : 'NE'}`);
  } else {
    radky.push('- Refinancování: nezadána stávající hypotéka k posouzení.');
  }

  radky.push(`## INVESTICE (horizont ${v.investice.horizontLet} let, metodika KFP)`);
  const al = v.investice.doporucenaAlokace;
  radky.push(`- Doporučená alokace dle horizontu (Morningstar): akcie ${pct(al.akcie)}, dluhopisy ${pct(al.dluhopisy)}, hotovost ${pct(al.hotovost)}`);
  radky.push(`- Očekávaný reálný výnos (AFP glide-path): ${pct(v.investice.ocekavanyVynosKFP)} p.a.`);
  const mc = v.investice.monteCarlo;
  radky.push(`- Projekce Monte Carlo — pesimistický (p10): ${f(mc.p10)} Kč · medián (p50): ${f(mc.median)} Kč · optimistický (p90): ${f(mc.p90)} Kč`);
  if (mc.pravdepodobnostCile != null) radky.push(`- Pravděpodobnost dosažení cíle: ${pct(mc.pravdepodobnostCile)}`);
  radky.push('- Srovnání forem (čistá hodnota po poplatcích):');
  for (const s of v.investice.srovnaniForem) {
    radky.push(`  ${s.poradi}. ${s.nazev}: ${f(s.cistaHodnota)} Kč (ztráta na poplatcích vs. hrubé: ${f(s.ztrataNaPoplatcichVsHrube)} Kč)`);
  }

  if (v.cile.length > 0) {
    radky.push('## CÍLE KLIENTA (kolik investovat, KFP)');
    for (const c of v.cile) {
      radky.push(
        `- ${c.nazev}: ${f(c.castka)} Kč za ${c.roky} let (výnos ${pct(c.vynos)}, akcie ${pct(c.alokace.akcie)}) → jednorázově ${f(c.jednorazove)} Kč NEBO měsíčně ${f(c.mesicni)} Kč`
      );
    }
  }

  radky.push('## PENZE');
  radky.push(`- Let do důchodu: ${v.penze.projekce.letDoOdchodu} · Měsíčně spoří: ${f(v.penze.projekce.celkemMesicneSpori)} Kč (z toho stát ${f(v.penze.projekce.mesicniStatniPrispevek)} Kč)`);
  radky.push(`- Naspořený kapitál k důchodu: ${f(v.penze.projekce.nasporenyKapital)} Kč`);
  radky.push(`- Mezera v důchodu: ${v.penze.mezera.pokryto ? 'POKRYTO' : f(v.penze.mezera.mesicniMezera) + ' Kč/měs. CHYBÍ'}`);
  radky.push(`- Potřebný kapitál pro cílovou rentu (pravidlo KFP ×200): ${f(v.penze.potrebnyKapitalRentaKFP)} Kč`);

  return radky.join('\n');
}
