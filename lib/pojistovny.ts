// Mapování pojišťoven na jejich oficiální stránku „dokumenty ke stažení".
// Poradce zadává název pojišťovny při nahrávání volně, proto hledáme podle
// klíčových slov (klicovaSlova), aby to trefilo i varianty jako
// „NN Životní pojišťovna" nebo „Kooperativa pojišťovna, a.s.".

export interface PojistovnaOdkaz {
  /** Zobrazovaný název pojišťovny. */
  nazev: string;
  /** Stabilní ASCII identifikátor (pro cron param, URL apod.). */
  slug: string;
  /** Klíčová slova pro rozpoznání ve volně zadaném názvu (bez diakritiky, malá písmena). */
  klicovaSlova: string[];
  /** Oficiální stránka s dokumenty / pojistnými podmínkami ke stažení. */
  urlDokumenty: string;
}

export const POJISTOVNY: PojistovnaOdkaz[] = [
  {
    nazev: 'Kooperativa',
    slug: 'kooperativa',
    klicovaSlova: ['kooperativa', 'koop'],
    urlDokumenty: 'https://www.koop.cz/dokumenty-ke-stazeni/dokumenty-k-pojisteni-osob',
  },
  {
    nazev: 'NN',
    slug: 'nn',
    klicovaSlova: ['nn', 'nationale', 'nederlanden'],
    urlDokumenty: 'https://www.nn.cz/pro-klienty/pojisteni/nn-orange-risk/dokumenty/',
  },
  {
    nazev: 'Generali Česká pojišťovna',
    slug: 'generali',
    klicovaSlova: ['generali', 'česká pojišťovna', 'ceska pojistovna'],
    urlDokumenty: 'https://www.generaliceska.cz/dokumenty-podle-produktu',
  },
  {
    nazev: 'UNIQA',
    slug: 'uniqa',
    klicovaSlova: ['uniqa'],
    urlDokumenty: 'https://www.uniqa.cz/zivotni-pojisteni-dokumenty/',
  },
  {
    nazev: 'Allianz',
    slug: 'allianz',
    klicovaSlova: ['allianz'],
    urlDokumenty: 'https://www.allianz.cz/cs_CZ/pojisteni/pro-klienty/dokumenty-a-formulare.html',
  },
  {
    nazev: 'ČPP',
    slug: 'cpp',
    klicovaSlova: ['cpp', 'podnikatelska', 'podnikatelská'],
    urlDokumenty: 'https://www.cpp.cz/klientsky-servis/dokumenty',
  },
];

/** Normalizace pro porovnání: malá písmena, bez diakritiky, oříznuté mezery. */
function normalizuj(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

/**
 * Najde oficiální odkaz na podmínky podle volně zadaného názvu pojišťovny.
 * Krátká klíčová slova (např. „nn") porovnáváme jako celé slovo, aby nedocházelo
 * k falešným shodám; delší (např. „kooperativa") i jako podřetězec.
 * Vrací URL, nebo null pokud pojišťovna v seznamu není.
 */
export function najdiOdkazPodminek(pojistovna: string | null | undefined): string | null {
  if (!pojistovna) return null;
  const vstup = normalizuj(pojistovna);
  const tokeny = vstup.split(/[^a-z0-9]+/).filter(Boolean);

  for (const p of POJISTOVNY) {
    const shoda = p.klicovaSlova.some((klic) => {
      const k = normalizuj(klic);
      if (k.length <= 3) return tokeny.includes(k);
      return vstup.includes(k);
    });
    if (shoda) return p.urlDokumenty;
  }
  return null;
}
