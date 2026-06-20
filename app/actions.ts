'use server';

import { processPdf } from '@/lib/documentProcessor';
import { getEmbedding, generateChatResponse, generateClientSolution, extrahujSrovnani, generateFinancniPlan, ClientProfile } from '@/lib/gemini';
import { supabaseAdmin, checkEnvConfigured } from '@/lib/supabase';
import { POJISTOVNY } from '@/lib/pojistovny';
import { objevPodminky } from '@/lib/podminkyScraper';
import { pripravPodklady, formatujPodklady, type FinPlanProfil } from '@/lib/financniPlan';
import { jePlatnaKategorie, VYCHOZI_KATEGORIE } from '@/lib/kategorie';
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
 * Ochrana proti SSRF: povolíme stažení jen z HTTPS a jen z domén pojišťoven z `POJISTOVNY`.
 * URL k importu pochází z LLM extrakce / scrapingu (nedůvěryhodné), proto allowlist.
 */
function jeBezpecnaUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:') return false;
  if (u.hostname === 'localhost' || /^[0-9.:]+$/.test(u.hostname)) return false; // ne IP/loopback
  const host = u.hostname.replace(/^www\./, '');
  const povolene = POJISTOVNY.map((p) => {
    try {
      return new URL(p.urlDokumenty).hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  }).filter(Boolean);
  return povolene.some((d) => {
    const base = d.split('.').slice(-2).join('.'); // registrovatelná doména (koop.cz, nn.cz…)
    return host === d || host === base || host.endsWith('.' + base);
  });
}

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
    // Doména (pilíř): pojisteni | uvery | investice | penze. Výchozí pojisteni
    // kvůli zpětné kompatibilitě se stávajícím nahráváním.
    const domenaRaw = (formData.get('domena') as string) || 'pojisteni';
    const platneDomeny = ['pojisteni', 'uvery', 'investice', 'penze'];
    const domena = platneDomeny.includes(domenaRaw) ? domenaRaw : 'pojisteni';
    // Kategorie (role podkladu): postup_firmy | metodika | produktove_podminky.
    const kategorieRaw = (formData.get('kategorie') as string) || VYCHOZI_KATEGORIE;
    const kategorie = jePlatnaKategorie(kategorieRaw) ? kategorieRaw : VYCHOZI_KATEGORIE;

    if (!file || file.size === 0) {
      throw new Error('Nebyl vybrán žádný soubor.');
    }

    if (!pojistovna || pojistovna.trim() === '') {
      throw new Error('Název poskytovatele je povinný.');
    }

    if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
      throw new Error('Nahrávat lze pouze soubory ve formátu PDF.');
    }

    // Limit velikosti (i na serveru, ne jen v UI) — ochrana proti přetížení/timeoutu.
    const MAX_BAJTU = 25 * 1024 * 1024;
    if (file.size > MAX_BAJTU) {
      throw new Error(`Soubor je příliš velký (${(file.size / 1048576).toFixed(1)} MB). Maximum je 25 MB.`);
    }

    // Převedení souboru na Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Ověření skutečné PDF signatury (%PDF-) — nespoléhat jen na MIME/příponu z klienta.
    if (buffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
      throw new Error('Soubor není platné PDF (chybí PDF signatura).');
    }

    const result = await processPdf(buffer, file.name, pojistovna, domena, kategorie);

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
 * Přeřadí dokument: změní kategorii / doménu / poskytovatele. Denormalizované hodnoty
 * jsou i v `chunky` (kvůli RAG filtrům), proto se aktualizují na obou tabulkách.
 */
