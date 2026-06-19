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

## v0.7 — ROZŠÍŘENÍ NA CELÉ FINANČNÍ PORADENSTVÍ (4 pilíře) — SKELET

Cíl (zadání uživatele): z „AI nad pojistnými podmínkami" udělat komplexního AI poradce přes
**🏦 PENZE · 📈 INVESTICE · 🏠 ÚVĚRY · 🛡️ POJIŠTĚNÍ** s propojením do kalkulaček a automatickým
finančním plánem. Postaven celý skelet najednou; jednotlivé „frakce" se doladí.

**Klíčový princip:** AI nepočítá čísla. Tři vrstvy — (1) znalost (RAG + strukturované produkty),
(2) deterministické kalkulačky, (3) AI orchestrace, která z kalkulaček složí plán se zdroji.

| # | Část | Stav | Ověření |
|---|------|------|---------|
| 4 | Kalkulačky (4 pilíře) | ✅ | 36/36 testů (tsx): anuita, RPSN, Monte Carlo, DIME, DPS, mezera v důchodu |
| 5 | Datový model (domény + produkty + plány) | ✅ | aditivní migrace; RAG beze změny (82 % shoda); 382 chunků = pojisteni |
| 6 | Zdroje sazeb (ruční/scraping/API) | ✅ | typecheck; ruční čte z `produkty`, scraping+API zapojené stuby |
| 7 | AI orchestrace finančního plánu | ✅ | živě: čísla z kalkulaček, zdroje z podmínek (Kooperativa s.46), disclaimer, plán 8k |
| 8 | UI: stránka /plan + doména v adminu + Navbar | ✅ | build OK, /plan HTTP 200, navbar odkaz |

### Mapa nového kódu
- `lib/kalkulacky/` — `uvery.ts` (anuita, splátkový kalendář, DSTI/DTI/LTV, refinancování, RPSN),
  `investice.ts` (FV, TER dopad, **Monte Carlo** p10/p50/p90 + pravděpodobnost cíle, **srovnání forem**),
  `penze.ts` (DPS státní příspěvek 2024, projekce, renta, mezera), `pojisteni.ts` (rezerva, DIME),
  `kalkulacky.test.ts` (spustit `npx tsx lib/kalkulacky/kalkulacky.test.ts`).
- `lib/domeny.ts` — 4 pilíře (id/název/ikona).
- `lib/sazby/` — `SazbyProvider` rozhraní + ruční (DB `produkty`) / scraping (stub) / api (stub).
- `lib/financniPlan.ts` — `FinPlanProfil`, `pripravPodklady()` (předpočet kalkulaček z profilu +
  produkty/defaulty), `formatujPodklady()`.
- `lib/gemini.ts` — `generateFinancniPlan()` (syntéza z podkladů, čísla nepočítá, dokládá zdroji).
- `app/actions.ts` — `generujFinancniPlanAction()` (předpočet + RAG + syntéza + uložení do `financni_plany`).
- `app/plan/page.tsx` — bohatý profil (4 pilíře) → plán + rozklikávací podklady + zdroje + PDF.
- `components/Markdown.tsx` — sdílený renderer.
- DB: `dokumenty.domena`/`chunky.domena` (default pojisteni), `hledej_chunky(..., filtr_domena)`,
  tabulky `produkty` / `klienti` / `financni_plany` (RLS permisivní).

### Otevřené k doladění „frakcí" (další iterace)
- **Parametry DIME/horizonty**: roky náhrady příjmu nyní hrubě (18 let při dětech) — zjemnit dle věku dětí.
- **Sazby produktů**: ✅ UI správy produktů v adminu HOTOVO (`components/SpravaProduktu.tsx` +
  akce `getProduktyAction`/`ulozProduktAction`/`smazProduktAction`; schéma polí `PARAMETRY_DOMENY`
  v `lib/domeny.ts`, procenta se ukládají jako desetinné). Ověřeno: produkt se sazbou 3,9 % se
  propsal do `pripravPodklady` (refinancování přepočítáno). Zbývá naplnit reálnými sazbami nebo
  dokončit scraping/API providery. Defaulty (hypo 4,9 %, formy ETF/fond/DPS) platí, dokud DB prázdná.
- **RAG napříč doménami**: zatím data jen pro pojištění. Po nahrání úvěrových/investičních dokumentů
  s `domena` se plán doloží i jejich zdroji.
- **Function calling**: orchestrace je deterministický předpočet + syntéza (robustní). Ad-hoc what-if
  scénáře přes Gemini tools jsou přirozené rozšíření.
- **Admin: správa produktů** (CRUD nad `produkty`) a **uložené plány/klienti** — UI zatím chybí.

## v0.8 — Knowledge base z eDO metodiky (naimportováno)

RAG knowledge base naplněna metodikou eDO (doména `metodika`/`investice`/`uvery`, BEZ osobních
dat klientů — jen postupy/metodika). Ověřeno retrievalem (75–78 % shoda na metodické dotazy).

