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

## v0.11 — workflow audit kalkulaček + opravy
Spuštěn multi-agent workflow audit (30 agentů, 4 dimenze + adversariální verifikace) →
15 potvrzených nálezů (z toho 4 duplikáty DTI). Opraveno:
- HIGH: kolikInvestovat dělení nulou (horizont 0).
- DTI v maxUver nově odečítá stávající jistinu dluhu (nenadhodnocuje kapacitu úvěru).
- Sjednoceny reálné výnosy (RIZIKO 2,5/4,5/6,5 % reálně); celý plán v dnešní hodnotě.
- Monte Carlo guard (pocetSimulaci/n → žádné NaN); EFPA deficit invalidity 1,2×;
  rezerva default 6×; rokyNahrady vyčištěno; TNÚ komentář upřesněn.
GDPR (dokumentačně): profil jde do Gemini pro plán → produkčně DPA s Googlem + informovat klienty.
+3 regresní testy. 64/64 testů, build OK.

## v0.12 — workflow audit UI + orchestrace + opravy
2. kolo multi-agent auditu (26 agentů, 4 dimenze: React/stav, UX, orchestrace, bezpečnost) → 19 potvrzených.
Opraveno:
- UI: tisk PDF skrývá Navbar (globální @media print), reálné výnosy v popiscích, kopírování s ošetřením
  chyby, stabilní React key u cílů, label↔input (htmlFor), role=alert.
- Orchestrace: validace věk odchodu, Monte Carlo výnos+volatilita z jedné alokace, zachycení chyby insertu.
- Bezpečnost: SSRF allowlist domén u importu PDF, autorizace import/cron endpointů + fail-closed na produkci,
  prompt-injection hardening (kontext=data), upload limit 25 MB + ověření %PDF- signatury, oprava SQL v adminu.
ODLOŽENO na login-fázi: plná autentizace adminu a mutujících akcí (Supabase Auth).
64/64 testů, build OK.

