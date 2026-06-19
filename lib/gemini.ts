import { GoogleGenAI } from '@google/genai';
import { PDFDocument } from 'pdf-lib';

const apiKey = process.env.GEMINI_API_KEY || 'placeholder-gemini-key';
export const ai = new GoogleGenAI({ apiKey });

/**
 * Generuje embeddingy pro zadaný text pomocí modelu text-embedding-004 (768 dimenzí).
 */
export async function getEmbedding(
  text: string,
  taskType: 'RETRIEVAL_QUERY' | 'RETRIEVAL_DOCUMENT' = 'RETRIEVAL_QUERY'
): Promise<number[]> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY není nastavena v proměnných prostředí.');
  }

  const maxPokusu = 5;
  let posledniChyba: unknown;

  for (let pokus = 0; pokus <= maxPokusu; pokus++) {
    try {
      // text-embedding-004 byl odstaven; používáme gemini-embedding-001.
      // outputDimensionality: 768 zachová kompatibilitu s DB schématem VECTOR(768).
      // taskType zásadně zlepšuje trefnost RAG: dokumenty se embedují jako
      // RETRIEVAL_DOCUMENT, dotazy jako RETRIEVAL_QUERY.
      const response = await ai.models.embedContent({
        model: 'gemini-embedding-001',
        contents: text,
        config: { outputDimensionality: 768, taskType },
      });

      const embeddings = response.embeddings;
      if (!embeddings || embeddings.length === 0 || !embeddings[0].values) {
        throw new Error('Gemini API nevrátilo platné embeddingy.');
      }

      return embeddings[0].values;
    } catch (error) {
      posledniChyba = error;
      // Při překročení limitu (429 / RESOURCE_EXHAUSTED) počkáme a zkusíme znovu
      // s exponenciálním prodlením (2s, 4s, 8s, 16s, 32s – max 60s).
      if (jeChybaLimitu(error) && pokus < maxPokusu) {
        const cekejMs = Math.min(60000, 2000 * 2 ** pokus);
        console.warn(`Limit Gemini API (429), pokus ${pokus + 1}/${maxPokusu}, čekám ${cekejMs} ms…`);
        await new Promise((r) => setTimeout(r, cekejMs));
        continue;
      }
      console.error('Chyba při generování embeddingu:', error);
      throw error;
    }
  }

  throw posledniChyba;
}

/** Rozpozná chybu překročení kvóty/limitu (HTTP 429 / RESOURCE_EXHAUSTED). */
function jeChybaLimitu(error: unknown): boolean {
  const text = error instanceof Error ? error.message : String(error);
  return text.includes('429') || text.includes('RESOURCE_EXHAUSTED') || text.includes('quota');
}

/** Rozpozná přechodnou síťovou/serverovou chybu, u které má smysl zkusit znovu. */
function jePrechodnaChyba(error: unknown): boolean {
  const cause = (error as { cause?: { code?: string } })?.cause?.code ?? '';
  const text = (error instanceof Error ? error.message : String(error)) + ' ' + cause;
  return /ECONNRESET|ETIMEDOUT|EAI_AGAIN|fetch failed|socket hang up|network|\b503\b|\b502\b|\b504\b|UNAVAILABLE|INTERNAL/i.test(
    text
  );
}

/**
 * Zavolá Gemini generateContent s opakováním na přechodné chyby (429, ECONNRESET, 5xx).
 * Exponenciální prodleva 1.5s, 3s, 6s, 12s (max 30s).
 */
async function generujSOpakovanim(
  params: Parameters<typeof ai.models.generateContent>[0],
  popis: string
) {
  const maxPokusu = 4;
  let posledniChyba: unknown;
  for (let pokus = 0; pokus <= maxPokusu; pokus++) {
    try {
      return await ai.models.generateContent(params);
    } catch (error) {
      posledniChyba = error;
      if ((jeChybaLimitu(error) || jePrechodnaChyba(error)) && pokus < maxPokusu) {
        const cekejMs = Math.min(30000, 1500 * 2 ** pokus);
        console.warn(`Gemini (${popis}): dočasná chyba, pokus ${pokus + 1}/${maxPokusu}, čekám ${cekejMs} ms…`);
        await new Promise((r) => setTimeout(r, cekejMs));
        continue;
      }
      throw error;
    }
  }
  throw posledniChyba;
}

/**
 * OCR naskenovaného PDF přes Gemini vision (gemini-2.5-flash umí číst dokumenty včetně češtiny).
 * Pošle celé PDF jako dokument a požádá o přepis textu po stránkách.
 * Vrací pole textů stránek (index 0 = strana 1). Stránky bez rozpoznaného textu jsou prázdné.
 */
