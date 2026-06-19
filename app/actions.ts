'use server';

import { processPdf } from '@/lib/documentProcessor';
import { getEmbedding, generateChatResponse, generateClientSolution, ClientProfile } from '@/lib/gemini';
import { supabaseAdmin, checkEnvConfigured } from '@/lib/supabase';
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
export async function askChatAction(query: string, history: ChatMessage[]) {
  await checkConfig();
  try {
    if (!query || query.trim() === '') {
      throw new Error('Dotaz nesmí být prázdný.');
    }

    // 1. Generování embeddingu pro dotaz uživatele
    const queryEmbedding = await getEmbedding(query, 'RETRIEVAL_QUERY');

    // 2. Vyhledání nejpodobnějších chunků v Supabase (bereme víc a pak filtrujeme prahem)
    const { data: chunks, error: rpcError } = await supabaseAdmin.rpc('hledej_chunky', {
      dotaz_embedding: queryEmbedding,
      pocet: 10,
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

    // 2. Vyhledání relevantních chunků v Supabase
    // Pro komplexnější srovnání načteme více chunků (např. 12)
    const { data: chunks, error: rpcError } = await supabaseAdmin.rpc('hledej_chunky', {
      dotaz_embedding: searchEmbedding,
      pocet: 12,
    });

    if (rpcError) {
      throw new Error(`Chyba vyhledávání v databázi pro případ: ${rpcError.message}`);
    }

    const contextChunks = chunks || [];

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
