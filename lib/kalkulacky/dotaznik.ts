// INVESTIČNÍ DOTAZNÍK → RIZIKOVÝ PROFIL (deterministicky, dle metodiky MiFID/EFPA + eDO).
//
// Čistá funkce: z odpovědí (index zvolené volby u každé otázky) spočítá skóre a namapuje ho
// na jeden ze 3 rizikových profilů (konzervativní / vyvážený / dynamický), které dále řídí
// modelové portfolio eDO (lib/edoPortfolia.ts). Číslo NEpočítá AI — je ověřitelné a vysvětlitelné.
//
// KLÍČOVÉ: investiční HORIZONT je TVRDÝ strop. I rizikově laděný klient s krátkým horizontem
// nesmí dostat dynamické portfolio — krátký horizont neunese drawdown akcií (viz eDO horizonty:
// konzervativní ~3 roky, vyvážený 4–6 let, dynamický 7+ let).

import type { RizikovyProfil } from '@/lib/financniPlan';

export interface OdpovedVolba {
  text: string;
  body: number;
}

export interface Otazka {
  id: string;
  otazka: string;
  volby: OdpovedVolba[];
}

// Pořadí otázek je závazné (index odpovědi se mapuje na pořadí). Otázka „horizont" MUSÍ být první.
export const INVESTICNI_DOTAZNIK: Otazka[] = [
  {
    id: 'horizont',
    otazka: 'Na jak dlouho chcete peníze investovat (kdy je budete chtít použít)?',
    volby: [
      { text: 'Méně než 3 roky', body: 0 },
      { text: '3–7 let', body: 3 },
      { text: '7 let a více', body: 5 },
    ],
  },
  {
    id: 'cil',
    otazka: 'Jaký je hlavní cíl investice?',
    volby: [
      { text: 'Ochránit hodnotu peněz, minimum rizika', body: 0 },
      { text: 'Vyvážený růst s přijatelným kolísáním', body: 3 },
      { text: 'Maximální dlouhodobý růst, kolísání nevadí', body: 5 },
    ],
  },
  {
    id: 'zkusenost',
    otazka: 'Jaké máte zkušenosti s investováním?',
    volby: [
      { text: 'Žádné — jen spořicí účet / termínovaný vklad', body: 0 },
      { text: 'Základní — dluhopisy, konzervativní fondy', body: 2 },
      { text: 'Pokročilé — akcie, akciové fondy, ETF', body: 4 },
    ],
  },
  {
    id: 'reakce',
    otazka: 'Hodnota investice během roku klesne o 20 %. Co uděláte?',
    volby: [
      { text: 'Vše prodám, abych zabránil/a další ztrátě', body: 0 },
      { text: 'Část prodám, zbytek nechám', body: 2 },
      { text: 'Nic neměním, počkám na oživení', body: 4 },
      { text: 'Dokoupím — levný nákup', body: 5 },
    ],
  },
  {
    id: 'tolerance',
    otazka: 'Jaké kolísání hodnoty jste ochoten/ochotna akceptovat za vyšší výnos?',
    volby: [
      { text: 'Téměř žádné — hodnota nesmí klesat', body: 0 },
      { text: 'Mírné krátkodobé výkyvy', body: 3 },
      { text: 'I výrazné výkyvy, pokud dlouhodobě roste', body: 5 },
    ],
  },
  {
    id: 'stabilita',
    otazka: 'Jak je na tom váš příjem a finanční rezerva?',
    volby: [
      { text: 'Nejistý příjem nebo bez rezervy', body: 0 },
      { text: 'Stabilní příjem a vytvořená rezerva (3–6 výplat)', body: 2 },
    ],
  },
];

export const DOTAZNIK_MAX_SKORE = INVESTICNI_DOTAZNIK.reduce(
  (s, o) => s + Math.max(...o.volby.map((v) => v.body)),
  0,
);

export interface VyhodnoceniDotazniku {
  skore: number;
  maxSkore: number;
  profil: RizikovyProfil;
  profilZeSkore: RizikovyProfil; // profil čistě dle skóre (před horizontovým stropem)
  omezenoHorizontem: boolean; // true, pokud horizont profil snížil
  duvod: string;
}

const PROFIL_NAZEV: Record<RizikovyProfil, string> = {
  konzervativni: 'konzervativní',
  vyvazeny: 'vyvážený',
  dynamicky: 'dynamický',
};

/** Strop profilu dle indexu odpovědi na horizont (0 = <3 r, 1 = 3–7 let, 2 = 7+ let). */
function stropDleHorizontu(horizontIdx: number): RizikovyProfil {
  if (horizontIdx <= 0) return 'konzervativni'; // krátký horizont neunese akciové drawdowny
  if (horizontIdx === 1) return 'vyvazeny';
  return 'dynamicky';
}

const PORADI: RizikovyProfil[] = ['konzervativni', 'vyvazeny', 'dynamicky'];

/**
 * Vyhodnotí dotazník. `odpovedi` = index zvolené volby u každé otázky ve stejném pořadí jako
 * INVESTICNI_DOTAZNIK; -1 = nezodpovězeno (bere se jako 0 bodů). Pro plný výsledek musí být
 * zodpovězené všechny otázky — to hlídá UI (tlačítko „Vyhodnotit" je do té doby zakázané).
 */
export function vyhodnotDotaznik(odpovedi: number[]): VyhodnoceniDotazniku {
  const skore = INVESTICNI_DOTAZNIK.reduce((s, o, i) => {
    const idx = odpovedi[i];
    const volba = idx >= 0 ? o.volby[idx] : undefined;
    return s + (volba?.body ?? 0);
  }, 0);

  // Mapování skóre na profil dle podílu z maxima (≤40 % konzervativní, ≤70 % vyvážený, jinak dynamický).
  const podil = skore / DOTAZNIK_MAX_SKORE;
  const profilZeSkore: RizikovyProfil =
    podil <= 0.4 ? 'konzervativni' : podil <= 0.7 ? 'vyvazeny' : 'dynamicky';

  // Aplikuj horizontový strop (profil nesmí být rizikovější, než dovoluje horizont).
  const strop = stropDleHorizontu(odpovedi[0] ?? 0);
  const profil = PORADI[Math.min(PORADI.indexOf(profilZeSkore), PORADI.indexOf(strop))];
  const omezenoHorizontem = profil !== profilZeSkore;

  const duvod = omezenoHorizontem
    ? `Skóre ${skore}/${DOTAZNIK_MAX_SKORE} by odpovídalo profilu ${PROFIL_NAZEV[profilZeSkore]}, `
      + `ale kvůli krátkému investičnímu horizontu je profil snížen na ${PROFIL_NAZEV[profil]} `
      + `(rizikovější portfolio neunese krátkodobé propady).`
    : `Skóre ${skore}/${DOTAZNIK_MAX_SKORE} odpovídá profilu ${PROFIL_NAZEV[profil]}.`;

  return { skore, maxSkore: DOTAZNIK_MAX_SKORE, profil, profilZeSkore, omezenoHorizontem, duvod };
}