const OCR_DAVKA_STRAN = 15; // stránek na jedno OCR volání (drží výstup pod limitem tokenů)

export async function ocrPdfStranky(fileBuffer: Buffer): Promise<string[]> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY není nastavena v proměnných prostředí.');
  }

  // PDF rozdělíme na dávky stránek, aby se výstup OCR vešel do limitu tokenů
  // a zvládli jsme i velké skeny (desítky/stovky stran).
  const zdroj = await PDFDocument.load(fileBuffer, { ignoreEncryption: true });
  const celkem = zdroj.getPageCount();
  const pages: string[] = new Array(celkem).fill('');

  for (let start = 0; start < celkem; start += OCR_DAVKA_STRAN) {
    const konec = Math.min(start + OCR_DAVKA_STRAN, celkem);
    const indices: number[] = [];
    for (let i = start; i < konec; i++) indices.push(i);

    const sub = await PDFDocument.create();
    const zkopirovane = await sub.copyPages(zdroj, indices);
    zkopirovane.forEach((p) => sub.addPage(p));
    const base64 = Buffer.from(await sub.save()).toString('base64');

    const pocetVDavce = konec - start;
    const prompt = `Toto je část naskenovaného dokumentu (pojistné podmínky), ${pocetVDavce} stránek. Přepiš VEŠKERÝ čitelný text z každé stránky věrně a kompletně.
Pro KAŽDOU stránku vrať přesně tento formát:
===STRANA k===
<přepsaný text stránky>
Kde k je pořadí stránky v TÉTO části (1 až ${pocetVDavce}). Nevynechávej žádnou stránku. Nepřidávej žádné komentáře mimo přepsaný text.`;

    const response = await generujSOpakovanim({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType: 'application/pdf', data: base64 } },
            { text: prompt },
          ],
        },
      ],
      config: { temperature: 0, maxOutputTokens: 65536 },
    }, `OCR str. ${start + 1}+`);

    const text = response.text || '';
    const matches = [...text.matchAll(/===\s*STRANA\s*(\d+)\s*===/gi)];
    if (matches.length === 0) {
      if (text.trim()) pages[start] = text.trim();
      continue;
    }
    for (let i = 0; i < matches.length; i++) {
      const lokalni = parseInt(matches[i][1], 10);
      const s = matches[i].index! + matches[i][0].length;
      const e = i + 1 < matches.length ? matches[i + 1].index! : text.length;
      const globalni = start + lokalni - 1;
      if (lokalni > 0 && globalni < celkem) pages[globalni] = text.slice(s, e).trim();
    }
  }
  return pages;
}

interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

interface ContextChunk {
  obsah: string;
  pojistovna: string;
  nazev_dokumentu: string;
  strana?: number;
  podobnost: number;
}

/**
 * Odpoví na dotaz uživatele na základě poskytnutých chunků pojistných podmínek.
 */
export async function generateChatResponse(
  history: ChatMessage[],
  contextChunks: ContextChunk[]
): Promise<string> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY není nastavena v proměnných prostředí.');
  }

  // Sestavení kontextu z nalezených chunků
  const formattedContext = contextChunks
    .map((chunk, idx) => {
      const sourceInfo = `${chunk.pojistovna} - ${chunk.nazev_dokumentu}${chunk.strana ? `, str. ${chunk.strana}` : ''}`;
      return `--- ZDROJ ČÍSLO ${idx + 1}: ${sourceInfo} ---
${chunk.obsah}`;
    })
    .join('\n\n');

  const systemInstruction = `Jsi profesionální AI asistent pro finanční poradce v České republice. Tvým úkolem je přesně a spolehlivě odpovídat na dotazy ohledně pojistných podmínek.

KRITICKÁ PRAVIDLA PRO TVOJI ODPOVĚĎ:
1. Odpovídej VÝHRADNĚ na základě poskytnutého kontextu níže.
2. Pokud odpověď v kontextu není, nebo si nejsi jistý, jasně řekni: "Tuto informaci jsem v nahraných podmínkách nenašel."
3. NIKDY si nevymýšlej žádné informace, které nejsou přímo uvedeny v poskytnutém kontextu (žádné domněnky, doplňování z obecných znalostí atd.).
4. Komunikuj výhradně česky, odborně, ale srozumitelně.
5. U každé věcné informace uveď referenci na zdroj (např. [1], [2] atd.) a na konci odpovědi uveď seznam těchto zdrojů s názvem pojišťovny, dokumentu a číslem strany.

Následuje poskytnutý kontext z nahraných dokumentů:
${formattedContext}

DŮLEŽITÉ: Pokud kontext neobsahuje odpověď na položenou otázku, odmítni odpovědět a sděl, že informace chybí v nahraných dokumentech. NIKDY nepoužívej své obecné znalosti pojišťoven k zodpovězení dotazu.`;

  // Sestavení zpráv pro Gemini API
  // V novém SDK se historie posílá v contents. Formát zpráv: { role: 'user' | 'model', parts: [{ text: string }] }
  const contents = [
    ...history.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }))
  ];

  try {
    const response = await generujSOpakovanim({
      model: 'gemini-2.5-flash',
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.1, // Nízká kreativita pro přesné odpovědi
      }
    }, 'chat');

    return response.text || 'Omlouvám se, nepodařilo se vygenerovat odpověď.';
  } catch (error) {
    console.error('Chyba při volání Gemini API (chat):', error);
    throw error;
  }
}

