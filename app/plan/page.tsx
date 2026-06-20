'use client';

import { useState } from 'react';
import {
  Wallet, Loader2, AlertTriangle, CheckCircle2, Printer, Copy, BookOpen,
  FileText, ChevronRight, Eye, Calculator, ShieldCheck, Home, TrendingUp, PiggyBank, Target, Plus, Trash2,
} from 'lucide-react';
import { generujFinancniPlanAction } from '@/app/actions';
import type { FinPlanProfil, RizikovyProfil, FinCil, Vypocty } from '@/lib/financniPlan';
import Markdown from '@/components/Markdown';
import PlanPrehled from '@/components/PlanPrehled';

interface SourceChunk {
  id: string;
  obsah: string;
  pojistovna: string;
  nazev_dokumentu: string;
  strana?: number;
  domena?: string;
  podobnost: number;
}

/** Pomocné číslo z inputu (prázdné = 0/undefined). */
function num(v: string): number {
  const n = parseFloat(v.replace(/\s/g, '').replace(',', '.'));
  return isNaN(n) ? 0 : n;
}

/** Krátké číselné/textové pole. Na úrovni modulu (NE uvnitř renderu), aby input
 *  neztrácel fokus po každém znaku. Zákaz během načítání řeší <fieldset disabled>. */
