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

  // OPRAVA auditu: DTI zohledňuje stávající dluh → menší prostor pro nový úvěr.
  const muBezDluhu = uvery.maxUver({ cistyMesicniPrijem: 50_000, rocniSazba: 0.05, pocetMesicu: 360 });
  const muSDluhem = uvery.maxUver({ cistyMesicniPrijem: 50_000, stavajiciCelkovyDluh: 3_000_000, rocniSazba: 0.05, pocetMesicu: 360 });
  ok(muSDluhem.dleDTI === muBezDluhu.dleDTI - 3_000_000, 'DTI: stávající dluh se odečítá od stropu');

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

  // OSVČ paušál: obrat 900k, volná živnost (60 %) → roční 540k, měsíční 45k.
  const osvc = uvery.osvcPrijemPausal(900_000, 'volna');
  ok(osvc.rocniPrijem === 540_000 && blizko(osvc.mesicniPrijem, 45_000, 0.0001), 'OSVČ 900k×60% = 45k/měs');
  // Strop obratu 1 mil.: obrat 1,5M se ořízne na 1M.
  const osvcLimit = uvery.osvcPrijemPausal(1_500_000, 'remeslna');
  ok(osvcLimit.pouzityObrat === 1_000_000 && osvcLimit.nadLimit === true, 'OSVČ obrat nad 1M ořezán na 1M + nadLimit');
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

console.log('— INVESTICE: alokace a výnosy KFP —');
{
  // Alokace dle horizontu (Morningstar): 1 rok → 8 % akcií; 18 let → 83 %; 40 let → 93 %.
  ok(investice.alokaceDleHorizontu(1).akcie === 0.08, 'alokace 1 rok = 8 % akcií');
  ok(investice.alokaceDleHorizontu(18).akcie === 0.83, 'alokace 18 let = 83 % akcií');
  ok(investice.alokaceDleHorizontu(40).akcie === 0.93, 'alokace 40 let = 93 % akcií');
  const a = investice.alokaceDleHorizontu(10);
  ok(blizko(a.akcie + a.dluhopisy + a.hotovost, 1, 0.0001), 'alokace sčítá na 100 %');

  // Historické reálné výnosy.
  ok(investice.VYNOSY_REALNE.akcie === 0.0727, 'reálný výnos akcií 7,27 %');
  // Výnos portfolia 18 let (83/15/2) ≈ 6,3 % (statická alokace).
  ok(blizko(investice.ocekavanyVynosDleHorizontu(18), 0.0631, 0.02), `výnos portfolia 18 let ≈ 6,3 % (=${(investice.ocekavanyVynosDleHorizontu(18)*100).toFixed(2)} %)`);

  // Kolik investovat na cíl: 500k za 15 let při 4,4 % → rozumné jednorázové/měsíční > 0.
  const ki = investice.kolikInvestovat(500_000, 15, 0.044);
  ok(ki.jednorazove > 0 && ki.jednorazove < 500_000, 'kolikInvestovat jednorázově < cíl');
  ok(ki.mesicni > 0 && ki.mesicni * 12 * 15 < 500_000, 'kolikInvestovat měsíčně sumárně < cíl (výnos pomáhá)');
  // S již naspořenou částkou pokrývající cíl → potřeba 0.
  const ki0 = investice.kolikInvestovat(100_000, 10, 0.05, 100_000);
  ok(ki0.jednorazove === 0 && ki0.mesicni === 0, 'kolikInvestovat: naspořeno pokrývá cíl → 0');
  // OPRAVA auditu: horizont 0 → žádné dělení nulou, vrátí konečná čísla (celá částka hned).
  const kiNula = investice.kolikInvestovat(100_000, 0, 0.05);
  ok(Number.isFinite(kiNula.mesicni) && Number.isFinite(kiNula.jednorazove), 'kolikInvestovat roky=0 → konečné (ne Infinity)');
  // OPRAVA auditu: Monte Carlo s pocetSimulaci 0 → guard, percentily konečné.
  const mc0 = investice.monteCarloProjekce({ pocatecni: 1000, mesicniVklad: 0, roky: 1, ocekavanyVynos: 0.05, volatilita: 0.1, pocetSimulaci: 0 });
  ok(Number.isFinite(mc0.median) && Number.isFinite(mc0.p10), 'monteCarlo pocetSimulaci=0 → konečné percentily (ne NaN)');

  // AFP glide-path výnosy: cíl 15 let = 4,4 %, renta 20 let = 5,7 %.
  ok(investice.ocekavanyVynosCile(15) === 0.044, 'AFP výnos cíle 15 let = 4,4 %');
  ok(investice.ocekavanyVynosCile(3) === 0.025, 'AFP výnos cíle 3 roky = 2,5 %');
  ok(investice.ocekavanyVynosRenta(20) === 0.057, 'AFP výnos renty 20 let = 5,7 %');
}

