// Ruční zdroj sazeb — plně funkční. Čte strukturované produkty z tabulky `produkty`,
// které poradce zadal v adminu (nebo se naimportovaly ze sazebníku). Plná kontrola,
// žádná závislost na cizích webech.

import type { DomenaId } from '../domeny';
import { supabaseAdmin } from '../supabase';
import type { Produkt, SazbyProvider } from './index';

async function nactiProdukty(domena: DomenaId): Promise<Produkt[]> {
  const { data, error } = await supabaseAdmin
    .from('produkty')
    .select('id, domena, poskytovatel, nazev, typ, parametry, zdroj, aktualizovano_kdy')
    .eq('domena', domena)
    .order('poskytovatel', { ascending: true });
  if (error) throw new Error(`Načtení produktů (ruční) selhalo: ${error.message}`);
  return (data || []).map((r) => ({
    id: r.id,
    domena: r.domena as DomenaId,
    poskytovatel: r.poskytovatel,
    nazev: r.nazev,
    typ: r.typ,
    parametry: (r.parametry as Record<string, unknown>) || {},
    zdroj: 'rucni' as const,
    aktualizovano_kdy: r.aktualizovano_kdy,
  }));
}

export const rucniProvider: SazbyProvider = { zdroj: 'rucni', nactiProdukty };
