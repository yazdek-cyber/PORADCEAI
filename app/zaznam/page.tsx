'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ClipboardCheck, Printer, UserRound, AlertTriangle, UserPlus } from 'lucide-react';
import { PageHeader, Card, Button } from '@/components/ui';
import { usePripad, jePripadPrazdny, jmenoKlienta, type Pripad } from '@/lib/pripadStore';

// ZÁZNAM Z JEDNÁNÍ (record of advice) — v ČR povinný dle zákona o distribuci pojištění/investic.
// Generuje se z aktivního případu klienta; poradce doplní doporučení a zdůvodnění. Tisk = PDF.
// Vše jen v prohlížeči (localStorage), nic se neodesílá.

interface Poradce { jmeno?: string; osvedceni?: string; telefon?: string; email?: string }
const PORADCE_KLIC = 'poradceai:poradce';

const fmt = (n?: number) => (n === undefined || n === null ? '' : n.toLocaleString('cs-CZ'));

function shrnutiKlienta(p: Pripad): string {
  return [
    p.vek ? `věk ${p.vek} let` : null,
    p.povolani ? `povolání ${p.povolani}` : null,
    p.cistyPrijem ? `čistý příjem ${fmt(p.cistyPrijem)} Kč/měs` : null,
    p.vydaje ? `výdaje ${fmt(p.vydaje)} Kč/měs` : null,
    p.partner ? 'partner/ka' : null,
    typeof p.pocetDeti === 'number' && p.pocetDeti > 0 ? `${p.pocetDeti} děti` : null,
    p.hypotekaZustatek ? `hypotéka ${fmt(p.hypotekaZustatek)} Kč` : null,
  ].filter(Boolean).join(', ');
}

const VYCHOZI_UPOZORNENI =
  'Doporučení vychází z informací poskytnutých klientem a z aktuálně dostupných pojistných podmínek. ' +
  'Uvedené hodnoty a projekce jsou orientační, počítané v reálné hodnotě (nad inflaci), a nejsou garancí ' +
  'budoucích výnosů. Klient byl poučen o souvisejících rizicích a o tom, že konečné podmínky určuje smluvní ' +
  'dokumentace zvolených produktů.';

