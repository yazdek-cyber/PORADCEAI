'use client';

import { useState, useEffect } from 'react';
import { FolderClock, Loader2, Wallet, Printer, Trash2, ArrowLeft, FileText } from 'lucide-react';
import Link from 'next/link';
import { getUlozenePlanyAction, getUlozenyPlanAction, smazUlozenyPlanAction } from '@/app/actions';
import type { Vypocty } from '@/lib/financniPlan';
import Markdown from '@/components/Markdown';
import PlanPrehled from '@/components/PlanPrehled';

interface PlanMeta {
  id: string;
  vytvoreno_kdy: string;
  profil: { vek?: number; cistyPrijem?: number; cileSeznam?: { nazev: string }[]; cile?: string } | null;
}

export default function PlanyPage() {
  const [plany, setPlany] = useState<PlanMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ id: string; plan: string; vypocty: Vypocty | null; datum: string } | null>(null);
  const [nacitamDetail, setNacitamDetail] = useState(false);

  const nactiSeznam = async () => {
    setLoading(true);
    const res = await getUlozenePlanyAction();
    if (res.success) setPlany(res.plany as PlanMeta[]);
    else setError(res.error || 'Nepodařilo se načíst plány.');
    setLoading(false);
  };
  useEffect(() => { nactiSeznam(); }, []);

  const otevri = async (id: string) => {
    setNacitamDetail(true);
    setError(null);
    const res = await getUlozenyPlanAction(id);
    if (res.success) {
      // Nedůvěřuj tvaru z DB: prázdný objekt {} (DB default) je truthy → ověř klíče.
      const raw = res.vypocty as Partial<Vypocty> | null | undefined;
      const vypocty = raw && raw.rezerva && raw.investice && raw.penze ? (raw as Vypocty) : null;
      setDetail({ id, plan: res.plan, vypocty, datum: res.vytvoreno_kdy as string });
    }
    else setError(res.error || 'Plán se nepodařilo otevřít.');
    setNacitamDetail(false);
  };

  const smaz = async (id: string) => {
    if (!confirm('Opravdu smazat tento uložený plán?')) return;
    const res = await smazUlozenyPlanAction(id);
    if (res.success) { if (detail?.id === id) setDetail(null); nactiSeznam(); }
    else setError(res.error || 'Smazání selhalo.');
  };

  const popis = (p: PlanMeta) => {
    const pr = p.profil || {};
    const cile = pr.cileSeznam?.length ? `${pr.cileSeznam.length} cílů` : (pr.cile ? 'cíle' : '');
    return [pr.vek ? `${pr.vek} let` : null, pr.cistyPrijem ? `${pr.cistyPrijem.toLocaleString('cs-CZ')} Kč/měs` : null, cile]
      .filter(Boolean).join(' · ') || 'Klient';
  };
  const datum = (s: string) => new Date(s).toLocaleString('cs-CZ');

  if (detail) {
    return (
      <div className="space-y-4 animate-fade-in">
        <button onClick={() => setDetail(null)} className="flex items-center gap-1.5 text-sm font-bold text-primary hover:text-primary-600 print:hidden">
          <ArrowLeft className="h-4 w-4" /> Zpět na seznam
        </button>
        <div className="flex items-center justify-between print:hidden">
          <h1 className="text-2xl font-extrabold text-primary flex items-center gap-2"><Wallet className="h-6 w-6 text-accent" />Uložený finanční plán</h1>
          <button onClick={() => window.print()} className="flex items-center gap-1.5 text-xs font-bold text-white bg-primary hover:bg-primary-600 rounded-lg px-3 py-1.5 shadow-sm">
            <Printer className="h-3.5 w-3.5 text-accent" />Export PDF
          </button>
        </div>
        <p className="text-xs text-slate-400 print:hidden">Vytvořeno {datum(detail.datum)}</p>
        {detail.vypocty && (
          <div><h3 className="text-sm font-bold text-primary mb-2 print:mt-4">Přehled (spočítaná čísla)</h3><PlanPrehled v={detail.vypocty} /></div>
        )}
        <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm print:border-none print:shadow-none text-slate-900">
          <div className="prose prose-sm max-w-none"><Markdown text={detail.plan} /></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold tracking-tight text-primary flex items-center gap-2">
          <FolderClock className="h-7 w-7 text-accent" /> Uložené plány
        </h1>
        <Link href="/plan" className="text-sm font-bold text-primary hover:text-primary-600">+ Nový plán</Link>
      </div>
      <p className="text-sm text-slate-600">Dříve vygenerované finanční plány. Klikni pro znovuotevření, tisk nebo smazání.</p>

      {error && <div role="alert" className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}

      {loading || nacitamDetail ? (
        <div className="flex items-center justify-center py-12 text-slate-500"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : plany.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-slate-200 rounded-lg">
          <FileText className="h-10 w-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-600">Zatím žádné uložené plány.</p>
          <Link href="/plan" className="text-sm font-bold text-primary hover:underline">Vytvořit první finanční plán</Link>
        </div>
      ) : (
        <div className="space-y-1.5">
          {plany.map((p) => (
            <div key={p.id} className="flex items-center gap-2 rounded-lg border border-slate-200 p-3 text-sm hover:bg-slate-50">
              <button onClick={() => otevri(p.id)} className="flex-1 min-w-0 text-left">
                <div className="font-semibold text-slate-800 truncate">{popis(p)}</div>
                <div className="text-[11px] text-slate-400">{datum(p.vytvoreno_kdy)}</div>
              </button>
              <button onClick={() => otevri(p.id)} className="text-xs font-bold text-primary bg-primary-50 hover:bg-primary-100 rounded-md px-2.5 py-1.5">Otevřít</button>
              <button onClick={() => smaz(p.id)} className="text-slate-400 hover:text-red-600 p-1.5" title="Smazat"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
