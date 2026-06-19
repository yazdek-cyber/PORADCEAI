// Testy deterministických kalkulaček. Spuštění: npx tsx lib/kalkulacky/kalkulacky.test.ts
// Porovnáváme proti ručně ověřeným hodnotám a kontrolujeme klíčové invarianty.

import * as uvery from './uvery';
import * as investice from './investice';
import * as penze from './penze';
import * as pojisteni from './pojisteni';

let prosly = 0;
let selhaly = 0;

function ok(podminka: boolean, popis: string) {
  if (podminka) {
    prosly++;
  } else {
    selhaly++;
    console.error(`  ✗ ${popis}`);
  }
}
/** Přibližná rovnost (relativní tolerance) — pro plovoucí čárku. */
function blizko(a: number, b: number, tol = 0.01): boolean {
  if (b === 0) return Math.abs(a) < tol;
  return Math.abs(a - b) / Math.abs(b) <= tol;
}

console.log('— ÚVĚRY —');
{
  // Hypotéka 3 000 000, 5 % p.a., 30 let (360 měs.). Anuita ≈ 16 104,6 Kč.
  const splatka = uvery.anuitniSplatka(3_000_000, 0.05, 360);
  ok(blizko(splatka, 16104.6, 0.002), `anuita 3M/5%/30l ≈ 16104,6 (=${splatka.toFixed(1)})`);

  // Nulová sazba → prosté dělení.
  ok(uvery.anuitniSplatka(1_200_000, 0, 240) === 5000, 'anuita při 0 % = jistina/n');

  // Splátkový kalendář: zůstatek na konci = 0, součet úmorů = jistina.
  const k = uvery.splatkovyKalendar(1_000_000, 0.04, 120);
  ok(blizko(k.radky[k.radky.length - 1].zustatek, 0, 0.0001), 'kalendář končí na nule');
  const sumaUmoru = k.radky.reduce((a, r) => a + r.umor, 0);
  ok(blizko(sumaUmoru, 1_000_000, 0.0001), 'součet úmorů = jistina');
  ok(k.celkemUroky > 0 && k.celkemZaplaceno > 1_000_000, 'přeplatek je kladný');

  // Max úvěr: DSTI 45 % z 50k = 22,5k splátky → při vyšších splátkách rozhoduje DSTI.
  const mu = uvery.maxUver({ cistyMesicniPrijem: 50_000, rocniSazba: 0.05, pocetMesicu: 360 });
  ok(mu.maxUver > 0, `maxUver > 0 (=${mu.maxUver})`);
  ok(blizko(mu.splatkaPriMaxUveru, 22_500, 0.02), 'splátka při max ≈ 45 % příjmu (DSTI)');

  // LTV strop: nemovitost 2M, LTV 80 % → max 1,6M když je nejníž.
  const muLtv = uvery.maxUver({
    cistyMesicniPrijem: 200_000,
    rocniSazba: 0.05,
    pocetMesicu: 360,
    hodnotaNemovitosti: 2_000_000,
  });
  ok(muLtv.rozhodujiciLimit === 'LTV' && muLtv.maxUver === 1_600_000, 'LTV strop 80 % = 1,6M');

  // Refinancování: nižší sazba → kladná měsíční úspora a konečná návratnost.
  const ref = uvery.refinancovani({
    zbyvajiciJistina: 2_000_000,
    zbyvajiciMesicu: 240,
    stavajiciSazba: 0.06,
    novaSazba: 0.045,
    poplatkyZaRefinancovani: 15_000,
  });
  ok(ref.mesicniUspora > 0 && ref.vyplati, 'refinancování se vyplatí');
  ok(ref.navratnostMesicu !== null && ref.navratnostMesicu > 0, 'návratnost poplatků spočtena');

  // RPSN bez poplatků = EFEKTIVNÍ roční sazba z měsíčního úročení nominálních 5 %:
  // (1+0,05/12)^12 − 1 ≈ 5,116 %. (RPSN je vždy efektivní, proto > nominál.)
  const r0 = uvery.rpsn(1_000_000, 0.05, 120, 0, 0);
  ok(blizko(r0, 0.05116, 0.01), `RPSN bez poplatků ≈ 5,12 % efektivní (=${(r0 * 100).toFixed(2)} %)`);
  const r1 = uvery.rpsn(1_000_000, 0.05, 120, 20_000, 200);
  ok(r1 > r0, 'RPSN s poplatky > RPSN bez poplatků');
}