function Pole({ label, value, set, placeholder }: { label: string; value: string; set: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">{label}</span>
      <input
        value={value}
        onChange={(e) => set(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary-100 focus:outline-none placeholder-slate-400"
      />
    </label>
  );
}

function Sekce({ cislo, titulek, value, set, rows = 4 }: { cislo: number; titulek: string; value: string; set: (v: string) => void; rows?: number }) {
  return (
    <div className="mt-5">
      <h3 className="text-sm font-bold text-primary mb-2">{cislo}. {titulek}</h3>
      <textarea
        value={value}
        onChange={(e) => set(e.target.value)}
        rows={rows}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm leading-relaxed focus:border-primary focus:ring-2 focus:ring-primary-100 focus:outline-none print:border-none print:p-0 print:resize-none"
      />
    </div>
  );
}

export default function ZaznamPage() {
  const { pripad, nacteno, aktivniId } = usePripad();
  const maKlient = nacteno && !jePripadPrazdny(pripad);

  const [poradce, setPoradce] = useState<Poradce>({});
  const [pozadavky, setPozadavky] = useState('');
  const [doporuceni, setDoporuceni] = useState('');
  const [zduvodneni, setZduvodneni] = useState('');
  const [upozorneni, setUpozorneni] = useState(VYCHOZI_UPOZORNENI);
  const poslIdRef = useRef<string | null | undefined>(undefined);

  const datumDnes = new Date().toLocaleDateString('cs-CZ');

  // Načti uloženou identitu poradce.
  useEffect(() => {
    try { const s = localStorage.getItem(PORADCE_KLIC); if (s) setPoradce(JSON.parse(s)); } catch { /* noop */ }
  }, []);
  const upravPoradce = (klic: keyof Poradce, val: string) => {
    setPoradce((p) => {
      const next = { ...p, [klic]: val };
      try { localStorage.setItem(PORADCE_KLIC, JSON.stringify(next)); } catch { /* noop */ }
      return next;
    });
  };

  // Předvyplň z profilu — při příchodu i při PŘEPNUTÍ klienta. Texty doporučení jsou
  // klientské, proto se při přepnutí resetují (jinak by se zobrazila u jiného klienta).
  useEffect(() => {
    if (!nacteno) return;
    if (aktivniId === poslIdRef.current) return;
    poslIdRef.current = aktivniId;
    const shrnuti = shrnutiKlienta(pripad);
    setPozadavky(
      `Klient: ${shrnuti || '—'}.\n` +
      `Cíle a potřeby klienta: ${pripad.cile?.trim() || '—'}.`
    );
    setDoporuceni('');
    setZduvodneni('');
    setUpozorneni(VYCHOZI_UPOZORNENI);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nacteno, aktivniId]);

  if (nacteno && !maKlient) {
    return (
      <div>
        <PageHeader ikona={<ClipboardCheck className="h-5 w-5 text-accent" />} titulek="Záznam z jednání"
          popis="Strukturovaný záznam o poskytnutém doporučení (compliance) z aktivního případu klienta." />
        <Card className="text-center py-12">
          <UserPlus className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <h3 className="font-bold text-slate-700">Není vybraný klient</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
            Vyberte nebo založte klienta v přepínači vlevo nahoře, případně nejprve vyplňte{' '}
            <Link href="/plan" className="font-bold text-primary hover:underline">finanční plán</Link>.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        ikona={<ClipboardCheck className="h-5 w-5 text-accent" />}
        titulek="Záznam z jednání"
        popis="Strukturovaný záznam o poskytnutém doporučení (compliance) z aktivního případu klienta."
        akce={<Button variant="primary" onClick={() => window.print()}><Printer className="h-4 w-4 text-accent" /> Tisk / PDF</Button>}
      />

      {/* Identita poradce (nepovinné; pamatuje se pro příště) */}
      <Card className="mb-5 print:hidden">
        <h3 className="text-sm font-bold text-primary mb-3 flex items-center gap-2"><UserRound className="h-4 w-4 text-accent" /> Poradce</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Pole label="Jméno a příjmení" value={poradce.jmeno || ''} set={(v) => upravPoradce('jmeno', v)} placeholder="Jan Poradce" />
          <Pole label="Č. osvědčení ČNB" value={poradce.osvedceni || ''} set={(v) => upravPoradce('osvedceni', v)} placeholder="123456PZ" />
          <Pole label="Telefon" value={poradce.telefon || ''} set={(v) => upravPoradce('telefon', v)} placeholder="+420 …" />
          <Pole label="E-mail" value={poradce.email || ''} set={(v) => upravPoradce('email', v)} placeholder="jan@…" />
        </div>
      </Card>

      {/* Dokument (na obrazovce editovatelný, k tisku čistý) */}
      <div className="rounded-2xl border border-slate-200/70 bg-white p-6 sm:p-8 shadow-soft print:border-none print:shadow-none print:p-0">
        {/* Hlavička dokumentu */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h1 className="text-xl font-bold text-primary">Záznam z jednání</h1>
            <p className="text-xs text-slate-500 mt-0.5">Záznam o požadavcích, potřebách a poskytnutém doporučení</p>
          </div>
          <div className="text-right text-xs text-slate-600">
            <p><span className="text-slate-400">Datum:</span> {datumDnes}</p>
            <p><span className="text-slate-400">Klient:</span> <strong>{jmenoKlienta(pripad)}</strong></p>
            {poradce.jmeno && <p><span className="text-slate-400">Poradce:</span> {poradce.jmeno}{poradce.osvedceni ? `, ${poradce.osvedceni}` : ''}</p>}
          </div>
        </div>

        {/* Identifikace klienta z profilu */}
        <div className="mt-5">
          <h3 className="text-sm font-bold text-primary mb-2">1. Identifikace a situace klienta</h3>
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
            <Radek label="Jméno" hodnota={jmenoKlienta(pripad)} />
            <Radek label="Věk" hodnota={pripad.vek ? `${pripad.vek} let` : '—'} />
            <Radek label="Čistý příjem" hodnota={pripad.cistyPrijem ? `${fmt(pripad.cistyPrijem)} Kč/měs` : '—'} />
            <Radek label="Výdaje" hodnota={pripad.vydaje ? `${fmt(pripad.vydaje)} Kč/měs` : '—'} />
            <Radek label="Rodina" hodnota={[pripad.partner ? 'partner/ka' : null, typeof pripad.pocetDeti === 'number' && pripad.pocetDeti > 0 ? `${pripad.pocetDeti} děti` : null].filter(Boolean).join(', ') || '—'} />
            <Radek label="Hypotéka" hodnota={pripad.hypotekaZustatek ? `${fmt(pripad.hypotekaZustatek)} Kč` : '—'} />
            <Radek label="Povolání" hodnota={pripad.povolani || '—'} />
            <Radek label="Rizikový profil" hodnota={pripad.rizikovyProfil || '—'} />
          </div>
        </div>

        <Sekce cislo={2} titulek="Zjištěné požadavky, cíle a potřeby" value={pozadavky} set={setPozadavky} rows={4} />
        <Sekce cislo={3} titulek="Doporučení" value={doporuceni} set={setDoporuceni} rows={5} />
        <Sekce cislo={4} titulek="Zdůvodnění vhodnosti doporučení" value={zduvodneni} set={setZduvodneni} rows={4} />
        <Sekce cislo={5} titulek="Upozornění a poučení o rizicích" value={upozorneni} set={setUpozorneni} rows={3} />

        {/* Podpisy */}
        <div className="grid grid-cols-2 gap-8 mt-10 pt-6">
          <div className="text-center">
            <div className="border-t border-slate-400 pt-1.5 text-xs text-slate-600">Podpis klienta</div>
          </div>
          <div className="text-center">
            <div className="border-t border-slate-400 pt-1.5 text-xs text-slate-600">
              Podpis poradce{poradce.jmeno ? ` — ${poradce.jmeno}` : ''}
            </div>
          </div>
        </div>

        <p className="hidden print:block mt-6 text-[10px] text-slate-400">
          Vygenerováno aplikací PoradceAI dne {datumDnes}. Tento dokument je záznamem z jednání dle zákona o distribuci
          pojištění a zajištění / o distribuci na finančním trhu.
        </p>
      </div>
    </div>
  );
}

function Radek({ label, hodnota }: { label: string; hodnota: string }) {
  return (
    <div className="flex justify-between gap-3 py-0.5 border-b border-slate-50">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-800 text-right">{hodnota}</span>
    </div>
  );
}
