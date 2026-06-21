'use client';

// KOMPLEXNÍ ANALÝZA KLIENTA (pro poradce) — JEDEN ucelený pohled po PILÍŘÍCH, ať se to neroztříští.
// Každý pilíř má stejnou strukturu: CO KLIENT MÁ → CO POTŘEBUJE → MEZERA, a odkaz rovnou do KALKULAČKY.
// Sjednocuje dřívější roztříštěné panely (mezery, krytí, čísla) + propojuje /kalkulacky (deep-link ?tab=).
// Skryté v klientském PDF (print:hidden) — je to pracovní pohled poradce; provize neřídí doporučení.
import Link from 'next/link';
import type { Vypocty } from '@/lib/financniPlan';
import type { KlientCisla } from '@/components/KlientskaAnalyza';
import { type KarierniStupen, odhadProvize } from '@/lib/provize';
import { Wallet, ShieldCheck, TrendingUp, PiggyBank, Home, Calculator, ArrowRight, Coins, Info } from 'lucide-react';

const f = (x: number) => Math.round(x).toLocaleString('cs-CZ');

interface Radek { oblast: string; ma: string; potreba: string; mezera: number; mezeraText: string; }
interface Pilir { id: string; nazev: string; ikona: typeof Wallet; tab: string; radky: Radek[]; akce: string; }

