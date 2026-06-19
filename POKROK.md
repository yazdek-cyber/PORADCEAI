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
| 5 | Export návrhu do PDF | 🔄 | Existuje `window.print()`; zvážit profesionálnější layout |
| 6 | Kvalita a spolehlivost (hardening) | ⬜ | Chybové stavy, loading, logování, rate limity |
| 7 | Příprava na multi-tenant | ⬜ | `workspace_id`, RLS připraveno (permisivní), bez plného loginu |

## Akceptační kritérium fáze
1. „Ptám se" přesné odpovědi se zdroji, nevymýšlí
2. Skeny přes OCR
3. Srovnání více pojišťoven
4. „Řeším případ" specifické podložené návrhy
5. Export do PDF
6. Nepadá při chybách
7. Model připraven na multi-tenant

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
