'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Plus, Pencil, Trash2, X, Save, Package, AlertCircle } from 'lucide-react';
import { DOMENY, PARAMETRY_DOMENY, type DomenaId } from '@/lib/domeny';
import { getProduktyAction, ulozProduktAction, smazProduktAction } from '@/app/actions';

interface Produkt {
  id: string;
  domena: DomenaId;
  poskytovatel: string | null;
  nazev: string;
  typ: string | null;
  parametry: Record<string, unknown>;
  zdroj: string;
  aktualizovano_kdy: string;
}

/** Hodnota parametru → text do formuláře (procento zpět na %). */
function hodnotaDoFormu(typ: string, v: unknown): string {
  if (v == null) return '';
  if (typ === 'procento' && typeof v === 'number') return String(+(v * 100).toFixed(4));
  return String(v);
}

/** Zobrazení hodnoty v seznamu. */
function zobrazHodnotu(typ: string, suffix: string | undefined, v: unknown): string {
  if (v == null || v === '') return '–';
  if (typ === 'procento' && typeof v === 'number') return `${+(v * 100).toFixed(3)} ${suffix ?? '%'}`;
  return `${v}${suffix ? ' ' + suffix : ''}`;
}

export default function SpravaProduktu() {
  const [domena, setDomena] = useState<DomenaId>('uvery');
  const [produkty, setProdukty] = useState<Produkt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ukladani, setUkladani] = useState(false);
  const [mazaniId, setMazaniId] = useState<string | null>(null);

  // Formulář (přidání/úprava)
  const [formOtevren, setFormOtevren] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [poskytovatel, setPoskytovatel] = useState('');
  const [nazev, setNazev] = useState('');
  const [typ, setTyp] = useState('');
  const [paramValues, setParamValues] = useState<Record<string, string>>({});

  const nactiProdukty = useCallback(async () => {
    setLoading(true);
    const res = await getProduktyAction(domena);
    if (res.success) {
      setProdukty(res.produkty as Produkt[]);
      setError(null);
    } else {
      setError(res.error || 'Nepodařilo se načíst produkty.');
    }
    setLoading(false);
  }, [domena]);

  useEffect(() => {
    nactiProdukty();
  }, [nactiProdukty]);

  const resetForm = () => {
    setEditId(null);
    setPoskytovatel('');
    setNazev('');
    setTyp('');
    setParamValues({});
    setFormOtevren(false);
  };

  const otevriPridat = () => {
    resetForm();
    setFormOtevren(true);
  };

  const otevriUpravit = (p: Produkt) => {
    setEditId(p.id);
    setPoskytovatel(p.poskytovatel ?? '');
    setNazev(p.nazev);
    setTyp(p.typ ?? '');
    const vals: Record<string, string> = {};
    for (const pole of PARAMETRY_DOMENY[domena]) {
      vals[pole.klic] = hodnotaDoFormu(pole.typ, p.parametry?.[pole.klic]);
    }
    setParamValues(vals);
    setFormOtevren(true);
  };

  const sestavParametry = (): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    for (const pole of PARAMETRY_DOMENY[domena]) {
      const raw = (paramValues[pole.klic] ?? '').trim();
      if (raw === '') continue;
      if (pole.typ === 'text') {
        out[pole.klic] = raw;
      } else {
        const n = parseFloat(raw.replace(',', '.'));
        if (!isNaN(n)) out[pole.klic] = pole.typ === 'procento' ? n / 100 : n;
      }
    }
    return out;
  };

  const handleUloz = async () => {
    if (!nazev.trim()) {
      setError('Název produktu je povinný.');
      return;
    }
    setUkladani(true);
    setError(null);
    const res = await ulozProduktAction({
      id: editId ?? undefined,
      domena,
      poskytovatel,
      nazev,
      typ,
      parametry: sestavParametry(),
    });
    setUkladani(false);
    if (res.success) {
      resetForm();
      await nactiProdukty();
    } else {
      setError(res.error || 'Uložení selhalo.');
    }
  };

  const handleSmaz = async (id: string, jmeno: string) => {
    if (!confirm(`Opravdu smazat produkt „${jmeno}"?`)) return;
    setMazaniId(id);
    const res = await smazProduktAction(id);
    setMazaniId(null);
    if (res.success) await nactiProdukty();
    else setError(res.error || 'Smazání selhalo.');
  };

  const polePro = PARAMETRY_DOMENY[domena];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 className="text-xl font-bold text-primary flex items-center gap-2">
          <Package className="h-5 w-5 text-accent" />
          Produkty a sazby (vstupy pro kalkulačky)
        </h2>
        <button
          onClick={formOtevren ? resetForm : otevriPridat}
          className="flex items-center gap-1.5 text-xs font-bold rounded-lg px-3 py-2 bg-primary text-white hover:bg-primary-600 cursor-pointer"
        >
          {formOtevren ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5 text-accent" />}
          {formOtevren ? 'Zavřít' : 'Přidat produkt'}
        </button>
      </div>

      <p className="text-xs text-slate-500 mb-3">
        Sazby a parametry, které používá finanční plán. Vyplněné hodnoty mají přímý vliv na výpočty
        (např. úroková sazba u úvěrů, výnos a poplatky u investic). Chybí-li, použijí se rozumné defaulty.
      </p>

      {/* Záložky domén */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {DOMENY.map((d) => (
          <button
            key={d.id}
            onClick={() => { resetForm(); setDomena(d.id); }}
            className={`text-xs font-bold rounded-lg px-3 py-1.5 border transition-colors cursor-pointer ${
              domena === d.id
                ? 'bg-primary-50 border-primary-200 text-primary'
                : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
            }`}
          >
            {d.ikona} {d.nazev}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-3 rounded-lg bg-red-50 border border-red-200 p-3 flex items-start gap-2 text-sm text-red-800">
          <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* Formulář */}
      {formOtevren && (
        <div className="mb-4 rounded-lg border border-primary-100 bg-primary-50/40 p-4 space-y-3">
          <h3 className="text-sm font-bold text-primary">{editId ? 'Upravit produkt' : 'Nový produkt'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Poskytovatel</label>
              <input value={poskytovatel} onChange={(e) => setPoskytovatel(e.target.value)} placeholder="Banka / pojišťovna / správce"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Název *</label>
              <input value={nazev} onChange={(e) => setNazev(e.target.value)} placeholder="Např. Hypotéka Klasik"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Typ</label>
              <input value={typ} onChange={(e) => setTyp(e.target.value)} placeholder="hypoteka / etf / dps…"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
            </div>
          </div>

          {/* Dynamická pole parametrů dle domény */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {polePro.map((pole) => (
              <div key={pole.klic}>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1" title={pole.napoveda}>
                  {pole.label}{pole.suffix ? ` (${pole.suffix})` : ''}
                </label>
                <input
                  value={paramValues[pole.klic] ?? ''}
                  onChange={(e) => setParamValues((s) => ({ ...s, [pole.klic]: e.target.value }))}
                  placeholder={pole.typ === 'procento' ? 'např. 4,9' : pole.typ === 'cislo' ? '0' : ''}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <button onClick={handleUloz} disabled={ukladani}
              className="flex items-center gap-1.5 text-xs font-bold rounded-lg px-4 py-2 bg-primary text-white hover:bg-primary-600 disabled:bg-slate-300 cursor-pointer">
              {ukladani ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5 text-accent" />}
              Uložit
            </button>
            <button onClick={resetForm} className="text-xs font-bold rounded-lg px-4 py-2 bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer">
              Zrušit
            </button>
          </div>
        </div>
      )}

      {/* Seznam */}
      {loading ? (
        <div className="flex items-center justify-center py-10 text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : produkty.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-slate-200 rounded-lg">
          <Package className="h-8 w-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-600">Pro tuto doménu zatím nejsou produkty. Přidej první sazbu.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {produkty.map((p) => (
            <div key={p.id} className="flex items-center gap-2 rounded-lg border border-slate-200 p-2.5 text-sm hover:bg-slate-50">
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-slate-800 truncate">
                  {p.nazev}
                  {p.poskytovatel ? <span className="text-slate-400 font-normal"> · {p.poskytovatel}</span> : ''}
                  {p.typ ? <span className="text-[10px] ml-1.5 text-slate-500 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5">{p.typ}</span> : ''}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 flex flex-wrap gap-x-3">
                  {polePro.map((pole) => (
                    <span key={pole.klic}>
                      {pole.label}: <span className="font-medium text-slate-700">{zobrazHodnotu(pole.typ, pole.suffix, p.parametry?.[pole.klic])}</span>
                    </span>
                  ))}
                </div>
              </div>
              <button onClick={() => otevriUpravit(p)} className="text-slate-400 hover:text-primary p-1.5 rounded-lg hover:bg-slate-100" title="Upravit">
                <Pencil className="h-4 w-4" />
              </button>
              <button onClick={() => handleSmaz(p.id, p.nazev)} disabled={mazaniId === p.id}
                className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50" title="Smazat">
                {mazaniId === p.id ? <Loader2 className="h-4 w-4 animate-spin text-red-600" /> : <Trash2 className="h-4 w-4" />}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
