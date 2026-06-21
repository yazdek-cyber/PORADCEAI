'use client';

import { useState } from 'react';
import { UserRound, Loader2, X } from 'lucide-react';
import { usePripad } from '@/lib/pripadStore';

/**
 * Modal pro založení nového klienta — nahrazuje window.prompt. Založení je SERVEROVĚ POTVRZENÉ:
 * klient se přidá do UI až po úspěšném uložení na server (žádné tiché zmizení po reloadu).
 */
export default function ModalNovyKlient({ open, onClose, onCreated }: {
  open: boolean;
  onClose: () => void;
  onCreated?: (id: string) => void;
}) {
  const { novyKlientServer } = usePripad();
  const [jmeno, setJmeno] = useState('');
  const [uklada, setUklada] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);

  if (!open) return null;

  const zavri = () => { if (!uklada) { setJmeno(''); setChyba(null); onClose(); } };

  const vytvor = async () => {
    if (uklada) return;
    setUklada(true);
    setChyba(null);
    const r = await novyKlientServer(jmeno);
    setUklada(false);
    if (!r.ok) { setChyba(r.error || 'Uložení na server selhalo. Zkuste to znovu.'); return; }
    setJmeno('');
    onCreated?.(r.id!);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={zavri} />
      <div className="relative w-full max-w-sm rounded-2xl border border-slate-200/70 bg-white p-5 shadow-pop animate-fade-in">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold text-primary flex items-center gap-2">
            <UserRound className="h-5 w-5 text-accent" /> Nový klient
          </h3>
          <button onClick={zavri} aria-label="Zavřít" className="text-slate-400 hover:text-slate-600 p-1 disabled:opacity-40" disabled={uklada}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <label className="block">
          <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Jméno klienta</span>
          <input
            autoFocus
            value={jmeno}
            onChange={(e) => setJmeno(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') vytvor(); }}
            placeholder="např. Jan Novák (lze doplnit později)"
            disabled={uklada}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary-100 focus:outline-none placeholder-slate-400"
          />
        </label>

        {chyba && <p className="mt-2 text-xs text-red-600">{chyba}</p>}

        <div className="mt-4 flex items-center justify-end gap-2">
          <button onClick={zavri} disabled={uklada} className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-40">
            Zrušit
          </button>
          <button
            onClick={vytvor}
            disabled={uklada}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary-600 disabled:bg-slate-300"
          >
            {uklada ? <><Loader2 className="h-4 w-4 animate-spin text-accent" /> Zakládám…</> : 'Založit klienta'}
          </button>
        </div>
      </div>
    </div>
  );
}