export interface ClientProfile {
  vek: number;
  povolani: string;
  prijem: string;
  zavazky: string;
  rodina: string;
  zdravotniStav: string;
  cil: string;
}

/**
 * Vygeneruje strukturovaný analytický návrh pro klienta na základě profilu a vyhledaných chunků z dokumentů.
 */
export async function generateClientSolution(
  profile: ClientProfile,
  contextChunks: ContextChunk[]
): Promise<string> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY není nastavena v proměnných prostředí.');
  }

  // Sestavení kontextu z nalezených chunků
  const formattedContext = contextChunks
    .map((chunk, idx) => {
      const sourceInfo = `${chunk.pojistovna} - ${chunk.nazev_dokumentu}${chunk.strana ? `, str. ${chunk.strana}` : ''}`;
      return `--- ZDROJ ČÍSLO ${idx + 1}: ${sourceInfo} ---
${chunk.obsah}`;
    })
    .join('\n\n');

  const systemInstruction = `Jsi špičkový analytik životního pojištění. Tvým úkolem je připravit pro finančního poradce strukturovaný návrh řešení a podklady pro klienta na základě jeho profilu a nahraných pojistných podmínek.

KRITICKÁ PRAVIDLA PRO NÁVRH:
1. Celý návrh MUSÍ vycházet z poskytnutých pojistných podmínek v kontextu. Nepoužívej obecné znalosti, pokud nejsou doloženy v kontextu.
2. Na samém začátku a na samém konci dokumentu MUSÍ být viditelně a jasně uvedeno:
   "Toto je analytický podklad pro licencovaného poradce, nikoliv finanční doporučení."
3. Návrh musí být strukturovaný do následujících sekcí:
   - **Profil klienta a cíle**: Krátké shrnutí situace klienta.
   - **Doporučený typ produktu a zdůvodnění**: Jaký typ pojištění doporučuješ (např. invalidita, smrt, pracovní neschopnost) a proč vzhledem k profilu a kontextu.
   - **Analýza a srovnání pojišťoven**: Které z pojišťoven z nahraných podmínek nejlépe odpovídají klientovu profilu a proč. Porovnej je na základě zjištěných dat z kontextu (např. čekací doby, definice diagnóz, rizikové skupiny).
   - **Na co si dát pozor (důležité výluky a čekací doby)**: Konkrétní výluky, čekací doby nebo omezení pro zjištěné pojišťovny z kontextu, které jsou relevantní pro klientův věk, povolání či zdravotní stav.
   - **Srovnání alternativ / doporučený postup**: Další kroky pro poradce.

4. U každého tvrzení o pojišťovně uveď odkaz na zdroj (např. název pojišťovny, název dokumentu, strana) přímo v textu nebo jako seznam zdrojů.
5. Odpovídej v češtině, vysoce profesionálně, strukturovaně v Markdown formátu.

Následuje poskytnutý kontext z nahraných dokumentů:
${formattedContext}`;

  const prompt = `Zadání profilu klienta:
- Věk: ${profile.vek} let
- Povolání / riziková skupina: ${profile.povolani}
- Příjem (orientačně): ${profile.prijem}
- Závazky (hypotéka, úvěry): ${profile.zavazky}
- Rodinná situace (děti, partner): ${profile.rodina}
- Zdravotní stav (orientačně): ${profile.zdravotniStav}
- Cíl / co chce řešit: ${profile.cil}

Vygeneruj strukturovaný návrh splňující všechna pravidla v systémové instrukci.`;

  try {
    const response = await generujSOpakovanim({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.2,
      }
    }, 'návrh');

    return response.text || 'Nepodařilo se vygenerovat návrh.';
  } catch (error) {
    console.error('Chyba při volání Gemini API (návrh):', error);
    throw error;
  }
}
