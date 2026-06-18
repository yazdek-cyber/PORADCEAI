import { GoogleGenAI } from '@google/genai';

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
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.1, // Nízká kreativita pro přesné odpovědi
      }
    });

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
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.2,
      }
    });

    return response.text || 'Nepodařilo se vygenerovat návrh.';
  } catch (error) {
    console.error('Chyba při volání Gemini API (návrh):', error);
    throw error;
  }
}