console.log('— INVESTICE —');
{
  // Jednorázová: 100k při 6 % na 10 let ≈ 179 084.
  ok(blizko(investice.budouciHodnota(100_000, 0.06, 10), 179_084, 0.001), 'FV jednorázová 100k/6%/10l');

  // Pravidelná: 5000/měs při 0 % na 10 let = 600k (prostý součet).
  ok(investice.budouciHodnotaPravidelna(5000, 0, 10) === 600_000, 'FV pravidelná při 0 % = vklady');

  // Reálná hodnota klesá s inflací.
  ok(investice.realnaHodnota(100_000, 0.03, 10) < 100_000, 'reálná hodnota < nominální');

  // TER ukrojí z výsledku → čistá < hrubá, ztráta kladná.
  const dp = investice.dopadPoplatku(100_000, 5000, 0.06, 0.015, 20);
  ok(dp.cistaHodnota < dp.hrubaHodnota && dp.ztrataNaPoplatcich > 0, 'TER snižuje výsledek');

  // Monte Carlo: reprodukovatelnost (stejný seed → stejný medián), p10<median<p90.
  const mcParams = {
    pocatecni: 100_000,
    mesicniVklad: 5000,
    roky: 20,
    ocekavanyVynos: 0.06,
    volatilita: 0.15,
    cilovaCastka: 2_000_000,
    pocetSimulaci: 3000,
    seed: 42,
  };
  const mc1 = investice.monteCarloProjekce(mcParams);
  const mc2 = investice.monteCarloProjekce(mcParams);
  ok(mc1.median === mc2.median, 'Monte Carlo je reprodukovatelné (stejný seed)');
  ok(mc1.p10 < mc1.median && mc1.median < mc1.p90, 'percentily seřazené p10<med<p90');
  ok(
    mc1.pravdepodobnostCile !== null && mc1.pravdepodobnostCile >= 0 && mc1.pravdepodobnostCile <= 1,
    `pravděpodobnost cíle v [0,1] (=${(mc1.pravdepodobnostCile! * 100).toFixed(0)} %)`
  );

  // Srovnání forem: levnější (nižší TER+vstupní) při stejném výnosu vyhraje.
  const sr = investice.srovnejFormy(100_000, 5000, 20, [
    { nazev: 'Drahý fond', ocekavanyVynos: 0.06, ter: 0.02, vstupniPoplatek: 0.03 },
    { nazev: 'ETF', ocekavanyVynos: 0.06, ter: 0.002, vstupniPoplatek: 0 },
  ]);
  ok(sr[0].nazev === 'ETF' && sr[0].poradi === 1, 'levnější forma (ETF) je první');
  ok(sr[0].cistaHodnota > sr[1].cistaHodnota, 'nižší poplatky = vyšší čistá hodnota');
}

console.log('— PENZE —');
{
  // Státní příspěvek DPS: <500 → 0; 1000 → 200; 1700+ → strop 340.
  ok(penze.statniPrispevekDPS(300) === 0, 'DPS pod 500 Kč = 0');
  ok(penze.statniPrispevekDPS(1000) === 200, 'DPS 1000 → 200 (20 %)');
  ok(penze.statniPrispevekDPS(3000) === 340, 'DPS strop 340');

  // Projekce: započte státní příspěvek, kapitál > vložené (díky výnosu).
  const pp = penze.projekcePenze({
    vlastniPrispevek: 1700,
    prispevekZamestnavatele: 1000,
    rocniVynos: 0.05,
    aktualniVek: 35,
    vekOdchodu: 65,
  });
  ok(pp.mesicniStatniPrispevek === 340, 'projekce zapojí státní 340');
  ok(pp.celkemMesicneSpori === 1700 + 1000 + 340, 'měsíčně spoří vlastní+zaměstn.+stát');
  ok(pp.nasporenyKapital > pp.vlozenoCelkem, 'kapitál > vložené (výnos kladný)');
  ok(pp.letDoOdchodu === 30, 'let do odchodu = 30');

  // Renta z kapitálu: vyčerpá kapitál za dobu výplaty (kladná, rozumná).
  const renta = penze.mesicniRentaZKapitalu(3_000_000, 0.03, 25);
  ok(renta > 0 && renta < 3_000_000, `renta z 3M/3%/25l rozumná (=${renta.toFixed(0)})`);

  // Mezera v důchodu: vysoký cíl, nulový kapitál → mezera kladná, nepokryto.
  const mez = penze.mezeraVDuchodu({
    cilovaMesicniRenta: 30_000,
    ocekavanaStatniPenze: 18_000,
    naprojektovanyKapital: 0,
    rocniVynosVDuchodu: 0.03,
    letVyplaty: 25,
  });
  ok(!mez.pokryto && mez.mesicniMezera > 0, 'nulový kapitál → mezera v důchodu');
  ok(mez.potrebnaRentaZeSporeni === 12_000, 'potřebná renta = cíl − státní (30k−18k)');
  ok(mez.potrebnyKapital > 0, 'potřebný kapitál pro cíl spočten');
}

console.log('— POJIŠTĚNÍ —');
{
  // Rezerva: 30k výdaje × 6 měsíců = 180k; s 50k naspořenými chybí 130k.
  const rez = pojisteni.rezerva(30_000, 6, 50_000);
  ok(rez.doporucenaRezerva === 180_000 && rez.chybiDoRezervy === 130_000, 'rezerva 6 měs.');

  // Příjmová metoda: 600k ročně × 10 let = 6M.
  ok(pojisteni.pojistnaPotreba_prijmova(600_000, 10) === 6_000_000, 'příjmová metoda 10 let');

  // DIME: dluhy 200k + příjem 50k×12×15 + hypotéka 2,5M + děti 1M − již 300k.
  const dime = pojisteni.pojistnaPotreba_DIME({
    dluhy: 200_000,
    mesicniPrijem: 50_000,
    rokyNahradyPrijmu: 15,
    hypoteka: 2_500_000,
    nakladyNaDeti: 1_000_000,
    jizKDispozici: 300_000,
  });
  // nahrada = 50000*12*15 = 9 000 000; hrubá = 200k+9M+2,5M+1M = 12,7M; − 300k = 12,4M
  ok(dime.nahradaPrijmu === 9_000_000, 'DIME náhrada příjmu = 9M');
  ok(dime.doporucenaPojistnaCastka === 12_400_000, 'DIME doporučená částka = 12,4M');
}

console.log('');
console.log(`Výsledek: ${prosly} prošlo, ${selhaly} selhalo.`);
if (selhaly > 0) process.exit(1);
