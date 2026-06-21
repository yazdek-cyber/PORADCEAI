'use client';

// FINANČNÍ DOMEČEK (eDO/KFP grafická pomůcka) — priority financí jako dům: základ (rezerva + ochrana
// příjmů) → bydlení → penze → střecha (investice/cíle). Každé patro obarvené podle POKRYTÍ klienta
// a KLIKACÍ na příslušnou kalkulačku. Interaktivní vizuál pro analýzu i klientskou prezentaci.
import Link from 'next/link';
import { Home, ShieldCheck, Wallet, PiggyBank, TrendingUp } from 'lucide-react';
import { pokrytiKlienta } from '@/lib/pokryti';
import type { Pripad } from '@/lib/pripadStore';

export default function FinancniDomecek({ profil, naAktivni }: { profil: Pripad; naAktivni?: () => void }) {
  const obl = pokrytiKlienta(profil);
  const stav = (ids: string[]) => {
    const a = obl.filter((o) => ids.includes(o.id));
    return { k: a.filter((x) => x.kryto).length, c: a.length };
  };
  // shora dolů: střecha → … → základ (nejširší). sirka = relativní šířka patra (dům se rozšiřuje dolů).
  const patra = [
    { id: 'strecha', nazev: 'Investice & cíle', popis: 'tvorba majetku, sny', tab: 'investice', ikona: TrendingUp, sirka: 'w-[62%]', ...stav(['investice', 'stavebko']) },
    { id: 'penze', nazev: 'Penze / renta', popis: 'zajištění na stáří', tab: 'renta', ikona: PiggyBank, sirka: 'w-[78%]', ...stav(['penze']) },
    { id: 'bydleni', nazev: 'Bydlení / úvěry', popis: 'hypotéka, optimalizace', tab: 'uvery', ikona: Home, sirka: 'w-[90%]', ...stav(['uvery']) },
    { id: 'zaklad', nazev: 'Rezerva + Ochrana příjmů', popis: 'základ — bez toho nic nestavět', tab: 'pojisteni', ikona: ShieldCheck, sirka: 'w-full', ...stav(['rezerva', 'zivot', 'auto', 'majetek', 'odpovednost']) },
  ];

  // barva patra dle pokrytí
  const barva = (k: number, c: number) =>
    k >= c ? 'bg-green-100 border-green-300 text-green-800'
      : k > 0 ? 'bg-amber-100 border-amber-300 text-amber-800'
        : 'bg-slate-100 border-slate-300 text-slate-500';

  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-soft break-inside-avoid">
      <h4 className="text-base font-bold text-primary flex items-center gap-2 mb-1"><Home className="h-5 w-5 text-accent" />Finanční domeček</h4>
      <p className="text-xs text-slate-500 mb-3">Priority financí jako dům — staví se zdola. Barva = pokrytí (zelená hotovo, jantarová částečně, šedá chybí). Klik na patro → kalkulačka.</p>

      {/* Střecha */}
      <div className="flex justify-center">
        <div className="w-0 h-0 border-l-[70px] border-r-[70px] border-b-[26px] border-l-transparent border-r-transparent border-b-accent/70" />
      </div>

      <div className="flex flex-col items-center gap-1.5 -mt-px">
        {patra.map((p) => {
          const Ikona = p.ikona;
          return (
            <Link
              key={p.id}
              href={`/kalkulacky?tab=${p.tab}`}
              onClick={naAktivni}
              className={`${p.sirka} flex items-center gap-2.5 rounded-lg border px-3 py-2 transition-transform hover:scale-[1.02] ${barva(p.k, p.c)}`}
              title={`${p.nazev} — ${p.k}/${p.c} pokryto`}
            >
              <Ikona className="h-4 w-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold leading-tight">{p.nazev}</div>
                <div className="text-[10px] opacity-80 leading-tight truncate">{p.popis}</div>
              </div>
              <span className="text-[11px] font-bold shrink-0">{p.k}/{p.c}</span>
            </Link>
          );
        })}
      </div>
      <p className="text-[10px] text-slate-400 text-center mt-2 print:hidden">Klik na patro otevře příslušnou kalkulačku.</p>
    </div>
  );
}
