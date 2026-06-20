'use client';

import { usePoradce } from '@/lib/poradceStore';

// Brandovaná hlavička/patička pro klientské výstupy (zobrazí se JEN při tisku/PDF).
// Logo + firma poradce vlevo, titulek + klient + datum vpravo.

export function TiskHlavicka({
  titulek, podtitulek, klient, datum,
}: { titulek: string; podtitulek?: string; klient?: string; datum: string }) {
  const { poradce } = usePoradce();
  return (
    <div className="hidden print:flex items-start justify-between gap-4 pb-4 border-b-2 border-primary mb-6">
      <div className="flex items-center gap-3">
        {poradce.logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={poradce.logo} alt="logo" className="h-12 max-w-[170px] object-contain" />
        )}
        <div>
          <div className="text-lg font-bold text-primary leading-tight">{poradce.firma || 'PoradceAI'}</div>
          {poradce.jmeno && (
            <div className="text-xs text-slate-500">{poradce.jmeno}{poradce.osvedceni ? `, ČNB ${poradce.osvedceni}` : ''}</div>
          )}
        </div>
      </div>
      <div className="text-right">
        <div className="text-lg font-bold text-slate-800 leading-tight">{titulek}</div>
        {podtitulek && <div className="text-xs text-slate-500">{podtitulek}</div>}
        {klient && <div className="text-xs text-slate-700 mt-1">Klient: <strong>{klient}</strong></div>}
        <div className="text-xs text-slate-400">{datum}</div>
      </div>
    </div>
  );
}

export function TiskPaticka({ datum }: { datum: string }) {
  const { poradce } = usePoradce();
  const kontakt = [poradce.jmeno, poradce.telefon, poradce.email].filter(Boolean).join(' · ');
  return (
    <div className="hidden print:block mt-8 pt-3 border-t border-slate-300 text-[10px] text-slate-500">
      <p className="font-semibold">Toto je analytický podklad pro licencovaného poradce, nikoliv individualizované finanční doporučení.</p>
      <p>
        {poradce.firma || 'PoradceAI'}{kontakt ? ` · ${kontakt}` : ''} · {datum}. Čísla pocházejí z deterministických
        kalkulaček (dnešní hodnota peněz), tvrzení o produktech z nahraných podmínek.
      </p>
    </div>
  );
}
