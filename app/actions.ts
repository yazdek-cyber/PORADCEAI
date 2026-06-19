'use server';

import { processPdf } from '@/lib/documentProcessor';
import { getEmbedding, generateChatResponse, generateClientSolution, extrahujSrovnani, ClientProfile } from '@/lib/gemini';
import { supabaseAdmin, checkEnvConfigured } from '@/lib/supabase';
import { POJISTOVNY } from '@/lib/pojistovny';
import { objevPodminky } from '@/lib/podminkyScraper';
import { revalidatePath } from 'next/cache';

interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

// Minimální cosine podobnost, aby byl chunk považován za relevantní.
// Empiricky naměřeno (ÚLOHA 1): relevantní dotazy 72–78 %, irelevantní ≤ 59 %.
// Práh 0.65 leží v mezeře → odfiltruje nesouvisející kontext (žádné „falešné" zdroje).
const MIN_PODOBNOST = 0.65;

/**
 * Zkontroluje, zda jsou nastaveny všechny potřebné klíče v env.
 */
async function checkConfig() {
  if (!checkEnvConfigured()) {
    throw new Error(
      'Aplikace není správně nakonfigurována. Prosím, nastavte všechny proměnné v souboru .env.local (GEMINI_API_KEY, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY).'
    );
  }
}

/**
 * Získá seznam všech nahraných dokumentů.
 */
export async function getDocumentsAction() {
  await checkConfig();
  try {
    const { data, error } = await supabaseAdmin
      .from('dokumenty')
      .select('*')
      .order('nahrano_kdy', { ascending: false });

    if (error) {
      throw new Error(`Nepodařilo se načíst dokumenty: ${error.message}`);
    }

    return { success: true, documents: data || [] };
  } catch (error) {
    console.error('Chyba getDocumentsAction:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      documents: [],
    };
  }
}

/**
 * Srovnávací matice: pro vybrané pojišťovny a parametry vytáhne z podmínek
 * konkrétní hodnoty se zdrojem (strana). Vrací matici hodnot.
 */
export async function srovnejParametryAction(pojistovny: string[], parametry: string[]) {
  await checkConfig();
  try {
    if (!pojistovny?.length || !parametry?.length) {
      throw new Error('Vyberte alespoň jednu pojišťovnu a jeden parametr.');
    }

    const matice: Record<string, Record<string, { hodnota: string; strana: number | null }>> = {};

    for (const poj of pojistovny) {
      // Pro každý parametr vytáhneme relevantní úryvky této pojišťovny a označíme je.
      const bloky: string[] = [];
      for (const param of parametry) {
        const emb = await getEmbedding(param, 'RETRIEVAL_QUERY');
        const { data } = await supabaseAdmin.rpc('hledej_chunky', {
          dotaz_embedding: emb,
          pocet: 4,
          filtr_pojistovna: poj,
        });
        const chunks = (data || []).filter((c: any) => c.podobnost >= 0.6);
        const text = chunks.map((c: any) => `[str.${c.strana ?? '?'}] ${c.obsah}`).join('\n');
        bloky.push(`### PARAMETR: ${param}\n${text || '(nenalezeno)'}`);
      }
      matice[poj] = await extrahujSrovnani(poj, parametry, bloky.join('\n\n'));
    }

    return { success: true, pojistovny, parametry, matice };
  } catch (error) {
    console.error('Chyba srovnejParametryAction:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      pojistovny: [],
      parametry: [],
      matice: {},
    };
  }
}

/**
 * Vrátí seznam unikátních pojišťoven (pro filtr ve vyhledávání).
 */
export async function getPojistovnyAction() {
  await checkConfig();
  try {
    const { data, error } = await supabaseAdmin.from('dokumenty').select('pojistovna');
    if (error) {
      throw new Error(`Nepodařilo se načíst pojišťovny: ${error.message}`);
    }
    const pojistovny = [...new Set((data || []).map((d) => d.pojistovna).filter(Boolean))].sort();
    return { success: true, pojistovny };
  } catch (error) {
    console.error('Chyba getPojistovnyAction:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      pojistovny: [] as string[],
    };
  }
}

/**
 * Nahraje a zpracuje PDF dokument.
 */
