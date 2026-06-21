'use client';

// HORIZONTY (eDO „rozdělení peněz dle času") — peníze klienta rozdělené do 4 časových košů
// s doporučenou strategií: Okamžité (0–1) likvidní · Krátkodobé (1–5) konzervativní ·
// Střednědobé (5–10) vyvážená · Dlouhodobé (10+) dynamická. Cíle se zatřídí dle počtu let.
import type { Vypocty } from '@/lib/financniPlan';
import type { KlientCisla } from '@/components/KlientskaAnalyza';
import { Karta } from '@/components/ui';
import { Clock, Waves, Shield, Scale, Rocket } from 'lucide-react';

const f = (x: number) => Math.round(x).toLocaleString('cs-CZ');

interface Polozka { label: string; hodnota: number; mesicni?: boolean }
interface Kos {
  id: string;
  nazev: string;
  rozsah: string;
  strategie: string;
  ikona: typeof Waves;
  trida: string; // barevný tón koše
  polozky: Polozka[];
}

export default function HorizontyRezerv({ v, klient }: { v: Vypocty; klient: KlientCisla }) {
  if (!v?.rezerva) return null;
  const cile = v.cile ?? [];
  const investMes = klient.mesicniVkladInvestice ?? 0;
  const penzeMes = klient.penzeMesicniVklad ?? 0;

  const kose: Kos[] = [
    {
      id: 'okamzite', nazev: 'Okamžité', rozsah: '0–1 rok', strategie: 'Likvidní', ikona: Waves,
      trida: 'border-sky-200 bg-sky-50/60', polozky: [
        { label: 'Pohotovostní rezerva', hodnota: v.rezerva.doporucenaRezerva },
      ],
    },
    {
      id: 'kratkodobe', nazev: 'Krátkodobé', rozsah: '1–5 let', strategie: 'Konzervativní', ikona: Shield,
      trida: 'border-emerald-200 bg-emerald-50/60',
      polozky: cile.filter((c) => c.roky >= 1 && c.roky <= 5).map((c) => ({ label: c.nazev, hodnota: c.castka })),
    },
    {
      id: 'strednedobe', nazev: 'Střednědobé', rozsah: '5–10 let', strategie: 'Vyvážená', ikona: Scale,
      trida: 'border-amber-200 bg-amber-50/60',
      polozky: cile.filter((c) => c.roky > 5 && c.roky <= 10).map((c) => ({ label: c.nazev, hodnota: c.castka })),
    },
    {
      id: 'dlouhodobe', nazev: 'Dlouhodobé', rozsah: '10+ let', strategie: 'Dynamická', ikona: Rocket,
      trida: 'border-primary-200 bg-primary-50/60',
      polozky: [
        ...cile.filter((c) => c.roky > 10).map((c) => ({ label: c.nazev, hodnota: c.castka })),
        ...(investMes > 0 ? [{ label: 'Investiční portfolio', hodnota: investMes, mesicni: true }] : []),
        ...(penzeMes > 0 ? [{ label: 'Penze / renta', hodnota: penzeMes, mesicni: true }] : []),
      ],
    },
  ];

  return (
    <Karta
      ikona={<Clock className="h-4 w-4 text-accent" />}
      titulek="Peníze podle horizontu"
      popis="Každý cíl má svůj čas — a tomu odpovídá strategie. Krátké peníze jistě, dlouhé dynamicky."
      className="lg:col-span-2 print:col-span-2"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        {kose.map((k) => {
          const Ikona = k.ikona;
          const soucetJedn = k.polozky.filter((p) => !p.mesicni).reduce((s, p) => s + p.hodnota, 0);
          const soucetMes = k.polozky.filter((p) => p.mesicni).reduce((s, p) => s + p.hodnota, 0);
          return (
            <div key={k.id} className={`rounded-xl border p-3 ${k.trida}`}>
              <div className="flex items-center gap-1.5 mb-0.5">
                <Ikona className="h-4 w-4 text-slate-600 shrink-0" />
                <span className="text-[13px] font-bold text-slate-800">{k.nazev}</span>
              </div>
              <div className="text-[10px] text-slate-500 mb-2">{k.rozsah} · <span className="font-semibold">{k.strategie}</span></div>
              {k.polozky.length > 0 ? (
                <div className="space-y-1">
                  {k.polozky.map((p, i) => (
                    <div key={i} className="flex items-center justify-between gap-1.5 text-[11px]">
                      <span className="text-slate-600 truncate">{p.label}</span>
                      <span className="font-semibold text-slate-800 shrink-0">{f(p.hodnota)}{p.mesicni ? '/m' : ''}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[11px] text-slate-400 italic">zatím bez cíle</div>
              )}
              {(soucetJedn > 0 || soucetMes > 0) && (
                <div className="mt-2 border-t border-slate-200/70 pt-1.5 text-[11px] font-bold text-slate-700">
                  {soucetJedn > 0 && <span>{f(soucetJedn)} Kč</span>}
                  {soucetJedn > 0 && soucetMes > 0 && <span className="text-slate-400"> · </span>}
                  {soucetMes > 0 && <span>{f(soucetMes)} Kč/m</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex gap-2 rounded-xl bg-primary-50/60 p-2.5">
        <Clock className="h-4 w-4 text-accent shrink-0 mt-0.5" />
        <p className="text-[11px] leading-relaxed text-slate-600">
          Peníze potřebné brzy držte v jistotě (spořicí účet, fond peněžního trhu), peníze s dlouhým
          horizontem mohou pracovat dynamicky — čas vyrovná výkyvy trhu. Tak se cíle nepotkají se špatným okamžikem.
        </p>
      </div>
    </Karta>
  );
}
