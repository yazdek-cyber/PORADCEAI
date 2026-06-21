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
Aplikace se rozšířila z „AI nad pojistnými podmínkami" na **komplexní finanční poradenství přes
4 pilíře (penze/investice/úvěry/pojištění)** dle metodiky eDO/KFP. Detailní stav fází v `POKROK.md`
(v0.5–v0.15), předloha eDO v `docs/edo-blueprint.md`.

UI shell & design systém (v0.18):
- `components/AppShell.tsx` — **levý sidebar** se sekcemi (Domů/Poradna · Případ klienta · Znalosti & data)
  + mobilní zásuvka; nahradil horní `Navbar`. Použit v `app/layout.tsx`.
- `components/ui.tsx` — **sdílené primitivy** (`'use client'`: PageHeader, Card/CardHeader, **Karta**, Field(=Pole,
  `useId`), Stat, Radek, Badge, Button, SectionLabel) — jeden vizuální jazyk; stránky/komponenty NEmají vlastní
  duplikáty Pole/Karta/Radek. Tokeny v `app/globals.css` (shadow-soft/card/pop, sémantická zeleň).
- `lib/pripadStore.ts` — **evidence klientů + sdílený „případ"** (`usePripad()`, localStorage, BEZ serveru).
  VÍCE pojmenovaných klientů s aktivním klientem; modul-level store + `useSyncExternalStore` (všechny instance
  se synchronizují — přepínač v sidebaru ihned promítne i obsah stránky). Migrace ze single-case v0.18.
  Profil se zadá jednou v plánu a propíše se do kalkulaček (předvyplnění), Rychlého návrhu, záznamu i Domů.

Stránky (UI):
- `app/page.tsx` — **„Domů"** (dashboard/rozcestník). Dlaždice funkcí + principy + karta Aktivní případ + poslední plány.
- `app/poradna/page.tsx` — **„Poradna"** (chat/RAG, dříve na `/`). `askChatAction`. Zdroje + náhled, filtr pojišťovny.
- `app/pripad/page.tsx` — **„Pojištění — analýza z podmínek"** (zaměřeno na 1 pilíř). `generateSolutionAction`
  s RAG ZACÍLENÝM na `produktove_podminky` + doména `pojisteni` (ne metodika/postupy) → Markdown + tisk;
  předvyplní se ze sdíleného případu, cross-link na komplexní plán. Komplexní 4 pilíře řeší `/plan`.
- `app/plan/page.tsx` — **„Finanční plán"** (4 pilíře). Bohatý profil + cíle → `generujFinancniPlanAction`; lišta
  případu (načíst/uložit), auto-uložení po vygenerování;
  `components/PlanPrehled.tsx` vizuální přehled (donut, 3 metody pojištění…), `components/Markdown.tsx`, PDF.
- `app/kalkulacky/page.tsx` — **„Kalkulačky"**: 11 interaktivních kalkulaček bez dat (počítají v prohlížeči
  z `lib/kalkulacky`), 4 záložky, grafy/donut, tisk.
- `app/srovnani/page.tsx` — **„Srovnání"** (matice parametrů přes pojišťovny). `srovnejParametryAction` + export PDF.
- `app/zaznam/page.tsx` — **„Záznam z jednání"** (compliance). Z aktivního klienta předvyplní požadavky;
  poradce doplní doporučení/zdůvodnění → tisk/PDF. Identita poradce v localStorage (`poradceai:poradce`).
- `app/admin/page.tsx` — nahrávání PDF, monitor podmínek, **správa produktů** (`components/SpravaProduktu.tsx`).

Logika:
- `app/actions.ts` — server actions: dokumenty (upload/delete + validace %PDF-/limit), `askChatAction`,
  `generateSolutionAction`, `generujFinancniPlanAction`, `srovnejParametryAction`, monitor podmínek,
  produkty CRUD. SSRF allowlist `jeBezpecnaUrl` u importu.
- `lib/kalkulacky/` — **čisté deterministické kalkulačky** (uvery, investice, penze, pojisteni) — zdroj všech
  čísel; testy `kalkulacky.test.ts` (`npm test`). Dle metodiky KFP (Morningstar alokace, výnosy, ×200, EFPA).
- `lib/financniPlan.ts` — `pripravPodklady` (předpočet kalkulaček z profilu) + `formatujPodklady`.
- `lib/sazby/` — `SazbyProvider` (ruční/scraping/api) pro parametry produktů.
- `lib/gemini.ts` — embeddingy (retry), `generateChatResponse/ClientSolution/FinancniPlan` (čísla nepočítá,
  bere z podkladů), OCR, url_context. Prompty zpevněné proti injection (kontext=data).
- `lib/documentProcessor.ts` — `processPdf` (+ OCR, paralelní embeddingy) a `processText` (text→RAG).
- `lib/domeny.ts` — 4 pilíře + schéma parametrů produktů. `lib/supabase.ts`, `lib/pojistovny.ts`, `lib/podminkyScraper.ts`.
- `scripts/scraper/` — Playwright scraper portálu (login se session, odchyt API) — pro budoucí napojení eDO.
- `schema.sql` — `dokumenty`, `chunky` (+`domena`), `produkty`, `klienti`, `financni_plany`, `hledej_chunky`.

## Datový model (Supabase)
- `workspaces(id, nazev, vytvoreno_kdy)` — **tenant = firma** (multitenant). 1. tenant `00000000-…-0001` = „eDO".
  Firmu (postupy, produkty, klienty, plány) drží `workspace_id`. eDO je DATA, ne natvrdo v kódu.
- **Tři nezávislé osy dokumentu**: `domena` (4 pilíře) × `pojistovna` (= POSKYTOVATEL: pojišťovna/banka/
  investiční či penzijní spol./fond) × `kategorie` (ROLE v RAG).
- **`kategorie`** (`lib/kategorie.ts`): `postup_firmy` (závazný systém práce firmy) · `metodika` (odborná —
  KFP/EFPA/AFP, jak počítat + poučky) · `produktove_podminky` (podmínky produktů napříč pilíři). Default `produktove_podminky`.
- `dokumenty(id, nazev, pojistovna, domena, kategorie, nahrano_kdy, pocet_chunku, workspace_id)`
- `chunky(id, dokument_id→dokumenty, obsah, embedding VECTOR(768), strana, poradi, pojistovna, nazev_dokumentu, domena, kategorie, workspace_id)`
- `hledej_chunky(dotaz_embedding, pocet=8, filtr_pojistovna=NULL, filtr_workspace=NULL, filtr_domena=NULL, filtr_kategorie=NULL)`
  — top-N dle cosine, volitelné filtry (vč. kategorie). POZOR: měnit přes DROP+CREATE (jinak přetížení).
- Admin: dokumenty seskupené po kategoriích + přeřazení (`updateDokumentMetaAction` přepíše i `chunky`).
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
