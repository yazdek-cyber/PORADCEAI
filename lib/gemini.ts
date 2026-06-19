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

export interface ObjevenaPodminka {
  produkt: string;
  nazev: string;
  url: string;
}

// Sdílená instrukce: bereme JEN skutečné pojistné podmínky životního/osobního pojištění.
const FILTR_ZIVOTNI = `Vybírej POUZE skutečné POJISTNÉ PODMÍNKY pro ŽIVOTNÍ a OSOBNÍ pojištění.
- ZAHRŇ pouze dokumenty, které samy JSOU pojistné podmínky — všeobecné, zvláštní, doplňkové
  nebo obecné pojistné podmínky (VPP, ZPP, DPP, OPP) pro životní, rizikové životní, úrazové,
  nemocenské, invalidní pojištění nebo pojištění pracovní neschopnosti/příjmu osob. Název
  takového dokumentu vždy obsahuje slovo „podmínky".
- VYNECH ÚPLNĚ vše ostatní, zejména: formuláře a žádosti, hlášení/oznámení události, odstoupení,
  plné moci, výpovědi; informační dokumenty o produktu (IPID), předsmluvní informace, sdělení
  klíčových informací (KID), dokumenty k investičním fondům (fond, ETF, dluhopisový/akciový fond);
  sazebníky, ceníky, oceňovací tabulky, letáky, marketing, výroční zprávy; a JAKÉKOLI pojištění
  mimo osoby (majetek, domácnost, nemovitosti, vozidla, havarijní, povinné ručení, cestovní,
  odpovědnost, podnikatelské či firemní).`;

/**
 * Z textu stránky pojišťovny a seznamu odkazů vytáhne strukturovaný seznam
 * produktů a jejich dokumentů ke stažení (pojistné podmínky apod.).
 */
export async function extrahujPodminky(
  pojistovna: string,
  textStranky: string,
  odkazy: string[]
): Promise<ObjevenaPodminka[]> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY není nastavena v proměnných prostředí.');
  }

  const seznamOdkazu = odkazy.slice(0, 400).join('\n');
  const prompt = `Toto je obsah stránky pojišťovny "${pojistovna}" se sekcí dokumenty ke stažení.

${FILTR_ZIVOTNI}

Vrať seznam vybraných dokumentů jako JSON. Pravidla:
- "url" MUSÍ být přesně jeden z odkazů ze seznamu níže (zkopíruj doslova), ideálně končící na .pdf.
- "produkt" = název produktu/pojištění (např. "NN Orange Risk"); když nelze určit, použij "Obecné".
- "nazev" = název dokumentu (např. "Všeobecné pojistné podmínky pro životní pojištění").
- Odpověz POUZE platným JSON polem: [{"produkt":"...","nazev":"...","url":"..."}]. Nic jiného.

DOSTUPNÉ ODKAZY:
${seznamOdkazu}

TEXT STRÁNKY (kontext):
${textStranky.slice(0, 24000)}`;

  const response = await generujSOpakovanim(
    {
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { temperature: 0, responseMimeType: 'application/json' },
    },
    'extrakce podmínek'
  );

  try {
    const parsed = JSON.parse(response.text || '[]');
    if (!Array.isArray(parsed)) return [];
    // VALIDACE proti reálným odkazům — model nesmí vymýšlet URL (jinak 404 při importu).
    const platne = new Set(odkazy);
    return parsed
      .filter((p) => p && typeof p.url === 'string' && typeof p.nazev === 'string' && platne.has(p.url))
      .map((p) => ({ produkt: String(p.produkt || 'Obecné'), nazev: String(p.nazev), url: String(p.url) }));
  } catch {
    return [];
  }
}

/**
 * Fallback pro JS-renderované stránky (např. Kooperativa): Gemini si stránku načte
 * sám přes nástroj „url_context" (renderuje i JavaScript) a vrátí dokumenty.
 * Odolné parsování — bere JSON i holé PDF odkazy z odpovědi, relativní URL dořeší.
 */
