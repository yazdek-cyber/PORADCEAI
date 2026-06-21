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

// Titulní strana klientské prezentace (jen tisk) — celá první stránka: logo + firma,
// název prezentace, klient, datum, poradce. Za ní zlom stránky (obsah začne na další).
export function TiskTitulka({
  titulek, podtitulek, klient, datum,
}: { titulek: string; podtitulek?: string; klient?: string; datum: string }) {
  const { poradce } = usePoradce();
  return (
    <div className="hidden print:flex tisk-titulka flex-col justify-between" style={{ pageBreakAfter: 'always' }}>
      <div className="flex items-center gap-3 pt-2">
        {poradce.logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={poradce.logo} alt="logo" className="h-14 max-w-[200px] object-contain" />
        )}
        <div>
          <div className="text-2xl font-bold text-primary leading-tight">{poradce.firma || 'PoradceAI'}</div>
          {poradce.jmeno && (
            <div className="text-sm text-slate-500">{poradce.jmeno}{poradce.osvedceni ? `, ČNB ${poradce.osvedceni}` : ''}</div>
          )}
        </div>
      </div>

      <div className="py-10">
        <div className="text-[13px] font-semibold uppercase tracking-[0.2em] text-accent-700 mb-3">Finanční analýza</div>
        <h1 className="text-5xl font-extrabold text-primary leading-tight">{titulek}</h1>
        {podtitulek && <p className="text-lg text-slate-500 mt-3">{podtitulek}</p>}
        {klient && (
          <div className="mt-10 border-l-4 border-accent pl-4">
            <div className="text-xs text-slate-400 uppercase tracking-wide">Připraveno pro</div>
            <div className="text-2xl font-bold text-slate-800">{klient}</div>
          </div>
        )}
      </div>

      <div className="border-t border-slate-200 pt-4 flex items-end justify-between text-sm text-slate-500">
        <div>
          {[poradce.telefon, poradce.email].filter(Boolean).join(' · ')}
        </div>
        <div className="text-right">{datum}</div>
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