## v0.13 — dotažení bez loginu (srovnání UX, npm test, e2e verifikace)
- Srovnání: Export PDF + Kopírovat (tab tabulka), prázdný stav, varování „vše Neuvedeno", tisk jen matice.
- package.json: `npm test` (tsx) + tsx jako devDependency → snadné spouštění/CI.
- End-to-end ověření přes Playwright: /plan vygeneruje reálný plán (UI→akce→kalkulačky→RAG→Gemini→render),
  ověřen vizuální přehled, alokace, AI plán (sekce), 3 metody pojištění i panel zdrojů. Plán OK, bez chyb
  (zdánlivý „alert" byl jen Next.js dev overlay s prázdným textem). Screenshot potvrdil profesionální výstup.
64/64 testů, build OK.

## v0.14 — interaktivní kalkulačky (samostatné, bez dat) + UI
Nová stránka /kalkulacky (jako kalkulačky KFP) — 9 živých kalkulaček ve 4 záložkách, počítají
v prohlížeči z čistých funkcí lib/kalkulacky (žádné AI/RAG/data, okamžitý přepočet):
Úvěry (hypotéka, max. úvěr, refinancování), Investice (Monte Carlo projekce + alokace, kolik na cíl),
Renta & penze (finanční nezávislost ×200, DPS), Pojištění & rezerva (3 metody pojistné potřeby, rezerva 3/6/12×).
Konzistentní karty, alokační pruhy, položka v Navbaru. Ověřeno e2e (změna vstupu → přepočet). Build OK.

## v0.15 — rozšíření kalkulaček + vizuál + tisk
- Hypotéka: SVG graf zůstatku úvěru v čase.
- Nová kalkulačka „Srovnání forem a poplatků" (ETF/aktivní fond/IŽP — vliv TER na výsledek).
- Nová kalkulačka „Daňová úspora" (DPS+ŽP: odečet, 15 %, státní příspěvek; orientačně limity 2024).
- Alokace jako donut (SVG koláč) místo pruhu napříč investičními kalkulačkami.
- Tlačítko Tisk na /kalkulacky (window.print + print:hidden na ovládání).
Celkem 11 interaktivních kalkulaček bez nutnosti dat. Ověřeno e2e, build OK.

## v0.16 — splátkový kalendář (tabulka), sjednocené vizuály, aktualizace CLAUDE.md
- Hypotéka: rozklikávací splátkový kalendář po letech (úroky/úmor/zůstatek), k tisku.
- Sdílené vizuály `components/Vizualy.tsx` (Donut, AlokaceVizual, MiniGraf); plán i kalkulačky je sdílí.
- Investiční projekce: graf očekávaného růstu. CLAUDE.md mapa kódu zaktualizována na současný stav.
Build OK, e2e OK.

## v0.17 — uložené plány + 3. kolo auditu (oprava nálezů)
- Uložené plány: `app/plany/page.tsx` (seznam + detail s PlanPrehled + Markdown + tisk + smazání), akce `getUlozenePlany/getUlozenyPlan/smazUlozenyPlan`.
- Audit #3 (multiagentní, nový kód) — opraveny 4 potvrzené nálezy:
  - [vysoká] Prázdné `vypocty {}` z DB (DEFAULT '{}') shazovalo PlanPrehled → validace tvaru v `/plany` + guard v `PlanPrehled`.
  - [střední] Nesoulad alokace (donut) vs. výnos: glide-path výnos vs. statická alokace → sjednoceno na `ocekavanyVynosDleHorizontu` (vážený výnos zobrazené alokace) v Projekce/Cíl/Renta i ve `financniPlan` (výnos↔volatilita↔MC z jednoho zdroje).
  - [nízká] PenzeKalk tiché `Math.max` přepsání věku → viditelné varování, UI = vstup.
  - [nízká] Pevný výnos 4,5 % → volitelné pole „Výnos" (default 3 % reálně) + poznámka ke strategii fondu.
Testy 64/64, TSC 0, build OK.

## v0.18 — přepracování UI: sidebar shell + Domů dashboard + propojení případu klienta
Zadání uživatele: „vyladit celkové UI (nelíbí se) a lépe logicky spojit". Tři fáze:
- **A — Design systém**: svěžejší tokeny v `globals.css` (měkčí stíny shadow-soft/card/pop, sémantická
  zeleň, vzdušný gradient, zaoblenější rádiusy) + sdílené primitivy `components/ui.tsx`
  (PageHeader, Card, Field, Stat, Radek, Badge, Button, SectionLabel) → jeden vizuální jazyk.
- **B — Shell & navigace**: `components/AppShell.tsx` (levý sidebar se sekcemi Domů/Poradna ·
  Případ klienta · Znalosti & data + mobilní zásuvka) nahradil horní `Navbar`. Nové `/` = **Domů
  dashboard** (rozcestník + principy + poslední plány). Chat přesunut z `/` na `/poradna`.
  Doplněny dříve „ztracené" Uložené plány do navigace.
- **D — Propojení případu (datově)**: `lib/pripadStore.ts` (`usePripad()`, localStorage, BEZ serveru —
  reálná data klienta neopouštějí prohlížeč). Profil se zadá jednou ve `/plan` (lišta Uložit/Načíst +
  auto-uložení po vygenerování), propíše se na **Domů** (karta Aktivní případ), do **/kalkulacky**
  (banner + „Předvyplnit z případu" → hypotéka/max. úvěr/renta/penze přes context+remount klíč) a do
  **/pripad** (Rychlý návrh se předvyplní; cross-link na plný plán). Heading sjednocen na „Rychlý návrh".
Ověřeno e2e (Playwright): uložení v plánu → karta na Domů → banner v kalkulačkách → hypotéka
3 000 000 → 2 800 000 po předvyplnění. Starý `Navbar.tsx` odstraněn. 64/64 testů, TSC 0, build 13 rout OK.

### Zbývá (volitelné doladění)
- Plné sloučení Plán + Rychlý návrh do jednoho průvodce (zatím propojeno cross-linkem + sdíleným případem).
- Refaktor zbylých stránek plně na `components/ui` (vizuál už drží přes sdílené tokeny).
- Chat na /poradna: dotáhnout fill-height pod novým shellem.

### Roadmapa k ostrému provozu (další velký krok — po dohodě)
1. **Login fáze (Supabase Auth)** — ZÁMĚRNĚ odložená na konec. Datový model připraven (workspaces,
   workspace_id, RLS). Přidat: login UI, session, RLS na `auth.uid()`, ochrana admin/mutací.
2. **Reálná data/sazby produktů** — naplnit `produkty` (hypo sazby, investiční formy) ručně nebo přes
   scraping/API provider; RAG napříč doménami po nahrání úvěrových/investičních dokumentů.
3. **Nasazení (Vercel)** — env, cron limity (sken po 1 pojišťovně), DPA s Googlem (GDPR profil→Gemini).

## v0.19 — evidence klientů + záznam z jednání (přidaná hodnota pro denní použití)
Po strategické rozvaze (přidaná hodnota / mezery / trh) přidány dvě funkce, co dělají z dema nástroj,
BEZ překročení hranice soukromí (vše v prohlížeči, nic se neodesílá):
- **Evidence klientů** — `lib/pripadStore.ts` rozšířen ze single-case na VÍCE pojmenovaných klientů
  s aktivním klientem. Modul-level store + `useSyncExternalStore` → všechny instance `usePripad`
  ve stejném dokumentu se synchronizují (oprava nalezeného bugu: přepínač vs. obsah stránky byly
  rozsynchronizované, protože `storage` event se v jednom dokumentu nespouští). Migrace ze v0.18.
  Přepínač klientů v `AppShell` (sidebar): přepnout / nový / přejmenovat / smazat. Pole „Jméno klienta"
  v plánu. Formuláře (plán/Rychlý návrh/záznam) se znovu načtou při PŘEPNUTÍ klienta (klíčeno na `aktivniId`).
- **Záznam z jednání** — `app/zaznam/page.tsx` (v ČR povinný dle zákona o distribuci). Z aktivního
  klienta předvyplní požadavky/situaci; poradce doplní doporučení, zdůvodnění vhodnosti, poučení o
  rizicích → tisk/PDF s podpisovými poli. Identita poradce uložena (`poradceai:poradce`).
Ověřeno e2e (Playwright): jméno→uložení→přepínač, nový klient, předvyplnění záznamu, synchronizace
karty na dashboardu po přepnutí bez reloadu. 64/64 testů, TSC 0, build 14 rout OK.

## v0.20 — struktura knowledge base: kategorie dokumentů + multitenant rámec
Zadání uživatele: podklady nejsou jen pojistné podmínky — je potřeba je lépe strukturovat, eDO je
FIRMA (ne pojišťovna), kde je uživatel vázaný zástupce; oddělit „co dává firma" (postupy) od „dat",
a celé to musí být multitenant (editovatelné, ne natvrdo eDO). První krok = struktura dokumentů:
- **3 kategorie** (`lib/kategorie.ts`, nezávislá osa na doméně i poskytovateli): `postup_firmy`
  (závazný systém práce firmy) · `metodika` (odborná KFP/EFPA/AFP) · `produktove_podminky` (podmínky
  produktů NAPŘÍČ pilíři — pojistné/úvěrové/investiční/penzijní; pilíř určuje `domena`, poskytovatele `pojistovna`).
- **DB migrace**: `kategorie` do `dokumenty`+`chunky` (default produktove_podminky) + backfill (23 dok →
  postup_firmy 11 / metodika 10 / produktove_podminky 2) + `hledej_chunky` rozšířeno o `filtr_kategorie`.
  POZOR vyřešeno: CREATE OR REPLACE s novým parametrem vytvořil PŘETÍŽENÍ → starou 5-arg verzi nutno DROPnout
  (jinak PostgREST hlásí nejednoznačnost a RAG spadne). Ověřeno: zůstala 1 funkce, chat RAG OK.
- **Multitenant rámec**: workspace = tenant = firma; výchozí WS přejmenován na „eDO" (1. tenant). Kód generický.
- **Insert cesta**: `processPdf`/`processText` + `uploadDocumentAction` přijímají `kategorie`.
- **Admin**: výběr kategorie při nahrání + seznam SESKUPENÝ po kategoriích + přeřazení 1 klikem
  (`updateDokumentMetaAction` přepíše dokument i chunky). Poskytovatel místo „pojišťovna".
Ověřeno e2e (admin 3 skupiny 11/10/2, chat RAG vrací zdroje bez chyby). 64/64 testů, TSC 0, build OK.

### Zbývá v této ose (návazný krok)
- ✅ **Plán/orchestrace používá kategorie RŮZNĚ** (v0.21).
- ✅ **eDO-vizuál plánu** (v0.22).
- Rozlišit Plán vs Rychlý návrh (zúžit Rychlý návrh na „Pojištění — analýza z podmínek").
- Per-tenant: poskytovatelé/produkty/branding vázané na workspace (až s login fází).

## v0.21 — orchestrace plánu podle kategorií (každá kategorie hraje jinou roli)
4. bod „struktury": finanční plán už netáhne jeden smíchaný balík chunků, ale RAG PO KATEGORIÍCH:
- `generujFinancniPlanAction` (actions.ts): 2 embeddingy (situace klienta + metodický dotaz) → 3 RPC
  `hledej_chunky` s `filtr_kategorie`: produktove_podminky (situace, práh 0,65, 8) · postup_firmy
  (metodický dotaz, práh 0,5, 4) · metodika (metodický dotaz, práh 0,5, 5). Spojené do contextu (≤17).
- `generateFinancniPlan` (gemini.ts): contextChunks nesou `kategorie`, prompt je rozdělí do TŘÍ sekcí
  s odlišnou rolí: POSTUP FIRMY = závazná kostra/pořadí (přednost před obecnou metodikou) · ODBORNÁ
  METODIKA = jak počítat + vkládat **Poučky** pro klienta · PRODUKTOVÉ PODMÍNKY = doložená fakta (cituj).
  Obecná metodika eDO/KFP zůstává jako fallback, když postup_firmy/metodika chybí.
- Plan UI: panel přejmenován „Zdroje z podmínek" → „Použité podklady" (obsahuje i metodiku/postupy).
Ověřeno e2e: plán bez chyby, 6 poučky (z metodiky, vč. citace), citace produktů (Kooperativa s.46/76),
všechny sekce, reálná čísla z kalkulaček, 17 zdrojů (8/4/5). 64/64 testů, TSC 0, build OK.

## v0.22 — eDO-vizuál plánu (interaktivní dokument: formičky, poučky, ikony)
Výstup finančního plánu už není plochý Markdown, ale interaktivní eDO-dokument:
- `components/PlanDokument.tsx`: AI Markdown se rozdělí na SEKCE-„formičky" dle `## ` nadpisů
  (fallback na `### `), každá s ikonou pilíře (rezerva/pojištění/úvěr/cíle/investice/penze/priority)
  a rozklikávací (chevron); v tisku vždy rozbalené (`hidden print:block`). Intro (disclaimer + shrnutí) nad sekcemi.
- `components/Markdown.tsx` rozšířen: **Poučky** jako vizuální callout (žárovka, accent box) — ořezává
  `**` kolem labelu, zachová vnitřní tučné; **Akční krok / Odůvodnění / Pozor / Tip** jako barevné štítky.
- `lib/gemini.ts`: prompt vynucuje hlavní sekce jako H2 (`## `), bez vlastního titulku — aby se
  deterministicky rozdělily na formičky. Poučky uvádět řádkem „Poučka: ".
- Použito na `/plan` i `/plany` (uložené plány); `/pripad` má vlastní render (beze změny).
Ověřeno e2e: plán = 8 formiček (Shrnutí→Priority) + 6 poučky-calloutů + citace, čísla z kalkulaček.
64/64 testů, TSC 0, build OK.

## v0.23 — zúžení „Rychlého návrhu" na „Pojištění — analýza z podmínek"
Vyřešen překryv Plán vs Rychlý návrh (uživatel nevěděl, kdy použít kterou):
- `/pripad` přejmenováno na **„Pojištění — analýza z podmínek"** (nadpis, sidebar = ikona ShieldCheck,
  dashboard dlaždice). Cross-link „Komplexní finanční plán →" na `/plan`.
- `generateSolutionAction`: RAG ZACÍLEN na `filtr_domena='pojisteni'` + `filtr_kategorie='produktove_podminky'`
  → analýza stojí jen na pojistných podmínkách (ne metodika/postupy firmy). Chybová hláška upřesněna.
Role je teď jasná: `/pripad` = rychlá analýza pojistné ochrany z podmínek (1 pilíř); `/plan` = komplexní
plán napříč 4 pilíři. Ověřeno e2e: nadpis OK, analýza bez chyby, zdroje jen pojišťovny (Kooperativa s.8/47,
NN s.12), žádné eDO metodiky. 64/64 testů, TSC 0, build OK.

### Stav osy „struktura + plán" — KOMPLETNÍ
✅ Kategorie podkladů (v0.20) · ✅ Orchestrace dle kategorií (v0.21) · ✅ eDO-vizuál plánu (v0.22) ·
✅ Zúžení Rychlého návrhu (v0.23). Zbývá jen per-tenant (poskytovatelé/produkty/branding na workspace) —
až s login fází.

## v0.24 — KLIENTSKÁ GRAFICKÁ ANALÝZA (eDO-styl) — výstup pro klienta
Severní hvězda (viz paměť): nahradit eDO nástroje, ať poradci nechtějí nic jiného. Výstup plánu
povýšen z „poradenského textu" na GRAFICKÝ klientský dokument jako eDO Finanční analýza:
- `components/KlientskaAnalyza.tsx`: 4 životní oblasti — Ochrana příjmů · Finanční rezerva · Růst
  majetku · Penze a renta — každá GRAF + číslo klienta (z kalkulaček) + box „PROČ" (kontext).
  Edukační statistiky (rozložení invalidity 42/18/40 % + průměrné invalidní důchody, příčiny úmrtí)
  vysvětlují klientovi kontext = proč se pojistit / spořit. Zdroj statistik označen.
- `lib/edoStatistiky.ts`: referenční data ČR (~2020–2021) z metodiky eDO — konstanty, snadno měnitelné.
- `components/Vizualy.tsx`: + `DonutObecny` (N segmentů) a `Sloupce` (horizontální bar graf).
- Na `/plan` i `/plany`: „Klientská analýza" jako hlavní pohled; „Detailní čísla (pro poradce)"
  sbaleno (`<details>`); tiskne se jako podklad pro klienta.
Ověřeno e2e (uložený plán): 4 bloky s grafy, čísla klienta (krytí 11 mil., mezera 8 118 Kč,
kapitál ×200 3 mil., scénáře p10/medián/p90), „proč" texty. TSC 0, build OK.

### Roadmapa k plné platformě (vize uživatele — paměť produkt-strategie)
Cíl: kompletní paralelní platforma pro poradenské sítě (tenant = síť, eDO první) — CRM/správa klientů,
knowledge base, AI poradce, fakta/podmínky, kalkulačky. Network effect. eDO API nepočítat (scrape později).
Hotové cihly: evidence klientů (v0.19), knowledge base + kategorie + multitenant (v0.20), AI plán dle
kategorií (v0.21), vizuál plánu (v0.22), klientská analýza (v0.24). Další: perzistence klientů na server
(dnes localStorage) až s login fází; produktové podmínky napříč pilíři (banky/fondy/penze); reálné sazby.

## v0.25 — klientská analýza dorovnána na celé eDO (7 životních oblastí)
KlientskaAnalyza rozšířena ze 4 na 7 oblastí (řazení dle eDO logiky):
- **Příjmy a výdaje** (cashflow): příjem vs výdaje vs volné prostředky + kam volné jde (investice/penze/k rozdělení).
- **Bydlení a úvěry**: měsíční splátka + přeplatek (z `uvery.splatkovyKalendar`), křivka zůstatku v čase,
  citlivost splátky na sazbu 3–7 % (sazba klienta zvýrazněna), refinancování (proč). Bez hypotéky → kapacita (max. úvěr).
- **Cíle a děti**: časová osa životních fází dětí (Narození→Start do života) + karty cílů (kolik měsíčně / jednorázově / akcie %).
- (Zachováno: Rezerva, Ochrana příjmů, Růst majetku, Penze a renta.)
KlientCisla rozšířeno (vydaje, hypotéka, děti, vklady); napojeno na /plan i /plany.
Ověřeno e2e (uložený plán): 7 bloků s grafy a čísly klienta. TSC 0, build OK, 64/64 testů.

## v0.26 — brandovaný klientský PDF (bod 2)
Klientské výstupy mají hlavičku a patičku s brandingem poradce/sítě → lze položit klientovi na stůl:
- `lib/poradceStore.ts` (`usePoradce`): profil poradce v localStorage (jméno, č. osvědčení ČNB,
  telefon, e-mail, firma/síť, logo jako data URL). BEZ serveru.
- `app/nastaveni/page.tsx`: formulář brandingu + upload loga (max 400 kB → data URL) + ŽIVÝ náhled
  hlavičky. Sidebar: položka „Nastavení".
- `components/Tisk.tsx`: `TiskHlavicka` (logo + firma + poradce/ČNB vlevo, titulek + klient + datum
  vpravo) a `TiskPaticka` (kontakt + disclaimer) — zobrazí se JEN při tisku (`print:`).
- `/plan` i `/plany`: brandovaná hlavička na začátku PDF + patička; stará inline hlavička odstraněna.
- `jmeno` doplněno do `FinPlanProfil` (ukládá se s plánem) → hlavička zná jméno klienta.
Ověřeno e2e (emulace print): hlavička „eDO finance · Ing. Jan Poradce, ČNB 123456PZ" + klientská
analýza. TSC 0, build 15 rout OK, 64/64 testů.

## v0.27 — eDO metodika z Drive nahrána do RAG (bod 3)
Zpracováno přímo přes konektor (Google Drive MCP → text → `processText`), bez ručního nahrávání:
- **+4 dokumenty** (poskytovatel eDO): OSVČ v paušálním režimu daně — výpočet bonity (metodika/úvěry) ·
  Wealth Management metodika (postup_firmy/investice) · Cross-sell eDOc (postup_firmy/metodika) ·
  ZETEO online sjednávač (postup_firmy/pojištění).
- Knowledge base nyní: metodika 11 · postup_firmy 14 · produktové podmínky 2 = **27 dokumentů**.
- Plán přes orchestraci dle kategorií (v0.21) z nich automaticky čerpá (postup firmy = kostra, metodika = jak počítat + poučky).
- Vynecháno: duplicity (Smluvní dokumentace, Kariérní plán už v DB), čisté UI manuály (Aplikace eDO,
  HypoKalkulačka, Wealth návod), kontakty/osobní data (do RAG nepatří).
Embedding ověřen (chunky s embedding v DB). Dočasný ingest skript po doběhnutí smazán.

## v0.28 — doplnění eDO metodiky z Drive (dávka 2)
Přes konektor (Drive MCP → text → processText) doplněno z folderů 2.Produktové dotazníky a Modelová portfolia:
- **eDO Modelová portfolia** (metodika/investice): konzervativní 4,5 % / vyvážený 5,5 % / dynamický 7 %,
  konkrétní fondy s ISIN, vahami a max. drawdown + komentáře (Future X1, Conseq Repofond, GS Czech Bond,
  Amundi/FF akciové…) + požadovaná dokumentace.
- **eDO Produktové dotazníky — co zjišťovat od klienta** (postup_firmy): souhrn napříč ŽP/HÚ/investice/DPS/
  auto/majetek (jaké údaje sbírat, zdravotní dotazník, bonus/malus u POV, atd.).
Vynecháno: duplicity (EFPA pojištění osob/vozidel, mBank — už v DB), akademie/knihy/know-how (objemné
vzdělávání, nižší priorita pro plán), kontakty/smlouvy (osobní data).
Knowledge base celkem: metodika 12 · postup firmy 15 · produktové podmínky 2 = **29 dokumentů**.

## v0.33 — hardening + spolehlivé párování plán ↔ klient
Dvě věci v jednom kroku.

**A) Robustnost (obrana proti pádům z poškozených/starých dat):**
- `/plany`: otevření plánu v `try/catch/finally` + přísnější guard tvaru `Vypocty` (ověř konkrétní
  podklíče — staré uložené plány nepadají, sjednoceno s guardem v `KlientskaAnalyza`/`PlanPrehled`).
- `KlientskaAnalyza`: guard rozšířen o `rezervaUrovne` a `uvery`.
- `pripadStore.nacti()`: runtime validace tvaru z localStorage (cizí/poškozená data → `PRAZDNO`,
  jinak by `klienti.find(...)` spadlo).
- `poradceStore.ulozPoradce` vrací `boolean`; `/nastaveni` ukáže chybu, když kvóta (velké logo)
  zápis odmítne — místo falešného „uloženo".
- `Markdown`: oprava regexů (Poučka; case-insensitive klíč v `LABEL_TONE`).
- Oprava překlepu typu `ModeloveBortfolio` → `ModelovePortfolio` (`lib/edoPortfolia.ts`).

**B) Párování plán ↔ klient (`klientId`):**
- `FinPlanProfil.klientId` — plán se orazítkuje id klienta z evidence. `ulozPripad`/`ulozDoPripadu`
  vrací id (i nově založeného), `/plan` razítkuje JEŠTĚ PŘED generováním → párování je spolehlivé,
  nezávislé na shodě věku/příjmu. Jede v JSONB `financni_plany.profil` (bez změny schématu).
