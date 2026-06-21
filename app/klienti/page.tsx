'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  Users, UserRound, ArrowLeft, Plus, Pencil, Trash2, Check, Wallet, ShieldCheck,
  ClipboardCheck, FolderClock, FileText, Loader2, Lightbulb, ChevronRight,
} from 'lucide-react';
import { getUlozenePlanyAction } from '@/app/actions';
import { PageHeader, Card, Badge, Button, Radek } from '@/components/ui';
import { usePripad, popisPripadu, jmenoKlienta, jePripadPrazdny, type Pripad } from '@/lib/pripadStore';
import { najdiPrilezitosti, type PrioritaPrilezitosti } from '@/lib/prilezitosti';
import ModalNovyKlient from '@/components/ModalNovyKlient';
import ProcesPripadu from '@/components/ProcesPripadu';
import PokrytiKlienta from '@/components/PokrytiKlienta';

const PRIORITA_STYL: Record<PrioritaPrilezitosti, { tone: 'red' | 'amber' | 'slate'; label: string }> = {
  vysoka: { tone: 'red', label: 'Vysoká' },
  stredni: { tone: 'amber', label: 'Střední' },
  nizka: { tone: 'slate', label: 'Nízká' },
};
const TONE_TRIDA: Record<'red' | 'amber' | 'slate', string> = {
  red: 'bg-red-100 text-red-700',
  amber: 'bg-amber-100 text-amber-700',
  slate: 'bg-slate-100 text-slate-600',
};

interface PlanMeta {
  id: string;
  vytvoreno_kdy: string;
  profil: { jmeno?: string; klientId?: string; vek?: number; cistyPrijem?: number; cileSeznam?: { nazev: string }[]; cile?: string } | null;
}

const f = (x?: number) => (x === undefined || x === null ? '—' : Math.round(x).toLocaleString('cs-CZ'));