export default function KomplexniAnalyza({ v, klient, stupen, naAktivni }: {
  v: Vypocty;
  klient: KlientCisla;
  stupen?: KarierniStupen | null;
  naAktivni?: () => void;
}) {
  if (!v || !v.rezerva || !v.penze) return null;

  const prijem = klient.cistyPrijem ?? 0;
  const vydaje = klient.vydaje ?? 0;
  const investVklad = klient.mesicniVkladInvestice ?? 0;
  const penzeVklad = klient.penzeMesicniVklad ?? 0;
  const volnyCashflow = Math.max(0, prijem - vydaje - investVklad - penzeVklad);
  const rezervaMa = Math.max(0, v.rezerva.doporucenaRezerva - v.rezerva.chybiDoRezervy);

  const krytiRizik = (potreba: number, ma: number): Radek => ({
    oblast: '', ma: `${f(ma)} Kč`, potreba: `${f(potreba)} Kč`,
    mezera: Math.max(0, potreba - ma),
    mezeraText: Math.max(0, potreba - ma) > 0 ? `${f(Math.max(0, potreba - ma))} Kč` : 'pokryto ✓',
  });
  const r = (oblast: string, base: Radek): Radek => ({ ...base, oblast });

  const penzeKapitalPotreba = v.penze.potrebnyKapitalRentaKFP ?? 0;
  const penzeMezeraMes = Math.max(0, v.penze.mezera?.mesicniMezera ?? 0);
  const refi = v.uvery?.refinancovani;
  const refiUspora = refi && refi.vyplati ? refi.mesicniUspora : 0;

  const pilire: Pilir[] = [
    {
      id: 'rezerva', nazev: 'Likvidní rezerva', ikona: Wallet, tab: 'pojisteni', akce: 'Doplnit rezervu (3–6× výdaje)',
      radky: [{ oblast: 'Rezerva', ma: `${f(rezervaMa)} Kč`, potreba: `${f(v.rezerva.doporucenaRezerva)} Kč`,
        mezera: v.rezerva.chybiDoRezervy, mezeraText: v.rezerva.chybiDoRezervy > 0 ? `${f(v.rezerva.chybiDoRezervy)} Kč` : 'pokryto ✓' }],
    },
    {
      id: 'ochrana', nazev: 'Ochrana / pojištění', ikona: ShieldCheck, tab: 'pojisteni', akce: 'Sjednat/navýšit krytí na mezeru',
      radky: [
        r('Smrt', krytiRizik(v.edoKryti?.smrt ?? v.efpaKryti?.smrt ?? 0, klient.soucasneKrytiSmrt ?? 0)),
        r('Invalidita', krytiRizik(v.edoKryti?.invalidita ?? v.efpaKryti?.invalidita ?? 0, klient.soucasneKrytiInvalidita ?? 0)),
        r('Závažná onem.', krytiRizik(v.edoKryti?.zavazneOnemocneni ?? 0, klient.soucasneKrytiZO ?? 0)),
        r('Trvalé následky', krytiRizik(v.edoKryti?.trvaleNasledkyUrazu ?? v.efpaKryti?.trvaleNasledkyUrazu ?? 0, klient.soucasneKrytiTN ?? 0)),
      ].filter((x) => x.potreba !== '0 Kč'),
    },
    {
      id: 'investice', nazev: 'Investice / tvorba majetku', ikona: TrendingUp, tab: 'investice', akce: 'Investovat volný cashflow dle profilu',
      radky: [{ oblast: 'Měsíční tvorba', ma: `${f(investVklad)} Kč/měs`, potreba: `${f(volnyCashflow + investVklad)} Kč/měs (volné)`,
        mezera: volnyCashflow, mezeraText: volnyCashflow > 0 ? `${f(volnyCashflow)} Kč/měs nevyužito` : 'využito ✓' }],
    },
    {
      id: 'penze', nazev: 'Penze / důchod / renta', ikona: PiggyBank, tab: 'renta', akce: 'Navýšit DPS / rentu na pokrytí mezery',
      radky: [{ oblast: 'Kapitál na rentu', ma: `${f(klient.penzeNasporeno ?? 0)} Kč`, potreba: `${f(penzeKapitalPotreba)} Kč`,
        mezera: penzeMezeraMes, mezeraText: penzeMezeraMes > 0 ? `renta −${f(penzeMezeraMes)} Kč/měs` : 'pokryto ✓' }],
    },
    {
      id: 'uvery', nazev: 'Úvěry / bydlení', ikona: Home, tab: 'uvery', akce: refiUspora > 0 ? 'Refinancovat hypotéku' : 'Bez akce / prověřit kapacitu',
      radky: [{ oblast: 'Hypotéka', ma: (klient.hypotekaZustatek ?? 0) > 0 ? `${f(klient.hypotekaZustatek!)} Kč` : 'bez hypotéky',
        potreba: refiUspora > 0 ? 'refinancování' : '—', mezera: refiUspora,
        mezeraText: refiUspora > 0 ? `úspora ${f(refiUspora)} Kč/měs` : '—' }],
    },
  ];

  const otevrenych = pilire.reduce((s, p) => s + p.radky.filter((x) => x.mezera > 0).length, 0);

  return (
    <div className="rounded-2xl border border-accent-100 bg-accent-50/20 p-5 shadow-soft print:hidden">
      <div className="flex items-center justify-between gap-2 mb-1">
        <h3 className="text-base font-bold text-primary flex items-center gap-2"><Calculator className="h-5 w-5 text-accent" />Komplexní analýza <span className="text-[11px] font-semibold text-slate-400">(pro poradce)</span></h3>
        <span className="text-[11px] font-semibold text-slate-500">{otevrenych} otevřených mezer</span>
      </div>
      <p className="text-xs text-slate-500 mb-3">Jeden pohled napříč pilíři: co klient má → co potřebuje → mezera. Klik na pilíř = příslušná kalkulačka.</p>

      <div className="space-y-2.5">
        {pilire.map((p) => {
          const Ikona = p.ikona;
          const mezerVPiliri = p.radky.filter((x) => x.mezera > 0).length;
          return (
            <div key={p.id} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-sm font-bold text-slate-800 flex items-center gap-1.5"><Ikona className="h-4 w-4 text-accent" />{p.nazev}
                  {mezerVPiliri > 0 && <span className="rounded-full bg-accent-100 text-accent-700 text-[10px] font-bold px-1.5 py-0.5">{mezerVPiliri} mezera</span>}
                </span>
                <Link href={`/kalkulacky?tab=${p.tab}`} onClick={naAktivni} className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-white border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-primary hover:bg-primary-50 hover:border-primary-200">
                  Kalkulačka <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              <table className="w-full text-xs">
                <tbody>
                  {p.radky.map((x, i) => (
                    <tr key={i} className="border-t border-slate-50">
                      <td className="py-1 pr-2 text-slate-600">{x.oblast}</td>
                      <td className="py-1 px-2 text-slate-500 text-right whitespace-nowrap">{x.ma}</td>
                      <td className="py-1 px-2 text-slate-400">→ {x.potreba}</td>
                      <td className={`py-1 pl-2 font-bold text-right whitespace-nowrap ${x.mezera > 0 ? 'text-accent-700' : 'text-green-600'}`}>{x.mezeraText}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="text-[10px] text-slate-400 mt-1">{p.akce}</div>
            </div>
          );
        })}
      </div>

      {/* Provize — interní orientační přehled (needs-driven, neřídí doporučení) */}
      <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
        <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5"><Coins className="h-4 w-4 text-slate-400" />Potenciál (interní)</span>
        <span className="text-xs text-slate-600">objem <strong>{f(volnyCashflow)} Kč/měs</strong>{stupen ? <> · provize ≈ <strong className="text-accent-700">{f(odhadProvize(volnyCashflow * 12, 'investice', stupen))} Kč/rok</strong></> : <> · <Link href="/nastaveni" className="text-primary font-bold hover:underline">nastavit stupeň</Link></>}</span>
      </div>
      <div className="mt-2 flex gap-2 rounded-xl bg-white/70 border border-accent-100 p-2.5">
        <Info className="h-4 w-4 text-accent shrink-0 mt-0.5" />
        <p className="text-[11px] leading-relaxed text-slate-600">Mezery = potřeby klienta podložené čísly (komplexní zajištění). Provize je jen orientační přehled, <strong>neřídí doporučení</strong>.</p>
      </div>
    </div>
  );
}
