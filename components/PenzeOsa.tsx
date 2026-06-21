'use client';

// PENZE „V KOLIKA S KOLIKA" (eDO) — osa od dnešního věku po odchod do důchodu: kolik měsíčně spoří
// (vlastní + zaměstnavatel + stát), jaký kapitál naspoří, jakou rentu z něj utáhne vs. cíl + mezera.
// Navíc DAŇOVÁ ÚSPORA z DPS (eDO argument). Vše deterministicky z v.penze + kalkulačky DPS.
import type { Vypocty } from '@/lib/financniPlan';
import type { KlientCisla } from '@/components/KlientskaAnalyza';
import { Karta } from '@/components/ui';
import { penze } from '@/lib/kalkulacky';
import { PiggyBank, Landmark, TrendingUp, Receipt } from 'lucide-react';

const f = (x: number) => Math.round(x).toLocaleString('cs-CZ');

export default function PenzeOsa({ v, klient, vek, vekOdchodu }: { v: Vypocty; klient: KlientCisla; vek?: number; vekOdchodu?: number }) {
  if (!v?.penze?.projekce || !v.penze.mezera) return null;
  const pr = v.penze.projekce;
  const mez = v.penze.mezera;
  const vekTeated = vek ?? 0;
  const vekOd = vekOdchodu ?? (vekTeated + pr.letDoOdchodu);
  const dan = penze.danovaUsporaDPS(klient.penzeMesicniVklad ?? 0);

  // poměr pokrytí renty (dosažitelná / potřebná) pro pruh
  const potrebna = mez.potrebnaRentaZeSporeni;
  const dosazitelna = mez.dosazitelnaRenta;
  const podil = potrebna > 0 ? Math.min(1, dosazitelna / potrebna) : 1;

  return (
    <Karta
      ikona={<PiggyBank className="h-4 w-4 text-accent" />}
      titulek="Penze — v kolika s kolika"
      popis="Co stihnete naspořit do důchodu a jakou rentu z toho budete čerpat."
      className="lg:col-span-2 print:col-span-2"
    >
      {/* OSA věk → odchod → čerpání */}
      <div className="flex items-center gap-2 text-center">
        <div className="flex-1">
          <div className="text-lg font-extrabold text-primary">{vekTeated || '—'}</div>
          <div className="text-[10px] text-slate-400">dnes</div>
        </div>
        <div className="flex-[3] relative">
          <div className="h-1.5 rounded-full bg-gradient-to-r from-primary-200 to-accent" />
          <div className="text-[10px] text-slate-500 mt-1">spoříte {pr.letDoOdchodu} let · {f(pr.celkemMesicneSpori)} Kč/měs</div>
        </div>
        <div className="flex-1">
          <div className="text-lg font-extrabold text-accent-700">{vekOd}</div>
          <div className="text-[10px] text-slate-400">odchod</div>
        </div>
      </div>

      {/* Z čeho se měsíční úložka skládá */}
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        {[
          ['Vlastní + zaměstnavatel', pr.celkemMesicneSpori - pr.mesicniStatniPrispevek],
          ['Státní příspěvek', pr.mesicniStatniPrispevek],
          ['Celkem měsíčně', pr.celkemMesicneSpori],
        ].map(([l, val]) => (
          <div key={l as string} className="rounded-lg bg-slate-50 py-1.5">
            <div className="text-sm font-bold text-slate-800">{f(val as number)}</div>
            <div className="text-[10px] text-slate-400">{l as string} Kč/m</div>
          </div>
        ))}
      </div>

      {/* Naspořený kapitál + složení */}
      <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide"><TrendingUp className="h-3.5 w-3.5 text-accent" />Kapitál k odchodu</span>
          <span className="text-lg font-extrabold text-primary">{f(pr.nasporenyKapital)} Kč</span>
        </div>
        <div className="mt-1.5 flex h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
          <div className="h-2.5 bg-slate-400" style={{ width: `${pr.nasporenyKapital > 0 ? (pr.vlozenoCelkem / pr.nasporenyKapital) * 100 : 0}%` }} />
          <div className="h-2.5 bg-positive" style={{ width: `${pr.nasporenyKapital > 0 ? (pr.vynosCelkem / pr.nasporenyKapital) * 100 : 0}%` }} />
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-slate-500">
          <span>vloženo {f(pr.vlozenoCelkem)} Kč</span>
          <span className="text-positive font-semibold">výnos {f(pr.vynosCelkem)} Kč</span>
        </div>
      </div>

      {/* Renta: dosažitelná vs. potřebná + mezera */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-[11px] mb-1">
          <span className="flex items-center gap-1.5 font-semibold text-slate-600"><Landmark className="h-3.5 w-3.5 text-accent" />Měsíční renta v důchodu</span>
          <span className={`font-bold ${mez.pokryto ? 'text-positive' : 'text-accent-700'}`}>
            {mez.pokryto ? '✓ cíl pokryt' : `mezera ${f(mez.mesicniMezera)} Kč/m`}
          </span>
        </div>
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-200">
          <div className="h-3 bg-positive" style={{ width: `${podil * 100}%` }} />
          <div className="h-3 bg-accent/70" style={{ width: `${(1 - podil) * 100}%` }} />
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-slate-500">
          <span>z vlastního spoření {f(dosazitelna)} Kč/m</span>
          <span className="font-semibold text-slate-700">potřeba navíc ke státní {f(potrebna)} Kč/m</span>
        </div>
      </div>

      {/* Daňová úspora */}
      {dan.rocniUspora > 0 && (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-accent-50 px-3 py-2">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600"><Receipt className="h-4 w-4 text-accent" />Daňová úspora z DPS (ročně)</span>
          <span className="text-lg font-extrabold text-accent-700">{f(dan.rocniUspora)} Kč</span>
        </div>
      )}

      <div className="mt-3 flex gap-2 rounded-xl bg-primary-50/60 p-2.5">
        <PiggyBank className="h-4 w-4 text-accent shrink-0 mt-0.5" />
        <p className="text-[11px] leading-relaxed text-slate-600">
          {mez.pokryto
            ? 'Při současném nastavení důchodový cíl vychází — držte spoření a navyšujte ho s růstem příjmu.'
            : `Aby renta dosáhla na cíl, je potřeba doplnit měsíční mezeru ${f(mez.mesicniMezera)} Kč. Čím dřív, tím méně to měsíčně bolí — pracuje za vás čas a výnos.`}
          {dan.rocniUspora > 0 && ` Stát navíc přispívá ${f(pr.mesicniStatniPrispevek)} Kč/měs a na dani ušetříte ${f(dan.rocniUspora)} Kč ročně.`}
        </p>
      </div>
    </Karta>
  );
}