export async function updateDokumentMetaAction(
  documentId: string,
  zmeny: { kategorie?: string; domena?: string; pojistovna?: string }
) {
  await checkConfig();
  try {
    const platneDomeny = ['pojisteni', 'uvery', 'investice', 'penze', 'metodika'];
    const patch: Record<string, string> = {};
    if (zmeny.kategorie && jePlatnaKategorie(zmeny.kategorie)) patch.kategorie = zmeny.kategorie;
    if (zmeny.domena && platneDomeny.includes(zmeny.domena)) patch.domena = zmeny.domena;
    if (typeof zmeny.pojistovna === 'string' && zmeny.pojistovna.trim()) patch.pojistovna = zmeny.pojistovna.trim();
    if (Object.keys(patch).length === 0) throw new Error('Žádná platná změna.');

    const { error: e1 } = await supabaseAdmin.from('dokumenty').update(patch).eq('id', documentId);
    if (e1) throw new Error(`Chyba úpravy dokumentu: ${e1.message}`);
    // Propaguj do chunků (kategorie/domena/pojistovna se používají při vyhledávání).
    const { error: e2 } = await supabaseAdmin.from('chunky').update(patch).eq('dokument_id', documentId);
    if (e2) throw new Error(`Chyba úpravy chunků: ${e2.message}`);

    revalidatePath('/admin');
    return { success: true };
  } catch (error) {
    console.error('Chyba updateDokumentMetaAction:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
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
 * Vygeneruje komplexní FINANČNÍ PLÁN přes 4 pilíře (penze/investice/úvěry/pojištění).
 * 1) deterministicky spočítá podklady (kalkulačky + zdroje sazeb),
 * 2) RAG: doplní úryvky z podmínek jako zdroje,
 * 3) AI z podkladů složí plán se zdroji a disclaimerem,
 * 4) uloží plán do financni_plany (dohledatelnost).
 */
export async function generujFinancniPlanAction(profil: FinPlanProfil) {
  await checkConfig();
  try {
    // Validace: věk odchodu musí být po aktuálním věku (jinak nemá horizont smysl).
    const vekOdchodu = profil.vekOdchodu ?? 65;
    if (!(profil.vek > 0) || vekOdchodu <= profil.vek) {
      throw new Error('Věk odchodu do důchodu musí být vyšší než aktuální věk klienta.');
    }
    // 1) Deterministické podklady ze všech pilířů.
    const vypocty = await pripravPodklady(profil);
    const podkladyText = formatujPodklady(profil, vypocty);

    // 2) RAG: vyhledáme relevantní úryvky z podmínek (napříč doménami).
    const dotaz = `Finanční situace klienta, věk ${profil.vek}, povolání ${profil.povolani ?? '–'}, cíle: ${profil.cile ?? '–'}. Pojištění, úvěry, investice, penze.`;
    const emb = await getEmbedding(dotaz, 'RETRIEVAL_QUERY');
    const { data: chunks } = await supabaseAdmin.rpc('hledej_chunky', {
      dotaz_embedding: emb,
      pocet: 12,
      filtr_pojistovna: null,
    });
    const contextChunks = (chunks || []).filter((c: any) => c.podobnost >= MIN_PODOBNOST).slice(0, 10);

    // 3) Textový profil pro prompt.
    const profilText = [
      `Věk: ${profil.vek}`,
      `Čistý měsíční příjem: ${profil.cistyPrijem} Kč · Výdaje: ${profil.vydaje} Kč`,
      `Rodina: ${profil.partner ? 'partner/ka' : 'bez partnera'}, dětí: ${profil.pocetDeti ?? 0}`,
      `Rezerva naspořeno: ${profil.rezervaNasporeno ?? 0} Kč · Investice: ${profil.existujiciInvestice ?? 0} Kč (měs. vklad ${profil.mesicniVkladInvestice ?? 0} Kč)`,
      `Hypotéka: ${profil.hypotekaZustatek ?? 0} Kč${profil.hypotekaSazba ? `, sazba ${(profil.hypotekaSazba * 100).toFixed(2)} %, zbývá ${profil.hypotekaZbyvaMesicu ?? '?'} měs.` : ''} · Jiné dluhy: ${profil.jineDluhy ?? 0} Kč`,
      `Penze: naspořeno ${profil.penzeNasporeno ?? 0} Kč, měs. vklad ${profil.penzeMesicniVklad ?? 0} Kč, věk odchodu ${profil.vekOdchodu ?? 65}`,
      `Rizikový profil: ${profil.rizikovyProfil ?? 'vyvazeny'} · Zdravotní stav: ${profil.zdravotniStav ?? '–'}`,
      profil.cileSeznam && profil.cileSeznam.length > 0
        ? `Cíle (CO/KDY/KOLIK): ${profil.cileSeznam.map((c) => `${c.nazev} ${c.castka} Kč za ${c.roky} let`).join('; ')}`
        : '',
      `Poznámka k cílům: ${profil.cile ?? '–'}`,
    ].filter(Boolean).join('\n');

    // 4) AI syntéza.
    const plan = await generateFinancniPlan(profilText, podkladyText, contextChunks);

    // 5) Uložení plánu (best-effort, neblokuje výsledek).
    try {
      const { error: insErr } = await supabaseAdmin.from('financni_plany').insert({
        profil: profil as unknown as Record<string, unknown>,
        plan_md: plan,
        vypocty: vypocty as unknown as Record<string, unknown>,
      });
      if (insErr) console.error('Uložení finančního plánu selhalo (nekritické):', insErr.message);
    } catch (e) {
      console.error('Uložení finančního plánu selhalo (nekritické):', e);
    }

    return {
      success: true,
      plan,
      podklady: podkladyText,
      vypocty,
      chunks: contextChunks.map((c: any) => ({
        id: c.id,
        obsah: c.obsah,
        pojistovna: c.pojistovna,
        nazev_dokumentu: c.nazev_dokumentu,
        strana: c.strana,
        domena: c.domena,
        podobnost: c.podobnost,
      })),
    };
  } catch (error) {
    console.error('Chyba generujFinancniPlanAction:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      plan: '',
      podklady: '',
      vypocty: null,
      chunks: [],
    };
  }
}

