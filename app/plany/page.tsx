'use client';

import { useState, useEffect } from 'react';
import { FolderClock, Loader2, Wallet, Printer, Trash2, ArrowLeft, FileText, UserRound, ArrowLeftRight, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { getUlozenePlanyAction, getUlozenyPlanAction, smazUlozenyPlanAction } from '@/app/actions';
import type { Vypocty, FinPlanProfil } from '@/lib/financniPlan';
import PlanDokument from '@/components/PlanDokument';
import PlanPrehled from '@/components/PlanPrehled';
import KlientskaAnalyza, { type KlientCisla } from '@/components/KlientskaAnalyza';
import { TiskHlavicka, TiskPaticka } from '@/components/Tisk';
import { ShieldCheck } from 'lucide-react';
import { usePripad, jmenoKlienta, type Pripad } from '@/lib/pripadStore';

interface PlanMeta {
  id: string;
  vytvoreno_kdy: string;
  profil: { jmeno?: string; klientId?: string; vek?: number; cistyPrijem?: number; cileSeznam?: { nazev: string }[]; cile?: string } | null;
}

/** Mapuje uložený profil plánu na profil případu (Pripad).
 *  Pozor: hypotekaSazba je v plánu desetinně (0.049), v Pripad v procentech (4.9). */
function planProfilNaPripad(p: FinPlanProfil): Partial<Pripad> {
  return {
    jmeno: p.jmeno, vek: p.vek, cistyPrijem: p.cistyPrijem, vydaje: p.vydaje,
    rezervaNasporeno: p.rezervaNasporeno, existujiciInvestice: p.existujiciInvestice,
    mesicniVkladInvestice: p.mesicniVkladInvestice,
    hypotekaZustatek: p.hypotekaZustatek,
    hypotekaSazba: p.hypotekaSazba !== undefined ? p.hypotekaSazba * 100 : undefined,
    hypotekaZbyvaMesicu: p.hypotekaZbyvaMesicu,
    jineDluhy: p.jineDluhy, mesicniSplatkyDluhu: p.mesicniSplatkyDluhu,
    partner: p.partner, pocetDeti: p.pocetDeti,
    vekOdchodu: p.vekOdchodu, penzeNasporeno: p.penzeNasporeno,
    penzeMesicniVklad: p.penzeMesicniVklad, cilovaRentaDuchod: p.cilovaRentaDuchod,
    ocekavanaStatniPenze: p.ocekavanaStatniPenze,
    rizikovyProfil: p.rizikovyProfil, povolani: p.povolani,
    zdravotniStav: p.zdravotniStav, cile: p.cile,
  };
}

export default function PlanyPage() {
  const [plany, setPlany] = useState<PlanMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ id: string; plan: string; vypocty: Vypocty | null; datum: string; profil: KlientCisla | null; klientId?: string; profilPlanu: FinPlanProfil | null } | null>(null);
  const [nacitamDetail, setNacitamDetail] = useState(false);
  const [syncHlaska, setSyncHlaska] = useState<string | null>(null);

  // Párování plán↔klient: evidence klientů z pripadStore (lokální).
  const { klienti, aktivniId, prepniKlienta, aktualizujKlienta } = usePripad();
  const jmenoProKlientId = (id?: string): string | null => {
    if (!id) return null;
    const k = klienti.find((x) => x.id === id);
    return k ? jmenoKlienta(k.profil) : null;
  };

  const nactiSeznam = async () => {
    setLoading(true);
    setError(null);
    const res = await getUlozenePlanyAction();
    if (res.success) setPlany(res.plany as PlanMeta[]);
    else setError(res.error || 'Nepodařilo se načíst plány.');
    setLoading(false);
  };
  useEffect(() => { nactiSeznam(); }, []);

  const otevri = async (id: string) => {
    setNacitamDetail(true);
    setError(null);
    setSyncHlaska(null);
    try {
      const res = await getUlozenyPlanAction(id);
      if (res.success) {
        // Nedůvěřuj tvaru z DB: prázdný objekt {} (DB default) je truthy → ověř konkrétní podklíče
        // (shodně s guardem v KlientskaAnalyza/PlanPrehled, ať starší uložené plány nepadají).
        const raw = res.vypocty as Partial<Vypocty> | null | undefined;
        const vypocty = raw && raw.rezerva?.doporucenaRezerva !== undefined && raw.rezervaUrovne
          && raw.investice?.monteCarlo && raw.penze?.projekce && raw.uvery ? (raw as Vypocty) : null;
        const profilPlanu = (res.profil ?? null) as FinPlanProfil | null;
        const profil = profilPlanu as KlientCisla | null;
        setDetail({ id, plan: res.plan, vypocty, datum: res.vytvoreno_kdy as string, profil, klientId: profilPlanu?.klientId, profilPlanu });
      } else {
        setError(res.error || 'Plán se nepodařilo otevřít.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Plán se nepodařilo otevřít.');
    } finally {
      setNacitamDetail(false);
    }
  };

  const smaz = async (id: string) => {
    if (!confirm('Opravdu smazat tento uložený plán?')) return;
    const res = await smazUlozenyPlanAction(id);
    if (res.success) { if (detail?.id === id) setDetail(null); nactiSeznam(); }
    else setError(res.error || 'Smazání selhalo.');
  };

  // Jméno klienta plánu: přednost má AKTUÁLNÍ jméno z evidence (dle klientId — přežije přejmenování),
  // pak jméno uložené v profilu plánu, nakonec obecné „Klient".
  const jmenoPlanu = (p: PlanMeta) =>
    jmenoProKlientId(p.profil?.klientId) || p.profil?.jmeno?.trim() || 'Klient';
  const popis = (p: PlanMeta) => {
    const pr = p.profil || {};
    const cile = pr.cileSeznam?.length ? `${pr.cileSeznam.length} cílů` : (pr.cile ? 'cíle' : '');
    return [pr.vek ? `${pr.vek} let` : null, pr.cistyPrijem ? `${pr.cistyPrijem.toLocaleString('cs-CZ')} Kč/měs` : null, cile]
      .filter(Boolean).join(' · ') || '—';
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

        {/* Lišta párovaného případu klienta */}
        {detail.klientId && (() => {
          const klientPlanu = klienti.find((k) => k.id === detail.klientId);
          const jeAktivni = detail.klientId === aktivniId;
          if (!klientPlanu) {
            return (
              <div className="print:hidden rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
                Klient k tomuto plánu už v evidenci neexistuje (byl smazán). Profil plánu zůstává v PDF zachován.
              </div>
            );
          }
          return (
            <div className="print:hidden flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary-100 bg-primary-50/60 px-4 py-2.5">
              <div className="flex items-center gap-2 min-w-0 text-sm">
                <UserRound className="h-4 w-4 text-primary shrink-0" />
                <span className="text-slate-500">Případ klienta:</span>
                <span className="font-semibold text-primary truncate">{jmenoKlienta(klientPlanu.profil)}</span>
                {jeAktivni && <span className="shrink-0 rounded-full bg-primary-100 text-primary text-[10px] font-bold px-1.5 py-0.5">aktivní</span>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {!jeAktivni && (
                  <button
                    type="button"
                    onClick={() => { prepniKlienta(detail.klientId!); setSyncHlaska('Klient nastaven jako aktivní případ.'); }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-primary hover:border-primary-200"
                  >
                    <ArrowLeftRight className="h-3.5 w-3.5" /> Přepnout na tohoto klienta
                  </button>
                )}
                {detail.profilPlanu && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!confirm('Přepsat profil klienta v evidenci hodnotami z tohoto plánu? Aktuální profil klienta bude nahrazen snímkem z plánu.')) return;
                      aktualizujKlienta(detail.klientId!, planProfilNaPripad(detail.profilPlanu!));
                      setSyncHlaska('Profil klienta byl aktualizován podle plánu.');
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-primary hover:border-primary-200"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Aktualizovat profil podle plánu
                  </button>
                )}
              </div>
            </div>
          );
        })()}
        {syncHlaska && <p className="print:hidden text-xs font-semibold text-green-700">{syncHlaska}</p>}

        <TiskHlavicka titulek="Finanční plán" podtitulek="4 pilíře: penze · investice · úvěry · pojištění" klient={jmenoProKlientId(detail.klientId) || detail.profil?.jmeno} datum={datum(detail.datum)} />

        {detail.vypocty && (
          <div>
            <h3 className="text-sm font-bold text-primary mb-2 print:mt-4 flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-accent" />Klientská analýza</h3>
            <KlientskaAnalyza v={detail.vypocty} klient={detail.profil ?? {}} />
          </div>
        )}
        {detail.vypocty && (
          <details className="group print:hidden">
            <summary className="text-sm font-bold text-primary mb-2 cursor-pointer list-none">Detailní čísla (pro poradce) <span className="text-xs font-normal text-slate-400 group-open:hidden">— rozbalit</span></summary>
            <div className="mt-2"><PlanPrehled v={detail.vypocty} /></div>
          </details>
        )}
        <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm print:border-none print:shadow-none text-slate-900">
          <h3 className="hidden print:block text-lg font-bold text-primary mb-3 pb-1 border-b border-slate-200">Finanční plán — odborný rozbor</h3>
          <PlanDokument text={detail.plan} />
          <TiskPaticka datum={datum(detail.datum)} />
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
                <div className="font-semibold text-slate-800 truncate flex items-center gap-1.5">
                  {jmenoPlanu(p)}
                  {p.profil?.klientId && p.profil.klientId === aktivniId && (
                    <span className="shrink-0 rounded-full bg-primary-100 text-primary text-[10px] font-bold px-1.5 py-0.5">aktivní klient</span>
                  )}
                </div>
                <div className="text-[11px] text-slate-400">{popis(p)} · {datum(p.vytvoreno_kdy)}</div>
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
