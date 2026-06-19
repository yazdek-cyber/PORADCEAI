import { PDFParse } from 'pdf-parse';
import { getEmbedding, ocrPdfStranky } from './gemini';
import { supabaseAdmin } from './supabase';

interface ProcessResult {
  success: boolean;
  documentId?: string;
  chunkCount?: number;
  error?: string;
  pouzitoOcr?: boolean;
}

// Kolik embeddingů generovat současně. Embeddingy jsou hlavní brzda zpracování
// (u velkého/OCR dokumentu desítky až stovky chunků). Mírný souběh zkrátí čas
// několikanásobně a přitom nepřetíží Gemini API — případné 429 řeší retry+backoff
// uvnitř getEmbedding. Drženo nízko, ať to funguje i blízko serverless limitů.
const EMBEDDING_SOUBEH = 5;

/**
 * Spustí asynchronní operaci nad polem s omezeným souběhem a ZACHOVÁ pořadí výsledků.
 * Když kterákoli operace selže, chyba probublá (Promise.all chování) a zpracování skončí.
 */
export async function mapSOmezenim<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const vysledky: R[] = new Array(items.length);
  let dalsi = 0;
  async function pracovnik() {
    while (true) {
      const i = dalsi++;
      if (i >= items.length) return;
      vysledky[i] = await fn(items[i], i);
    }
  }
  const pocet = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: pocet }, () => pracovnik()));
  return vysledky;
}

/**
 * Zpracuje PDF soubor: extrahuje text po stránkách, rozdělí na chunky,
 * vytvoří pro každý chunk embedding pomocí Gemini a uloží do Supabase.
 */