console.log('— PENZE: renta dle KFP (×200) —');
{
  // 30 000 Kč renta → 6 mil. majetku; 1 mil. → 5 000 Kč renty.
  ok(penze.majetekProRentu(30_000) === 6_000_000, 'majetek pro rentu 30k = 6 mil. (×200)');
  ok(penze.rentaZMajetku(1_000_000) === 5_000, 'renta z 1 mil. = 5 000 Kč');
}

console.log('— POJIŠTĚNÍ: EFPA + rezerva úrovně —');
{
  // Likvidní rezerva 3/6/12× výdaje.
  const ru = pojisteni.rezervaUrovne(30_000);
  ok(ru.kratkodoba === 90_000 && ru.ztrataPrace === 180_000 && ru.dlouhodobaNemoc === 360_000, 'rezerva 3/6/12× výdaje');

  // EFPA: deficit smrt 20k × 200 = 4M; − sirotčí 2×1M − vdovský 2M = 4M → smrt 0; bez dětí/majetku jiné.
  const efpa = pojisteni.pojistnaPotreba_EFPA({
    mesicniDeficitSmrt: 20_000, mesicniDeficitInvalidita: 25_000, pocetDeti: 2, sezdany: true,
  });
  ok(efpa.potrebaSmrtHruba === 4_000_000, 'EFPA potřeba smrt hrubá = deficit×200');
  // smrt = 4M − (2×1M + 2M vdovský) = 0
  ok(efpa.smrt === 0, 'EFPA smrt po dávkách (2 děti + vdovský) = 0');
  // invalidita = 25k×200=5M − 2M invalidní = 3M; TNÚ = 1,5M
  ok(efpa.invalidita === 3_000_000, 'EFPA invalidita = deficit×200 − 2M');
  ok(efpa.trvaleNasledkyUrazu === 1_500_000, 'EFPA TNÚ = ½ invalidity');

  // Bez dětí/manželství: smrt = deficit×200 − majetek.
  const efpa2 = pojisteni.pojistnaPotreba_EFPA({
    mesicniDeficitSmrt: 15_000, mesicniDeficitInvalidita: 18_000, pocetDeti: 0, sezdany: false, soucasnyMajetek: 500_000,
  });
  ok(efpa2.smrt === 15_000*200 - 500_000, 'EFPA smrt singl = deficit×200 − majetek');
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

  // eDO praxe: příjem 50k/měs (600k ročně) → smrt/invalidita 1,8M, ZO 600k, TN dle věku.
  const edo = pojisteni.pojistnaPotreba_eDO({ mesicniCistyPrijem: 50_000, vek: 38 });
  ok(edo.smrt === 1_800_000 && edo.invalidita === 1_800_000, 'eDO smrt/invalidita = 3× roční příjem');
  ok(edo.zavazneOnemocneni === 600_000, 'eDO závažná onemocnění = 1× roční příjem');
  ok(edo.pracovniNeschopnostMesicniDorovnani === 20_000, 'eDO PN dorovnání ≈ 40 % příjmu');
  ok(edo.trvaleNasledkyUrazu === 2_000_000, 'eDO TN do 45 let = 2 mil.');
  ok(pojisteni.pojistnaPotreba_eDO({ mesicniCistyPrijem: 50_000, vek: 50 }).trvaleNasledkyUrazu === 1_000_000, 'eDO TN nad 45 let = 1 mil.');

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
