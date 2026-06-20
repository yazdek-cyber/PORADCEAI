'use client';

import type { Vypocty } from '@/lib/financniPlan';
import { ShieldCheck, TrendingUp, Home, PiggyBank, Target, Wallet } from 'lucide-react';
import { AlokaceVizual } from '@/components/Vizualy';

const f = (x: number) => Math.round(x).toLocaleString('cs-CZ');
const pct = (x: number) => (x * 100).toFixed(1).replace('.0', '') + ' %';

function Karta({ ikona, titulek, children }: { ikona: React.ReactNode; titulek: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h4 className="text-sm font-bold text-primary mb-2 flex items-center gap-1.5">{ikona}{titulek}</h4>
      {children}
    </div>
  );
}

/** Vizuální přehled spočítaných podkladů (deterministická čísla) — nad AI textem plánu. */
export default function PlanPrehled({ v }: { v: Vypocty }) {
  const rezPokryto = v.rezerva.doporucenaRezerva > 0
    ? Math.min(100, ((v.rezerva.doporucenaRezerva - v.rezerva.chybiDoRezervy) / v.rezerva.doporucenaRezerva) * 100)
    : 100;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {/* Rezerva */}
      <Karta ikona={<Wallet className="h-4 w-4 text-accent" />} titulek="Finanční rezerva (6× výdaje)">
        <div className="text-lg font-bold text-slate-800">{f(v.rezerva.doporucenaRezerva)} Kč</div>
        <div className="mt-1 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
          <div style={{ width: `${rezPokryto}%` }} className="h-2 bg-green-500" />
        </div>
        <div className="text-[11px] text-slate-500 mt-1">
          {v.rezerva.chybiDoRezervy > 0 ? `Chybí ${f(v.rezerva.chybiDoRezervy)} Kč` : 'Pokryto ✓'} · úrovně 3×/6×/12×: {f(v.rezervaUrovne.kratkodoba)} / {f(v.rezervaUrovne.ztrataPrace)} / {f(v.rezervaUrovne.dlouhodobaNemoc)} Kč
        </div>
      </Karta>

      {/* Pojištění — 3 metody */}
      <Karta ikona={<ShieldCheck className="h-4 w-4 text-accent" />} titulek="Potřeba krytí (3 metody)">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-slate-400 text-left"><th className="font-semibold">Metoda</th><th className="font-semibold text-right">Smrt</th><th className="font-semibold text-right">Invalidita</th></tr>
          </thead>
          <tbody className="text-slate-700">
            <tr><td>DIME</td><td className="text-right" colSpan={2}>{f(v.pojistnaPotreba.doporucenaPojistnaCastka)} Kč (celkem)</td></tr>
            <tr><td>eDO (3× příjem)</td><td className="text-right">{f(v.edoKryti.smrt)}</td><td className="text-right">{f(v.edoKryti.invalidita)}</td></tr>
            <tr><td>EFPA (×200)</td><td className="text-right">{f(v.efpaKryti.smrt)}</td><td className="text-right">{f(v.efpaKryti.invalidita)}</td></tr>
          </tbody>
        </table>
        <div className="text-[11px] text-slate-500 mt-1">eDO: závažná onem. {f(v.edoKryti.zavazneOnemocneni)} Kč · TNÚ {f(v.efpaKryti.trvaleNasledkyUrazu)} Kč</div>
      </Karta>

      {/* Investice — alokace + projekce */}
      <Karta ikona={<TrendingUp className="h-4 w-4 text-accent" />} titulek={`Investice (horizont ${v.investice.horizontLet} let)`}>
        <AlokaceVizual {...v.investice.doporucenaAlokace} />
        <div className="text-[11px] text-slate-500 mt-1.5">Oček. reálný výnos: <strong className="text-slate-700">{pct(v.investice.ocekavanyVynosKFP)}</strong> p.a.</div>
        <div className="mt-1.5 text-xs text-slate-700">
          Projekce: <span className="text-red-600">{f(v.investice.monteCarlo.p10)}</span> · <strong>{f(v.investice.monteCarlo.median)}</strong> · <span className="text-green-600">{f(v.investice.monteCarlo.p90)}</span> Kč
          <span className="block text-[10px] text-slate-400">pesimistický · medián · optimistický</span>
        </div>
      </Karta>

      {/* Úvěry */}
      <Karta ikona={<Home className="h-4 w-4 text-accent" />} titulek="Úvěry / bydlení">
        <div className="text-sm text-slate-700">Max. úvěr: <strong>{f(v.uvery.maxUver.maxUver)} Kč</strong> <span className="text-[11px] text-slate-400">({v.uvery.maxUver.rozhodujiciLimit})</span></div>
        <div className="text-[11px] text-slate-500">Splátka ~{f(v.uvery.maxUver.splatkaPriMaxUveru)} Kč · sazba {pct(v.uvery.trzniSazba)}</div>
        {v.uvery.refinancovani && (
          <div className={`text-[11px] mt-1 ${v.uvery.refinancovani.vyplati ? 'text-green-700' : 'text-slate-500'}`}>
            Refinancování: {v.uvery.refinancovani.vyplati ? `úspora ${f(v.uvery.refinancovani.mesicniUspora)} Kč/měs (návratnost ${v.uvery.refinancovani.navratnostMesicu} měs.)` : 'nevyplatí se'}
          </div>
        )}
      </Karta>

      {/* Cíle */}
      {v.cile.length > 0 && (
        <Karta ikona={<Target className="h-4 w-4 text-accent" />} titulek="Cíle klienta">
          <div className="space-y-1.5">
            {v.cile.map((c, i) => (
              <div key={i} className="text-xs">
                <div className="flex justify-between"><span className="font-semibold text-slate-800">{c.nazev}</span><span className="text-slate-500">{f(c.castka)} Kč / {c.roky} let</span></div>
                <div className="text-[11px] text-slate-500">měsíčně {f(c.mesicni)} Kč nebo jednorázově {f(c.jednorazove)} Kč · akcie {pct(c.alokace.akcie)}</div>
              </div>
            ))}
          </div>
        </Karta>
      )}

      {/* Penze */}
      <Karta ikona={<PiggyBank className="h-4 w-4 text-accent" />} titulek="Penze / renta">
        <div className="text-sm text-slate-700">Kapitál k důchodu: <strong>{f(v.penze.projekce.nasporenyKapital)} Kč</strong></div>
        <div className="text-[11px] text-slate-500">Měs. spoří {f(v.penze.projekce.celkemMesicneSpori)} Kč (stát {f(v.penze.projekce.mesicniStatniPrispevek)} Kč)</div>
        <div className={`text-[11px] mt-1 ${v.penze.mezera.pokryto ? 'text-green-700' : 'text-amber-700'}`}>
          {v.penze.mezera.pokryto ? 'Důchodový cíl pokryt ✓' : `Mezera ${f(v.penze.mezera.mesicniMezera)} Kč/měs`} · potřeba kapitálu (×200) {f(v.penze.potrebnyKapitalRentaKFP)} Kč
        </div>
      </Karta>
    </div>
  );
}
