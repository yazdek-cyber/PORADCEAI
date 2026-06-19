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
