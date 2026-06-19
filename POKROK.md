# POKROK — Fáze v0.5

Stav rozšíření alfy na funkční produkt. Legenda: ⬜ čeká · 🔄 probíhá · ✅ hotovo · ⛔ bloker

## Výchozí audit (hotovo)
Zmapováno do `CLAUDE.md`. Zjištění:
- „Ptám se" + RAG funguje, zobrazuje zdroje.
- „Řeším případ" (ÚLOHA 4) je z velké části **už hotová** — formulář profilu + `generateSolutionAction`.
- Tisk/PDF (ÚLOHA 5) existuje přes `window.print()`.
- Retry na 429 (část ÚLOHA 6) hotová.

## Úlohy
| # | Úloha | Stav | Poznámka |
|---|-------|------|----------|
| 1 | Audit a stabilizace jádra | ✅ | Práh podobnosti 0.65 + zkratka „nenašel jsem"; 5-dotazový test prošel |
| 2 | OCR fallback pro skeny | ✅ | Detekce skenu + dávkové OCR přes Gemini vision (po 15 str.); test 6/6 |
| 3 | Vícezdrojové vyhledávání (filtr pojišťoven) | ✅ | `hledej_chunky` + filtr; rozbalovátko v „Ptám se"; test napříč/na 1 prošel |
| 4 | „Řeším případ" | ✅ | Ověřeno na 3 profilech: specifické, podložené, disclaimer; + práh relevance |
| 5 | Export návrhu do PDF | ✅ | „Exportovat do PDF" + zdroje a patička v tisku; vizuál = uživatelský klik |
| 6 | Kvalita a spolehlivost (hardening) | ✅ | Retry (embed/chat/návrh/OCR), validace souboru, error boundary, graceful chyby |
| 7 | Příprava na multi-tenant | ✅ | workspaces + workspace_id (DB default), RLS permisivní, filtr v hledej_chunky; test izolace OK |

## Akceptační kritérium fáze — VŠE SPLNĚNO ✅
1. ✅ „Ptám se" přesné odpovědi se zdroji, nevymýšlí (práh 0.65, test 5 dotazů)
2. ✅ Skeny přes OCR (Gemini vision, dávkově)
3. ✅ Srovnání více pojišťoven (filtr + napříč zdroji)
4. ✅ „Řeším případ" specifické podložené návrhy (3 profily otestovány)
5. ✅ Export do PDF (zdroje + patička)
6. ✅ Nepadá při chybách (retry, validace, error boundary)
7. ✅ Model připraven na multi-tenant (workspaces, RLS, izolace ověřena)

## Blokery / poznámky
- **OCR je pomalé** (~15–20 s/strana). Velký sken (50+ stran) = několik minut. V produkci
  (serverless timeout) by velké skeny mohly vypršet — zvážit frontu/job. Pro dev OK.
