'use client';

// MEZERY & POTENCIÁL — POHLED PRO PORADCE (ne pro klienta; v tisku klientského PDF skrytý).
// Konsoliduje mezery mezi tím, co klient MÁ, a co POTŘEBUJE — z reálných podkladů (Vypocty).
// Mezera = potřeba klienta podložená jeho čísly = zároveň příležitost poradce. NE maximalizace provize:
// každý řádek je obhajitelný daty (drží princip nestrannosti a povinnost jednat v zájmu klienta).
import type { Vypocty } from '@/lib/financniPlan';
import type { KlientCisla } from '@/components/KlientskaAnalyza';
import { TrendingUp, Info, Coins } from 'lucide-react';
import { type KarierniStupen, odhadProvize } from '@/lib/provize';

const f = (x: number) => Math.round(x).toLocaleString('cs-CZ');

interface Radek {
  oblast: string;
  ma: string;
  potreba: string;
  mezera: number;       // pro řazení / souhrn (0 = bez mezery)
  mezeraText: string;
  akce: string;
  jednotka: 'měs' | 'Kč';
}

export default function PotencialMezery({ v, klient, stupen }: { v: Vypocty; klient: KlientCisla; stupen?: KarierniStupen | null }) {
  if (!v || !v.rezerva || !v.penze) return null;

  const prijem = klient.cistyPrijem ?? 0;
  const vydaje = klient.vydaje ?? 0;
  const investVklad = klient.mesicniVkladInvestice ?? 0;
  const penzeVklad = klient.penzeMesicniVklad ?? 0;

  // Volný cashflow, který zatím nejde do tvorby majetku / ochrany.
  const volnyCashflow = Math.max(0, prijem - vydaje - investVklad - penzeVklad);

  const rezervaMa = Math.max(0, v.rezerva.doporucenaRezerva - v.rezerva.chybiDoRezervy);
  const penzeMezeraMes = Math.max(0, v.penze.mezera?.mesicniMezera ?? 0);
  const penzeKapitalPotreba = v.penze.potrebnyKapitalRentaKFP ?? 0;
  const refi = v.uvery?.refinancovani;
  const refiUspora = refi && refi.vyplati ? refi.mesicniUspora : 0;

  // Pojistná rizika: POTŘEBA (z kalkulačky eDO/EFPA) vs. SOUČASNÉ KRYTÍ (z existujících smluv) → MEZERA.
  const rizika: { nazev: string; potreba: number; ma: number; akce: string }[] = [
    { nazev: 'Smrt', potreba: v.edoKryti?.smrt ?? v.efpaKryti?.smrt ?? 0, ma: klient.soucasneKrytiSmrt ?? 0, akce: 'Sjednat/navýšit krytí smrti (ŽP)' },
    { nazev: 'Invalidita', potreba: v.edoKryti?.invalidita ?? v.efpaKryti?.invalidita ?? 0, ma: klient.soucasneKrytiInvalidita ?? 0, akce: 'Sjednat/navýšit invaliditu (ŽP)' },
    { nazev: 'Závažná onemocnění', potreba: v.edoKryti?.zavazneOnemocneni ?? 0, ma: klient.soucasneKrytiZO ?? 0, akce: 'Sjednat/navýšit závažná onemocnění' },
    { nazev: 'Trvalé následky úrazu', potreba: v.edoKryti?.trvaleNasledkyUrazu ?? v.efpaKryti?.trvaleNasledkyUrazu ?? 0, ma: klient.soucasneKrytiTN ?? 0, akce: 'Sjednat/navýšit TN úrazu' },
  ];
  const pojistneRadky: Radek[] = rizika
    .filter((r) => r.potreba > 0)
    .map((r) => {
      const mezera = Math.max(0, r.potreba - r.ma);
      return {
        oblast: `Pojištění — ${r.nazev}`,
        ma: `${f(r.ma)} Kč`,
        potreba: `${f(r.potreba)} Kč`,
        mezera,
        mezeraText: mezera > 0 ? `${f(mezera)} Kč` : 'pokryto ✓',
        akce: r.akce,
        jednotka: 'Kč' as const,
      };
    });

  const radky: Radek[] = [
    {
      oblast: 'Likvidní rezerva',
      ma: `${f(rezervaMa)} Kč`,
      potreba: `${f(v.rezerva.doporucenaRezerva)} Kč`,
      mezera: v.rezerva.chybiDoRezervy,
      mezeraText: v.rezerva.chybiDoRezervy > 0 ? `${f(v.rezerva.chybiDoRezervy)} Kč` : '—',
      akce: 'Doplnit rezervu (spořicí účet / fond peněžního trhu)',
      jednotka: 'Kč',
    },
    ...pojistneRadky,
    {
      oblast: 'Penze a renta',
      ma: `${f(klient.penzeMesicniVklad ?? 0)} Kč/měs`,
      potreba: `kapitál ${f(penzeKapitalPotreba)} Kč`,
      mezera: penzeMezeraMes,
      mezeraText: penzeMezeraMes > 0 ? `${f(penzeMezeraMes)} Kč/měs renty` : '—',
      akce: 'Navýšit DPS / pravidelnou investici na rentu',
      jednotka: 'měs',
    },
    {
      oblast: 'Růst majetku',
      ma: `${f(investVklad)} Kč/měs`,
      potreba: `volné ${f(volnyCashflow)} Kč/měs`,
      mezera: volnyCashflow,
      mezeraText: volnyCashflow > 0 ? `${f(volnyCashflow)} Kč/měs nevyužito` : '—',
      akce: 'Investovat volný cashflow dle rizikového profilu',
      jednotka: 'měs',
    },
  ];
  if (refiUspora > 0) {
    radky.push({
      oblast: 'Úvěry',
      ma: 'stávající sazba',
      potreba: 'refinancování',
      mezera: refiUspora,
      mezeraText: `úspora ${f(refiUspora)} Kč/měs`,
      akce: 'Refinancovat hypotéku za nižší sazbu',
      jednotka: 'měs',
    });
  }

  const otevrene = radky.filter((r) => r.mezera > 0).length;

  return (
    <div className="rounded-2xl border border-accent-100 bg-accent-50/30 p-5 shadow-soft print:hidden">
      <div className="flex items-start justify-between gap-3 mb-1">
        <h3 className="text-base font-bold text-primary flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-accent" /> Mezery &amp; potenciál <span className="text-[11px] font-semibold text-slate-400">(pro poradce)</span>
        </h3>
        <div className="text-right shrink-0">
          <div className="text-xl font-extrabold text-accent-700">{f(volnyCashflow)} Kč/měs</div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wide">volný měsíční potenciál</div>
        </div>
      </div>
      <p className="text-xs text-slate-500 mb-3">{otevrene} otevřených mezer mezi tím, co klient má, a co potřebuje — z jeho reálných čísel.</p>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wide text-slate-400">
              <th className="py-1.5 pr-2 font-bold">Oblast</th>
              <th className="py-1.5 px-2 font-bold">Klient má</th>
              <th className="py-1.5 px-2 font-bold">Potřeba</th>
              <th className="py-1.5 px-2 font-bold">Mezera</th>
              <th className="py-1.5 pl-2 font-bold">Co s tím</th>
            </tr>
          </thead>
          <tbody>
            {radky.map((r) => (
              <tr key={r.oblast} className="border-t border-slate-100 align-top">
                <td className="py-2 pr-2 font-semibold text-slate-800">{r.oblast}</td>
                <td className="py-2 px-2 text-slate-600">{r.ma}</td>
                <td className="py-2 px-2 text-slate-600">{r.potreba}</td>
                <td className={`py-2 px-2 font-bold ${r.mezera > 0 ? 'text-accent-700' : 'text-slate-400'}`}>{r.mezeraText}</td>
                <td className="py-2 pl-2 text-slate-600">{r.akce}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* SEKUNDÁRNÍ: orientační provizní přehled (jen pro poradce, nikdy ne klientovi). */}
      <div className="mt-3 rounded-xl border border-slate-200 bg-white/70 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5"><Coins className="h-4 w-4 text-slate-400" />Potenciál &amp; provize (interní přehled)</span>
          {stupen
            ? <span className="text-[10px] font-semibold text-slate-400">{stupen.nazev}</span>
            : <a href="/nastaveni" className="text-[10px] font-bold text-primary hover:underline">nastavit kariérní stupeň →</a>}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-center">
          <div className="rounded-lg bg-slate-50 py-1.5">
            <div className="text-sm font-bold text-slate-800">{f(volnyCashflow)} Kč/měs</div>
            <div className="text-[10px] text-slate-400">objem do tvorby majetku</div>
          </div>
          <div className="rounded-lg bg-slate-50 py-1.5">
            <div className="text-sm font-bold text-accent-700">{stupen ? `≈ ${f(odhadProvize(volnyCashflow * 12, 'investice', stupen))} Kč` : '—'}</div>
            <div className="text-[10px] text-slate-400">orientační roční provize</div>
          </div>
        </div>
        <p className="text-[10px] text-slate-400 mt-2">
          Orientačně (sazby se mění dle provizních listin). Provize <strong>neřídí doporučení</strong> — to vychází z potřeb klienta;
          tohle je jen přehled potenciálu. Pojištění/úvěry závisí na konkrétním produktu.
        </p>
      </div>

      <div className="mt-3 flex gap-2 rounded-xl bg-white/70 border border-accent-100 p-2.5">
        <Info className="h-4 w-4 text-accent shrink-0 mt-0.5" />
        <p className="text-[11px] leading-relaxed text-slate-600">
          Mezery jsou <strong>potřeby klienta podložené jeho čísly</strong> — řešte je v jeho zájmu (komplexní zajištění klienta).
          U pojištění je mezera = <strong>potřeba − současné krytí</strong> ze smluv (zadejte je v profilu plánu).
        </p>
      </div>
    </div>
  );
}