export async function extrahujPodminkyUrlContext(
  pojistovna: string,
  url: string
): Promise<ObjevenaPodminka[]> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY není nastavena v proměnných prostředí.');
  }
  const base = new URL(url).origin;
  const prompt = `Na stránce ${url} (pojišťovna ${pojistovna}) jsou odkazy na PDF dokumenty.

${FILTR_ZIVOTNI}

Vrať vybrané dokumenty VÝHRADNĚ jako platný JSON (žádné HTML, žádný markdown, žádné vysvětlení) ve tvaru:
[{"produkt":"...","nazev":"...","url":"https://...pdf"}]
"url" musí být absolutní odkaz na PDF. Když žádné neodpovídají, vrať [].`;

  const response = await generujSOpakovanim(
    {
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { temperature: 0, maxOutputTokens: 30000, tools: [{ urlContext: {} }] },
    },
    'url_context podmínky'
  );

  const text = response.text || '';
  const podleUrl = new Map<string, ObjevenaPodminka>();
  const pridej = (produkt: string | undefined, nazev: string | undefined, rawUrl: string) => {
    let abs: string;
    try {
      abs = new URL(rawUrl, base).href;
    } catch {
      return;
    }
    if (!/\.pdf(\/|\?|#|$)/i.test(abs)) return;
    const stary = podleUrl.get(abs);
    if (!stary || (nazev && (!stary.nazev || stary.nazev.length < nazev.length))) {
      podleUrl.set(abs, {
        produkt: produkt || stary?.produkt || 'Obecné',
        nazev: nazev || stary?.nazev || abs.split('/').pop() || 'Dokument',
        url: abs,
      });
    }
  };

  // 1) Primárně filtrovaný JSON z modelu
  const m = text.match(/\[[\s\S]*\]/);
  if (m) {
    try {
      const arr = JSON.parse(m[0]);
      if (Array.isArray(arr)) for (const d of arr) if (d?.url) pridej(d.produkt, d.nazev, String(d.url));
    } catch {
      // model nevrátil JSON — zkusíme nouzovou extrakci odkazů
    }
  }
  // 2) Nouze JEN když JSON nic nedal: holé PDF odkazy s vyloučením formulářů a jiných odvětví
  if (podleUrl.size === 0) {
    const vylucit =
      /formul|zadost|žádost|oznamen|hlasen|hlášen|odstoup|plna-moc|plná-moc|vypoved|výpověd|majetk|domacnost|domácnost|nemovit|vozid|auto|havarij|povinne-ruceni|povinné-ručen|cestov|odpovednost|odpovědnost|podnik|firemn|vyrocni|výroční/i;
    for (const mm of text.matchAll(/((?:https?:\/\/|\/)[^"'\s<>()]+?\.pdf(?:\/[A-Za-z0-9._-]+)?)/gi)) {
      if (!vylucit.test(mm[1])) pridej(undefined, undefined, mm[1]);
    }
  }
  return [...podleUrl.values()];
}

export interface SrovnaniBunka {
  hodnota: string;
  strana: number | null;
}

/**
 * Z kontextu (úryvky podmínek jedné pojišťovny, sdružené po parametrech) vytáhne
 * pro KAŽDÝ parametr stručnou konkrétní hodnotu + číslo strany zdroje. Striktně z kontextu.
 */
export async function extrahujSrovnani(
  pojistovna: string,
  parametry: string[],
  kontext: string
): Promise<Record<string, SrovnaniBunka>> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY není nastavena v proměnných prostředí.');
  }
  const seznam = parametry.map((p, i) => `${i + 1}. ${p}`).join('\n');
  const prompt = `Jsi přesný analytik pojistných podmínek. Z níže uvedených úryvků podmínek pojišťovny "${pojistovna}" vytáhni pro KAŽDÝ parametr stručnou, konkrétní hodnotu — VÝHRADNĚ z kontextu.

Parametry:
${seznam}

Pravidla:
- "hodnota": krátce a věcně (např. "2 měsíce", "90 dní", "od 18 do 65 let", stručný výčet výluk). NEVYMÝŠLEJ — co není v kontextu, dej "hodnota": "Neuvedeno".
- "strana": číslo strany úryvku, z něhož hodnota plyne (z označení [str.X]), jinak null.
- Klíče v JSON musí být PŘESNĚ názvy parametrů, jak jsou zadané výše.
- Odpověz POUZE JSON objektem: { "<parametr>": { "hodnota": "...", "strana": <číslo|null> }, ... }.

KONTEXT (úryvky označené [str.X], sdružené po parametrech):
${kontext.slice(0, 28000)}`;

  const response = await generujSOpakovanim(
    {
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { temperature: 0, responseMimeType: 'application/json' },
    },
    'srovnání'
  );

  try {
    const parsed = JSON.parse(response.text || '{}');
    const out: Record<string, SrovnaniBunka> = {};
    for (const p of parametry) {
      const b = parsed?.[p];
      out[p] = {
        hodnota: b && typeof b.hodnota === 'string' ? b.hodnota : 'Neuvedeno',
        strana: b && typeof b.strana === 'number' ? b.strana : null,
      };
    }
    return out;
  } catch {
    const out: Record<string, SrovnaniBunka> = {};
    for (const p of parametry) out[p] = { hodnota: 'Neuvedeno', strana: null };
    return out;
  }
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
