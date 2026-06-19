// Scraping zdroj sazeb — ZAPOJENÝ STUB. Připraveno na rozšíření monitoru
// (lib/podminkyScraper.ts) o sazebníky bank a factsheety fondů: stáhnout stránku
// poskytovatele, AI vytáhne sazby/poplatky → vrátit jako Produkt[].
//
// Záměrně vrací [], dokud se nedoplní konkrétní zdroje a extrakce. Rozhraní je
// shodné s ručním, takže přepnutí je bezbolestné (a nactiProduktyVse ho už volá).

import type { DomenaId } from '../domeny';
import type { Produkt, SazbyProvider } from './index';

// Mapa domén na (budoucí) URL sazebníků/listingů. Doplnit při implementaci.
// Příklad struktury, ať je jasné, kam to povede:
//   uvery:     [{ poskytovatel: 'Banka X', url: 'https://…/sazebnik-hypoteky' }]
//   investice: [{ poskytovatel: 'Správce Y', url: 'https://…/fondy' }]
export const ZDROJE_SCRAPINGU: Partial<Record<DomenaId, { poskytovatel: string; url: string }[]>> = {
  uvery: [],
  investice: [],
  penze: [],
  pojisteni: [], // pojištění už řeší monitor podmínek (lib/podminkyScraper.ts)
};

async function nactiProdukty(_domena: DomenaId): Promise<Produkt[]> {
  // TODO: stáhnout ZDROJE_SCRAPINGU[domena], AI extrakce parametrů → Produkt[].
  // Lze přímo využít vzor z lib/podminkyScraper.ts (statický fetch + Gemini).
  return [];
}

export const scrapingProvider: SazbyProvider = { zdroj: 'scraping', nactiProdukty };
