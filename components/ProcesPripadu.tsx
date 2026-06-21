'use client';

// KOKPIT PŘÍPADU — provázaná procesní linka poradenství „od založení po uzavření".
// Místo roztříštěných nástrojů ukáže u klienta celý postup jako kroky se stavem a CTA
// „pokračovat", které poradce provedou daným nástrojem s UŽ NAČTENÝM klientem.
import Link from 'next/link';
import { CheckCircle2, Circle, ArrowRight, UserRound, LineChart, Wallet, ShieldCheck, ClipboardCheck, Flag } from 'lucide-react';
import type { Pripad } from '@/lib/pripadStore';

type Stav = 'hotovo' | 'aktivni' | 'ceka';

interface Krok {
  id: string;
  nazev: string;
  popis: string;
  href: string;
  cta: string;
  ikona: typeof Wallet;
  hotovo: boolean;
}

/** Je profil natolik vyplněný, že má smysl stavět plán? (jádro: věk + příjem) */
function profilVyplnen(p: Pripad): boolean {
  return (p.vek ?? 0) > 0 && (p.cistyPrijem ?? 0) > 0;
}

export default function ProcesPripadu({
  profil, pocetPlanu, naAktivni,
}: {
  profil: Pripad;
  pocetPlanu: number;
  /** Nastav tohoto klienta jako aktivního (před přechodem na nástroj). */
  naAktivni: () => void;
}) {
  const maProfil = profilVyplnen(profil);
  const maPlan = pocetPlanu > 0;

  // Stav se odvozuje z dat; „uzavření" je závěrečný manuální krok.
  // POŘADÍ dle metodiky: ANALÝZA (rozbor situace a potřeb) je PŘED plánem; PLÁN je východisko pro klienta.
  const kroky: Krok[] = [
    { id: 'profil', nazev: 'Profil & data', popis: 'Sběr vstupů: příjmy, závazky, cíle a rodina.', href: '/plan', cta: maProfil ? 'Upravit profil' : 'Vyplnit profil', ikona: UserRound, hotovo: maProfil },
    { id: 'analyza', nazev: 'Finanční analýza', popis: 'Rozbor současné situace, potřeb a mezer — východisko PŘED plánem.', href: '/plan', cta: 'Otevřít analýzu', ikona: LineChart, hotovo: maProfil },
    { id: 'plan', nazev: 'Finanční plán', popis: 'Doporučení a řešení — východisko pro klienta (na základě analýzy).', href: '/plan', cta: maPlan ? 'Otevřít plán' : 'Vytvořit plán', ikona: Wallet, hotovo: maPlan },
    { id: 'pojisteni', nazev: 'Pojištění z podmínek', popis: 'Ověřit krytí, výluky a čekací doby z podmínek.', href: '/pripad', cta: profil.maZivotni ? 'Pojištění' : 'Analýza pojištění', ikona: ShieldCheck, hotovo: !!profil.maZivotni },
    { id: 'zaznam', nazev: 'Záznam z jednání', popis: 'Doporučení a zdůvodnění (compliance) k tisku.', href: '/zaznam', cta: 'Vyplnit záznam', ikona: ClipboardCheck, hotovo: false },
    { id: 'uzavreni', nazev: 'Uzavření případu', popis: 'Shrnutí a předání klientovi.', href: '/zaznam', cta: 'Uzavřít', ikona: Flag, hotovo: false },
  ];

  // První nehotový krok = „aktivní" (doporučený další krok).
  const prvniNehotovy = kroky.findIndex((k) => !k.hotovo);
  const stav = (i: number): Stav => (kroky[i].hotovo ? 'hotovo' : i === prvniNehotovy ? 'aktivni' : 'ceka');
  const hotovych = kroky.filter((k) => k.hotovo).length;

  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-soft">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-base font-bold text-primary">Postup případu</h3>
        <span className="text-[11px] font-semibold text-slate-400">{hotovych} / {kroky.length} hotovo</span>
      </div>
      <p className="text-xs text-slate-500 mb-4">Provázaný postup od založení po uzavření — pokračujte tam, kde naváže další krok.</p>

      <ol className="space-y-2">
        {kroky.map((k, i) => {
          const s = stav(i);
          const Ikona = k.ikona;
          return (
            <li
              key={k.id}
              className={`flex items-center gap-3 rounded-xl border p-3 ${
                s === 'aktivni' ? 'border-primary-200 bg-primary-50/50' : 'border-slate-100 bg-slate-50/40'
              }`}
            >
              <div className="shrink-0">
                {s === 'hotovo'
                  ? <CheckCircle2 className="h-5 w-5 text-green-600" />
                  : <Circle className={`h-5 w-5 ${s === 'aktivni' ? 'text-primary' : 'text-slate-300'}`} />}
              </div>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white border border-slate-200 text-primary">
                <Ikona className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  {i + 1}. {k.nazev}
                  {s === 'aktivni' && <span className="rounded-full bg-primary-100 text-primary text-[10px] font-bold px-1.5 py-0.5">další krok</span>}
                  {s === 'hotovo' && <span className="text-[10px] font-bold text-green-700">hotovo</span>}
                </div>
                <div className="text-[11px] text-slate-500 truncate">{k.popis}</div>
              </div>
              <Link
                href={k.href}
                onClick={naAktivni}
                className={`shrink-0 inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold ${
                  s === 'aktivni' ? 'bg-primary text-white hover:bg-primary-600' : 'bg-white border border-slate-200 text-slate-600 hover:text-primary hover:border-primary-200'
                }`}
              >
                {k.cta} <ArrowRight className="h-3 w-3" />
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
