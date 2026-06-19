# PORADCEA_AI — Produktová roadmapa

Cíl: z RAG nástroje udělat **nepostradatelný, monetizovatelný nástroj pro finanční poradce**
nad osobním pojištěním, s obhajitelnou výhodou (moat), kterou konkurent snadno nezkopíruje.

## Teze (proč to existuje)
Dnes poradce porovnává pojistné podmínky z hlavy / ručně / podle provize → mis-selling,
zamítnutá plnění, stížnosti, regulatorní riziko (IDD/ČNB). **Revoluce = objektivní, aktuální,
zdrojem podložené srovnání + automatický compliant podklad za minuty.** Posun od prodeje k datům.

## Moat (kde je obhajitelná hodnota)
1. **Strukturovaná, vždy aktuální databáze podmínek** napříč pojišťovnami (dřina = bariéra).
2. **Normalizační/srovnávací vrstva** — různě psané podmínky → porovnatelná data.
3. **Workflow „případ → obhajitelný podklad se zdroji"** (compliance-grade).
NE samotný AI chat — ten je komodita.

## Princip, který se nesmí porušit
Nezávislost: doporučení z dat klienta a podmínek, **nikdy ne z provize**. ⛔ Žádné peníze od
pojišťoven za lepší umístění — tím padá moat i důvěra.

---

## Fáze

### ✅ v0.5 (hotovo) — funkční jádro
RAG „Ptám se" se zdroji + prahem relevance, OCR skenů, filtr/srovnání napříč pojišťovnami,
„Řeším případ" (podložené návrhy + PDF export), hardening, multi-tenant model, monitor podmínek.

### 🔨 v0.6 (probíhá) — DIFERENCIÁTOR: Srovnávací matice
Strukturovaná extrakce klíčových parametrů produktů (čekací doby, výluky, definice invalidity/
vážných nemocí, vstupní věk, limity) do **porovnatelné matice** vedle sebe, se zdroji.
→ To, co poradce ručně neudělá. Skok z „hezká hračka" na „nástroj, bez kterého nedělám".

### v0.7 — Hlídání + kompletní data
- Per-site crawler pro skryté podmínky (Koop, Generali — kategorie/podstránky).
- Alerty „pojišťovna změnila výluky u produktu X" (retence + recurring value).
- Rozšíření na všechny pojišťovny + verzování podmínek (historie).

### v0.8 — Compliance & klientský výstup
- Auditní stopa: proč byl produkt doporučen (IDD record-keeping).
- Brandovaný klientský PDF / sdílecí odkaz.
- Knihovna „pasti" (časté důvody zamítnutí plnění).

### v1.0 — Multi-tenant & sítě (monetizace)
- Supabase Auth, oddělené workspace firem, vlastní materiály.
- Manažerský dashboard (přehled týmu, využití).
- CRM vrstva (klienti, historie, upomínky) = lock-in.

---

## Monetizace
- **SaaS per seat / měsíc**, tiery: Solo → Tým (firma + dashboard) → Enterprise.
- **Hlavní kanál = B2B2C přes poradenské sítě** (Partners, OVB, Broker Consulting, SAB,
  Fincentrum/Swiss Life Select). Jeden kontrakt = stovky seatů. Sem mířit.
- Add-ony: compliance audit, CRM, manažerský dashboard.

## Jak porazit konkurenta
Hloubka + aktuálnost dat (ne víc featur) · workflow lock-in (případy, historie) ·
rychlost do obhajitelné niky (osobní pojištění pro poradce) · pozice na straně poradce.
