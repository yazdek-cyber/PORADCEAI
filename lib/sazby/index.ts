// Jednotné rozhraní pro ZDROJE SAZEB / parametrů produktů.
// Tři varianty (ruční / scraping / API) jsou zaměnitelné za stejným rozhraním,
// takže orchestrace finančního plánu nezávisí na tom, odkud čísla pocházejí.
//
// - 'rucni'    — plně funkční: čte strukturované produkty z tabulky `produkty`
//                (poradce je zadá v adminu, případně importuje ze sazebníku).
// - 'scraping' — zapojený stub: připraveno na rozšíření monitoru o sazebníky.
// - 'api'      — zapojený stub: připraveno na napojení na API srovnávačů/poskytovatelů.

import type { DomenaId } from '../domeny';
import { rucniProvider } from './rucni';
import { scrapingProvider } from './scraping';
import { apiProvider } from './api';

export type ZdrojSazeb = 'rucni' | 'scraping' | 'api';

/** Strukturovaný produkt (čisté parametry pro kalkulačky). Mapuje tabulku `produkty`. */
export interface Produkt {
  id?: string;
  domena: DomenaId;
  poskytovatel?: string | null;
  nazev: string;
  typ?: string | null;
  /** Doménově specifická čísla: sazba, ter, ocekavanyVynos, limity, výluky… */
  parametry: Record<string, unknown>;
  zdroj?: ZdrojSazeb;
  aktualizovano_kdy?: string;
}

export interface SazbyProvider {
  zdroj: ZdrojSazeb;
  /** Načte produkty dané domény z tohoto zdroje. */
  nactiProdukty(domena: DomenaId): Promise<Produkt[]>;
}

const PROVIDERS: Record<ZdrojSazeb, SazbyProvider> = {
  rucni: rucniProvider,
  scraping: scrapingProvider,
  api: apiProvider,
};

/** Vrátí providera pro daný zdroj (default 'rucni'). */
export function ziskejProvidera(zdroj: ZdrojSazeb = 'rucni'): SazbyProvider {
  return PROVIDERS[zdroj] ?? rucniProvider;
}

/**
 * Načte produkty domény napříč VŠEMI dostupnými zdroji a sloučí je.
 * Ruční je vždy k dispozici; scraping/API přidají, co umí (zatím prázdné stuby).
 */
export async function nactiProduktyVse(domena: DomenaId): Promise<Produkt[]> {
  const vysledky = await Promise.all(
    (Object.keys(PROVIDERS) as ZdrojSazeb[]).map(async (z) => {
      try {
        return await PROVIDERS[z].nactiProdukty(domena);
      } catch {
        return [];
      }
    })
  );
  return vysledky.flat();
}