- `pripadStore.aktualizujKlienta(id, zmeny)` — sloučí změny do KONKRÉTNÍHO klienta dle id.
- `/plany`: u plánu se zobrazí AKTUÁLNÍ jméno klienta z evidence (dle `klientId` — přežije přejmenování),
  odznak „aktivní klient"; v detailu lišta případu s akcemi **Přepnout na tohoto klienta** (`prepniKlienta`)
  a **Aktualizovat profil podle plánu** (`aktualizujKlienta`, s potvrzením; sazba hypotéky desetinně→%).
  Smazaný klient → upozornění, PDF zůstává.
TSC 0, build OK, 66/66 testů.

## v0.34 — /klienti páruje plány přes klientId (dotažení A2)
`planyKlienta()` matchuje primárně dle `profil.klientId` (přežije přejmenování), jméno jen fallback
pro staré plány. NOCNI-BACKLOG srovnán s realitou (A1/A2/A3/B4/D1 hotovo).

## v0.35 — opravy z multi-agent code-review (C1)
Workflow review noční dávky (v0.18–v0.34, 5 dimenzí × adversariální ověření) → 10 potvrzeno / 7 zamítnuto.
Opraveno 5 nálezů:
- `schema.sql`: `DROP FUNCTION` před `CREATE` u `hledej_chunky` → idempotentní migrace (re-run na starší DB nespadne).
- `/plan`: přepnutí klienta plně synchronizuje formulář i pro prázdného klienta (`nastavFormular`) →
  konec kontaminace dat mezi klienty.
