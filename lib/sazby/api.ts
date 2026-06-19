// API zdroj sazeb — ZAPOJENÝ STUB. Připraveno na napojení na externí API
// (srovnávače sazeb, poskytovatelé, datové feedy fondů). Adapter převede odpověď
// API na jednotný Produkt[]. Aktivuje se nastavením příslušného API klíče v env.
//
// Záměrně vrací [], dokud není nakonfigurováno API. Rozhraní je shodné s ručním.

import type { DomenaId } from '../domeny';
import type { Produkt, SazbyProvider } from './index';

/** Je nakonfigurované nějaké API pro sazby? (env klíč). */
export function jeApiNakonfigurovano(): boolean {
  return Boolean(process.env.SAZBY_API_KEY && process.env.SAZBY_API_URL);
}

async function nactiProdukty(_domena: DomenaId): Promise<Produkt[]> {
  if (!jeApiNakonfigurovano()) return [];
  // TODO: zavolat process.env.SAZBY_API_URL pro danou doménu, namapovat na Produkt[].
  //   const res = await fetch(`${process.env.SAZBY_API_URL}/${_domena}`, {
  //     headers: { Authorization: `Bearer ${process.env.SAZBY_API_KEY}` },
  //     signal: AbortSignal.timeout(15000),
  //   });
  //   return (await res.json()).map(mapujNaProdukt);
  return [];
}

export const apiProvider: SazbyProvider = { zdroj: 'api', nactiProdukty };
