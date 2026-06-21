# Noční autonomní backlog (uživatel spí — „udělej appku top strop")

Mandát: vyladit · přidat důležité · odstranit překryvy · **CRM databáze klientů** · celkově top kvalita.
Pravidla: rozhodovat sám, commit po každé úloze, držet **TSC 0 / build OK / 64 testů**, NEpushovat,
nic outward-facing, neobcházet login. Po každé úloze aktualizovat tento soubor (✅) + POKROK.md.

Legenda: ⬜ čeká · 🔄 probíhá · ✅ hotovo

## A. CRM — databáze klientů (největší „přidat důležité")
- ✅ A1. `/klienti` stránka: seznam klientů + detail (profil, jejich uložené plány, záznamy, poznámky). — v0.30
- ✅ A2. Propojit uložené plány s klientem (klientId k plánu; v detailu filtrovat). — v0.33 (klientId stamp + /plany + /klienti párují přes klientId)
- ✅ A3. Poznámky ke klientovi (localStorage) + rychlé akce (otevřít plán, nový záznam). — v0.30
- ⬜ A4. (volitelné) Příležitosti výročí/fixace/konec à la eDO Cross-sell — lehký připomínkovač.

## B. Odstranit překryvy / dedupe
- ⬜ B1. KB: zrušit 1-chunk stub duplicity (Produktové dotazníky, Modelová portfolia) ve prospěch plných verzí. (ověřit stav v DB)
- ⬜ B2. UI dedup: PlanPrehled vs KlientskaAnalyza (poradenský detail) — vyjasnit/zredukovat redundanci.
- ⬜ B3. Konsolidovat duplikované `Pole`/`Karta` napříč stránkami do `components/ui`.
- ✅ B4. Sjednotit markdown (/pripad má vlastní renderer → sdílený `Markdown`). — v0.32

## C. Kvalita — multi-agent audit (Workflow)
- ✅ C1. Code-review Workflow nad novým kódem (v0.18–v0.34): 5 dimenzí × adversariální ověření → 10 potvrzeno / 7 zamítnuto.
  Opraveno (v0.35): schema.sql DROP+CREATE hledej_chunky · kontaminace formuláře mezi klienty (/plan reset) ·
  PII jméno se neukládá na server (jen klientId) · validace záznamů v pripadStore.nacti · zavádějící copy /klienti.
  DEFER (low): tichá ztráta při kvótě localStorage v pripadStore.zapis (riziko minimální — klíč drží jen text, ne logo).

## D. Kalkulačky
- ✅ D1. OSVČ bonita kalkulačka (z nahrané metodiky — paušální režim daně). — v0.31
- ⬜ D2. Investiční dotazník → rizikový profil (mapuje na eDO portfolio).

## E. Klientská analýza kompletní
- ⬜ E1. Cashflow rozpad (příjmy/výdaje detail) + Aktuální portfolio klienta.

## F. Polish
- ⬜ F1. Konzistence, prázdné stavy, mobil, přístupnost; chat fill-height na /poradna; drobnosti.

## Hotovo tuto noc (+ ráno po pádu)
- ✅ v0.29 eDO modelová portfolia → plán doporučí konkrétní fondy dle rizikového profilu.
- ✅ v0.30 CRM `/klienti` (A1, A3).
- ✅ v0.31 OSVČ bonita kalkulačka (D1).
- ✅ v0.32 sjednocení markdownu na /pripad (B4).
- ✅ v0.33 hardening + spolehlivé párování plán↔klient přes klientId (A2). *(noc spadla v rozpracovaném stavu ~02:20; dokončeno ráno 08:33)*

## Zbývá (priorita shora)
A4 (připomínkovač výročí/fixací) · B2 (PlanPrehled vs KlientskaAnalyza) · B3 (Pole/Karta do ui) ·
C1 (multi-agent code-review v0.18–v0.33) · D2 (investiční dotazník → profil) · E1 (cashflow rozpad) · F1 (polish).
B1: ověřit, zda v KB nezůstaly 1-chunk stuby po doplnění plných verzí (v0.28).
