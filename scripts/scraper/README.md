# Scraper firemního portálu (za přihlášením, i s 2FA)

Stáhne data z portálu pod **tvojí** přihlášenou relací. Heslo se nikam neukládá —
přihlašuješ se ručně v okně prohlížeče, skript si uloží jen session (cookies).

## Jednorázová příprava
```bash
npm install -D playwright
npx playwright install chromium
```
Do `.env.local` přidej URL přihlašovací stránky:
```
PORTAL_LOGIN_URL=https://portal.tvojefirma.cz/login
```

## Použití
1. **Přihlášení (jednou):**
   ```bash
   npx tsx scripts/scraper/prihlaseni.ts
   ```
   V okně se přihlas (heslo + 2FA), pak v terminálu stiskni Enter. Uloží se `.session.json`.

2. **Stažení stránek:**
   - Do `stranky.json` dej seznam URL, které chceš stáhnout.
   - ```bash
     npx tsx scripts/scraper/stahni.ts
     ```
   - Výstupy (HTML + text) se uloží do `scripts/scraper/data/`.

3. Pošli jeden výstup zpět → doladí se konkrétní extrakce:
   - **produkty/sazby** → tabulka `produkty` (vstup do kalkulaček),
   - **postupy/metodiky** → RAG báze.

## Bezpečnost
- `.session.json` a `data/` jsou v `.gitignore` (necommitují se).
- Relace časem vyprší → stačí znovu `prihlaseni.ts`.
- Scrapuj jen vlastní firemní portál a v souladu s jeho podmínkami.