- **PII**: jméno klienta se NEukládá do `financni_plany` (datová minimalizace); ponechán jen neosobní
  `klientId`; hlavička PDF na `/plany` řeší jméno klientsky přes `klientId`.
- `pripadStore.nacti()`: validace i jednotlivých záznamů `klienti[]` + sanitizace `aktivniId`.
- `/klienti`: oprava zavádějícího textu o párování.
Zamítnuto 7 (DRY/kosmetika). Defer: tichá kvóta localStorage (low). TSC 0, build OK, 66/66 testů.

## v0.36 — investiční dotazník → rizikový profil (D2)
MiFID/EFPA dotazník, který deterministicky určí rizikový profil a doporučí modelové portfolio eDO:
- `lib/kalkulacky/dotaznik.ts` — 6 vážených otázek (horizont, cíl, zkušenost, reakce na pokles,
  tolerance, stabilita) → skóre → profil. **Horizont je TVRDÝ strop** (krátký horizont srazí i jinak
  dynamického klienta na konzervativní — akcie neunesou krátkodobý drawdown). Čisté + testovatelné.
- `/kalkulacky` (záložka Investice): komponenta `DotaznikKalk` — radio dotazník, výsledek s profilem,
  skóre, vysvětlením a modelovým portfoliem (fondy s vahami/třídami, cílový výnos, max. pokles).
  Tlačítko **Uložit profil do případu** → propíše `rizikovyProfil` do aktivního klienta (a dál do plánu).
