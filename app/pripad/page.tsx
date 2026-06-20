'use client';

import { useState, useRef } from 'react';
import {
  FileText,
  UserCheck,
  Briefcase,
  Activity,
  Heart,
  TrendingUp,
  AlertTriangle,
  Loader2,
  Copy,
  Printer,
  CheckCircle2,
  ChevronRight,
  BookOpen,
  Eye,
} from 'lucide-react';
import { generateSolutionAction } from '@/app/actions';

interface SourceChunk {
  id: string;
  obsah: string;
  pojistovna: string;
  nazev_dokumentu: string;
  strana?: number;
  podobnost: number;
}

export default function PripadPage() {
  // Form states
  const [vek, setVek] = useState<number>(35);
  const [povolani, setPovolani] = useState('');
  const [prijem, setPrijem] = useState('');
  const [zavazky, setZavazky] = useState('');
  const [rodina, setRodina] = useState('');
  const [zdravotniStav, setZdravotniStav] = useState('');
  const [cil, setCil] = useState('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const [solution, setSolution] = useState<string>('');
  const [chunks, setChunks] = useState<SourceChunk[]>([]);
  const [activeChunk, setActiveChunk] = useState<SourceChunk | null>(null);
  const [copied, setCopied] = useState(false);

  const printAreaRef = useRef<HTMLDivElement>(null);
  const datumDnes = new Date().toLocaleDateString('cs-CZ');

  const simulateLoadingSteps = () => {
    setLoadingStep(1); // Searching database...
    
    const timer1 = setTimeout(() => {
      setLoadingStep(2); // Analyzing matching terms...
    }, 4000);

    const timer2 = setTimeout(() => {
      setLoadingStep(3); // Drafting comparative proposal...
    }, 8000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError(null);
    setSuccess(false);
    setSolution('');
    setChunks([]);
    setActiveChunk(null);

    const cleanupTimers = simulateLoadingSteps();

    try {
      const res = await generateSolutionAction({
        vek,
        povolani: povolani.trim() || 'Neuvedeno',
        prijem: prijem.trim() || 'Neuvedeno',
        zavazky: zavazky.trim() || 'Neuvedeno',
        rodina: rodina.trim() || 'Neuvedeno',
        zdravotniStav: zdravotniStav.trim() || 'Bez komplikací',
        cil: cil.trim() || 'Komplexní zabezpečení příjmu a rodiny',
      });

      if (res.success) {
        setSolution(res.solution);
        setChunks(res.chunks || []);
        setSuccess(true);
      } else {
        setError(res.error || 'Nepodařilo se vygenerovat návrh řešení.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nastala neočekávaná chyba.');
    } finally {
      cleanupTimers();
      setLoading(false);
      setLoadingStep(0);
    }
  };

  const handleCopy = async () => {
    if (!solution) return;
    try {
      await navigator.clipboard.writeText(solution);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Kopírování do schránky se nezdařilo (zkuste ručně označit text).');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Basic Markdown Parser helper
  const renderMarkdown = (text: string) => {
    if (!text) return null;
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      const trimmed = line.trim();
      
      // Horizontal Rule
      if (trimmed === '---') {
        return <hr key={idx} className="my-4 border-slate-200" />;
      }

      // Headers
      if (trimmed.startsWith('### ')) {
        return <h4 key={idx} className="text-base font-bold text-primary mt-4 mb-2">{trimmed.replace('### ', '')}</h4>;
      }
      if (trimmed.startsWith('## ')) {
        return <h3 key={idx} className="text-lg font-bold text-primary mt-6 mb-3 pb-1 border-b border-slate-100">{trimmed.replace('## ', '')}</h3>;
      }
      if (trimmed.startsWith('# ')) {
        return <h2 key={idx} className="text-xl font-bold text-primary mt-8 mb-4">{trimmed.replace('# ', '')}</h2>;
      }

      // Bullets
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const cleaned = trimmed.substring(2);
        return (
          <ul key={idx} className="list-disc pl-6 my-1.5 text-sm leading-relaxed text-slate-800">
            <li>{parseInlineStyles(cleaned)}</li>
          </ul>
        );
      }

      // Numbered List
      const numberRegex = /^\d+\.\s/;
      if (numberRegex.test(trimmed)) {
        const cleaned = trimmed.replace(numberRegex, '');
        const num = trimmed.match(/^\d+/) || '1';
        return (
          <ol key={idx} className="list-decimal pl-6 my-1.5 text-sm leading-relaxed text-slate-800" start={parseInt(num[0])}>
            <li>{parseInlineStyles(cleaned)}</li>
          </ol>
        );
      }

      // Blockquote / Disclaimer block
      if (trimmed.startsWith('> ')) {
        const cleaned = trimmed.substring(2);
        return (
          <blockquote key={idx} className="border-l-4 border-accent bg-amber-50 p-3 rounded-r-lg text-xs italic text-amber-900 my-3 font-semibold">
            {parseInlineStyles(cleaned)}
          </blockquote>
        );
      }

      // Empty line
      if (trimmed === '') {
        return <div key={idx} className="h-2.5" />;
      }

      return (
        <p key={idx} className="text-sm leading-relaxed text-slate-800 my-2">
          {parseInlineStyles(line)}
        </p>
      );
    });
  };

  const parseInlineStyles = (text: string) => {
    const parts = [];
    let currentIndex = 0;
    const boldRegex = /\*\*([^*]+)\*\*/g;
    let match;
    
    while ((match = boldRegex.exec(text)) !== null) {
      const matchIndex = match.index;
      if (matchIndex > currentIndex) {
        parts.push(text.substring(currentIndex, matchIndex));
      }
      parts.push(
        <strong key={matchIndex} className="font-bold text-primary">
          {match[1]}
        </strong>
      );
      currentIndex = boldRegex.lastIndex;
    }
    
    if (currentIndex < text.length) {
      parts.push(text.substring(currentIndex));
    }
    
    return parts.length > 0 ? parts : text;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Title */}
      <div className="print:hidden">
        <h1 className="text-3xl font-extrabold tracking-tight text-primary">Řeším případ (Srovnávač & Analýza)</h1>
        <p className="mt-2 text-slate-600 text-sm">
          Zadejte profil klienta a jeho cíle. Systém prohledá všechny nahrané pojistné podmínky a na základě zjištěných faktů (čekací doby, výluky, definice) sestaví strukturovaný podklad a doporučení pojišťoven.
        </p>
      </div>

      {/* Main Form/Result Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Side: Client Profile Form (hidden on print unless specifically styled) */}
        <div className="lg:col-span-4 print:hidden">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sticky top-20">
            <h2 className="text-lg font-bold text-primary mb-4 flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-accent" />
              Profil klienta
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1">
                  <label htmlFor="vek" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Věk
                  </label>
                  <input
                    type="number"
                    id="vek"
                    value={vek}
                    onChange={(e) => setVek(parseInt(e.target.value) || 0)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                    required
                    min={0}
                    max={100}
                    disabled={loading}
                  />
                </div>
                <div className="col-span-2">
                  <label htmlFor="prijem" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Měsíční příjem (Kč)
                  </label>
                  <input
                    type="text"
                    id="prijem"
                    value={prijem}
                    onChange={(e) => setPrijem(e.target.value)}
                    placeholder="Např. 45 000 čistého"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                    disabled={loading}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="povolani" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Povolání / Riziková skupina
                </label>
                <input
                  type="text"
                  id="povolani"
                  value={povolani}
                  onChange={(e) => setPovolani(e.target.value)}
                  placeholder="Např. IT programátor / 1. RS nebo automechanik"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  required
                  disabled={loading}
                />
              </div>

              <div>
                <label htmlFor="zavazky" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Závazky (Hypotéka, úvěry)
                </label>
                <input
                  type="text"
                  id="zavazky"
                  value={zavazky}
                  onChange={(e) => setZavazky(e.target.value)}
                  placeholder="Např. hypotéka 4,5 mil. Kč, splátka 22 tis."
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  disabled={loading}
                />
              </div>

              <div>
                <label htmlFor="rodina" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Rodinná situace
                </label>
                <input
                  type="text"
                  id="rodina"
                  value={rodina}
                  onChange={(e) => setRodina(e.target.value)}
                  placeholder="Např. Ženatý, 2 děti (5 a 8 let)"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  disabled={loading}
                />
              </div>

              <div>
                <label htmlFor="zdravotniStav" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Zdravotní stav
                </label>
                <input
                  type="text"
                  id="zdravotniStav"
                  value={zdravotniStav}
                  onChange={(e) => setZdravotniStav(e.target.value)}
                  placeholder="Např. alergie, v minulosti operace kolene"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  disabled={loading}
                />
              </div>

              <div>
                <label htmlFor="cil" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Cíl / Co chce klient vyřešit *
                </label>
                <textarea
                  id="cil"
                  value={cil}
                  onChange={(e) => setCil(e.target.value)}
                  placeholder="Např. zajištění příjmu v případě invalidity nebo dlouhodobé pracovní neschopnosti. Pokrytí hypotéky."
                  rows={3}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none placeholder-slate-400"
                  required
                  disabled={loading}
                />
              </div>

              <button
                type="submit"
                disabled={loading || !cil.trim() || !povolani.trim()}
                className={`w-full flex items-center justify-center gap-2 rounded-lg py-3 text-sm font-bold text-white transition-all duration-200 ${
                  loading || !cil.trim() || !povolani.trim()
                    ? 'bg-slate-300 cursor-not-allowed'
                    : 'bg-primary hover:bg-primary-600 shadow-sm cursor-pointer'
                }`}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-accent" />
                    Generuji návrh...
                  </>
                ) : (
                  <>
                    <TrendingUp className="h-4 w-4 text-accent" />
                    Vypracovat podklad
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Right Side: Proposal Results & Sources */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Active loading state */}
          {loading && (
            <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm flex flex-col items-center justify-center text-center space-y-6 py-20 min-h-[450px]">
              <div className="relative flex items-center justify-center">
                <Loader2 className="h-16 w-16 animate-spin text-primary" />
                <div className="absolute h-10 w-10 bg-primary-50 rounded-full flex items-center justify-center">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
              </div>
              
              <div className="space-y-2 max-w-md">
                <h3 className="text-lg font-bold text-primary">Sestavuji analýzu pojistných podmínek</h3>
                <p className="text-sm text-slate-500">
                  Systém prohledává databázi, vytahuje relevantní ustanovení o výlukách a lhůtách a Gemini tvoří srovnávací přehled.
                </p>
              </div>

              {/* Progress Steps */}
              <div className="w-full max-w-xs space-y-2 text-left bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div className="flex items-center gap-2 text-xs">
                  <span className={`h-2.5 w-2.5 rounded-full flex items-center justify-center shrink-0 ${loadingStep >= 1 ? 'bg-primary' : 'bg-slate-200'}`} />
                  <span className={`${loadingStep >= 1 ? 'font-bold text-primary' : 'text-slate-500'}`}>1. Sémantické vyhledávání v PDF</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className={`h-2.5 w-2.5 rounded-full flex items-center justify-center shrink-0 ${loadingStep >= 2 ? 'bg-primary' : 'bg-slate-200'}`} />
                  <span className={`${loadingStep >= 2 ? 'font-bold text-primary' : 'text-slate-500'}`}>2. Analýza definic a čekacích dob</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className={`h-2.5 w-2.5 rounded-full flex items-center justify-center shrink-0 ${loadingStep >= 3 ? 'bg-primary' : 'bg-slate-200'}`} />
                  <span className={`${loadingStep >= 3 ? 'font-bold text-primary' : 'text-slate-500'}`}>3. Generování analytického podkladu</span>
                </div>
              </div>
            </div>
          )}

          {/* Error notice */}
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-6 flex gap-4 items-start print:hidden">
              <AlertTriangle className="h-6 w-6 text-red-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-red-900">Při generování návrhu nastala chyba</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Empty state (when not loading, no error, and no solution yet) */}
          {!loading && !error && !solution && (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center py-20 flex flex-col items-center justify-center min-h-[450px]">
              <FileText className="h-12 w-12 text-slate-300 mb-4" />
              <h3 className="text-lg font-bold text-slate-700">Analýza není vygenerována</h3>
              <p className="text-sm text-slate-400 mt-1 max-w-sm">
                Vyplňte profil klienta a jeho cíle v levém formuláři. Systém porovná parametry a připraví přehledné srovnání.
              </p>
            </div>
          )}

          {/* Output content area */}
          {!loading && solution && (
            <div className="space-y-6">
              
              {/* Toolbar (hidden on print) */}
              <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl p-3 px-4 shadow-sm print:hidden">
                <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  Podklad úspěšně vypracován
                </span>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-primary bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-3 py-1.5 transition-colors cursor-pointer"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    {copied ? 'Kopírováno!' : 'Kopírovat'}
                  </button>
                  <button
                    onClick={handlePrint}
                    title="Otevře dialog tisku — vyberte „Uložit jako PDF“"
                    className="flex items-center gap-1.5 text-xs font-bold text-white bg-primary hover:bg-primary-600 border border-transparent rounded-lg px-3 py-1.5 transition-colors cursor-pointer shadow-sm"
                  >
                    <Printer className="h-3.5 w-3.5 text-accent" />
                    Exportovat do PDF
                  </button>
                </div>
              </div>

              {/* Proposal Document Card */}
              <div
                ref={printAreaRef}
                className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm print:border-none print:shadow-none print:p-0 text-slate-900"
              >
                {/* Print only Header */}
                <div className="hidden print:flex items-center justify-between pb-4 border-b border-slate-300 mb-6">
                  <div>
                    <h1 className="text-xl font-bold">Poradce AI — Analytický podklad</h1>
                    <p className="text-xs text-slate-500">Vygenerováno na základě pojistných podmínek</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold">Věk klienta: {vek} let</p>
                    <p className="text-xs text-slate-500">Povolání: {povolani}</p>
                  </div>
                </div>

                {/* Markdown contents */}
                <div className="prose prose-sm max-w-none print:prose-xs">
                  {renderMarkdown(solution)}
                </div>

                {/* Zdroje – součást tištěného PDF (na obrazovce je interaktivní panel níže) */}
                {chunks && chunks.length > 0 && (
                  <div className="hidden print:block mt-8 pt-4 border-t border-slate-300">
                    <h3 className="text-sm font-bold mb-2">Použité zdroje z pojistných podmínek</h3>
                    <ul className="text-[11px] space-y-0.5 text-slate-700 list-none pl-0">
                      {chunks.map((c, i) => (
                        <li key={c.id}>
                          [{i + 1}] {c.pojistovna} — {c.nazev_dokumentu}
                          {c.strana ? `, s. ${c.strana}` : ''}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Patička pro PDF */}
                <div className="hidden print:block mt-8 pt-3 border-t border-slate-300 text-[10px] text-slate-500">
                  <p className="font-semibold">
                    Toto je analytický podklad pro licencovaného poradce, nikoliv finanční doporučení.
                  </p>
                  <p>Vygenerováno aplikací Poradce AI dne {datumDnes} na základě nahraných pojistných podmínek.</p>
                </div>
              </div>

              {/* Sources inspector (hidden on print) */}
              {chunks && chunks.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm print:hidden">
                  <h3 className="text-sm font-bold text-primary mb-3 flex items-center gap-1.5">
                    <BookOpen className="h-4 w-4 text-accent" />
                    Analyzované podklady ({chunks.length} pasáží)
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Sources buttons column */}
                    <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                      {chunks.map((chunk) => (
                        <button
                          key={chunk.id}
                          onClick={() => setActiveChunk(chunk)}
                          className={`w-full text-left flex items-start gap-2.5 rounded-lg p-2.5 text-xs transition-all duration-200 border cursor-pointer ${
                            activeChunk?.id === chunk.id
                              ? 'bg-primary-50 border-primary-200 text-primary'
                              : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <FileText className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold truncate text-slate-800">{chunk.pojistovna}</span>
                              <span className="text-[10px] text-green-600 font-bold shrink-0">{Math.round(chunk.podobnost * 100)}% shoda</span>
                            </div>
                            <p className="text-[10px] text-slate-400 truncate mt-0.5">{chunk.nazev_dokumentu}</p>
                            {chunk.strana && <p className="text-[10px] text-slate-500 font-medium">Strana {chunk.strana}</p>}
                          </div>
                          <ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0 self-center" />
                        </button>
                      ))}
                    </div>

                    {/* Source contents preview column */}
                    <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/50 flex flex-col h-60">
                      {activeChunk ? (
                        <>
                          <div className="text-[10px] font-bold text-primary mb-1 pb-1 border-b border-slate-200 uppercase shrink-0">
                            Původní text ({activeChunk.pojistovna}, s. {activeChunk.strana || '?'})
                          </div>
                          <div className="flex-1 overflow-y-auto text-xs text-slate-700 bg-white p-2.5 rounded border border-slate-200/60 leading-relaxed font-mono whitespace-pre-line">
                            {activeChunk.obsah}
                          </div>
                        </>
                      ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-400 p-4">
                          <Eye className="h-6 w-6 mb-1.5 text-slate-300" />
                          <p className="text-[11px]">Vyberte pasáž vlevo pro zobrazení zdrojového znění pojistných podmínek.</p>
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