export async function processPdf(
  fileBuffer: Buffer,
  fileName: string,
  insuranceCompany: string,
  domena: string = 'pojisteni'
): Promise<ProcessResult> {
  try {
    const pages: string[] = [];

    // pdf-parse v2: text se extrahuje přes třídu PDFParse, getText() vrací text po stránkách.
    // pageJoiner: '' vypne vkládání oddělovačů stran ("-- 1 of N --") do textu, aby se nedostaly do chunků.
    const parser = new PDFParse({ data: fileBuffer });
    let pocetStran = 0;
    try {
      const textResult = await parser.getText({ pageJoiner: '' });
      pocetStran = textResult.total;
      for (const page of textResult.pages) {
        pages[page.num - 1] = page.text;
      }
    } finally {
      await parser.destroy();
    }

    // Detekce naskenovaného PDF: když je z PDF extrahováno téměř žádné množství textu
    // (na stránku méně než prah), jde nejspíš o sken → OCR fallback přes Gemini vision.
    let pouzitoOcr = false;
    const celkemZnaku = pages.join('').replace(/\s/g, '').length;
    const prumerNaStranu = celkemZnaku / Math.max(1, pocetStran || pages.length);
    if (prumerNaStranu < 40) {
      pouzitoOcr = true;
      const ocrPages = await ocrPdfStranky(fileBuffer);
      pages.length = 0;
      ocrPages.forEach((t, i) => {
        pages[i] = t || '';
      });
      if (pages.join('').trim() === '') {
        throw new Error('PDF se nepodařilo přečíst ani přes OCR (možná chráněné nebo prázdné).');
      }
    }

    // Příprava chunků. Záznam o dokumentu vytvoříme až PO úspěšném vygenerování
    // embeddingů, aby při chybě/limitu (429) nezůstaly v DB osiřelé dokumenty bez chunků.
    const allChunks: {
      obsah: string;
      strana: number;
      poradi: number;
      pojistovna: string;
      nazev_dokumentu: string;
    }[] = [];

    let overallIndex = 0;
    
    for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
      const pageText = pages[pageIdx];
      if (!pageText || pageText.trim() === '') continue;

      const pageNumber = pageIdx + 1;
      const maxChunkLength = 3200; // Přibližně 800 tokenů v češtině
      const overlap = 400; // Přibližně 100 tokenů překryv

      if (pageText.length <= maxChunkLength) {
        allChunks.push({
          obsah: pageText.trim(),
          strana: pageNumber,
          poradi: overallIndex++,
          pojistovna: insuranceCompany,
          nazev_dokumentu: fileName,
        });
      } else {
        let start = 0;
        while (start < pageText.length) {
          let end = start + maxChunkLength;
          if (end >= pageText.length) {
            end = pageText.length;
          } else {
            // Najdeme mezeru před koncem, abychom nesekali slova
            const lastSpace = pageText.lastIndexOf(' ', end);
            if (lastSpace > start + maxChunkLength - overlap) {
              end = lastSpace;
            }
          }

          const chunkText = pageText.substring(start, end).trim();
          if (chunkText.length > 50) {
            allChunks.push({
              obsah: chunkText,
              strana: pageNumber,
              poradi: overallIndex++,
              pojistovna: insuranceCompany,
              nazev_dokumentu: fileName,
            });
          }

          // Dosáhli jsme konce stránky → hotovo.
          if (end >= pageText.length) break;

          // Posun dál s překryvem; pojistka, že start se VŽDY pohne dopředu
          // (jinak by u konce stránky vznikla nekonečná smyčka a došla paměť).
          const next = end - overlap;
          start = next > start ? next : end;
        }
      }
    }

    if (allChunks.length === 0) {
      throw new Error('Nebyly nalezeny žádné textové části v dokumentu.');
    }

    // Generování embeddingů pro každý chunk (paralelně s omezeným souběhem) a uložení.
    // Pořadí výsledků odpovídá allChunks (mapSOmezenim ho zachovává).
    let dbChunksToInsert: ({ embedding: number[] } & (typeof allChunks)[number])[];
    try {
      dbChunksToInsert = await mapSOmezenim(allChunks, EMBEDDING_SOUBEH, async (chunk) => {
        const embedding = await getEmbedding(chunk.obsah, 'RETRIEVAL_DOCUMENT');
        return { ...chunk, embedding };
      });
    } catch (err) {
      console.error('Chyba generování embeddingu:', err);
      throw new Error(
        `Chyba při generování embeddingu: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    // Embeddingy hotové → teď teprve vytvoříme záznam o dokumentu.
    const { data: docData, error: docError } = await supabaseAdmin
      .from('dokumenty')
      .insert({
        nazev: fileName,
        pojistovna: insuranceCompany,
        pocet_chunku: 0,
        domena,
      })
      .select()
      .single();

    if (docError || !docData) {
      throw new Error(`Nepodařilo se vytvořit záznam o dokumentu: ${docError?.message}`);
    }

    const documentId = docData.id;

    // Doplníme vazbu na dokument a hromadně uložíme chunky.
    const chunkyToInsert = dbChunksToInsert.map((c) => ({ ...c, dokument_id: documentId, domena }));
    const { error: insertError } = await supabaseAdmin.from('chunky').insert(chunkyToInsert);

    if (insertError) {
      // Úklid osiřelého dokumentu, ať v adminu nezůstane prázdný záznam.
      await supabaseAdmin.from('dokumenty').delete().eq('id', documentId);
      throw new Error(`Nepodařilo se uložit chunky do databáze: ${insertError.message}`);
    }

    // Aktualizace počtu chunků u dokumentu
    const { error: updateError } = await supabaseAdmin
      .from('dokumenty')
      .update({ pocet_chunku: dbChunksToInsert.length })
      .eq('id', documentId);

    if (updateError) {
      console.error('Nepodařilo se aktualizovat celkový počet chunků:', updateError.message);
    }

    return {
      success: true,
      documentId,
      chunkCount: dbChunksToInsert.length,
      pouzitoOcr,
    };
  } catch (error) {
    console.error('Chyba v processPdf:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Uloží do RAG už extrahovaný TEXT (metodika, postupy) — bez PDF parsování.
 * Použití pro knowledge base z metodických dokumentů (Maxx/Drive, bez osobních dat).
 * Stejné chunkování i paralelní embeddingy jako u PDF; dělení po stranách přes '\f'.
 */
export async function processText(
  fullText: string,
  fileName: string,
  provider: string,
  domena: string = 'metodika'
): Promise<ProcessResult> {
  try {
    if (!fullText || fullText.trim() === '') throw new Error('Prázdný text.');
    const pages = fullText.includes('\f') ? fullText.split('\f') : [fullText];

    const allChunks: {
      obsah: string; strana: number; poradi: number; pojistovna: string; nazev_dokumentu: string;
    }[] = [];
    let overallIndex = 0;
    const maxChunkLength = 3200;
    const overlap = 400;

    for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
      const pageText = pages[pageIdx];
      if (!pageText || pageText.trim() === '') continue;
      const pageNumber = pageIdx + 1;
      if (pageText.length <= maxChunkLength) {
        allChunks.push({ obsah: pageText.trim(), strana: pageNumber, poradi: overallIndex++, pojistovna: provider, nazev_dokumentu: fileName });
      } else {
        let start = 0;
        while (start < pageText.length) {
          let end = start + maxChunkLength;
          if (end >= pageText.length) end = pageText.length;
          else {
            const lastSpace = pageText.lastIndexOf(' ', end);
            if (lastSpace > start + maxChunkLength - overlap) end = lastSpace;
          }
          const chunkText = pageText.substring(start, end).trim();
          if (chunkText.length > 50) {
            allChunks.push({ obsah: chunkText, strana: pageNumber, poradi: overallIndex++, pojistovna: provider, nazev_dokumentu: fileName });
          }
          if (end >= pageText.length) break;
          const next = end - overlap;
          start = next > start ? next : end;
        }
      }
    }
    if (allChunks.length === 0) throw new Error('Žádný text k uložení.');

    const dbChunks = await mapSOmezenim(allChunks, EMBEDDING_SOUBEH, async (chunk) => ({
      ...chunk, embedding: await getEmbedding(chunk.obsah, 'RETRIEVAL_DOCUMENT'),
    }));

    const { data: doc, error: de } = await supabaseAdmin
      .from('dokumenty')
      .insert({ nazev: fileName, pojistovna: provider, pocet_chunku: 0, domena })
      .select().single();
    if (de || !doc) throw new Error(`Nepodařilo se vytvořit dokument: ${de?.message}`);

    const toInsert = dbChunks.map((c) => ({ ...c, dokument_id: doc.id, domena }));
    const { error: ie } = await supabaseAdmin.from('chunky').insert(toInsert);
    if (ie) {
      await supabaseAdmin.from('dokumenty').delete().eq('id', doc.id);
      throw new Error(`Nepodařilo se uložit chunky: ${ie.message}`);
    }
    await supabaseAdmin.from('dokumenty').update({ pocet_chunku: dbChunks.length }).eq('id', doc.id);

    return { success: true, documentId: doc.id, chunkCount: dbChunks.length };
  } catch (error) {
    console.error('Chyba v processText:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}