TSC 0, build OK, 71/71 testů (+5).

## v0.37 — příležitosti / cross-sell radar (A4)
Deterministický radar příležitostí napříč klienty (à la eDO Cross-sell) — bez nových dat, jen pravidla:
- `lib/prilezitosti.ts` — `najdiPrilezitosti(klienti)`: nízká rezerva, drahá hypotéka (refi), blížící se
  konec fixace, nevyužitý cashflow, chybějící rizikový profil, blížící se důchod s nízkým spořením,
  konsolidace dluhů, spoření na děti. Prioritizováno (vysoká→nízká). Čisté + testy.
- `/klienti`: panel „Příležitosti" — priorita, klient (klik otevře případ), důvod a akce (Link nastaví
  klienta jako aktivního). Disclaimer (nejde o automatické doporučení).
TSC 0, build OK, 78/78 testů (+7).

## v0.38 — aktuální majetek / rozvaha v klientské analýze (E1)
`KlientskaAnalyza` má novou kartu **Aktuální majetek**: složení aktiv (rezerva/investice/penze naspořeno,
donut) − závazky (hypotéka + jiné dluhy) = **čisté jmění** jako výchozí bod plánu, vč. vysvětlení.
`KlientCisla` rozšířeno (rezervaNasporeno, existujiciInvestice, penzeNasporeno, jineDluhy); napojeno z `/plan`
i `/plany` (z uloženého profilu). TSC 0, build OK, 78/78 testů.

