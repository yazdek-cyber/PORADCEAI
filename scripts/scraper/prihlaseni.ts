// KROK 1 — jednorázové přihlášení do firemního portálu (i s 2FA).
//
// Spustí prohlížeč, TY se v něm ručně přihlásíš (heslo + SMS/aplikace), a skript
// si uloží přihlášenou relaci (cookies) do .session.json. Heslo se nikam neukládá
// — píšeš ho jen ty do prohlížeče.
//
// Spuštění:
//   1) do .env.local přidej:  PORTAL_LOGIN_URL=https://portal.tvojefirma.cz/login
//   2) npx tsx scripts/scraper/prihlaseni.ts
//   3) v okně se přihlas (heslo + 2FA), pak se vrať do terminálu a stiskni Enter
//
// Pozn.: vyžaduje Playwright (npm i -D playwright && npx playwright install chromium).

import { chromium } from 'playwright';
import { createInterface } from 'node:readline';
import path from 'node:path';

const SESSION = path.join(process.cwd(), 'scripts', 'scraper', '.session.json');

function pockejNaEnter(zprava: string): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res) => rl.question(zprava, () => { rl.close(); res(); }));
}

async function main() {
  const loginUrl = process.env.PORTAL_LOGIN_URL;
  if (!loginUrl) {
    console.error('Chybí PORTAL_LOGIN_URL v .env.local (URL přihlašovací stránky).');
    process.exit(1);
  }

  // headless: false → vidíš okno a můžeš se přihlásit ručně (i 2FA).
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ locale: 'cs-CZ' });
  const page = await context.newPage();
  await page.goto(loginUrl, { waitUntil: 'domcontentloaded' });

  console.log('\n➡️  V otevřeném okně se PŘIHLAS (heslo + 2FA) a proklikej se až do portálu.');
  await pockejNaEnter('   Až budeš přihlášen/a, stiskni zde Enter pro uložení relace… ');

  await context.storageState({ path: SESSION });
  console.log(`\n✅ Relace uložena do ${SESSION} (gitignorováno). Teď spusť: npx tsx scripts/scraper/stahni.ts`);
  await browser.close();
}

main().catch((e) => { console.error('CHYBA:', e); process.exit(1); });
