// KROK 2B — odchyt JSON API portálu (ideální pro Angular SPA jako eDO).
//
// Otevře prohlížeč pod uloženou relací; zatímco TY ručně proklikáváš portál
// (analýzu, produkty, klienty…), skript zaznamenává VŠECHNA JSON volání, která
// appka dělá na backend. Z toho získáme: (a) čistá data, (b) mapu API endpointů
// pro pozdější přímou integraci (čistší než scrapovat DOM).
//
// Spuštění:
//   1) nejdřív scripts/scraper/prihlaseni.ts (uloží relaci)  — nebo se přihlas v okně tady
//   2) npx tsx scripts/scraper/odchyt-api.ts
//   3) v okně proklikej, co chceš načíst; pak v terminálu Enter pro uložení

import { chromium } from 'playwright';
import { createInterface } from 'node:readline';
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.join(process.cwd(), 'scripts', 'scraper');
const SESSION = path.join(DIR, '.session.json');
const OUT = path.join(DIR, 'data', 'api');

function pockejNaEnter(z: string): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res) => rl.question(z, () => { rl.close(); res(); }));
}

function nazevZUrl(method: string, url: string, poradi: number): string {
  const u = url.replace(/^https?:\/\//, '').replace(/\?.*$/, '').replace(/[^a-z0-9]+/gi, '_').slice(0, 90);
  return `${String(poradi).padStart(3, '0')}_${method}_${u}`;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const maStart = process.env.PORTAL_LOGIN_URL || process.env.PORTAL_BASE_URL;

  const browser = await chromium.launch({ headless: false });
  const context = fs.existsSync(SESSION)
    ? await browser.newContext({ storageState: SESSION, locale: 'cs-CZ' })
    : await browser.newContext({ locale: 'cs-CZ' });
  const page = await context.newPage();

  const endpointy: { method: string; url: string; status: number; soubor: string }[] = [];
  let poradi = 0;

  page.on('response', async (resp) => {
    try {
      const ct = resp.headers()['content-type'] || '';
      if (!ct.includes('application/json')) return;
      const req = resp.request();
      // GET/POST data; vynech statiku
      const url = resp.url();
      if (/\.(js|css|png|jpe?g|svg|woff2?|mp4)(\?|$)/i.test(url)) return;
      const body = await resp.text();
      poradi++;
      const zaklad = nazevZUrl(req.method(), url, poradi);
      fs.writeFileSync(path.join(OUT, `${zaklad}.json`), body, 'utf-8');
      endpointy.push({ method: req.method(), url, status: resp.status(), soubor: `${zaklad}.json` });
      console.log(`📥 ${req.method()} ${resp.status()} ${url.slice(0, 100)}`);
    } catch {
      // tělo nelze přečíst (stream/redirect) — přeskoč
    }
  });

  if (maStart) await page.goto(maStart, { waitUntil: 'domcontentloaded' }).catch(() => {});
  console.log('\n➡️  V okně se případně přihlas a PROKLIKEJ portál (analýza, produkty, klienti…).');
  console.log('   Každé JSON volání se zaznamená. Až budeš hotov/a, vrať se sem.');
  await pockejNaEnter('   Stiskni Enter pro uložení a ukončení… ');

  fs.writeFileSync(path.join(OUT, '_endpointy.json'), JSON.stringify(endpointy, null, 2), 'utf-8');
  // Pro pohodlí ulož i aktuální session (kdyby ses přihlašoval/a tady).
  await context.storageState({ path: SESSION }).catch(() => {});
  console.log(`\n✅ Zaznamenáno ${endpointy.length} JSON odpovědí → ${OUT}`);
  console.log('   Pošli mi _endpointy.json (mapa API) + 1–2 ukázkové .json a postavím import.');
  await browser.close();
}

main().catch((e) => { console.error('CHYBA:', e); process.exit(1); });