function Pole({ label, value, set, placeholder, suffix }: {
  label: string; value: string; set: (v: string) => void; placeholder?: string; suffix?: string;
}) {
  const id = 'pole-' + label.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-');
  return (
    <div>
      <label htmlFor={id} className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">{label}</label>
      <div className="relative">
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => set(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
        />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">{suffix}</span>}
      </div>
    </div>
  );
}

export default function PlanPage() {
  // — Profil (4 pilíře) —
  const [vek, setVek] = useState('38');
  const [cistyPrijem, setCistyPrijem] = useState('55000');
  const [vydaje, setVydaje] = useState('35000');
  const [rizikovyProfil, setRizikovyProfil] = useState<RizikovyProfil>('vyvazeny');
  const [vekOdchodu, setVekOdchodu] = useState('65');

  const [rezervaNasporeno, setRezervaNasporeno] = useState('80000');
  const [existujiciInvestice, setExistujiciInvestice] = useState('200000');
  const [mesicniVkladInvestice, setMesicniVkladInvestice] = useState('5000');

  const [hypotekaZustatek, setHypotekaZustatek] = useState('2800000');
  const [hypotekaSazba, setHypotekaSazba] = useState('5.9');
  const [hypotekaZbyvaMesicu, setHypotekaZbyvaMesicu] = useState('300');
  const [jineDluhy, setJineDluhy] = useState('0');
  const [mesicniSplatkyDluhu, setMesicniSplatkyDluhu] = useState('0');

  const [partner, setPartner] = useState(true);
  const [pocetDeti, setPocetDeti] = useState('2');

  const [penzeNasporeno, setPenzeNasporeno] = useState('150000');
  const [penzeMesicniVklad, setPenzeMesicniVklad] = useState('1000');
  const [cilovaRentaDuchod, setCilovaRentaDuchod] = useState('');
  const [ocekavanaStatniPenze, setOcekavanaStatniPenze] = useState('18000');

  const [povolani, setPovolani] = useState('');
  const [zdravotniStav, setZdravotniStav] = useState('');
  const [cile, setCile] = useState('Zajistit rodinu při výpadku příjmu a spořit na důchod');

  // Cíle klienta (CO / KDY / KOLIK) — KFP finanční mapa.
  const [cileList, setCileList] = useState<{ id: string; nazev: string; castka: string; roky: string }[]>([
    { id: 'c1', nazev: 'Vzdělání dětí', castka: '500000', roky: '15' },
  ]);
  const pridejCil = () => setCileList((s) => [...s, { id: `c${Date.now()}${s.length}`, nazev: '', castka: '', roky: '' }]);
  const upravCil = (i: number, klic: 'nazev' | 'castka' | 'roky', val: string) =>
    setCileList((s) => s.map((c, idx) => (idx === i ? { ...c, [klic]: val } : c)));
  const smazCil = (i: number) => setCileList((s) => s.filter((_, idx) => idx !== i));

  // — Výstup —
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState('');
  const [podklady, setPodklady] = useState('');
  const [vypocty, setVypocty] = useState<Vypocty | null>(null);
  const [chunks, setChunks] = useState<SourceChunk[]>([]);
  const [activeChunk, setActiveChunk] = useState<SourceChunk | null>(null);
  const [copied, setCopied] = useState(false);
  const [zobrazPodklady, setZobrazPodklady] = useState(false);

  const datumDnes = new Date().toLocaleDateString('cs-CZ');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    setPlan('');
    setPodklady('');
    setVypocty(null);
    setChunks([]);
    setActiveChunk(null);

    const profil: FinPlanProfil = {
      vek: num(vek),
      cistyPrijem: num(cistyPrijem),
      vydaje: num(vydaje),
      rizikovyProfil,
      vekOdchodu: num(vekOdchodu) || 65,
      rezervaNasporeno: num(rezervaNasporeno),
      existujiciInvestice: num(existujiciInvestice),
      mesicniVkladInvestice: num(mesicniVkladInvestice),
      hypotekaZustatek: num(hypotekaZustatek),
      hypotekaSazba: num(hypotekaSazba) > 0 ? num(hypotekaSazba) / 100 : undefined,
      hypotekaZbyvaMesicu: num(hypotekaZbyvaMesicu) || undefined,
      jineDluhy: num(jineDluhy),
      mesicniSplatkyDluhu: num(mesicniSplatkyDluhu),
      partner,
      pocetDeti: num(pocetDeti),
      penzeNasporeno: num(penzeNasporeno),
      penzeMesicniVklad: num(penzeMesicniVklad),
      cilovaRentaDuchod: num(cilovaRentaDuchod) || undefined,
      ocekavanaStatniPenze: num(ocekavanaStatniPenze) || undefined,
      povolani: povolani.trim() || undefined,
      zdravotniStav: zdravotniStav.trim() || undefined,
      cile: cile.trim() || undefined,
      cileSeznam: cileList
        .filter((c) => c.nazev.trim() && num(c.castka) > 0 && num(c.roky) > 0)
        .map((c): FinCil => ({ nazev: c.nazev.trim(), castka: num(c.castka), roky: num(c.roky) })),
    };

    try {
      const res = await generujFinancniPlanAction(profil);
      if (res.success) {
        setPlan(res.plan);
        setPodklady(res.podklady);
        setVypocty((res.vypocty as Vypocty) || null);
        setChunks((res.chunks as SourceChunk[]) || []);
      } else {
        setError(res.error || 'Nepodařilo se vygenerovat finanční plán.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nastala neočekávaná chyba.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!plan) return;
    try {
      await navigator.clipboard.writeText(plan);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Kopírování do schránky se nezdařilo (zkuste ručně označit text).');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="print:hidden">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-3xl font-extrabold tracking-tight text-primary flex items-center gap-2">
            <Wallet className="h-7 w-7 text-accent" /> Finanční plán (4 pilíře)
          </h1>
          <a href="/plany" className="text-sm font-bold text-primary hover:text-primary-600 whitespace-nowrap">Uložené plány →</a>
        </div>
        <p className="mt-2 text-slate-600 text-sm max-w-3xl">
          Komplexní plán napříč <strong>penzí, investicemi, úvěry a pojištěním</strong>. Čísla počítají
          deterministické kalkulačky (anuita, Monte&nbsp;Carlo, DIME, mezera v důchodu…), AI je propojí do
          plánu a tvrzení o produktech doloží zdroji z podmínek.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* FORMULÁŘ */}
        <div className="lg:col-span-5 print:hidden">
          <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
           <fieldset disabled={loading} className="space-y-5 disabled:opacity-60">
            {/* Základ */}
            <div>
              <h3 className="text-sm font-bold text-primary mb-2 flex items-center gap-1.5"><Calculator className="h-4 w-4 text-accent" />Základ</h3>
              <div className="grid grid-cols-2 gap-2">
                <Pole label="Věk" value={vek} set={setVek} />
                <Pole label="Věk odchodu" value={vekOdchodu} set={setVekOdchodu} />
                <Pole label="Čistý příjem" value={cistyPrijem} set={setCistyPrijem} suffix="Kč/měs" />
                <Pole label="Výdaje" value={vydaje} set={setVydaje} suffix="Kč/měs" />
              </div>
              <div className="mt-2">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Rizikový profil</label>
                <select
                  value={rizikovyProfil}
                  onChange={(e) => setRizikovyProfil(e.target.value as RizikovyProfil)}
                  disabled={loading}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none bg-white"
                >
                  <option value="konzervativni">Konzervativní (2,5 % reálně)</option>
                  <option value="vyvazeny">Vyvážený (4,5 % reálně)</option>
                  <option value="dynamicky">Dynamický (6,5 % reálně)</option>
                </select>
              </div>
            </div>

            {/* Rezerva & investice */}
            <div>
              <h3 className="text-sm font-bold text-primary mb-2 flex items-center gap-1.5"><TrendingUp className="h-4 w-4 text-accent" />Rezerva &amp; investice</h3>
              <div className="grid grid-cols-2 gap-2">
                <Pole label="Rezerva naspořeno" value={rezervaNasporeno} set={setRezervaNasporeno} suffix="Kč" />
                <Pole label="Investice nyní" value={existujiciInvestice} set={setExistujiciInvestice} suffix="Kč" />
                <Pole label="Měs. vklad invest." value={mesicniVkladInvestice} set={setMesicniVkladInvestice} suffix="Kč" />
              </div>
            </div>

            {/* Úvěry */}
            <div>
              <h3 className="text-sm font-bold text-primary mb-2 flex items-center gap-1.5"><Home className="h-4 w-4 text-accent" />Úvěry</h3>
              <div className="grid grid-cols-2 gap-2">
                <Pole label="Hypotéka zůstatek" value={hypotekaZustatek} set={setHypotekaZustatek} suffix="Kč" />
                <Pole label="Sazba hypotéky" value={hypotekaSazba} set={setHypotekaSazba} suffix="%" />
                <Pole label="Zbývá hypotéky" value={hypotekaZbyvaMesicu} set={setHypotekaZbyvaMesicu} suffix="měs" />
                <Pole label="Jiné dluhy" value={jineDluhy} set={setJineDluhy} suffix="Kč" />
                <Pole label="Splátky dluhů" value={mesicniSplatkyDluhu} set={setMesicniSplatkyDluhu} suffix="Kč/měs" />
              </div>
            </div>

            {/* Rodina */}
            <div>
              <h3 className="text-sm font-bold text-primary mb-2 flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-accent" />Rodina &amp; pojištění</h3>
              <div className="grid grid-cols-2 gap-2 items-end">
                <Pole label="Počet dětí" value={pocetDeti} set={setPocetDeti} />
                <label className="flex items-center gap-2 text-sm text-slate-700 pb-2">
                  <input type="checkbox" checked={partner} onChange={(e) => setPartner(e.target.checked)} disabled={loading} className="h-4 w-4" />
                  Partner/ka
                </label>
              </div>
            </div>

            {/* Penze */}
            <div>
              <h3 className="text-sm font-bold text-primary mb-2 flex items-center gap-1.5"><PiggyBank className="h-4 w-4 text-accent" />Penze</h3>
              <div className="grid grid-cols-2 gap-2">
                <Pole label="Penze naspořeno" value={penzeNasporeno} set={setPenzeNasporeno} suffix="Kč" />
                <Pole label="Měs. vklad DPS" value={penzeMesicniVklad} set={setPenzeMesicniVklad} suffix="Kč" />
                <Pole label="Cílová renta" value={cilovaRentaDuchod} set={setCilovaRentaDuchod} placeholder="auto 60 %" suffix="Kč/měs" />
                <Pole label="Státní penze (odhad)" value={ocekavanaStatniPenze} set={setOcekavanaStatniPenze} suffix="Kč/měs" />
              </div>
            </div>

            {/* Cíle (CO / KDY / KOLIK) — KFP finanční mapa */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-primary flex items-center gap-1.5"><Target className="h-4 w-4 text-accent" />Cíle klienta</h3>
                <button type="button" onClick={pridejCil} disabled={loading} className="flex items-center gap-1 text-[11px] font-bold text-primary hover:text-primary-600">
                  <Plus className="h-3.5 w-3.5" /> Přidat cíl
                </button>
              </div>
              <div className="space-y-1.5">
                {cileList.map((c, i) => (
                  <div key={c.id} className="flex items-center gap-1.5">
                    <input value={c.nazev} onChange={(e) => upravCil(i, 'nazev', e.target.value)} placeholder="Cíl (bydlení, děti…)" disabled={loading}
                      className="flex-1 min-w-0 rounded-lg border border-slate-200 px-2 py-1.5 text-sm focus:border-primary focus:outline-none" />
                    <input value={c.castka} onChange={(e) => upravCil(i, 'castka', e.target.value)} placeholder="Kč" disabled={loading}
                      className="w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-sm focus:border-primary focus:outline-none" />
                    <input value={c.roky} onChange={(e) => upravCil(i, 'roky', e.target.value)} placeholder="let" disabled={loading}
                      className="w-12 rounded-lg border border-slate-200 px-2 py-1.5 text-sm focus:border-primary focus:outline-none" />
                    <button type="button" onClick={() => smazCil(i)} disabled={loading} className="text-slate-400 hover:text-red-600 p-1" title="Odebrat">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {cileList.length === 0 && <p className="text-[11px] text-slate-400">Bez konkrétních cílů (volitelné).</p>}
              </div>
            </div>

            {/* Ostatní */}
            <div className="space-y-2">
              <Pole label="Povolání / riziková skupina" value={povolani} set={setPovolani} placeholder="Např. IT, automechanik" />
              <Pole label="Zdravotní stav" value={zdravotniStav} set={setZdravotniStav} placeholder="Např. bez komplikací" />
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Poznámka k cílům / situaci</label>
                <textarea
                  value={cile} onChange={(e) => setCile(e.target.value)} rows={2} disabled={loading}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full flex items-center justify-center gap-2 rounded-lg py-3 text-sm font-bold text-white transition-all ${
                loading ? 'bg-slate-300 cursor-not-allowed' : 'bg-primary hover:bg-primary-600 shadow-sm cursor-pointer'
              }`}
            >
              {loading ? (<><Loader2 className="h-4 w-4 animate-spin text-accent" />Sestavuji plán…</>) : (<><Wallet className="h-4 w-4 text-accent" />Vytvořit finanční plán</>)}
            </button>
           </fieldset>
          </form>
        </div>

        {/* VÝSTUP */}
        <div className="lg:col-span-7 space-y-6">
          {loading && (
            <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm flex flex-col items-center justify-center text-center py-20 min-h-[450px]">
              <Loader2 className="h-14 w-14 animate-spin text-primary mb-4" />
              <h3 className="text-lg font-bold text-primary">Sestavuji finanční plán</h3>
              <p className="text-sm text-slate-500 mt-1 max-w-md">Počítám kalkulačky 4 pilířů, hledám podklady v podmínkách a skládám plán se zdroji.</p>
            </div>
          )}

          {error && (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6 flex gap-4 items-start print:hidden">
              <AlertTriangle className="h-6 w-6 text-red-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-red-900">Chyba při generování plánu</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          )}

          {!loading && !error && !plan && (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center py-20 flex flex-col items-center justify-center min-h-[450px]">
              <Wallet className="h-12 w-12 text-slate-300 mb-4" />
              <h3 className="text-lg font-bold text-slate-700">Plán zatím není vygenerován</h3>
              <p className="text-sm text-slate-400 mt-1 max-w-sm">Vyplňte profil klienta vlevo a klikněte na „Vytvořit finanční plán".</p>
            </div>
          )}

          {!loading && plan && (
            <div className="space-y-6">
              <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl p-3 px-4 shadow-sm print:hidden">
                <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-green-600" />Plán vypracován</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setZobrazPodklady((v) => !v)} className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-primary bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-3 py-1.5 cursor-pointer">
                    <Calculator className="h-3.5 w-3.5" />{zobrazPodklady ? 'Skrýt výpočty' : 'Spočítané podklady'}
                  </button>
                  <button onClick={handleCopy} className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-primary bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-3 py-1.5 cursor-pointer">
                    <Copy className="h-3.5 w-3.5" />{copied ? 'Kopírováno!' : 'Kopírovat'}
                  </button>
                  <button onClick={() => window.print()} className="flex items-center gap-1.5 text-xs font-bold text-white bg-primary hover:bg-primary-600 rounded-lg px-3 py-1.5 cursor-pointer shadow-sm">
                    <Printer className="h-3.5 w-3.5 text-accent" />Export PDF
                  </button>
                </div>
              </div>

              {/* Vizuální přehled spočítaných podkladů */}
              {vypocty && (
                <div>
                  <h3 className="text-sm font-bold text-primary mb-2 print:mt-4">Přehled (spočítaná čísla)</h3>
                  <PlanPrehled v={vypocty} />
                </div>
              )}

              {zobrazPodklady && podklady && (
                <div className="rounded-xl border border-primary-100 bg-primary-50/40 p-4 shadow-sm print:hidden">
                  <h3 className="text-xs font-bold text-primary mb-2 flex items-center gap-1.5"><Calculator className="h-4 w-4 text-accent" />Spočítané podklady (vstup pro AI — ověřitelná čísla)</h3>
                  <pre className="text-[11px] text-slate-700 whitespace-pre-wrap font-mono leading-relaxed">{podklady}</pre>
                </div>
              )}

              <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm print:border-none print:shadow-none print:p-0 text-slate-900">
                <div className="hidden print:flex items-center justify-between pb-4 border-b border-slate-300 mb-6">
                  <div>
                    <h1 className="text-xl font-bold">Poradce AI — Finanční plán</h1>
                    <p className="text-xs text-slate-500">4 pilíře: penze · investice · úvěry · pojištění</p>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    <p className="font-semibold text-slate-700">Věk klienta: {vek} let</p>
                    <p>{datumDnes}</p>
                  </div>
                </div>

                <div className="prose prose-sm max-w-none print:prose-xs">
                  <Markdown text={plan} />
                </div>

                {chunks.length > 0 && (
                  <div className="hidden print:block mt-8 pt-4 border-t border-slate-300">
                    <h3 className="text-sm font-bold mb-2">Použité zdroje z podmínek</h3>
                    <ul className="text-[11px] space-y-0.5 text-slate-700 list-none pl-0">
                      {chunks.map((c, i) => (
                        <li key={c.id}>[{i + 1}] {c.pojistovna} — {c.nazev_dokumentu}{c.strana ? `, s. ${c.strana}` : ''}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="hidden print:block mt-8 pt-3 border-t border-slate-300 text-[10px] text-slate-500">
                  <p className="font-semibold">Toto je analytický podklad pro licencovaného poradce, nikoliv finanční doporučení.</p>
                  <p>Vygenerováno aplikací Poradce AI dne {datumDnes}. Čísla pocházejí z deterministických kalkulaček, tvrzení o produktech z nahraných podmínek.</p>
                </div>
              </div>

              {chunks.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm print:hidden">
                  <h3 className="text-sm font-bold text-primary mb-3 flex items-center gap-1.5"><BookOpen className="h-4 w-4 text-accent" />Zdroje z podmínek ({chunks.length})</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                      {chunks.map((chunk) => (
                        <button key={chunk.id} onClick={() => setActiveChunk(chunk)}
                          className={`w-full text-left flex items-start gap-2.5 rounded-lg p-2.5 text-xs border cursor-pointer ${activeChunk?.id === chunk.id ? 'bg-primary-50 border-primary-200 text-primary' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}>
                          <FileText className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold truncate text-slate-800">{chunk.pojistovna}</span>
                              <span className="text-[10px] text-green-600 font-bold shrink-0">{Math.round(chunk.podobnost * 100)} %</span>
                            </div>
                            <p className="text-[10px] text-slate-400 truncate mt-0.5">{chunk.nazev_dokumentu}</p>
                            {chunk.strana && <p className="text-[10px] text-slate-500 font-medium">Strana {chunk.strana}</p>}
                          </div>
                          <ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0 self-center" />
                        </button>
                      ))}
                    </div>
                    <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/50 flex flex-col h-60">
                      {activeChunk ? (
                        <>
                          <div className="text-[10px] font-bold text-primary mb-1 pb-1 border-b border-slate-200 uppercase shrink-0">Původní text ({activeChunk.pojistovna}, s. {activeChunk.strana || '?'})</div>
                          <div className="flex-1 overflow-y-auto text-xs text-slate-700 bg-white p-2.5 rounded border border-slate-200/60 leading-relaxed whitespace-pre-line">{activeChunk.obsah}</div>
                        </>
                      ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-400 p-4">
                          <Eye className="h-6 w-6 mb-1.5 text-slate-300" />
                          <p className="text-[11px]">Vyberte zdroj vlevo pro zobrazení původního znění.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
