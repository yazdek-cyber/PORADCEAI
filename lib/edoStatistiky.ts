// REFERENČNÍ STATISTIKY pro klientskou edukaci (graf „proč"). Zdroj: eDO Finanční analýza
// (orientační data ČR ~2020–2021). Slouží k VYSVĚTLENÍ kontextu klientovi, NE k výpočtu jeho čísel
// (ta počítají kalkulačky). Konstanty — snadno aktualizovatelné, nezávislé na tenantovi.

export const STATISTIKY_ZDROJ = 'Orientační data ČR (~2020–2021), zdroj: metodika eDO';

/** Rozložení stupňů invalidity v ČR + průměrný invalidní důchod (Kč/měs). */
export const INVALIDITA = [
  { stupen: 'I. stupeň', podil: 0.42, prumernyDuchod: 7650, barva: '#cbd5e1' },
  { stupen: 'II. stupeň', podil: 0.18, prumernyDuchod: 8950, barva: 'var(--color-accent)' },
  { stupen: 'III. stupeň', podil: 0.40, prumernyDuchod: 13400, barva: 'var(--color-primary)' },
];

/** Hlavní příčiny úmrtí v ČR (podíl). */
export const PRICINY_UMRTI = [
  { nazev: 'Nemoci oběhové soustavy', podil: 0.40, barva: 'var(--color-primary)' },
  { nazev: 'Novotvary (rakovina)', podil: 0.22, barva: 'var(--color-accent)' },
  { nazev: 'Covid-19 (2020)', podil: 0.08, barva: 'var(--color-primary-400)' },
  { nazev: 'Nemoci dýchací soustavy', podil: 0.06, barva: '#94a3b8' },
  { nazev: 'Vnější příčiny (úrazy, otravy)', podil: 0.04, barva: '#cbd5e1' },
  { nazev: 'Ostatní', podil: 0.20, barva: '#e2e8f0' },
];

/** Praxe eDO — orientační nastavení pojistných částek (vysvětlivka ke krytí). */
export const EDO_NASTAVENI_CASTEK = [
  'Smrt (nemoc i úraz): 3× roční čistý příjem',
  'Invalidita (nemoc i úraz): 3× roční čistý příjem',
  'Pracovní neschopnost: dorovnání rozdílu mezi nemocenskou a čistým příjmem',
  'Trvalé následky úrazu s progresí: 1–2,5 mil. Kč (do středního věku), 0,5–1 mil. Kč později',
  'Závažná onemocnění: 1× roční čistý příjem',
];
