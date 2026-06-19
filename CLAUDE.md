@AGENTS.md

# PORADCEA_AI — referenční přehled projektu

AI asistent pro finanční poradce v ČR nad pojistnými podmínkami. Poradce nahraje PDF
podmínek pojišťoven, aplikace z nich udělá RAG bázi a umí (1) odpovídat na dotazy
výhradně z dokumentů a (2) generovat analytický podklad pro klienta.

## Stack
- **Next.js 16.2.9** (App Router, Turbopack, Server Actions) + React 19 + TypeScript
- **Tailwind v4**, lucide-react ikony
- **Supabase** (Postgres 17 + pgvector) — úložiště dokumentů, chunků a vektorů
- **Gemini API** (`@google/genai`) — embeddingy a generování

## Klíčové principy produktu (MUSÍ platit v každé funkci)
1. **Nestrannost** — doporučení z dat klienta a podmínek, ne z provize.
2. **Vysvětlitelnost** — každá odpověď ukazuje PROČ a ZDROJ.
3. **Pravdivost** — AI nikdy nevymýšlí; když neví, řekne to.
4. **Specifičnost** — návrhy šité na klienta, ne šablony.

## Mapa kódu
- `app/page.tsx` — **„Ptám se"** (chat/RAG). Volá `askChatAction`. Zobrazuje zdroje (pojišťovna, strana, % shoda) + náhled zdrojového textu.
- `app/pripad/page.tsx` — **„Řeším případ"**. Formulář profilu klienta → `generateSolutionAction` → analytický podklad v Markdownu + tisk/PDF (`window.print()`).
- `app/admin/page.tsx` — nahrávání PDF, seznam dokumentů, mazání, odkaz „Podmínky ke stažení" (z `lib/pojistovny.ts`).
- `app/actions.ts` — server actions: `getDocumentsAction`, `uploadDocumentAction`, `deleteDocumentAction`, `askChatAction`, `generateSolutionAction`.
- `app/api/check-config*` — kontrola nastavení env.
- `lib/gemini.ts` — `getEmbedding(text, taskType)` (retry+backoff na 429), `generateChatResponse`, `generateClientSolution`. Modely: embedding `gemini-embedding-001` (768 dim), chat/návrh `gemini-2.5-flash`.
- `lib/documentProcessor.ts` — `processPdf`: pdf-parse v2 → text po stránkách → chunking → embeddingy → uložení. Dokument se v DB zakládá AŽ po úspěšných embeddinzích (žádné osiřelé záznamy).
- `lib/supabase.ts` — `supabase` (anon) a `supabaseAdmin` (service role) klient + `checkEnvConfigured`.
- `lib/pojistovny.ts` — mapování pojišťovna → oficiální URL podmínek.
- `schema.sql` — tabulky `dokumenty`, `chunky`, funkce `hledej_chunky`.

## Datový model (Supabase)
- `workspaces(id, nazev, vytvoreno_kdy)` — příprava na multi-tenant; výchozí WS `00000000-…-0001`.
- `dokumenty(id, nazev, pojistovna, nahrano_kdy, pocet_chunku, workspace_id)`
- `chunky(id, dokument_id→dokumenty, obsah, embedding VECTOR(768), strana, poradi, pojistovna, nazev_dokumentu, workspace_id)`
- `hledej_chunky(dotaz_embedding, pocet=8, filtr_pojistovna=NULL, filtr_workspace=NULL)` — top-N dle cosine, volitelné filtry.
- `workspace_id` má DB default = výchozí WS (viz `VYCHOZI_WORKSPACE_ID` v `lib/supabase.ts`), takže insert kód se nemění.
- **RLS zapnuté, zatím permisivní** (service_role ji obchází) — připraveno na Supabase Auth.
- **HNSW index zrušen** → vyhledávání je přesné (exact KNN). Pro velký objem dat zvážit index + REINDEX.

## Konvence
- UI i komentáře **česky**. Pojmenování proměnných převážně česky.
- Chunking: `maxChunkLength` 3200 znaků, `overlap` 400 (laděno v ÚLOZE 1).
- Embedding: dokumenty `RETRIEVAL_DOCUMENT`, dotazy `RETRIEVAL_QUERY`, vždy 768 dim.
- Změna `.env.local` vyžaduje restart dev serveru (Next.js čte env při startu).

## Provozní fakta (viz paměť)
- Gemini klíč musí být **Tier 1 / Postpay** (free tier 429 na hromadné embeddingy).
- Supabase projekt `tlmduatxtpxloxpbcnee` v org HIGHLIFE, plný přístup přes MCP.
- Spuštění: `npm run dev` → http://localhost:3000.

## Pracovní metodika (tato fáze v0.5)
PLÁN → IMPLEMENTACE → TEST → OPRAVA → OVĚŘENÍ → další úloha. Stav v `POKROK.md`.
Nepřepisovat funkční jádro (nahrávání, RAG, „Ptám se") — jen rozšiřovat. Commit po každé úloze.
