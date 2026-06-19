// Hromadný import metodických PDF do RAG knowledge base.
//
// Použití:
//   1) stáhni metodická PDF (bez osobních dat klientů!) do složky ./metodika/
//      (např. EFPA Metodika pojištění osob/vozidel, mBank úvěry, eDO START…)
//   2) npx tsx --env-file=.env.local scripts/ingest-metodika.ts
//
// Každé PDF se zpracuje standardní pipelinou (vč. OCR fallbacku) s doménou 'metodika'
// a poskytovatelem 'eDO'. Soubor projde rovnou do embeddingů — neprotéká kontextem AI.

import fs from 'node:fs';
import path from 'node:path';
import { processPdf } from '../lib/documentProcessor';

const DIR = path.join(process.cwd(), 'metodika');

async function main() {
  if (!fs.existsSync(DIR)) {
    console.error(`Složka ${DIR} neexistuje. Vytvoř ji a vlož metodická PDF.`);
    process.exit(1);
  }
  const soubory = fs.readdirSync(DIR).filter((f) => f.toLowerCase().endsWith('.pdf'));
  if (soubory.length === 0) {
    console.error('Ve složce metodika/ nejsou žádná PDF.');
    process.exit(1);
  }
  console.log(`Nalezeno ${soubory.length} PDF. Importuji…\n`);

  let ok = 0;
  for (const f of soubory) {
    const buf = fs.readFileSync(path.join(DIR, f));
    const nazev = f.replace(/\.pdf$/i, '');
    try {
      const res = await processPdf(buf, nazev, 'eDO', 'metodika');
      if (res.success) {
        ok++;
        console.log(`✅ ${f} → ${res.chunkCount} chunků${res.pouzitoOcr ? ' (OCR)' : ''}`);
      } else {
        console.log(`✗ ${f} → ${res.error}`);
      }
    } catch (e) {
      console.log(`✗ ${f} → ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  console.log(`\nHotovo: ${ok}/${soubory.length} dokumentů v knowledge base (doména 'metodika').`);
}
main().catch((e) => { console.error('CHYBA:', e); process.exit(1); });
