// Čtyři pilíře finančního poradenství. Sdílené mezi UI, RAG filtrem a produkty.
// Hodnota `id` se ukládá do sloupce `domena` (dokumenty/chunky/produkty).

export type DomenaId = 'pojisteni' | 'uvery' | 'investice' | 'penze';

export interface Domena {
  id: DomenaId;
  nazev: string;
  ikona: string; // emoji pro rychlé UI; lze nahradit lucide ikonou
  popis: string;
}

export const DOMENY: Domena[] = [
  { id: 'pojisteni', nazev: 'Pojištění', ikona: '🛡️', popis: 'Životní, úrazové, majetkové — krytí rizik.' },
  { id: 'uvery', nazev: 'Úvěry', ikona: '🏠', popis: 'Hypotéky, spotřebitelské úvěry, refinancování.' },
  { id: 'investice', nazev: 'Investice', ikona: '📈', popis: 'Fondy, ETF, pravidelné investice, tvorba majetku.' },
  { id: 'penze', nazev: 'Penze', ikona: '🏦', popis: 'Doplňkové penzijní spoření, renta, důchodová mezera.' },
];

export const DOMENY_MAP: Record<DomenaId, Domena> = Object.fromEntries(
  DOMENY.map((d) => [d.id, d])
) as Record<DomenaId, Domena>;

export function nazevDomeny(id: string): string {
  return DOMENY_MAP[id as DomenaId]?.nazev ?? id;
}

// ── Schéma parametrů produktu per doména ────────────────────────────────────
// Klíče (`klic`) MUSÍ sedět na to, co čtou kalkulačky/orchestrace (lib/financniPlan.ts),
// jinak by vyplněné sazby neměly na plán vliv. Procenta se ukládají jako desetinné
// číslo (5,9 % → 0.059), protože tak je kalkulačky očekávají.

export type TypParametru = 'procento' | 'cislo' | 'text';

export interface PoleParametru {
  klic: string;
  label: string;
  typ: TypParametru;
  suffix?: string;
  napoveda?: string;
}

export const PARAMETRY_DOMENY: Record<DomenaId, PoleParametru[]> = {
  uvery: [
    { klic: 'sazba', label: 'Úroková sazba', typ: 'procento', suffix: '% p.a.', napoveda: 'Použije se jako tržní sazba v kalkulačce hypotéky a refinancování.' },
    { klic: 'poplatky', label: 'Poplatky (jednorázové)', typ: 'cislo', suffix: 'Kč' },
    { klic: 'maxLTV', label: 'Max. LTV', typ: 'procento', suffix: '%' },
    { klic: 'fixaceLet', label: 'Fixace', typ: 'cislo', suffix: 'let' },
  ],
  investice: [
    { klic: 'ocekavanyVynos', label: 'Očekávaný výnos', typ: 'procento', suffix: '% p.a.', napoveda: 'Vstup do projekce a srovnání forem.' },
    { klic: 'ter', label: 'Průběžný poplatek (TER)', typ: 'procento', suffix: '% p.a.' },
    { klic: 'vstupniPoplatek', label: 'Vstupní poplatek', typ: 'procento', suffix: '%' },
  ],
  penze: [
    { klic: 'ocekavanyVynos', label: 'Očekávaný výnos', typ: 'procento', suffix: '% p.a.' },
    { klic: 'ter', label: 'Poplatek (TER)', typ: 'procento', suffix: '% p.a.' },
    { klic: 'prispevekZamestnavatele', label: 'Typ. příspěvek zaměstnavatele', typ: 'cislo', suffix: 'Kč/měs' },
  ],
  pojisteni: [
    { klic: 'cekaciDobaMesicu', label: 'Čekací doba', typ: 'cislo', suffix: 'měs.' },
    { klic: 'poznamka', label: 'Poznámka', typ: 'text' },
  ],
};
