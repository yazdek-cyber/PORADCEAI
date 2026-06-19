import { extrahujPodminky, extrahujPodminkyUrlContext, ObjevenaPodminka } from './gemini';

/** Hrubý převod HTML na text (pro kontext pro Gemini). */
function htmlNaText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Vytáhne absolutní odkazy ze stránky. */
function vytahniOdkazy(html: string, baseUrl: string): string[] {
  const odkazy = new Set<string>();
  const re = /href\s*=\s*["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try {
      const abs = new URL(m[1], baseUrl).href;
      if (/^https?:/i.test(abs)) odkazy.add(abs);
    } catch {
      // ignoruj nevalidní URL
    }
  }
  return [...odkazy];
}

/** Tier 1 — rychlý statický fetch + AI extrakce (funguje pro staticky renderované stránky). */
async function objevStaticky(pojistovna: string, url: string): Promise<ObjevenaPodminka[]> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (PoradceAI dokument-monitor)' },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) {
    throw new Error(`Nepodařilo se načíst stránku ${pojistovna} (HTTP ${res.status}).`);
  }
  const html = await res.text();
  const odkazy = vytahniOdkazy(html, url);
  const pdfOdkazy = odkazy.filter((o) => /\.pdf(\?|#|$)/i.test(o));
  // Bez PDF odkazů ve statickém HTML nemá smysl plýtvat tokeny — rovnou na fallback.
  if (pdfOdkazy.length === 0) return [];
  const text = htmlNaText(html);
  return extrahujPodminky(pojistovna, text, pdfOdkazy);
}

/**
 * Objeví dokumenty ke stažení na stránce pojišťovny.
 * Tier 1: statický fetch + AI. Tier 2 (fallback pro JS weby): Gemini url_context.
 */
export async function objevPodminky(pojistovna: string, url: string): Promise<ObjevenaPodminka[]> {
  let list: ObjevenaPodminka[] = [];
  try {
    list = await objevStaticky(pojistovna, url);
  } catch {
    // statický fetch selhal (blokace, timeout) → zkusíme url_context
  }
  if (list.length === 0) {
    // url_context fallback bývá občas flaky (vrátí 0) — zkusíme až 2×.
    for (let pokus = 0; pokus < 2 && list.length === 0; pokus++) {
      try {
        list = await extrahujPodminkyUrlContext(pojistovna, url);
      } catch {
        // necháme list prázdný a případně zkusíme znovu
      }
    }
  }

  // Tvrdý filtr: bereme jen dokumenty, jejichž název značí POJISTNÉ PODMÍNKY
  // (odfiltruje IPID, předsmluvní info, fondy, sazebníky, formuláře apod.).
  const jePodminky = (nazev: string) => /podm[ií]nk/i.test(nazev);

  // Deduplikace dle absolutní url
  const videno = new Set<string>();
  const vysledek: ObjevenaPodminka[] = [];
  for (const p of list) {
    if (!/^https?:/i.test(p.url) || videno.has(p.url)) continue;
    if (!jePodminky(p.nazev)) continue;
    videno.add(p.url);
    vysledek.push({ produkt: p.produkt || 'Obecné', nazev: p.nazev, url: p.url });
  }
  return vysledek;
}