export default function KlientiPage() {
  const { pripad, klienti, aktivniId, nacteno, prepniKlienta, prejmenujKlienta, smazKlienta, ulozPripad, aktualizujKlienta } = usePripad();
  const [modalNovy, setModalNovy] = useState(false);
  const [vybranyId, setVybranyId] = useState<string | null>(null);
  const [plany, setPlany] = useState<PlanMeta[]>([]);
  const [nactamPlany, setNactamPlany] = useState(true);
  const [poznamky, setPoznamky] = useState('');
  const [ulozenoPozn, setUlozenoPozn] = useState(false);

  useEffect(() => {
    getUlozenePlanyAction()
      .then((res) => { if (res.success) setPlany(res.plany as PlanMeta[]); })
      .catch(() => {})
      .finally(() => setNactamPlany(false));
  }, []);

  const vybrany = klienti.find((k) => k.id === vybranyId) ?? null;
  const prilezitosti = useMemo(() => najdiPrilezitosti(klienti), [klienti]);
  const [vsePrilezitosti, setVsePrilezitosti] = useState(false);

  // Při otevření detailu nastav klienta jako aktivního a načti jeho poznámky.
  const otevri = (id: string) => {
    prepniKlienta(id);
    setVybranyId(id);
    const k = klienti.find((x) => x.id === id);
    setPoznamky(k?.profil.poznamky ?? '');
  };

  // Deep-link z Domů: /klienti?id=<klientId> rovnou otevře kokpit daného klienta.
  // Param se SPOTŘEBUJE (vyčistí z URL), aby se efekt po „Zpět"/smazání jiného klienta neopakoval
  // a násilně nevracel uživatele zpět do detailu (a nepřepínal aktivního klienta).
  const deepLinkRef = useRef(false);
  useEffect(() => {
    if (!nacteno || deepLinkRef.current) return;
    try {
      const id = new URLSearchParams(window.location.search).get('id');
      if (id) {
        deepLinkRef.current = true;
        window.history.replaceState(null, '', '/klienti');
        if (!vybranyId && klienti.some((k) => k.id === id)) otevri(id);
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nacteno, klienti.length]);

  // Plány klienta: primárně dle klientId (spolehlivé, přežije přejmenování), pro starší plány
  // bez klientId fallback na shodu jména. Plán s klientId patřící jinému klientovi nikdy nepropadne.
  const planyKlienta = (id: string, p: Pripad): PlanMeta[] => {
    const jm = p.jmeno?.trim().toLowerCase();
    return plany.filter((pl) =>
      pl.profil?.klientId
        ? pl.profil.klientId === id
        : !!jm && pl.profil?.jmeno?.trim().toLowerCase() === jm);
  };

  const ulozPoznamky = () => {
    // Poznámky se ukládají do AKTIVNÍHO klienta (detail ho aktivním nastavil).
    ulozPripad({ ...pripad, poznamky: poznamky.trim() || undefined });
    setUlozenoPozn(true);
    setTimeout(() => setUlozenoPozn(false), 2000);
  };

  const pridej = () => setModalNovy(true);
  const prejmenuj = (id: string, soucasne: string) => {
    const jmeno = window.prompt('Nové jméno klienta:', soucasne);
    if (jmeno !== null && jmeno.trim()) prejmenujKlienta(id, jmeno);
  };
  const smaz = (id: string, jmeno: string) => {
    if (window.confirm(`Smazat klienta „${jmeno}"? Profil zůstane jen v tomto prohlížeči.`)) {
      smazKlienta(id);
      if (vybranyId === id) setVybranyId(null);
    }
  };

  // ── DETAIL ────────────────────────────────────────────────────────────────
  if (vybrany) {
    const p = vybrany.profil;
    const planyK = planyKlienta(vybrany.id, p);
    return (
      <div className="animate-fade-in">
        <button onClick={() => setVybranyId(null)} className="flex items-center gap-1.5 text-sm font-bold text-primary hover:text-primary-600 mb-4">
          <ArrowLeft className="h-4 w-4" /> Zpět na klienty
        </button>

        <PageHeader
          ikona={<UserRound className="h-5 w-5 text-accent" />}
          titulek={jmenoKlienta(p)}
          popis={popisPripadu(p)}
          akce={
            <>
              <Button variant="ghost" onClick={() => prejmenuj(vybrany.id, p.jmeno || '')}><Pencil className="h-4 w-4" /> Přejmenovat</Button>
              <Button variant="ghost" onClick={() => smaz(vybrany.id, jmenoKlienta(p))}><Trash2 className="h-4 w-4" /> Smazat</Button>
            </>
          }
        />

        {/* Kokpit případu + zajištění klienta — provázaná procesní linka a „co má vs. nemá" */}
        <div className="grid lg:grid-cols-2 gap-5 mb-5">
          <ProcesPripadu profil={p} pocetPlanu={planyK.length} naAktivni={() => prepniKlienta(vybrany.id)} />
          <PokrytiKlienta profil={p} naAktivni={() => prepniKlienta(vybrany.id)} onToggle={(pole, hodnota) => aktualizujKlienta(vybrany.id, { [pole]: hodnota })} />
        </div>

        <div className="grid lg:grid-cols-2 gap-5">
          {/* Profil */}
          <Card>
            <h3 className="text-sm font-bold text-primary mb-2">Profil klienta</h3>
            <Radek label="Věk" hodnota={p.vek ? `${p.vek} let` : '—'} />
            <Radek label="Čistý příjem" hodnota={p.cistyPrijem ? `${f(p.cistyPrijem)} Kč/měs` : '—'} />
            <Radek label="Výdaje" hodnota={p.vydaje ? `${f(p.vydaje)} Kč/měs` : '—'} />
            <Radek label="Rodina" hodnota={[p.partner ? 'partner/ka' : null, typeof p.pocetDeti === 'number' && p.pocetDeti > 0 ? `${p.pocetDeti} děti` : null].filter(Boolean).join(', ') || '—'} />
            <Radek label="Hypotéka" hodnota={p.hypotekaZustatek ? `${f(p.hypotekaZustatek)} Kč` : '—'} />
            <Radek label="Rizikový profil" hodnota={p.rizikovyProfil || '—'} />
            <Radek label="Povolání" hodnota={p.povolani || '—'} />
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href="/plan"><Button variant="primary"><Wallet className="h-4 w-4 text-accent" /> Finanční plán</Button></Link>
              <Link href="/pripad"><Button variant="ghost"><ShieldCheck className="h-4 w-4" /> Pojištění</Button></Link>
              <Link href="/zaznam"><Button variant="ghost"><ClipboardCheck className="h-4 w-4" /> Záznam</Button></Link>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">Rychlé akce pracují s tímto klientem (je nastaven jako aktivní).</p>
          </Card>

          {/* Poznámky */}
          <Card>
            <h3 className="text-sm font-bold text-primary mb-2">Poznámky</h3>
            <textarea
              value={poznamky}
              onChange={(e) => setPoznamky(e.target.value)}
              rows={6}
              placeholder="Poznámky ke klientovi — co řešíme, na co navázat, preference…"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm leading-relaxed focus:border-primary focus:ring-2 focus:ring-primary-100 focus:outline-none"
            />
            <div className="mt-2 flex items-center gap-3">
              <Button variant="primary" onClick={ulozPoznamky}>Uložit poznámky</Button>
              {ulozenoPozn && <span className="inline-flex items-center gap-1 text-sm font-semibold text-positive"><Check className="h-4 w-4" /> Uloženo</span>}
            </div>
          </Card>

          {/* Plány klienta */}
          <Card className="lg:col-span-2">
            <h3 className="text-sm font-bold text-primary mb-2 flex items-center gap-1.5"><FolderClock className="h-4 w-4 text-accent" />Uložené plány klienta ({planyK.length})</h3>
            {nactamPlany ? (
              <div className="flex items-center gap-2 text-sm text-slate-400 py-2"><Loader2 className="h-4 w-4 animate-spin" /> Načítám…</div>
            ) : planyK.length === 0 ? (
              <p className="text-sm text-slate-500">
                Zatím žádné uložené plány pro tohoto klienta.{' '}
                <Link href="/plan" className="font-bold text-primary hover:underline">Vytvořit plán →</Link>
                <span className="block text-[11px] text-slate-400 mt-1">Plány se ke klientovi párují automaticky při vygenerování (přes interní id); u starších plánů pomůže shoda jména.</span>
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {planyK.map((pl) => (
                  <Link key={pl.id} href="/plany" className="flex items-center justify-between gap-3 py-2.5 group">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary"><Wallet className="h-4 w-4" /></div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-800 group-hover:text-primary">Finanční plán</div>
                        <div className="text-xs text-slate-400">{new Date(pl.vytvoreno_kdy).toLocaleString('cs-CZ')}</div>
                      </div>
                    </div>
                    <Badge tone="primary">Otevřít</Badge>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    );
  }

  // ── SEZNAM ────────────────────────────────────────────────────────────────
  return (
    <div className="animate-fade-in">
      <ModalNovyKlient open={modalNovy} onClose={() => setModalNovy(false)} onCreated={(id) => setVybranyId(id)} />
      <PageHeader
        ikona={<Users className="h-5 w-5 text-accent" />}
        titulek="Klienti"
        popis="Databáze vašich klientů — profil, uložené plány a poznámky (uložené na serveru, izolované jen pro vás)."
        akce={<Button variant="primary" onClick={pridej}><Plus className="h-4 w-4" /> Nový klient</Button>}
      />

      {/* Příležitosti / cross-sell radar — odvozené z profilů klientů */}
      {nacteno && prilezitosti.length > 0 && (
        <Card className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-primary flex items-center gap-1.5">
              <Lightbulb className="h-4 w-4 text-accent" /> Příležitosti ({prilezitosti.length})
            </h3>
            {prilezitosti.length > 4 && (
              <button onClick={() => setVsePrilezitosti((v) => !v)} className="text-[11px] font-bold text-primary hover:underline">
                {vsePrilezitosti ? 'Zobrazit méně' : `Zobrazit vše (${prilezitosti.length})`}
              </button>
            )}
          </div>
          <p className="text-[11px] text-slate-400 mb-3">Návrhy odvozené z profilů klientů — nejde o automatické doporučení, posuďte vždy individuálně.</p>
          <div className="space-y-1.5">
            {(vsePrilezitosti ? prilezitosti : prilezitosti.slice(0, 4)).map((p, i) => {
              const styl = PRIORITA_STYL[p.priorita];
              return (
                <div key={`${p.klientId}-${p.typ}-${i}`} className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/60 p-2.5">
                  <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${TONE_TRIDA[styl.tone]}`}>{styl.label}</span>
                  <button onClick={() => otevri(p.klientId)} className="shrink-0 text-sm font-bold text-primary hover:underline truncate max-w-[120px]" title={p.klientJmeno}>
                    {p.klientJmeno}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-800">{p.nadpis}</div>
                    <div className="text-[11px] text-slate-500 truncate" title={p.duvod}>{p.duvod}</div>
                  </div>
                  <Link
                    href={p.akce.href}
                    onClick={() => prepniKlienta(p.klientId)}
                    className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold text-primary bg-primary-50 hover:bg-primary-100 rounded-md px-2.5 py-1.5"
                  >
                    {p.akce.label} <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {!nacteno ? (
        <div className="flex items-center justify-center py-12 text-slate-400"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : klienti.length === 0 ? (
        <Card className="text-center py-12">
          <Users className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <h3 className="font-bold text-slate-700">Zatím žádní klienti</h3>
          <p className="text-sm text-slate-500 mt-1">Založte prvního klienta nebo vyplňte profil ve Finančním plánu.</p>
          <div className="mt-3"><Button variant="primary" onClick={pridej}><Plus className="h-4 w-4" /> Nový klient</Button></div>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {klienti.map((k) => {
            const aktivni = k.id === aktivniId;
            const pocetPlanu = planyKlienta(k.id, k.profil).length;
            return (
              <Card key={k.id} className={`group ${aktivni ? 'border-primary-200' : ''}`}>
                <button onClick={() => otevri(k.id)} className="w-full text-left">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary">
                      <UserRound className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-bold text-primary truncate">{jmenoKlienta(k.profil)}</h3>
                        {aktivni && <Badge tone="primary">Aktivní</Badge>}
                      </div>
                      <p className="text-xs text-slate-500 truncate mt-0.5">{popisPripadu(k.profil)}</p>
                      <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-400">
                        <span className="inline-flex items-center gap-1"><FolderClock className="h-3 w-3" />{pocetPlanu} plánů</span>
                        {k.profil.poznamky && <span className="inline-flex items-center gap-1"><FileText className="h-3 w-3" />poznámky</span>}
                      </div>
                    </div>
                  </div>
                </button>
                <div className="mt-3 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => prejmenuj(k.id, k.profil.jmeno || '')} className="p-1.5 text-slate-400 hover:text-primary" title="Přejmenovat"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => smaz(k.id, jmenoKlienta(k.profil))} className="p-1.5 text-slate-400 hover:text-red-600" title="Smazat"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