## v0.42–v0.44 — AUTH + SERVEROVÁ DATA (login poradce, izolace per poradce)
Zásadní architektonický krok: klienti i plány nově NA SERVERU (Supabase) s reálným RLS, místo localStorage.
- **v0.42** základ: `@supabase/ssr`, `lib/supabase/{client,server,dal}.ts` (browser/server klient, `verifySession`).
- **v0.43** login: `app/login` (e-mail/heslo, `useActionState`), `proxy.ts` (Next 16 — obnova session).
- **v0.44** zapnutí:
  - DB migrace: `poradce_id` (FK `auth.users`) na `klienti` + `financni_plany`, indexy; reálné **RLS
    per poradce** (`poradce_id = auth.uid()`) místo permisivních politik. Existujících 12 plánů přiřazeno účtu.
  - `app/dataActions.ts` — serverové akce pro klienty (přes session client, RLS).
  - `app/actions.ts` — `financni_plany` (insert/get/smaz) přes session client + `verifySession` + `poradce_id`.
  - `lib/pripadStore.ts` — PŘEPSÁN na server-backed (veřejné API beze změny; optimistické zápisy,
    `aktivniId` v localStorage, JEDNORÁZOVÁ migrace starých localStorage klientů na server).
  - `proxy.ts` `AUTH_GATING=true` (nepřihlášení → /login); `AppShell` bypass /login + logout + e-mail.
