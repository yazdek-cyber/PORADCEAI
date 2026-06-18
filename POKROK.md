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
| 1 | Audit a stabilizace jádra | 🔄 | Audit hotov; ladění chunkingu/promptu/zdrojů + 5-dotazový test |
| 2 | OCR fallback pro skeny | ⬜ | Plán: detekce textu, OCR přes Gemini vision (multimodál) |
| 3 | Vícezdrojové vyhledávání (filtr pojišťoven) | ⬜ | Filtr v „Ptám se" + `pojistovna` parametr v `hledej_chunky` |
| 4 | „Řeším případ" | 🔄 | Existuje; ověřit specifičnost/podloženost na 3 profilech |
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

## Blokery
(zatím žádné)

## Log
- Založen CLAUDE.md + POKROK.md, git baseline.