- **Live status OCR** (spec „zpracovávám přes OCR…") je zatím POST-HOC: hláška se ukáže po
  dokončení (`pouzitoOcr` flag), ne živě během. Živý stav vyžaduje streaming — pozdější UI vylepšení.
- **Monitor — délka skenu**: plný sken 6 pojišťoven trval ~587 s. Vercel serverless má limit
  300 s → v produkci by se musel sken rozdělit (1 pojišťovna/volání, fronta) nebo běžet na
  prostředí s delším limitem. Cron endpoint funguje, jen pozor na timeout.
- **Monitor — filtr**: bere JEN pojistné podmínky životního pojištění (prompt + post-filtr na
  „podmínk" v názvu). Allianz 380→28, Kooperativa→30 (samé VPP/ZPP/DPP). DB vyčištěna a přeskenována.
- **Monitor — pokrytí**: UNIQA/ČPP mají dokumenty hlouběji (chce cílenější URL); Kooperativa
  občas vrátí 0 (flakita `url_context` → retry).

## Log
- Založen CLAUDE.md + POKROK.md, git baseline.
- **ÚLOHA 1 ✅** — Změřeno rozložení podobností: relevantní 72–79 %, irelevantní ≤ 59 %.
  Přidán práh `MIN_PODOBNOST = 0.65` v `askChatAction` + zkratka (bez volání Gemini)
  když nic relevantního. Test 5 dotazů (3 v dok / 2 mimo) prošel: zdroje sedí, mimo dok
  „nenašel jsem" bez falešných zdrojů. Systémový prompt už striktní — beze změny.
  Chunking (3200/400) dává dobrou separaci — ponechán.
- **ÚLOHA 2 ✅** — Detekce skenu (<40 zn./str.) → dávkové OCR po 15 str. (pdf-lib + gemini-2.5-flash).
- **ÚLOHA 3 ✅** — hledej_chunky + filtr_pojistovna; rozbalovátko v „Ptám se"; srovnání napříč OK.
- **ÚLOHA 4 ✅** — generateSolutionAction + práh; retry generování (ECONNRESET); 3 profily odlišné/podložené.
- **ÚLOHA 5 ✅** — „Exportovat do PDF" + zdroje a patička v tisku.
- **ÚLOHA 6 ✅** — retry (embed/chat/návrh/OCR), validace souboru klient+server, app/error.tsx.
- **ÚLOHA 7 ✅** — workspaces + workspace_id (DB default) + RLS permisivní + filtr; izolace ověřena.

## FÁZE v0.5 DOKONČENA — všech 7 úloh hotovo a zacommitováno (8 commitů).

## NAVÍC: Monitor podmínek pojišťoven (nová funkce)
Automatický „lovec" podmínek — projde weby pojišťoven, AI rozpozná produkty/dokumenty,
nabídne import v adminu a hlídá změny.
- **Scraper** (`lib/podminkyScraper.ts`): tier 1 statický fetch + AI extrakce; tier 2 fallback
  Gemini `url_context` (renderuje i JS weby). Test: NN 42 dok (statický), Kooperativa 92 (url_context).
- **Pojišťovny** (`lib/pojistovny.ts`): Kooperativa, NN, Generali, UNIQA, Allianz, ČPP.
- **DB**: tabulka `dostupne_podminky` (snapshot, stav nova/zmenena/importovana, RLS permisivní).
- **Akce**: `zkontrolujPodminkyAction` (sken + detekce změn), `getDostupnePodminkyAction`,
  `importujPodminkuAction` (stáhne PDF → standardní pipeline).
- **Hlídání**: ruční tlačítko v adminu + `app/api/cron/check-podminky` + `vercel.json` cron
  (denně 06:00, zapne se při nasazení; chráněno `CRON_SECRET`).
- **UI**: sekce „Podmínky pojišťoven (monitor)" v adminu — seznam s odznaky 🆕/✏️/✅ + import 1 klikem.

## v0.6 — výkon a hardening (navazuje na blockery v0.5)

| # | Zlepšení | Stav | Ověření |
|---|----------|------|---------|
| A | Paralelní embeddingy při zpracování PDF | ✅ | build + test poolu (pořadí zachováno, souběh ≤ 5, edge prázdné pole) |
| B | Monitor: sken po JEDNÉ pojišťovně | ✅ | živě: NN 34 s, neznámá pojišťovna → graceful chyba |
| C | Scraper: časový rozpočet + strop na 1 volání | ✅ | živě: UNIQA dřív visela 18+ min → teď ohraničeno na ~200 s, vrací graceful |

### Detaily
- **A — `lib/documentProcessor.ts`**: embeddingy se generovaly sekvenčně (`await` v cyklu) —
  hlavní brzda u velkých/OCR dokumentů (desítky–stovky chunků). Přidán `mapSOmezenim`
  (pool se souběhem 5, zachovává pořadí). 429 řeší existující retry uvnitř `getEmbedding`.
  Mitiguje blocker „OCR pomalé / serverless timeout u velkých skenů".
- **B — `app/actions.ts` + admin + cron + `lib/pojistovny.ts`**: `zkontrolujPodminkyAction(filtr?)`
  umí skenovat jednu pojišťovnu. Admin UI iteruje po jedné s průběžným stavem („Kontroluji X… 2/6").
  Cron přijímá `?pojistovna=<slug>`; `vercel.json` má 6 cronů (po jedné, rozložené 06:00–06:50).
  Každé volání krátké → řeší blocker „plný sken ~587 s > Vercel 300 s". Přidán `slug` k pojišťovnám.
- **C — `lib/gemini.ts` + `lib/podminkyScraper.ts`**: `url_context` volání občas viselo i 18 min
  (Gemini vrací dočasné chyby, retry × pomalé volání). Přidán `httpOptions.timeout` 80 s na jedno
  volání + `abortSignal` (deadline) + celkový rozpočet `ROZPOCET_MS` 200 s na pojišťovnu;
  `generujSOpakovanim` po vypršení rozpočtu přestane opakovat. Sken se už nikdy nezasekne přes limit.

### Otevřené (nižší priorita / vyžaduje další iteraci)
- **Coverage UNIQA/ČPP/Kooperativa**: `url_context` proti těmto JS webům aktuálně vrací 0
  (Gemini hlásí dočasné chyby). Chce cílenější URL listingu dokumentů, případně jiný renderer.
  Per-insurer + rozpočet zajistily, že to aspoň nezasekne sken — ale dokumenty z těchto webů
  zatím nepřibývají. NN (statický tier 1) funguje spolehlivě (12 dok).
- **Live status OCR** (spec): stále post-hoc (hláška po dokončení), ne živě — chce streaming.
- **Plné přihlášení (fáze 2)**: ZÁMĚRNĚ neimplementováno. Spec ho řadí do další fáze a plné Auth
  by rozbilo dnes funkční anonymní tok (login UI, session, RLS na auth.uid()). Datový model je
  připraven (workspaces, workspace_id, RLS) — migrace zůstává bezbolestná. Udělat jako cílený krok.