**Naimportováno (12 dokumentů, ~103 chunků):**
- EFPA Metodika pojištění osob (43) — výpočet pojistných částek (klíčové pro kalkulačky)
- EFPA Metodika pojištění vozidel (29)
- eDO Průvodce START — onboarding (20)
- Smluvní dokumentace manuál, Nejčastější chyby eSD, Přestupkový řád, NSURE, Kariérní plán,
  Metodika finanční analýzy, Prodejní skripty, mBank úvěry (bonita/příjmy), Modelová portfolia eDO

**Produkty (živé v plánu):** 3 eDO investiční strategie (konzervativní 4,5 % / vyvážená 5,5 % /
dynamická 8 %) — používá je investiční srovnání ve finančním plánu.

**Nástroje k naplnění:** `lib/documentProcessor.processText` (text→RAG), `scripts/ingest-metodika.ts`
(drop-folder PDF). Velké Drive dokumenty se nabírají přes konektor → uložený soubor → processText
(neprotéká kontextem AI).

**Zbývá (volitelně):** produktové dotazníky (2.Produktové dotazníky), akademie/know-how složky;
živá data produktů/sazeb z portálů eDO přes `scripts/scraper/odchyt-api.ts` (vyžaduje login uživatele).

### v0.8 doplněno — produktové dotazníky + akademie (jádro metodiky)
Přidáno do RAG (celkem 16 eDO dokumentů): produktové dotazníky (ŽP/HÚ/investice/DPS — co zjišťovat
od klienta), EFPA Metodika pojištění osob (43) a vozidel (29), eDO START (20), TAHÁK potřeby klienta
po oblastech, EFPA daňové aspekty (úlevy/paušály), Handbook pro poradce (produktový slovník), mBank úvěry.
ZÁMĚRNĚ vynecháno (off-topic/objemné, lze později přes drop-folder): marketing/nábor/osobní značka/
soft-skills PDF, deep investiční akademie (16 podsložek burzovní vzdělávání), videa. Osobní data klientů NE.

### v0.8 doplněno (2) — Akademie finančního plánování + zajištění (20 eDO dokumentů)
Přidána KOMPLETNÍ metodika finančního plánování (KFP/EFPA):
- Finanční mapa (metodika první schůzky: hodnoty→cíle→zdroje→závěr; pořadí dotazování)
- Zpracování plánu (renta 1 mil.=5000 Kč/měs; pořadí: rizika→hypotéka→cíle→renta; dlouhé cíle=dlouhé zdroje)
- Metodiky a alokace (Morningstar alokace dle horizontu; historické reálné výnosy akcie 7,27 %/dluhopisy 1,81 %; co ohrožuje plán)
- Poradenská metodika zajištění EFPA (koeficient 200; sociální dávky; TNÚ=½; likvidní rezerva 3/6/12×)
- Handbook (produktový slovník), TAHÁK potřeby klienta, daňové aspekty, produktové dotazníky
Tyto metodiky jsou připravené i k DOLADĚNÍ KALKULAČEK (Morningstar alokace dle věku/horizontu, renta=200×,
výnosy 4,6 %/5 %, koeficient 200 pro pojistnou potřebu, likvidní rezerva 6×) — přirozený další krok.

## v0.9 — kalkulačky doladěny dle metodiky eDO/KFP
Kalkulačky i finanční plán nyní počítají přesně podle ingestované metodiky:
- Alokace dle horizontu (Morningstar tabulka), reálné výnosy (akcie 7,27 %/dluhopisy 1,81 %),
  očekávaný výnos cíle/renty (AFP glide-path) → investiční projekce.
- Renta dle pravidla KFP ×200 (1 mil. Kč = 5 000 Kč/měs).
- Pojistná potřeba metodou EFPA (koeficient 200 − sociální dávky invalidní/sirotčí/vdovský, TNÚ ½)
  vedle metod DIME a eDO (3× příjem).
- Likvidní rezerva 3/6/12× výdaje (KFP konsensus 6×).
58/58 testů, build OK, ověřeno živě.

## v0.10 — maximum bez loginu: cíle klienta + plán ve struktuře eDO
- Kalkulačka kolikInvestovat (jak splnit cíl: jednorázově/měsíčně dle horizontu).
- Profil má cíle (CO/KDY/KOLIK); plán počítá per cíl alokaci (Morningstar) a výnos (AFP) → kolik investovat.
- AI plán generován ve struktuře a pořadí eDO/KFP: Shrnutí → Rezerva → Pojištění (DIME+eDO+EFPA) →
  Úvěry → Cíle → Investice (alokace/výnos) → Penze/renta (×200) → Priority (rizika→hypotéka→cíle→renta).
- /plan UI: dynamické zadání cílů. 61/61 testů, build OK.
- Ověřeno živě: plán 9,8k znaků, 7 sekcí, 8 zdrojů, disclaimer, cituje metodiku.
LOGIN do živých portálů eDO = až úplně nakonec (na přání uživatele).
