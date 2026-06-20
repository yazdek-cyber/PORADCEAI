'use client';

import { useState } from 'react';
import {
  Wallet, ShieldCheck, Home, Target, TrendingUp, PiggyBank, ListChecks, FileText, ChevronDown,
} from 'lucide-react';
import Markdown from '@/components/Markdown';

// Plán jako interaktivní eDO-dokument: AI Markdown rozdělíme na sekce („formičky") podle
// nadpisů `## …`, každou s ikonou pilíře a rozklikávací (v tisku vždy rozbalené). Poučky a
// akční kroky vizuálně řeší <Markdown>. Vstupní text je STEJNÝ markdown jako dřív (žádná
// změna orchestrace) — jen bohatší render.

type IkonaTyp = typeof Wallet;

function ikonaSekce(titulek: string): IkonaTyp {
  const t = titulek.toLowerCase();
  if (/(rezerv|likvid)/.test(t)) return Wallet;
  if (/(pojiš|ochran|krytí|rizik)/.test(t)) return ShieldCheck;
  if (/(úvěr|hypoté|bydlen)/.test(t)) return Home;
  if (/(cíl)/.test(t)) return Target;
  if (/(investic|portfolio|alokac)/.test(t)) return TrendingUp;
  if (/(penz|renta|důchod)/.test(t)) return PiggyBank;
  if (/(priorit|akční|krok|závěr|shrnutí)/.test(t)) return ListChecks;
  return FileText;
}

interface Sekce { titul: string | null; telo: string[] }

function rozdelDleUrovne(text: string, re: RegExp): Sekce[] {
  const sekce: Sekce[] = [{ titul: null, telo: [] }];
  for (const line of text.split('\n')) {
    const m = line.trim().match(re);
    if (m) sekce.push({ titul: line.trim().replace(re, ''), telo: [] });
    else sekce[sekce.length - 1].telo.push(line);
  }
  return sekce;
}

function rozdelNaSekce(text: string): Sekce[] {
  // Primárně dělíme na H2 (## …). Fallback na H3, kdyby model dal sekce o úroveň níž.
  const naH2 = rozdelDleUrovne(text, /^##\s+/);
  if (naH2.filter((s) => s.titul).length >= 2) return naH2;
  const naH3 = rozdelDleUrovne(text, /^###\s+/);
  if (naH3.filter((s) => s.titul).length >= 2) return naH3;
  return naH2;
}

function SekceBlok({ titul, telo }: { titul: string; telo: string }) {
  const [otevreno, setOtevreno] = useState(true);
  const Ikona = ikonaSekce(titul);
  return (
    <div className="rounded-xl border border-slate-200/70 overflow-hidden">
      <button
        type="button"
        onClick={() => setOtevreno((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-4 py-2.5 bg-slate-50/70 hover:bg-slate-100/70 transition-colors print:bg-white print:px-0"
      >
        <span className="flex items-center gap-2 font-bold text-primary text-sm">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-primary shadow-soft print:hidden">
            <Ikona className="h-4 w-4 text-accent" />
          </span>
          {titul}
        </span>
        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform print:hidden ${otevreno ? 'rotate-180' : ''}`} />
      </button>
      <div className={`${otevreno ? 'block' : 'hidden print:block'}`}>
        <div className="px-4 py-3 print:px-0">
          <Markdown text={telo} />
        </div>
      </div>
    </div>
  );
}

export default function PlanDokument({ text }: { text: string }) {
  if (!text) return null;
  const sekce = rozdelNaSekce(text);
  const intro = sekce[0].telo.join('\n').trim();
  const telene = sekce.slice(1).filter((s) => s.titul);

  return (
    <div className="space-y-3">
      {intro && (
        <div className="text-slate-900">
          <Markdown text={intro} />
        </div>
      )}
      {telene.map((s, i) => (
        <SekceBlok key={i} titul={s.titul as string} telo={s.telo.join('\n')} />
      ))}
    </div>
  );
}
