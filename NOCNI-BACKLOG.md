# Noční autonomní backlog (uživatel spí — „udělej appku top strop")

Mandát: vyladit · přidat důležité · odstranit překryvy · **CRM databáze klientů** · celkově top kvalita.
Pravidla: rozhodovat sám, commit po každé úloze, držet **TSC 0 / build OK / 64 testů**, NEpushovat,
nic outward-facing, neobcházet login. Po každé úloze aktualizovat tento soubor (✅) + POKROK.md.

Legenda: ⬜ čeká · 🔄 probíhá · ✅ hotovo

## A. CRM — databáze klientů (největší „přidat důležité")
- ⬜ A1. `/klienti` stránka: seznam klientů + detail (profil, jejich uložené plány, záznamy, poznámky).
- ⬜ A2. Propojit uložené plány s klientem (ukládat jméno/id klienta k plánu; v detailu filtrovat).
- ⬜ A3. Poznámky k klientovi (localStorage) + rychlé akce (otevřít plán, nový záznam).
- ⬜ A4. (volitelné) Příležitosti výročí/fixace/konec à la eDO Cross-sell — lehký připomínkovač.

## B. Odstranit překryvy / dedupe
- ⬜ B1. KB: zrušit 1-chunk stub duplicity (Produktové dotazníky, Modelová portfolia) ve prospěch plných verzí.
- ⬜ B2. UI dedup: PlanPrehled vs KlientskaAnalyza (poradenský detail) — vyjasnit/zredukovat redundanci.
- ⬜ B3. Konsolidovat duplikované `Pole`/`Karta` napříč stránkami do `components/ui`.
- ⬜ B4. Sjednotit markdown (/pripad má vlastní renderer → sdílený `Markdown`).

## C. Kvalita — multi-agent audit (Workflow)
- ⬜ C1. Code-review Workflow nad novým kódem (v0.18–v0.29): bugy/React/orchestrace/bezpečnost → opravit potvrzené.

## D. Kalkulačky
- ⬜ D1. OSVČ bonita kalkulačka (z nahrané metodiky — 5 bank).
- ⬜ D2. Investiční dotazník → rizikový profil (mapuje na eDO portfolio).

## E. Klientská analýza kompletní
- ⬜ E1. Cashflow rozpad (příjmy/výdaje detail) + Aktuální portfolio klienta.

## F. Polish
- ⬜ F1. Konzistence, prázdné stavy, mobil, přístupnost; chat fill-height na /poradna; drobnosti.

## Hotovo tuto noc
- ✅ v0.29 eDO modelová portfolia → plán doporučí konkrétní fondy dle rizikového profilu.
