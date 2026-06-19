// KROK 2 — stažení stránek portálu pod uloženou relací.
//
// Načte přihlášenou relaci z .session.json a projde URL ze stranky.json. Pro každou
// uloží HTML i čistý text do scripts/scraper/data/. Z těchto výstupů pak doladíme
// konkrétní extrakci (produkty/sazby → DB, postupy → RAG).
//
// Spuštění:
//   1) nejdřív scripts/scraper/prihlaseni.ts (uloží relaci)
//   2) do scripts/scraper/stranky.json dej seznam URL ke stažení
//   3) npx tsx scripts/scraper/stahni.ts

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.join(process.cwd(), 'scripts', 'scraper');
const SESSION = path.join(DIR, '.session.json');
const STRANKY = path.join(DIR, 'stranky.json');
const DATA = path.join(DIR, 'data');

/** Hrubý převod HTML → text (jen pro rychlý náhled obsahu). */
function naText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function bezpecnyNazev(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/[^a-z0-9]+/gi, '_').slice(0, 120);
}

async function main() {
  if (!fs.existsSync(SESSION)) {
    console.error('Chybí .session.json — nejdřív spusť scripts/scraper/prihlaseni.ts');
    process.exit(1);
  }
  if (!fs.existsSync(STRANKY)) {
    console.error(`Chybí ${STRANKY}. Vytvoř JSON pole URL, např.: ["https://portal.../produkty"]`);
    process.exit(1);
  }
  const urls: string[] = JSON.parse(fs.readFileSync(STRANKY, 'utf-8'));
  if (!Array.isArray(urls) || urls.length === 0) {
    console.error('stranky.json musí být neprázdné pole URL.');
    process.exit(1);
  }
  fs.mkdirSync(DATA, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: SESSION, locale: 'cs-CZ' });
  const page = await context.newPage();

  for (const url of urls) {
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
      const html = await page.content();
      const text = naText(html);
      const zaklad = path.join(DATA, bezpecnyNazev(url));
      fs.writeFileSync(`${zaklad}.html`, html, 'utf-8');
      fs.writeFileSync(`${zaklad}.txt`, text, 'utf-8');
      console.log(`✅ ${url} → ${text.length} znaků textu`);
    } catch (e) {
      console.error(`✗ ${url}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  await browser.close();
  console.log(`\nHotovo. Výstupy v ${DATA}. Pošli mi jeden .txt/.html a podle struktury doladím extrakci.`);
}

main().catch((e) => { console.error('CHYBA:', e); process.exit(1); });
