'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  MessageSquare, Wallet, Calculator, Columns3, FolderOpen, FileText,
  FolderClock, ArrowRight, Sparkles, ShieldCheck, TrendingUp, Loader2, UserRound,
} from 'lucide-react';
import { getUlozenePlanyAction } from '@/app/actions';
import { PageHeader, Card, Badge } from '@/components/ui';
import { usePripad, jePripadPrazdny, popisPripadu } from '@/lib/pripadStore';

interface PlanMeta {
  id: string;
  vytvoreno_kdy: string;
  profil: { vek?: number; cistyPrijem?: number; cileSeznam?: { nazev: string }[]; cile?: string } | null;
}

// Rozcestník hlavních funkcí — seskupený podle logiky práce s případem klienta.
const PRIPAD = [
  { name: 'Finanční plán', href: '/plan', icon: Wallet, desc: 'Komplexní plán přes 4 pilíře (penze, investice, úvěry, pojištění) z profilu klienta.' },
  { name: 'Rychlý návrh', href: '/pripad', icon: FileText, desc: 'Jednodušší analytický podklad pro klienta z pojistných podmínek.' },
  { name: 'Kalkulačky', href: '/kalkulacky', icon: Calculator, desc: '11 interaktivních kalkulaček — hypotéka, investice, renta, pojistná potřeba.' },
  { name: 'Uložené plány', href: '/plany', icon: FolderClock, desc: 'Znovu otevřít, vytisknout nebo smazat dříve vytvořené plány.' },
];
const ZNALOSTI = [
  { name: 'Poradna', href: '/poradna', icon: MessageSquare, desc: 'Ptejte se na pojistné podmínky — odpovědi výhradně z nahraných dokumentů se zdroji.' },
  { name: 'Srovnání', href: '/srovnani', icon: Columns3, desc: 'Matice parametrů napříč pojišťovnami — čekací doby, výluky, definice.' },
  { name: 'Dokumenty', href: '/admin', icon: FolderOpen, desc: 'Nahrání PDF podmínek, monitor změn a správa produktů a sazeb.' },
];

function Dlazdice({ name, href, icon: Icon, desc }: { name: string; href: string; icon: typeof Wallet; desc: string }) {
  return (
    <Link href={href} className="group block">
      <Card className="h-full transition-all duration-200 hover:shadow-card hover:border-primary-200 hover:-translate-y-0.5">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary group-hover:bg-primary group-hover:text-white transition-colors">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="font-bold text-primary">{name}</h3>
              <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
            </div>
            <p className="text-sm text-slate-500 mt-1 leading-snug">{desc}</p>
          </div>
        </div>
      </Card>
    </Link>
  );
}

export default function DashboardPage() {
  const [plany, setPlany] = useState<PlanMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const { pripad, nacteno } = usePripad();
  const maPripad = nacteno && !jePripadPrazdny(pripad);

  useEffect(() => {
    getUlozenePlanyAction()
      .then((res) => { if (res.success) setPlany((res.plany as PlanMeta[]).slice(0, 3)); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const popis = (p: PlanMeta) => {
    const pr = p.profil || {};
    const cile = pr.cileSeznam?.length ? `${pr.cileSeznam.length} cílů` : (pr.cile ? 'cíle' : '');
    return [pr.vek ? `${pr.vek} let` : null, pr.cistyPrijem ? `${pr.cistyPrijem.toLocaleString('cs-CZ')} Kč/měs` : null, cile]
      .filter(Boolean).join(' · ') || 'Klient';
  };

  return (
    <div>
      <PageHeader
        ikona={<Sparkles className="h-5 w-5 text-accent" />}
        titulek="Vítejte v PoradceAI"
        popis="Asistent finančního poradce: postavte klientovi finanční plán, ověřte detaily v pojistných podmínkách a doložte vše čísly i zdroji."
      />

      {/* Aktivní případ klienta — zobrazí se, jen když je vyplněný */}
      {maPripad && (
        <Link href="/plan" className="group block mb-8">
          <Card className="border-primary-200 bg-gradient-to-r from-primary-50/80 to-white hover:shadow-card transition-all">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-soft">
                  <UserRound className="h-5 w-5 text-accent" />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Aktivní případ klienta</div>
                  <div className="font-bold text-primary truncate">{popisPripadu(pripad)}</div>
                </div>
              </div>
              <Badge tone="primary">Pokračovat v plánu →</Badge>
            </div>
          </Card>
        </Link>
      )}

      {/* Princip produktu — krátká připomínka hodnoty */}
      <div className="grid sm:grid-cols-3 gap-3 mb-8">
        {[
          { ikona: ShieldCheck, t: 'Nestrannost', d: 'Doporučení z dat klienta, ne z provize.' },
          { ikona: TrendingUp, t: 'Pravdivá čísla', d: 'Počítají deterministické kalkulačky, ne AI.' },
          { ikona: FileText, t: 'Vysvětlitelnost', d: 'Každý závěr ukazuje proč a z jakého zdroje.' },
        ].map((x) => (
          <Card key={x.t} padding="p-4">
            <div className="flex items-center gap-2 text-primary font-bold text-sm">
              <x.ikona className="h-4 w-4 text-accent" />{x.t}
            </div>
            <p className="text-xs text-slate-500 mt-1">{x.d}</p>
          </Card>
        ))}
      </div>

      {/* Případ klienta */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Případ klienta</h2>
      </div>
      <div className="grid sm:grid-cols-2 gap-4 mb-8">
        {PRIPAD.map((x) => <Dlazdice key={x.href} {...x} />)}
      </div>

      {/* Znalosti & data */}
      <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Znalosti & data</h2>
      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        {ZNALOSTI.map((x) => <Dlazdice key={x.href} {...x} />)}
      </div>

      {/* Poslední plány */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Poslední plány</h2>
        <Link href="/plany" className="text-sm font-bold text-primary hover:text-primary-600">Všechny →</Link>
      </div>
      <Card>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-400 py-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Načítám…
          </div>
        ) : plany.length === 0 ? (
          <div className="text-sm text-slate-500 py-2">
            Zatím žádné uložené plány.{' '}
            <Link href="/plan" className="font-bold text-primary hover:underline">Vytvořit první finanční plán →</Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {plany.map((p) => (
              <Link key={p.id} href="/plany" className="flex items-center justify-between gap-3 py-2.5 group">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary">
                    <Wallet className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-800 group-hover:text-primary truncate">{popis(p)}</div>
                    <div className="text-xs text-slate-400">{new Date(p.vytvoreno_kdy).toLocaleString('cs-CZ')}</div>
                  </div>
                </div>
                <Badge tone="primary">Otevřít</Badge>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
