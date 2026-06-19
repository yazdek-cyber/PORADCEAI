# eDO blueprint — předloha, na které stavíme aplikaci

Cíl: PORADCEA_AI má **replikovat a vylepšit ekosystém eDO** (skupina eDO finance / eDO reality,
ředitelství Czernin) — komplexní finanční poradenství přes 4 pilíře s AI nad metodikou, daty a
kalkulačkami. Tento dokument shrnuje, jak eDO funguje (z dodaných podkladů), a mapuje to na náš build.

> Zdroje: uložená stránka „eDO Finanční analýza", 43stránkový vzorový finanční plán (PDF),
> Google Drive složka skupiny (metodika, BEZ osobních dat klientů), živé systémy eDO.
> Osobní data klientů (kontakty/leady) se ZÁMĚRNĚ neingestují — viz „GDPR hranice".

## 1) eDO ekosystém — systémy k replikaci

| Systém | URL | Co dělá | Náš protějšek |
|---|---|---|---|
| Keycloak SSO | `auth.edogroup.cz` | Přihlášení (OIDC) + 2FA (authenticator) | (budoucí Auth fáze) |
| Analýza | `analyza.edogroup.cz/koncept/...` | Průvodce finanční analýzou klienta | `/plan` (rozšířit na průvodce) |
| Kalkulačky | `kalkulacky.edogroup.cz` (např. „očekávaná investice") | Investiční/projektové kalkulačky | `lib/kalkulacky/` (máme) |
| MAXX | `maxx.edogroup.cz/documentslibrary` | Knihovna dokumentů, metodiky, zadávání smluv | RAG báze + admin |
| e-srovnání | `nove.e-srovnani.cz/...` | Porovnání životního pojištění (produkty) | srovnání + `produkty` |
| Úvěry RTM | `edofinance.uveryrtm.creasoft.cz` | Modul úvěrů (hypotéky) | pilíř Úvěry |

**Technika:** vše Angular SPA za Keycloak SSO → statický scrape nefunguje; nutný Playwright se
session (viz `scripts/scraper/`) nebo přímé JSON API (odchyt přes `odchyt-api.ts`).

## 2) Metodika eDO (jak vedou analýzu a co doporučují)

Proces: **Analýza → Poradenství → Realizace → Servis**. Pokrytí oblastí:

### Cashflow
Čistý příjem − výdaje (vč. rezervy ~10 %) = volné měsíční možnosti. (Vzor: 35 000 − 30 000 = 5 000.)

### Ochrana / Pojištění — doporučené pojistné částky (eDO praxe)
- **Smrt** (nemoc i úraz): **3× roční čistý příjem**
- **Invalidita** (nemoc i úraz): **3× roční čistý příjem**
- **Pracovní neschopnost**: dorovnání rozdílu mezi nemocenskou a čistým příjmem
  (pozn.: průměrná dlouhodobá PN ≈ 60 % příjmu)
- **Trvalé následky úrazu s progresí**: stř. věk 1–2,5 mil. Kč, vyšší věk 0,5–1 mil. Kč
- **Závažná onemocnění**: **1× roční čistý příjem**
- Statistiky, kterými argumentují: rozložení invalidit I/II/III (42/18/40 %), příčiny úmrtí, atd.

### Tvorba rezerv / Investice — horizonty a strategie
- Rozdělení rezerv: **Okamžité (0–1 r) · Krátkodobé (1–5) · Střednědobé (5–10) · Dlouhodobé (10+)**
- Strategie: **Dynamická / Vyvážená / Konzervativní** (= naše rizikové profily)
- **Modelová portfolia eDO / EDWARD**: Nobelova nadace (růst, ~inflace+3,5 %), Opatrná
  (~70 % dluhopisy), Hotovostní (likvidita). Regionální rozložení akcie/dluhopisy.
- Vstupní poplatky reálně účtované (1 % jednorázové velké, 3 % menší), kalkulovaný výnos po nákladech.

### Penze
„V kolika s kolika" — státní důchod vs. vlastní zodpovědnost; cílová částka k 65; DPS s příspěvky
účastník/zaměstnavatel/stát + daňová úspora.

### Děti
Prostředky dle fází (předškolní → start do života: studium, auto, bydlení, svatba).

### Bydlení / Úvěry
LTV 80–90 %, vlastní zdroje 10–20 % + 5–15 % na vybavení; přeplatky dle úroku/splatnosti;
program předčasného splacení.

### Majetek
Pojištění nemovitost + domácnost + odpovědnost; kompletní porovnání nabídek (limity, spoluúčast).

## 3) Výstup — struktura finančního plánu (z 43str. vzoru)
Titulka → Cashflow → Životní pojištění (modelace rizik, daňová úspora) → Investice (jednorázová/
pravidelná, portfolia, projekce) → Investiční plán (cíle, dlouhodobé/střednědobé/krátkodobé
portfolio, renta) → Penze (DPS) → Majetek (porovnání) → upozornění/disclaimery.

## 4) Mapování na náš build

| eDO | Stav u nás |
|---|---|
| 4 pilíře + cashflow | ✅ `lib/financniPlan.ts` + `/plan` |
| Kalkulačky (anuita, projekce, Monte Carlo, DIME, penze) | ✅ `lib/kalkulacky/` |
| Doporučené pojistné částky (3× příjem…) | 🔧 sladit defaulty DIME/pojištění s eDO praxí |
| Strategie/portfolia | 🔶 máme rizikové profily; doplnit modelová portfolia eDO |
| Produkty/sazby | ✅ tabulka `produkty` + admin; naplnit reálnými |
| RAG nad metodikou | 🔶 nahrát metodické PDF (bez PII) |
| Analýza jako průvodce | 🔶 `/plan` je formulář; lze rozšířit na krokový průvodce dle eDO |
| Výstupní plán + PDF | ✅ `/plan` Markdown + tisk; sladit sekce s eDO vzorem |

## 5) Co ingestovat z Drive (metodika, bez PII)
Složka **eDO Finance** → 5.Metodika, 2.Produktové dotazníky, 4.Kalkulačky, Modelová portfolia eDO,
akademie (Hypoteční/Investiční/Plánování), Know-how; **Finanční analýza vpisovatelné PDF**;
Průvodce eDO START; Smluvní dokumentace manuál. → RAG báze „jak eDO pracuje".

## 6) GDPR hranice (DŮLEŽITÉ)
NEINGESTOVAT: kontaktní/leadové seznamy, call recordy, cokoliv s reálnými jmény/telefony/adresami
klientů a poznámkami o jejich situaci. Embedding přes Gemini = předání osobních údajů třetí straně.
Klientská data řešit zvlášť jako řízený CRM s právním základem, ne jako AI znalostní bázi.

## 7) Další kroky (návrh pořadí)
1. Sladit kalkulačky pojistné potřeby s eDO praxí (3× příjem smrt/invalidita, 1× ZO, PN dorovnání).
2. Doplnit modelová portfolia eDO do investičního srovnání.
3. Nahrát metodická PDF (bez PII) do RAG → poradce se ptá „jak eDO řeší X".
4. Naplnit `produkty` reálnými sazbami (ručně nebo přes odchyt API z e-srovnání/RTM).
5. Rozšířit `/plan` na krokový průvodce dle eDO „Analýza".
