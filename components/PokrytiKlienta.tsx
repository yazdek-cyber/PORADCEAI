'use client';

// Checklist „co klient má vs. nemá" napříč VŠEMI odvětvími — jádro služby (klient má zajištěno vše).
// Odvozené oblasti se počítají z čísel; pojistné/spořicí produkty zaškrtne poradce. Každá nepokrytá
// oblast má odkaz „Řešit →" na příslušný nástroj (provázanost).
import Link from 'next/link';
import { CheckCircle2, Circle, ShieldCheck, ArrowRight } from 'lucide-react';
import { pokrytiKlienta, type PoleKryti } from '@/lib/pokryti';
import type { Pripad } from '@/lib/pripadStore';

export default function PokrytiKlienta({ profil, naAktivni, onToggle }: {
  profil: Pripad;
  /** nastav klienta aktivním před přechodem na nástroj */
  naAktivni?: () => void;
  onToggle: (pole: PoleKryti, hodnota: boolean) => void;
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
      <p className="text-xs text-slate-500 mb-3">Komplexní pohled „co klient má vs. nemá" napříč odvětvími. Nepokryté = co s ním řešit (klik vede na nástroj).</p>

      <div className="space-y-1.5">
        {oblasti.map((o) => {
          const klikatelne = !o.odvozeno && o.pole;
          return (
            <div
              key={o.id}
              className={`flex items-center gap-2.5 rounded-xl border p-2.5 ${
                o.kryto ? 'border-green-200 bg-green-50/40' : 'border-slate-200 bg-slate-50/40'
              }`}
            >
              <button
                type="button"
                onClick={klikatelne ? () => onToggle(o.pole!, !o.kryto) : undefined}
                className={`flex items-center gap-2.5 min-w-0 flex-1 text-left ${klikatelne ? '' : 'cursor-default'}`}
                title={klikatelne ? 'Klikni pro označení, zda klient produkt má' : undefined}
              >
                {o.kryto
                  ? <CheckCircle2 className="h-4.5 w-4.5 text-green-600 shrink-0" />
                  : <Circle className="h-4.5 w-4.5 text-slate-300 shrink-0" />}
                <div className="min-w-0">
                  <div className={`text-sm font-semibold ${o.kryto ? 'text-slate-800' : 'text-slate-500'}`}>{o.nazev}</div>
                  <div className="text-[10px] text-slate-400 truncate">{o.popis}{klikatelne ? ' · klik = má/nemá' : ''}</div>
                </div>
              </button>
              {!o.kryto && (
                <Link
                  href={o.href}
                  onClick={naAktivni}
                  className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-white border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-primary hover:bg-primary-50 hover:border-primary-200"
                >
                  Řešit <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