- Ověřeno: izolace RLS (dominik vidí 12 plánů, cizí uid 0), TSC 0, build OK, 80/80 testů.
- Účet poradce vytvořen přes admin API (`dominik@highlife.cz`).
- ZÁMĚRNĚ ponecháno permisivní: sdílená KB/config (`chunky`/`dokumenty`/`produkty`/`workspaces`) — přístup jen
  přes server service-role; zúžení (authenticated-read/service-write) je follow-up. `poradceStore` (branding)
  zatím localStorage — follow-up na `poradci_profil`.

## v0.45 — deployment prep (Vercel)
`DEPLOY.md` (env, GitHub/CLI, cron, Supabase Auth URL); `.env.example` + `CRON_SECRET` (sledován v gitu);
**oprava proxy matcheru** (vyloučit `/api` — jinak gating rozbije cron i `/api/check-config`).

## v0.46 — opravy z bezpečnostního review auth (12 potvrzených, 1 zamítnutý)
- **Server Actions bez `verifySession`** (high): doplněno do VŠECH chráněných akcí v `app/actions.ts`
  (upload/delete/updateMeta/produkty/chat/solution/plan/get…). `generujFinancniPlanAction` ověřuje session
  PRVNÍ (před RAG+Gemini, fail-closed). Plánové get/smaz mají `verifySession` PŘED `try` (redirect se neztratí).
  `zkontroluj/importujPodminkuAction` (volá cron) → guard `overPristupNeboCron` (session NEBO CRON_SECRET).
