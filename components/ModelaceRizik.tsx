'use client';

// MODELACE RIZIK (eDO „ochrana příjmů") — vlajková pomůcka obchodního rozhovoru.
// Pro každé riziko ukáže: POTŘEBA (eDO doporučení) vs. SOUČASNÉ KRYTÍ (ze smluv klienta) vs. MEZERA.
// Vstup: v.edoKryti (deterministicky spočtené potřeby) + soucasneKryti* z karty klienta. Žádná AI.
import type { Vypocty } from '@/lib/financniPlan';
import type { KlientCisla } from '@/components/KlientskaAnalyza';
import { Karta } from '@/components/ui';
import { ShieldAlert, Skull, Accessibility, HeartPulse, Bone, CalendarClock } from 'lucide-react';

const f = (x: number) => Math.round(x).toLocaleString('cs-CZ');

interface RadekRizika {
  id: string;
  nazev: string;
  popis: string;
  ikona: typeof Skull;
  potreba: number;
  kryto: number;
  /** true = měsíční dávka (PN), jinak jednorázová pojistná částka */
  mesicni?: boolean;
}

function PruhRizika({ r }: { r: RadekRizika }) {
  const Ikona = r.ikona;
  const mezera = Math.max(0, r.potreba - r.kryto);
  const podilKryto = r.potreba > 0 ? Math.min(1, r.kryto / r.potreba) : 1;
  const hotovo = mezera <= 0 && r.potreba > 0;
  const jednotka = r.mesicni ? ' Kč/měs' : ' Kč';
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="flex items-center gap-2 text-[13px] font-bold text-slate-800">
          <Ikona className="h-4 w-4 text-accent shrink-0" />{r.nazev}
        </span>
        <span className={`text-[11px] font-bold shrink-0 ${hotovo ? 'text-positive' : mezera > 0 ? 'text-accent-700' : 'text-slate-400'}`}>
          {hotovo ? '✓ kryto' : `mezera ${f(mezera)}${jednotka}`}
        </span>
      </div>
      {/* pruh: track = potřeba; zelená = kryto; jantarová = mezera */}
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-200">
        <div className="h-3 bg-positive transition-all" style={{ width: `${podilKryto * 100}%` }} />
        <div className="h-3 bg-accent/70 transition-all" style={{ width: `${(1 - podilKryto) * 100}%` }} />
      </div>
      <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500">
        <span>kryto {f(r.kryto)}{jednotka}</span>
        <span className="text-slate-400">{r.popis}</span>
        <span className="font-semibold text-slate-700">potřeba {f(r.potreba)}{jednotka}</span>
      </div>
    </div>
  );
}

export default function ModelaceRizik({ v, klient }: { v: Vypocty; klient: KlientCisla }) {
  if (!v?.edoKryti) return null;
  const e = v.edoKryti;
  const rizika: RadekRizika[] = [
    { id: 'smrt', nazev: 'Smrt', popis: '3× roční příjem', ikona: Skull, potreba: e.smrt, kryto: klient.soucasneKrytiSmrt ?? 0 },
    { id: 'invalidita', nazev: 'Invalidita', popis: '3× roční příjem', ikona: Accessibility, potreba: e.invalidita, kryto: klient.soucasneKrytiInvalidita ?? 0 },
    { id: 'zo', nazev: 'Závažná onemocnění', popis: '1× roční příjem', ikona: HeartPulse, potreba: e.zavazneOnemocneni, kryto: klient.soucasneKrytiZO ?? 0 },
    { id: 'tn', nazev: 'Trvalé následky úrazu', popis: 'progrese dle věku', ikona: Bone, potreba: e.trvaleNasledkyUrazu, kryto: klient.soucasneKrytiTN ?? 0 },
    { id: 'pn', nazev: 'Pracovní neschopnost', popis: 'dorovnání příjmu', ikona: CalendarClock, potreba: e.pracovniNeschopnostMesicniDorovnani, kryto: 0, mesicni: true },
  ];

  const celkovaMezera = rizika.filter((r) => !r.mesicni).reduce((s, r) => s + Math.max(0, r.potreba - r.kryto), 0);
  const krytoOblasti = rizika.filter((r) => r.potreba > 0 && r.kryto >= r.potreba).length;
  const relevantnich = rizika.filter((r) => r.potreba > 0).length;

  return (
    <Karta
      ikona={<ShieldAlert className="h-4 w-4 text-accent" />}
      titulek="Modelace rizik — krytí vs. potřeba"
      popis="Co dnešní smlouvy kryjí proti tomu, co eDO doporučuje. Mezera = kolik dorovnat."
      className="lg:col-span-2"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {rizika.map((r) => <PruhRizika key={r.id} r={r} />)}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-accent-50 px-3 py-2">
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Celková mezera krytí</div>
          <div className="text-xl font-extrabold text-accent-700">{f(celkovaMezera)} Kč</div>
        </div>
        <div className="rounded-xl bg-primary-50/60 px-3 py-2">
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Plně kryto rizik</div>
          <div className="text-xl font-extrabold text-primary">{krytoOblasti}/{relevantnich}</div>
        </div>
      </div>
      <div className="mt-3 flex gap-2 rounded-xl bg-primary-50/60 p-2.5">
        <ShieldAlert className="h-4 w-4 text-accent shrink-0 mt-0.5" />
        <p className="text-[11px] leading-relaxed text-slate-600">
          {celkovaMezera > 0
            ? `Při výpadku příjmu (smrt, invalidita, vážná nemoc) dnes chybí krytí ${f(celkovaMezera)} Kč. Pojištění má dorovnat mezeru, aby rodina udržela životní úroveň — ne přeplácet, co už je pokryté.`
            : 'Rizika jsou dle eDO metodiky pokryta — držte krytí aktuální vůči vývoji příjmu a závazků.'}
          {' '}Současné krytí zadáte v kartě klienta („krytí ze smluv"); potřeby počítá kalkulačka z příjmu a věku.
        </p>
      </div>
    </Karta>
  );
}
