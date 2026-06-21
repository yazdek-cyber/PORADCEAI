// PROVIZNÍ MODEL — POUZE INTERNÍ PŘEHLED PRO PORADCE (nikdy ne klientovi).
//
// Princip (drží nestrannost): provize NEŘÍDÍ doporučení. Doporučení vychází z POTŘEB klienta
// (mezery v pokrytí). Provize je jen ORIENTAČNÍ PŘEHLED „kolik mi vyřešení těch potřeb vynese",
// aby poradce/manažer viděl potenciál případu (který jinak nikdo nezná). Sazby se mění → drž je
// jako DATA (tady), aktualizuj při změně provizních listin.
//
// Zdroj kariérních násobičů: Provizní kalkulačka sítě v1.65 (10.6.2026). 1 BJ = 250 Kč.

export const BJ_KC = 250;

export interface KarierniStupen {
  nazev: string;
  pojisteni: number; // % násobič pro pojištění
  investice: number; // % násobič pro investice
  uvery: number;     // % násobič pro úvěry
}

// Kariérní stupně a jejich provizní úroveň (% ) — importováno z provizní listiny (spolehlivé).
export const KARIERNI_STUPNE: KarierniStupen[] = [
  { nazev: 'Doporučitel', pojisteni: 20, investice: 20, uvery: 20 },
  { nazev: 'Consultant 1', pojisteni: 85, investice: 95, uvery: 100 },
  { nazev: 'Consultant 2', pojisteni: 100, investice: 110, uvery: 115 },
  { nazev: 'Consultant 3', pojisteni: 115, investice: 125, uvery: 130 },
  { nazev: 'Senior Consultant 1', pojisteni: 130, investice: 140, uvery: 145 },
  { nazev: 'Manager', pojisteni: 135, investice: 145, uvery: 150 },
  { nazev: 'Senior Consultant 2', pojisteni: 145, investice: 155, uvery: 160 },
  { nazev: 'Senior Manager', pojisteni: 155, investice: 165, uvery: 170 },
  { nazev: 'Senior Consultant 3', pojisteni: 160, investice: 170, uvery: 175 },
  { nazev: 'Director', pojisteni: 170, investice: 180, uvery: 185 },
  { nazev: 'Senior Consultant 4', pojisteni: 175, investice: 185, uvery: 190 },
  { nazev: 'Senior Director', pojisteni: 185, investice: 195, uvery: 200 },
  { nazev: 'Partner', pojisteni: 200, investice: 210, uvery: 215 },
  { nazev: 'Senior Partner', pojisteni: 210, investice: 220, uvery: 225 },
];

export function stupenDleNazvu(nazev?: string): KarierniStupen | null {
  if (!nazev) return null;
  return KARIERNI_STUPNE.find((s) => s.nazev === nazev) ?? null;
}

export type ProviznKategorie = 'pojisteni' | 'investice' | 'uvery';

// ORIENTAČNÍ základní sazby provize ze ZÁKLADU (před kariérním násobičem). Jde o hrubý průměr trhu,
// ne přesné listinové sazby (ty jsou per produkt/partner a mění se) — slouží jen k řádovému přehledu.
// `zaklad` = roční pojistné (pojištění) / investovaný objem za rok (investice) / objem úvěru (úvěry).
export const ORIENT_SAZBA: Record<ProviznKategorie, number> = {
  pojisteni: 1.5,  // ~1,5× roční pojistné (ŽP) jako základ provize, dále × kariérní %/100
  investice: 0.03, // ~3 % z ročního objemu
  uvery: 0.01,     // ~1 % z objemu úvěru
};

/** Orientační provize: základ × orientační sazba × (kariérní úroveň / 100). Vrací Kč (zaokrouhleno). */
export function odhadProvize(zaklad: number, kategorie: ProviznKategorie, stupen: KarierniStupen | null): number {
  if (!stupen || zaklad <= 0) return 0;
  const uroven = stupen[kategorie] / 100;
  return Math.round(zaklad * ORIENT_SAZBA[kategorie] * uroven);
}
