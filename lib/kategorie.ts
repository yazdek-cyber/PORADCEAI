// KATEGORIE DOKUMENTU — role podkladu v RAG. Nezávislá osa na doméně (4 pilíře) i na
// poskytovateli. Generická (jméno firmy je DATA = workspace/tenant, ne kód):
//   postup_firmy       = závazný systém práce firmy (procesy, pořadí, compliance)
//   metodika           = odborná metodika (KFP/EFPA/AFP) — jak počítat a analyzovat, poučky
//   produktove_podminky= podmínky produktů, které firma sjednává — napříč pilíři
//                        (pojištění/úvěry/investice/penze; pilíř určuje `domena`,
//                         poskytovatele banka/pojišťovna/fond/penzijní spol. určuje `pojistovna`)

export type KategoriaId = 'postup_firmy' | 'metodika' | 'produktove_podminky';

export interface Kategorie {
  id: KategoriaId;
  nazev: string;
  popis: string;
  ikona: string; // emoji pro rychlé UI
}

export const KATEGORIE: Kategorie[] = [
  {
    id: 'postup_firmy',
    nazev: 'Postup firmy',
    popis: 'Závazný systém práce firmy — procesy, pořadí schůzky, compliance, onboarding.',
    ikona: '🏛️',
  },
  {
    id: 'metodika',
    nazev: 'Odborná metodika',
    popis: 'Jak počítat a analyzovat (KFP/EFPA/AFP) — alokace, koeficienty, poučky.',
    ikona: '📐',
  },
  {
    id: 'produktove_podminky',
    nazev: 'Produktové podmínky',
    popis: 'Podmínky produktů napříč pilíři — pojistné, úvěrové, investiční, penzijní.',
    ikona: '📄',
  },
];

export const KATEGORIE_MAP: Record<KategoriaId, Kategorie> = Object.fromEntries(
  KATEGORIE.map((k) => [k.id, k])
) as Record<KategoriaId, Kategorie>;

export const KATEGORIE_IDS = KATEGORIE.map((k) => k.id) as KategoriaId[];

export const VYCHOZI_KATEGORIE: KategoriaId = 'produktove_podminky';

export function jePlatnaKategorie(x: string): x is KategoriaId {
  return (KATEGORIE_IDS as string[]).includes(x);
}

export function nazevKategorie(id: string): string {
  return KATEGORIE_MAP[id as KategoriaId]?.nazev ?? id;
}
