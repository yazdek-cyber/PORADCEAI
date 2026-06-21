# Noční autonomní backlog (uživatel spí — „udělej appku top strop")

Mandát: vyladit · přidat důležité · odstranit překryvy · **CRM databáze klientů** · celkově top kvalita.
Pravidla: rozhodovat sám, commit po každé úloze, držet **TSC 0 / build OK / 64 testů**, NEpushovat,
nic outward-facing, neobcházet login. Po každé úloze aktualizovat tento soubor (✅) + POKROK.md.

Legenda: ⬜ čeká · 🔄 probíhá · ✅ hotovo

## A. CRM — databáze klientů (největší „přidat důležité")
- ✅ A1. `/klienti` stránka: seznam klientů + detail (profil, jejich uložené plány, záznamy, poznámky). — v0.30
- ✅ A2. Propojit uložené plány s klientem (klientId k plánu; v detailu filtrovat). — v0.33 (klientId stamp + /plany + /klienti párují přes klientId)
- ✅ A3. Poznámky ke klientovi (localStorage) + rychlé akce (otevřít plán, nový záznam). — v0.30
- ✅ A4. Příležitosti / cross-sell radar à la eDO — panel na /klienti, odvozeno z profilů (rezerva,
  refi, fixace, cashflow, penze, konsolidace, děti). — v0.37 (výročí/narozeniny vyžadují data → příště)

## B. Odstranit překryvy / dedupe
- ✅ B1. KB: zrušeny 2 stub duplicity (Produktové dotazníky, Modelová portfolia) ve prospěch plných verzí.
  Smazáno z produkční Supabase po výslovném OK uživatele. KB nyní: metodika 11 · postup firmy 14 · podmínky 2 = 27 dok.
- ⏭️ B2. PlanPrehled vs KlientskaAnalyza — rozhodnutí uživatele: NECHAT OBA (jiný účel: poradce vs klient).
- ✅ B3. Konsolidace do `components/ui`: sdílené `Karta` (nově) + `Field`(=Pole) + `Radek`; odstraněno 9
  lokálních definic v 6 souborech. Field má `useId()` (unikátní id, žádné kolize labelů). — v0.41
- ✅ B4. Sjednotit markdown (/pripad má vlastní renderer → sdílený `Markdown`). — v0.32

## C. Kvalita — multi-agent audit (Workflow)
- ✅ C1. Code-review Workflow nad novým kódem (v0.18–v0.34): 5 dimenzí × adversariální ověření → 10 potvrzeno / 7 zamítnuto.
  Opraveno (v0.35): schema.sql DROP+CREATE hledej_chunky · kontaminace formuláře mezi klienty (/plan reset) ·
  PII jméno se neukládá na server (jen klientId) · validace záznamů v pripadStore.nacti · zavádějící copy /klienti.
  DEFER (low): tichá ztráta při kvótě localStorage v pripadStore.zapis (riziko minimální — klíč drží jen text, ne logo).
- ✅ C2. Review nového kódu (v0.35–v0.38): 4 dimenze × ověření → 4 potvrzeno / 5 zamítnuto. Opraveno (v0.39):
  cashflow příležitost bez guardu na výdaje (smyšlené číslo) + ignoroval vklad na penzi · DotaznikKalk se
  remountoval při „Předvyplnit" (ztráta dotazníku) · uložení profilu bez klienta zakládalo prázdného klienta.

## D. Kalkulačky
- ✅ D1. OSVČ bonita kalkulačka (z nahrané metodiky — paušální režim daně). — v0.31
- ✅ D2. Investiční dotazník → rizikový profil (mapuje na eDO portfolio). — v0.36

## E. Klientská analýza kompletní
- ✅ E1. Aktuální majetek (rozvaha: aktiva − závazky = čisté jmění) v klientské analýze. — v0.38
  (cashflow rozpad už existoval v kartě „Příjmy a výdaje")

## F. Polish
- ✅ F1. Polish: chat /poradna už má fill-height; přístupnost (aria-label Send + input v /poradna; ostatní
  ikonová tlačítka mají title); Domů nově ukazuje teaser „Příležitosti" (top 3 z radaru). — v0.40
  (prázdné stavy už OK napříč; další drobnosti průběžně)

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
