// PŘÍLEŽITOSTI / CROSS-SELL RADAR (à la eDO Cross-sell).
//
// Deterministicky odvodí ze SOUČASNÝCH profilů klientů prioritizovaný seznam příležitostí
// k řešení (doplnit rezervu, refinancovat hypotéku, začít investovat, řešit penzi…).
// Žádná nová data ani AI — jen pravidla nad tím, co poradce o klientovi už ví. Čisté + testovatelné.

import { jmenoKlienta, type KlientZaznam, type Pripad } from './pripadStore';

export type PrioritaPrilezitosti = 'vysoka' | 'stredni' | 'nizka';

export interface Prilezitost {
  klientId: string;
  klientJmeno: string;
  typ: string;
  nadpis: string;
  duvod: string;
  akce: { label: string; href: string };
  priorita: PrioritaPrilezitosti;
}

const PORADI_PRIORITY: Record<PrioritaPrilezitosti, number> = { vysoka: 0, stredni: 1, nizka: 2 };

/** Příležitosti pro JEDNOHO klienta (pravidla nad profilem). */
function prilezitostiKlienta(id: string, p: Pripad): Omit<Prilezitost, 'klientId' | 'klientJmeno'>[] {
  const out: Omit<Prilezitost, 'klientId' | 'klientJmeno'>[] = [];
  const vydaje = p.vydaje ?? 0;
  const prijem = p.cistyPrijem ?? 0;
  // Skutečně volný cashflow = příjem − výdaje − splátky dluhů − již směřované do penze/investic.
  // (Shodná sémantika jako „zbytekVolne" v KlientskaAnalyza — ať nedáváme dvě různá čísla.)
  const volnyCashflow = prijem - vydaje - (p.mesicniSplatkyDluhu ?? 0)
    - (p.penzeMesicniVklad ?? 0) - (p.mesicniVkladInvestice ?? 0);

  // 1) Nízká likvidní rezerva (< 3× měsíční výdaje) — základ finanční pyramidy.
  if (vydaje > 0 && (p.rezervaNasporeno ?? 0) < vydaje * 3) {
    out.push({
      typ: 'rezerva',
      nadpis: 'Nízká likvidní rezerva',
      duvod: `Rezerva ${(p.rezervaNasporeno ?? 0).toLocaleString('cs-CZ')} Kč je pod 3× měsíčních výdajů (${(vydaje * 3).toLocaleString('cs-CZ')} Kč). Doporučená rezerva je 3–6 výdajů.`,
      akce: { label: 'Spočítat rezervu', href: '/kalkulacky' },
      priorita: 'vysoka',
    });
  }

  // 2) Drahá hypotéka → refinancování (sazba ≥ 6 %).
  if ((p.hypotekaZustatek ?? 0) > 0 && (p.hypotekaSazba ?? 0) >= 6) {
    out.push({
      typ: 'refinancovani',
      nadpis: 'Refinancování hypotéky',
      duvod: `Sazba hypotéky ${p.hypotekaSazba} % je vysoká — refinancování může snížit splátku.`,
      akce: { label: 'Spočítat refinancování', href: '/kalkulacky' },
      priorita: 'vysoka',
    });
  }

  // 3) Blíží se konec hypotéky / fixace (≤ 12 měsíců) — čas vyjednat podmínky.
  if ((p.hypotekaZbyvaMesicu ?? 0) > 0 && (p.hypotekaZbyvaMesicu ?? 0) <= 12) {
    out.push({
      typ: 'fixace',
      nadpis: 'Blíží se konec hypotéky / fixace',
      duvod: `Do konce zbývá ${p.hypotekaZbyvaMesicu} měsíců — vhodný čas oslovit klienta a porovnat nabídky.`,
      akce: { label: 'Otevřít případ', href: '/klienti' },
      priorita: 'stredni',
    });
  }

  // 4) Nevyužitý cashflow — neinvestuje, ač má volné peníze (> 3 000 Kč/měs).
  // Guard `vydaje > 0`: bez vyplněných výdajů je „volný cashflow" jen nedopočet, ne pravda — neukazuj smyšlené číslo.
  if ((p.mesicniVkladInvestice ?? 0) === 0 && vydaje > 0 && volnyCashflow > 3000) {
    out.push({
      typ: 'investice',
      nadpis: 'Nevyužitý volný cashflow',
      duvod: `Volný měsíční cashflow ≈ ${Math.round(volnyCashflow).toLocaleString('cs-CZ')} Kč není investován. Pravidelná investice buduje majetek.`,
      akce: { label: 'Investiční dotazník', href: '/kalkulacky' },
      priorita: 'stredni',
    });
  }

  // 5) Investuje, ale nemá určený rizikový profil → doplnit dotazník (MiFID).
  if ((p.mesicniVkladInvestice ?? 0) > 0 && !p.rizikovyProfil) {
    out.push({
      typ: 'profil',
      nadpis: 'Chybí rizikový profil',
      duvod: 'Klient investuje, ale nemá vyplněný investiční dotazník — doplnit pro vhodnou alokaci (MiFID).',
      akce: { label: 'Vyplnit dotazník', href: '/kalkulacky' },
      priorita: 'nizka',
    });
  }

  // 6) Blíží se důchod (≤ 15 let) s nízkým naspořením na penzi.
  if (p.vek && p.vekOdchodu && p.vekOdchodu - p.vek <= 15 && p.vekOdchodu - p.vek > 0
      && (p.penzeMesicniVklad ?? 0) < 1000) {
    out.push({
      typ: 'penze',
      nadpis: 'Řešit penzi — blíží se důchod',
      duvod: `Do důchodu zbývá ${p.vekOdchodu - p.vek} let a měsíční vklad na penzi je nízký (${(p.penzeMesicniVklad ?? 0).toLocaleString('cs-CZ')} Kč). Hrozí mezera v důchodu.`,
      akce: { label: 'Spočítat penzi', href: '/kalkulacky' },
      priorita: 'vysoka',
    });
  }

  // 7) Drahé spotřebitelské dluhy → konsolidace.
  if ((p.jineDluhy ?? 0) > 0 && (p.mesicniSplatkyDluhu ?? 0) > 0) {
    out.push({
      typ: 'konsolidace',
      nadpis: 'Konsolidace dluhů',
      duvod: `Spotřebitelské dluhy ${(p.jineDluhy ?? 0).toLocaleString('cs-CZ')} Kč se splátkami ${(p.mesicniSplatkyDluhu ?? 0).toLocaleString('cs-CZ')} Kč/měs — zvážit konsolidaci za nižší sazbu.`,
      akce: { label: 'Otevřít případ', href: '/klienti' },
      priorita: 'stredni',
    });
  }

  // 8) Děti → spoření na vzdělání (dlouhý horizont, státem nepodporováno → vlastní řešení).
  if ((p.pocetDeti ?? 0) > 0) {
    out.push({
      typ: 'deti',
      nadpis: 'Spoření na vzdělání dětí',
      duvod: `Klient má ${p.pocetDeti} ${(p.pocetDeti ?? 0) === 1 ? 'dítě' : 'děti'} — dlouhý horizont je ideální pro spoření na studia.`,
      akce: { label: 'Cíl ve Finančním plánu', href: '/plan' },
      priorita: 'nizka',
    });
  }

  return out;
}

/** Najde a seřadí příležitosti napříč všemi klienty (vysoká → nízká priorita). */
export function najdiPrilezitosti(klienti: KlientZaznam[]): Prilezitost[] {
  const vse: Prilezitost[] = [];
  for (const k of klienti) {
    const jmeno = jmenoKlienta(k.profil);
    for (const pr of prilezitostiKlienta(k.id, k.profil)) {
      vse.push({ ...pr, klientId: k.id, klientJmeno: jmeno });
    }
  }
  return vse.sort((a, b) => PORADI_PRIORITY[a.priorita] - PORADI_PRIORITY[b.priorita]);
}
