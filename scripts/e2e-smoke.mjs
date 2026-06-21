// E2E smoke test (Playwright) — ověří kritickou cestu na běžící appce.
// Spuštění:  E2E_EMAIL=… E2E_HESLO=… node scripts/e2e-smoke.mjs [URL]
// (heslo NIKDY necommituj — bere se z env). Default URL = produkce.
import { chromium } from 'playwright';

const BASE = process.argv[2] || process.env.E2E_URL || 'https://poradcea-ai.vercel.app';
const EMAIL = process.env.E2E_EMAIL;
const HESLO = process.env.E2E_HESLO;
if (!EMAIL || !HESLO) { console.error('Chybí E2E_EMAIL / E2E_HESLO v env.'); process.exit(2); }
const JMENO = 'E2E ' + Math.random().toString(36).slice(2, 7);

let selhani = 0;
const ok = (podm, popis) => { console.log((podm ? '✓' : '✗') + ' ' + popis); if (!podm) selhani++; };

const b = await chromium.launch();
const page = await b.newPage();
const post500 = [];
page.on('response', (r) => { if (r.request().method() === 'POST' && r.status() >= 500) post500.push(`${r.status()} ${r.url().replace(BASE, '')}`); });

try {
  // 1) Gating + login
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  ok(page.url().includes('/login'), 'nepřihlášený přesměrován na /login');
  await page.fill('input[name="email"]', EMAIL);
  await page.fill('input[name="heslo"]', HESLO);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 });
  ok(true, 'přihlášení proběhlo');

  // 2) Založení klienta (serverová akce)
  await page.goto(BASE + '/klienti', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Nový klient/i }).first().click();
  await page.fill('input[placeholder*="Jan Novák"]', JMENO);
  await page.getByRole('button', { name: /Založit klienta/i }).click();
  await page.waitForSelector(`text=${JMENO}`, { timeout: 15000 });
  ok(true, 'klient založen (server akce 200)');
  ok((await page.locator('text=Postup případu').count()) > 0, 'kokpit „Postup případu" zobrazen');
  ok((await page.locator('text=Zajištění klienta').count()) > 0, '„Zajištění klienta" zobrazeno');

  // 3) Analýza na /plan (deterministická, bez AI) — nejdřív vyplnit základní profil
  await page.goto(BASE + '/plan', { waitUntil: 'networkidle' });
  await page.getByLabel('Věk', { exact: true }).fill('40');
  await page.getByLabel('Věk odchodu', { exact: true }).fill('65');
  await page.getByLabel('Čistý příjem', { exact: true }).fill('50000');
  await page.getByLabel('Výdaje', { exact: true }).fill('30000');
  await page.getByRole('button', { name: /Spočítat analýzu/i }).click();
  await page.waitForSelector('text=Klientská analýza', { timeout: 20000 });
  ok(true, 'analýza spočítána (Klientská analýza zobrazena)');
  ok((await page.locator('text=Mezery').count()) > 0, '„Mezery & potenciál" zobrazeno');

  ok(post500.length === 0, 'žádná serverová akce nevrátila 500' + (post500.length ? ` (${post500.join(', ')})` : ''));
} catch (e) {
  ok(false, 'výjimka: ' + (e.message || e).toString().slice(0, 160));
} finally {
  await b.close();
  console.log(selhani === 0 ? '\nVŠE OK' : `\nSELHALO: ${selhani}`);
  process.exit(selhani === 0 ? 0 : 1);
}