export async function uploadDocumentAction(formData: FormData) {
  await checkConfig();
  try {
    const file = formData.get('file') as File;
    const pojistovna = formData.get('pojistovna') as string;

    if (!file || file.size === 0) {
      throw new Error('Nebyl vybrán žádný soubor.');
    }

    if (!pojistovna || pojistovna.trim() === '') {
      throw new Error('Název pojišťovny je povinný.');
    }

    if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
      throw new Error('Nahrávat lze pouze soubory ve formátu PDF.');
    }

    // Převedení souboru na Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await processPdf(buffer, file.name, pojistovna);

    if (!result.success) {
      throw new Error(result.error || 'Neznámá chyba při zpracování PDF.');
    }

    revalidatePath('/admin');
    return { success: true, chunkCount: result.chunkCount, pouzitoOcr: result.pouzitoOcr };
  } catch (error) {
    console.error('Chyba uploadDocumentAction:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Smaže dokument a jeho chunky (díky ON DELETE CASCADE v databázi).
 */
export async function deleteDocumentAction(documentId: string) {
  await checkConfig();
  try {
    const { error } = await supabaseAdmin.from('dokumenty').delete().eq('id', documentId);

    if (error) {
      throw new Error(`Chyba při mazání dokumentu: ${error.message}`);
    }

    revalidatePath('/admin');
    return { success: true };
  } catch (error) {
    console.error('Chyba deleteDocumentAction:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Odpoví na dotaz v chatu pomocí RAG.
 */
export async function askChatAction(
  query: string,
  history: ChatMessage[],
  pojistovna?: string | null
) {
  await checkConfig();
  try {
    if (!query || query.trim() === '') {
      throw new Error('Dotaz nesmí být prázdný.');
    }

    // 1. Generování embeddingu pro dotaz uživatele
    const queryEmbedding = await getEmbedding(query, 'RETRIEVAL_QUERY');

    // 2. Vyhledání nejpodobnějších chunků v Supabase (bereme víc a pak filtrujeme prahem).
    //    filtr_pojistovna=NULL => napříč všemi pojišťovnami; jinak jen vybraná.
    const { data: chunks, error: rpcError } = await supabaseAdmin.rpc('hledej_chunky', {
      dotaz_embedding: queryEmbedding,
      pocet: 10,
      filtr_pojistovna: pojistovna || null,
    });

    if (rpcError) {
      throw new Error(`Chyba vyhledávání v databázi: ${rpcError.message}`);
    }

    // Filtr relevance: jen chunky nad prahem podobnosti se použijí jako kontext i jako zdroje.
    const contextChunks = (chunks || [])
      .filter((c: any) => c.podobnost >= MIN_PODOBNOST)
      .slice(0, 8);

    // Pokud nic relevantního, vůbec nevoláme model — rovnou poctivě přiznáme, že to v podmínkách není.
    if (contextChunks.length === 0) {
      return {
        success: true,
        answer: 'Tuto informaci jsem v nahraných podmínkách nenašel.',
        chunks: [],
      };
    }

    // 3. Generování odpovědi pomocí Gemini na základě vyhledaných chunků
    const answer = await generateChatResponse(history, contextChunks);

    return {
      success: true,
      answer,
      chunks: contextChunks.map((c: any) => ({
        id: c.id,
        obsah: c.obsah,
        pojistovna: c.pojistovna,
        nazev_dokumentu: c.nazev_dokumentu,
        strana: c.strana,
        podobnost: c.podobnost,
      })),
    };
  } catch (error) {
    console.error('Chyba askChatAction:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      answer: '',
      chunks: [],
    };
  }
}

/**
 * Vygeneruje strukturovaný analytický návrh pro klienta.
 */
export async function generateSolutionAction(profile: ClientProfile) {
  await checkConfig();
  try {
    // Sestavíme vyhledávací text pro retrieval na základě klíčových cílů a zdravotního stavu klienta
    const searchString = `Pojištění pro klienty s cílem: ${profile.cil}. Povolání: ${profile.povolani}. Věk: ${profile.vek}. Zdravotní stav: ${profile.zdravotniStav}.`;
    
    // 1. Generování embeddingu pro vyhledávací řetězec
    const searchEmbedding = await getEmbedding(searchString, 'RETRIEVAL_QUERY');

    // 2. Vyhledání relevantních chunků v Supabase (napříč pojišťovnami).
    // Bereme víc a filtrujeme prahem, ať návrh stojí jen na relevantních podmínkách.
    const { data: chunks, error: rpcError } = await supabaseAdmin.rpc('hledej_chunky', {
      dotaz_embedding: searchEmbedding,
      pocet: 15,
      filtr_pojistovna: null,
    });

    if (rpcError) {
      throw new Error(`Chyba vyhledávání v databázi pro případ: ${rpcError.message}`);
    }

    const contextChunks = (chunks || [])
      .filter((c: any) => c.podobnost >= MIN_PODOBNOST)
      .slice(0, 12);

    if (contextChunks.length === 0) {
      return {
        success: false,
        error:
          'V nahraných podmínkách jsem nenašel dostatek relevantních informací pro tento profil. Zkuste nahrát více pojistných podmínek nebo upřesnit cíl klienta.',
        solution: '',
        chunks: [],
      };
    }

    // 3. Generování analytického návrhu pomocí Gemini
    const solution = await generateClientSolution(profile, contextChunks);

    return {
      success: true,
      solution,
      chunks: contextChunks.map((c: any) => ({
        id: c.id,
        obsah: c.obsah,
        pojistovna: c.pojistovna,
        nazev_dokumentu: c.nazev_dokumentu,
        strana: c.strana,
        podobnost: c.podobnost,
      })),
    };
  } catch (error) {
    console.error('Chyba generateSolutionAction:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      solution: '',
      chunks: [],
    };
  }
}

/**
 * Projde stránky všech pojišťoven, objeví dostupné dokumenty a uloží/aktualizuje
 * snapshot v `dostupne_podminky`. Detekuje nové a změněné dokumenty (hlídání).
 */
export async function zkontrolujPodminkyAction() {
  await checkConfig();
  const souhrn: {
    pojistovna: string;
    nalezeno?: number;
    nove?: number;
    zmenene?: number;
    chyba?: string;
  }[] = [];

  for (const p of POJISTOVNY) {
    try {
      const objevene = await objevPodminky(p.nazev, p.urlDokumenty);
      let nove = 0;
      let zmenene = 0;
      for (const d of objevene) {
        const hash = `${d.produkt}|${d.nazev}`;
        const { data: ex } = await supabaseAdmin
          .from('dostupne_podminky')
          .select('id, hash, stav')
          .eq('pojistovna', p.nazev)
          .eq('url', d.url)
          .maybeSingle();

        if (!ex) {
          await supabaseAdmin.from('dostupne_podminky').insert({
            pojistovna: p.nazev,
            produkt: d.produkt,
            nazev: d.nazev,
            url: d.url,
            hash,
            stav: 'nova',
          });
          nove++;
        } else {
          const zmena = ex.hash !== hash;
          let stav = ex.stav;
          if (zmena) {
            stav = 'zmenena';
            zmenene++;
          }
          await supabaseAdmin
            .from('dostupne_podminky')
            .update({ produkt: d.produkt, nazev: d.nazev, hash, stav, posledni_videno: new Date().toISOString() })
            .eq('id', ex.id);
        }
      }
      souhrn.push({ pojistovna: p.nazev, nalezeno: objevene.length, nove, zmenene });
    } catch (e) {
      souhrn.push({ pojistovna: p.nazev, chyba: e instanceof Error ? e.message : String(e) });
    }
  }

  revalidatePath('/admin');
  return { success: true, souhrn };
}

/**
 * Vrátí seznam objevených dostupných podmínek (pro zobrazení v adminu).
 */
export async function getDostupnePodminkyAction() {
  await checkConfig();
  try {
    const { data, error } = await supabaseAdmin
      .from('dostupne_podminky')
      .select('*')
      .order('pojistovna', { ascending: true })
      .order('produkt', { ascending: true });
    if (error) throw new Error(`Nepodařilo se načíst dostupné podmínky: ${error.message}`);
    return { success: true, podminky: data || [] };
  } catch (error) {
    console.error('Chyba getDostupnePodminkyAction:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error), podminky: [] };
  }
}

/**
 * Stáhne a importuje konkrétní objevený dokument (přes standardní pipeline).
 */
export async function importujPodminkuAction(id: string) {
  await checkConfig();
  try {
    const { data: zaznam, error } = await supabaseAdmin
      .from('dostupne_podminky')
      .select('*')
      .eq('id', id)
      .single();
    if (error || !zaznam) throw new Error('Záznam dokumentu nebyl nalezen.');

    const res = await fetch(zaznam.url, { signal: AbortSignal.timeout(60000) });
    if (!res.ok) throw new Error(`Stažení PDF selhalo (HTTP ${res.status}).`);
    const buffer = Buffer.from(await res.arrayBuffer());

    const nazevSouboru = `${zaznam.produkt ? zaznam.produkt + ' - ' : ''}${zaznam.nazev}`;
    const result = await processPdf(buffer, nazevSouboru, zaznam.pojistovna);
    if (!result.success) throw new Error(result.error || 'Zpracování PDF selhalo.');

    await supabaseAdmin
      .from('dostupne_podminky')
      .update({ stav: 'importovana', importovano_kdy: new Date().toISOString() })
      .eq('id', id);

    revalidatePath('/admin');
    return { success: true, chunkCount: result.chunkCount, pouzitoOcr: result.pouzitoOcr };
  } catch (error) {
    console.error('Chyba importujPodminkuAction:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}
