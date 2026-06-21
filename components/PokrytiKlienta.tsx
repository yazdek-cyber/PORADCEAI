'use client';

// Checklist „co klient má vs. nemá" — jádro služby (klient má zajištěno vše). Odvozené oblasti se
// počítají z čísel; pojistné krytí (ŽP, majetek) zaškrtne poradce. Nepokryté oblasti = co řešit (potenciál).
import { CheckCircle2, Circle, ShieldCheck } from 'lucide-react';
import { pokrytiKlienta } from '@/lib/pokryti';
import type { Pripad } from '@/lib/pripadStore';

export default function PokrytiKlienta({ profil, onToggle }: {
  profil: Pripad;
  onToggle: (pole: 'maZivotni' | 'maMajetek', hodnota: boolean) => void;
}) {
  const oblasti = pokrytiKlienta(profil);
  const kryto = oblasti.filter((o) => o.kryto).length;
  const pct = Math.round((kryto / oblasti.length) * 100);

  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-soft">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-base font-bold text-primary flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-accent" /> Zajištění klienta
        </h3>
        <span className="text-[11px] font-semibold text-slate-400">{kryto} / {oblasti.length} oblastí</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden mb-3">
        <div className="h-1.5 rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-slate-500 mb-3">Komplexní pohled „co klient má vs. nemá". Nepokryté oblasti = co s ním řešit.</p>

      <div className="grid sm:grid-cols-2 gap-1.5">
        {oblasti.map((o) => {
          const klikatelne = !o.odvozeno && o.pole;
          const obsah = (
            <>
              {o.kryto
                ? <CheckCircle2 className="h-4.5 w-4.5 text-green-600 shrink-0" />
                : <Circle className="h-4.5 w-4.5 text-slate-300 shrink-0" />}
              <div className="min-w-0">
                <div className={`text-sm font-semibold ${o.kryto ? 'text-slate-800' : 'text-slate-500'}`}>{o.nazev}</div>
                <div className="text-[10px] text-slate-400 truncate">{o.popis}{!o.odvozeno ? ' · klikni pro označení' : ''}</div>
              </div>
            </>
          );
          if (klikatelne) {
            return (
              <button
                key={o.id}
                onClick={() => onToggle(o.pole!, !o.kryto)}
                className={`flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition-colors ${
                  o.kryto ? 'border-green-200 bg-green-50/40' : 'border-slate-200 hover:border-primary-200 hover:bg-slate-50'
                }`}
              >
                {obsah}
              </button>
            );
          }
          return (
            <div key={o.id} className={`flex items-center gap-2.5 rounded-xl border border-slate-100 p-2.5 ${o.kryto ? 'bg-green-50/30' : 'bg-slate-50/40'}`}>
              {obsah}
            </div>
          );
        })}
      </div>
    </div>
  );
}
