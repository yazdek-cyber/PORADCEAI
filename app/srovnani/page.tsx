'use client';

import { useState, useEffect } from 'react';
import { Columns3, Loader2, Check, AlertTriangle, Plus, X, BookOpen } from 'lucide-react';
import { getPojistovnyAction, srovnejParametryAction } from '@/app/actions';

type Bunka = { hodnota: string; strana: number | null };

const VYCHOZI_PARAMETRY = [
  'Čekací doba u pracovní neschopnosti',
  'Čekací doba u invalidity',
  'Čekací doba u závažných onemocnění',
  'Definice invalidity (stupně)',
  'Výluky u rizikových sportů',
  'Vstupní věk pro sjednání',
  'Maximální pojistná částka',
];

export default function SrovnaniPage() {
  const [pojistovny, setPojistovny] = useState<string[]>([]);
  const [vybranePoj, setVybranePoj] = useState<string[]>([]);
  const [parametry, setParametry] = useState<string[]>(VYCHOZI_PARAMETRY.slice(0, 5));
  const [novyParam, setNovyParam] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matice, setMatice] = useState<Record<string, Record<string, Bunka>> | null>(null);
  const [vyslednePoj, setVyslednePoj] = useState<string[]>([]);
  const [vysledneParam, setVysledneParam] = useState<string[]>([]);

  useEffect(() => {
    getPojistovnyAction().then((res) => {
      if (res.success) {
        setPojistovny(res.pojistovny);
        setVybranePoj(res.pojistovny.slice(0, 3));
      }
    });
  }, []);

  const togglePoj = (p: string) =>
    setVybranePoj((s) => (s.includes(p) ? s.filter((x) => x !== p) : [...s, p]));
  const toggleParam = (p: string) =>
    setParametry((s) => (s.includes(p) ? s.filter((x) => x !== p) : [...s, p]));
  const pridejParam = () => {
    const p = novyParam.trim();
    if (p && !parametry.includes(p)) setParametry((s) => [...s, p]);
    setNovyParam('');
  };

  const handleSrovnat = async () => {
    if (vybranePoj.length < 1 || parametry.length < 1) {
      setError('Vyberte alespoň jednu pojišťovnu a jeden parametr.');
      return;
    }
    setLoading(true);
    setError(null);
    setMatice(null);
    try {
      const res = await srovnejParametryAction(vybranePoj, parametry);
      if (res.success) {
        setMatice(res.matice as Record<string, Record<string, Bunka>>);
        setVyslednePoj(res.pojistovny);
        setVysledneParam(res.parametry);
      } else {
        setError(res.error || 'Srovnání se nezdařilo.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chyba při srovnání.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-primary flex items-center gap-2">
          <Columns3 className="h-7 w-7 text-accent" />
          Srovnání podmínek
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Vyber pojišťovny a parametry. Systém z nahraných pojistných podmínek vytáhne konkrétní
          hodnoty se zdrojem a postaví je vedle sebe. Vždy ověř ve zdroji — jde o podklad pro poradce.
        </p>
      </div>

      {/* Výběr */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold text-primary mb-2">Pojišťovny</h2>
          {pojistovny.length === 0 ? (
            <p className="text-xs text-slate-400">Nahraj nejdřív dokumenty v sekci Dokumenty.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {pojistovny.map((p) => (
                <button
                  key={p}
                  onClick={() => togglePoj(p)}
                  className={`flex items-center gap-1 text-xs font-semibold rounded-lg px-2.5 py-1.5 border transition-colors ${
                    vybranePoj.includes(p)
                      ? 'bg-primary text-white border-primary'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-primary-200'
                  }`}
                >
                  {vybranePoj.includes(p) && <Check className="h-3 w-3" />}
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold text-primary mb-2">Parametry</h2>
          <div className="flex flex-wrap gap-2 mb-2">
            {[...new Set([...VYCHOZI_PARAMETRY, ...parametry])].map((p) => (
              <button
                key={p}
                onClick={() => toggleParam(p)}
                className={`flex items-center gap-1 text-xs font-medium rounded-lg px-2.5 py-1.5 border transition-colors ${
                  parametry.includes(p)
                    ? 'bg-primary-50 text-primary border-primary-200'
                    : 'bg-white text-slate-500 border-slate-200 hover:border-primary-200'
                }`}
              >
                {parametry.includes(p) && <Check className="h-3 w-3" />}
                {p}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={novyParam}
              onChange={(e) => setNovyParam(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && pridejParam()}
              placeholder="Vlastní parametr (např. čekací doba u rakoviny)"
              className="flex-1 text-xs rounded-lg border border-slate-200 px-2.5 py-1.5 focus:border-primary focus:outline-none"
            />
            <button
              onClick={pridejParam}
              className="flex items-center gap-1 text-xs font-bold text-primary bg-primary-50 hover:bg-primary-100 rounded-lg px-2.5 py-1.5"
            >
              <Plus className="h-3.5 w-3.5" /> Přidat
            </button>
          </div>
        </div>
      </div>

      <button
        onClick={handleSrovnat}
        disabled={loading || vybranePoj.length === 0 || parametry.length === 0}
        className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold text-white transition-colors ${
          loading || vybranePoj.length === 0 || parametry.length === 0
            ? 'bg-slate-300 cursor-not-allowed'
            : 'bg-primary hover:bg-primary-600 cursor-pointer shadow-sm'
        }`}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin text-accent" /> : <Columns3 className="h-4 w-4 text-accent" />}
        {loading ? 'Sestavuji srovnání…' : 'Srovnat'}
      </button>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex gap-3 items-start">
          <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Matice */}
      {matice && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-200">
                <th className="text-left py-2.5 px-3 font-bold text-slate-500 w-56">Parametr</th>
                {vyslednePoj.map((p) => (
                  <th key={p} className="text-left py-2.5 px-3 font-bold text-primary">{p}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vysledneParam.map((param) => (
                <tr key={param} className="border-b border-slate-100 align-top">
                  <td className="py-2.5 px-3 font-semibold text-slate-700">{param}</td>
                  {vyslednePoj.map((poj) => {
                    const b = matice[poj]?.[param];
                    const neuvedeno = !b || b.hodnota === 'Neuvedeno';
                    return (
                      <td key={poj} className="py-2.5 px-3">
                        <span className={neuvedeno ? 'text-slate-400 italic' : 'text-slate-800'}>
                          {b?.hodnota || 'Neuvedeno'}
                        </span>
                        {b?.strana && (
                          <span className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] text-slate-400">
                            <BookOpen className="h-2.5 w-2.5" /> s.{b.strana}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-[11px] text-slate-400">
            Podklad pro licencovaného poradce, nikoliv finanční doporučení. Hodnoty vždy ověřte v
            původních pojistných podmínkách (uvedená strana).
          </p>
        </div>
      )}
    </div>
  );
}
