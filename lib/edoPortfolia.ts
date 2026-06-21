// Modelová portfolia eDO (zdroj: ingestovaný dokument „Modelová portfolia eDO finance", říjen 2023).
// Konkrétní fondy s vahami pro 3 rizikové profily — aby plán/klientská analýza uměly doporučit
// konkrétní řešení, ne jen obecnou alokaci akcie/dluhopisy/hotovost. Orientační, NE individualizované
// investiční doporučení (viz disclaimer v dokumentu). Snadno aktualizovatelné konstanty.

import type { RizikovyProfil } from '@/lib/financniPlan';

export interface Fond {
  nazev: string;
  isin: string;
  trida: 'Peněžní trh' | 'Dluhopisy' | 'Nemovitosti' | 'Akcie';
  vaha: number; // 0–1
  ocekavanyVynos: number; // p.a. desetinně
}

export interface ModelovePortfolio {
  profil: RizikovyProfil;
  nazev: string;
  cilovyVynos: number; // p.a. desetinně
  maxDrawdown: number; // desetinně (černý scénář)
  horizont: string;
  fondy: Fond[];
}

export const EDO_PORTFOLIA: Record<RizikovyProfil, ModelovePortfolio> = {
  konzervativni: {
    profil: 'konzervativni',
    nazev: 'Konzervativní',
    cilovyVynos: 0.045,
    maxDrawdown: 0.03,
    horizont: '~3 roky',
    fondy: [
      { nazev: 'Conseq Repofond', isin: 'CZ0008477221', trida: 'Peněžní trh', vaha: 0.70, ocekavanyVynos: 0.04 },
      { nazev: 'Future X1', isin: 'LI0523708464', trida: 'Nemovitosti', vaha: 0.30, ocekavanyVynos: 0.055 },
    ],
  },
  vyvazeny: {
    profil: 'vyvazeny',
    nazev: 'Vyvážený',
    cilovyVynos: 0.055,
    maxDrawdown: 0.16,
    horizont: '4–6 let',
    fondy: [
      { nazev: 'Goldman Sachs Czech Bond', isin: 'LU0082087437', trida: 'Dluhopisy', vaha: 0.25, ocekavanyVynos: 0.045 },
      { nazev: 'Conseq korporátních dluhopisů', isin: 'CZ0008473873', trida: 'Dluhopisy', vaha: 0.25, ocekavanyVynos: 0.05 },
      { nazev: 'Future X1', isin: 'LI0523708464', trida: 'Nemovitosti', vaha: 0.35, ocekavanyVynos: 0.055 },
      { nazev: 'Amundi Pioneer Global Equity', isin: 'LU1894680591', trida: 'Akcie', vaha: 0.15, ocekavanyVynos: 0.08 },
    ],
  },
  dynamicky: {
    profil: 'dynamicky',
    nazev: 'Dynamický',
    cilovyVynos: 0.07,
    maxDrawdown: 0.34,
    horizont: '7+ let',
    fondy: [
      { nazev: 'Future X1', isin: 'LI0523708464', trida: 'Nemovitosti', vaha: 0.40, ocekavanyVynos: 0.055 },
      { nazev: 'FF — World Fund', isin: 'LU1756523376', trida: 'Akcie', vaha: 0.30, ocekavanyVynos: 0.08 },
      { nazev: 'Amundi Pioneer Global Equity', isin: 'LU1894680591', trida: 'Akcie', vaha: 0.30, ocekavanyVynos: 0.08 },
    ],
  },
};

export const EDO_PORTFOLIA_ZDROJ = 'Modelová portfolia eDO finance (říjen 2023) — orientační, ne individualizované doporučení';

export function portfolioProProfil(profil?: RizikovyProfil): ModelovePortfolio {
  return EDO_PORTFOLIA[profil ?? 'vyvazeny'];
}

const BARVY_TRIDA: Record<Fond['trida'], string> = {
  'Peněžní trh': '#94a3b8',
  'Dluhopisy': 'var(--color-accent)',
  'Nemovitosti': 'var(--color-primary-400)',
  'Akcie': 'var(--color-primary)',
};
export function barvaTridy(t: Fond['trida']): string {
  return BARVY_TRIDA[t];
}