- **`schema.sql` nesynchronní s DB** (high): doplněn `poradce_id`/`aktualizovano_kdy` + per-poradce RLS;
  permisivní `permisivni_vse` na `klienti`/`financni_plany` se už NEobnovuje (re-run by jinak anuloval izolaci).
- **Únik dat mezi poradci na sdíleném zařízení** (high): `pripadStore` modul-stav přežíval logout (soft-nav)
  → `resetPripadStore()` + odhlášení dělá `signOut` + tvrdý `window.location` na `/login`.
- **`novyId()` mohlo vrátit ne-UUID** (medium): vždy validní UUID v4 (jinak by upsert do UUID PK tiše selhal).
- **Migrace localStorage→server** (low): localStorage se smaže jen když VŠECHNY uploady prošly.
Zamítnut 1 nález (proxy/cron — už opraveno ve v0.45). TSC 0, build OK, 80/80 testů. Izolace ověřena.

## v0.39 — opravy z review nového kódu (C2)
Adversariální review v0.35–v0.38 (4 dimenze) → 4 potvrzeno / 5 zamítnuto. Opraveno:
- `prilezitosti.ts`: příležitost „nevyužitý cashflow" se spouštěla i bez vyplněných výdajů (smyšlené číslo
  poradci) → guard `vydaje > 0`; `volnyCashflow` nově odečítá i vklad na penzi/investice (konzistence
  s `KlientskaAnalyza`, ať nedáváme dvě různá čísla). + testy.
- `/kalkulacky`: `DotaznikKalk` se remountoval při „Předvyplnit z případu" (bumpne `verze`) a mazal
  rozdělaný dotazník → vyrenderován mimo `verze`-klíčovanou mřížku.
- `DotaznikKalk`: „Uložit profil do případu" bez aktivního klienta zakládalo prázdného „fantomového"
  klienta → tlačítko se ukáže jen s vybraným klientem, jinak hláška.
TSC 0, build OK, 80/80 testů (+2).

## B1 — úklid knowledge base (mimo kód, po OK uživatele)
Smazány 2 stub duplicity ze Supabase (staré 1-chunk verze nahrazené plnými): „Produktové dotazníky"
a „Modelová portfolia a investiční principy". KB nyní: metodika 11 · postup firmy 14 · podmínky 2 = 27 dok.

## v0.40 — polish (F1)
- `/poradna`: přístupnost — `aria-label` na tlačítku Odeslat a na vstupu dotazu (ikonová tlačítka jinde
  už mají `title`). Chat má fill-height (bylo).
- Domů (`app/page.tsx`): nový teaser **Příležitosti** — top 3 z cross-sell radaru napříč klienty,
  klik nastaví klienta aktivním a vede na akci. Zviditelňuje funkci z v0.37.
TSC 0, build OK, 80/80 testů.

## v0.41 — konsolidace UI primitiv (B3)
Odstranění duplikovaných lokálních komponent do `components/ui` (jeden vizuální jazyk):
- Nová sdílená **`Karta`** (ikona+titulek+popis, DS styl, `className`); nahradila 3 lokální definice
  (`kalkulacky`, `KlientskaAnalyza` — `sirka`→`className`, `PlanPrehled`).
- **`Field`** (alias `Pole`) nahradil 3 lokální `Pole` (`plan`, `kalkulacky`, `zaznam`); textová pole
  dostala `inputMode="text"` (číselná zůstávají na `decimal`). Field nově používá **`useId()`** →
  unikátní `id`, žádné kolize `label↔input` při shodných popiscích napříč kartami.
- **`Radek`** nahradil 3 lokální (`kalkulacky`, `zaznam`, `klienti`).
- `components/ui.tsx` má nově `'use client'` (kvůli `useId`); všechny konzumenty jsou klientské.
Celkem −9 duplicitních definic v 6 souborech. B2: dle rozhodnutí necháváme oba pohledy (poradce vs klient).
TSC 0, build OK, 80/80 testů.