/** Seznam uložených finančních plánů (metadata, bez těžkého plan_md). */
export async function getUlozenePlanyAction() {
  await checkConfig();
  try {
    const { data, error } = await supabaseAdmin
      .from('financni_plany')
      .select('id, vytvoreno_kdy, profil')
      .order('vytvoreno_kdy', { ascending: false })
      .limit(50);
    if (error) throw new Error(`Nepodařilo se načíst plány: ${error.message}`);
    return { success: true, plany: data || [] };
  } catch (error) {
    console.error('Chyba getUlozenePlanyAction:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error), plany: [] };
  }
}

/** Detail jednoho uloženého plánu (Markdown + spočítané podklady). */
export async function getUlozenyPlanAction(id: string) {
  await checkConfig();
  try {
    const { data, error } = await supabaseAdmin
      .from('financni_plany')
      .select('plan_md, vypocty, profil, vytvoreno_kdy')
      .eq('id', id)
      .single();
    if (error || !data) throw new Error('Plán nebyl nalezen.');
    return { success: true, plan: data.plan_md as string, vypocty: data.vypocty, profil: data.profil, vytvoreno_kdy: data.vytvoreno_kdy };
  } catch (error) {
    console.error('Chyba getUlozenyPlanAction:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error), plan: '', vypocty: null };
  }
}

/** Smaže uložený plán. */
export async function smazUlozenyPlanAction(id: string) {
  await checkConfig();
  try {
    const { error } = await supabaseAdmin.from('financni_plany').delete().eq('id', id);
    if (error) throw new Error(`Smazání selhalo: ${error.message}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
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
 * Projde stránky pojišťoven, objeví dostupné dokumenty a uloží/aktualizuje
 * snapshot v `dostupne_podminky`. Detekuje nové a změněné dokumenty (hlídání).
 *
 * @param filtrPojistovna Když je zadán, skenuje JEN tuto jednu pojišťovnu (dle názvu).
 *   Sken všech 6 najednou trvá ~10 min → překračuje serverless timeout (Vercel 300 s).
 *   Proto admin UI i cron volají akci po jedné pojišťovně (každé volání je krátké).
 */
export async function zkontrolujPodminkyAction(filtrPojistovna?: string) {
  await checkConfig();
  const souhrn: {
    pojistovna: string;
    nalezeno?: number;
    nove?: number;
    zmenene?: number;
    chyba?: string;
  }[] = [];

  const sken = filtrPojistovna
    ? POJISTOVNY.filter(
        (p) => p.nazev === filtrPojistovna || p.slug === filtrPojistovna.toLowerCase()
      )
    : POJISTOVNY;

  if (filtrPojistovna && sken.length === 0) {
    return { success: false, error: `Neznámá pojišťovna: ${filtrPojistovna}`, souhrn };
  }

  for (const p of sken) {
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

    if (!jeBezpecnaUrl(zaznam.url)) {
      throw new Error('Nepovolená URL dokumentu (povoleny jen HTTPS domény pojišťoven).');
    }
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

// ── Správa produktů a sazeb (vstupy pro kalkulačky finančního plánu) ─────────

const DOMENY_PLATNE = ['pojisteni', 'uvery', 'investice', 'penze'];

export interface ProduktVstup {
  id?: string;
  domena: string;
  poskytovatel?: string;
  nazev: string;
  typ?: string;
  parametry: Record<string, unknown>;
}

/** Vrátí produkty (volitelně jen jedné domény), nejnovější nahoře. */
export async function getProduktyAction(domena?: string) {
  await checkConfig();
  try {
    let q = supabaseAdmin
      .from('produkty')
      .select('id, domena, poskytovatel, nazev, typ, parametry, zdroj, aktualizovano_kdy')
      .order('aktualizovano_kdy', { ascending: false });
    if (domena && DOMENY_PLATNE.includes(domena)) q = q.eq('domena', domena);
    const { data, error } = await q;
    if (error) throw new Error(`Nepodařilo se načíst produkty: ${error.message}`);
    return { success: true, produkty: data || [] };
  } catch (error) {
    console.error('Chyba getProduktyAction:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error), produkty: [] };
  }
}

/** Vytvoří nebo upraví produkt (ruční zdroj). */
export async function ulozProduktAction(p: ProduktVstup) {
  await checkConfig();
  try {
    if (!DOMENY_PLATNE.includes(p.domena)) throw new Error('Neplatná doména produktu.');
    if (!p.nazev || p.nazev.trim() === '') throw new Error('Název produktu je povinný.');

    const zaznam = {
      domena: p.domena,
      poskytovatel: p.poskytovatel?.trim() || null,
      nazev: p.nazev.trim(),
      typ: p.typ?.trim() || null,
      parametry: p.parametry || {},
      zdroj: 'rucni' as const,
      aktualizovano_kdy: new Date().toISOString(),
    };

    if (p.id) {
      const { error } = await supabaseAdmin.from('produkty').update(zaznam).eq('id', p.id);
      if (error) throw new Error(`Úprava produktu selhala: ${error.message}`);
    } else {
      const { error } = await supabaseAdmin.from('produkty').insert(zaznam);
      if (error) throw new Error(`Vytvoření produktu selhalo: ${error.message}`);
    }

    revalidatePath('/admin');
    return { success: true };
  } catch (error) {
    console.error('Chyba ulozProduktAction:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/** Smaže produkt. */
export async function smazProduktAction(id: string) {
  await checkConfig();
  try {
    const { error } = await supabaseAdmin.from('produkty').delete().eq('id', id);
    if (error) throw new Error(`Smazání produktu selhalo: ${error.message}`);
    revalidatePath('/admin');
    return { success: true };
  } catch (error) {
    console.error('Chyba smazProduktAction:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}
