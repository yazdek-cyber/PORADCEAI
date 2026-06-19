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
