'use client';

import React from 'react';
import { Lightbulb } from 'lucide-react';

/** Inline styling: **tučně**. */
function parseInlineStyles(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let currentIndex = 0;
  const boldRegex = /\*\*([^*]+)\*\*/g;
  let match: RegExpExecArray | null;
  while ((match = boldRegex.exec(text)) !== null) {
    if (match.index > currentIndex) parts.push(text.substring(currentIndex, match.index));
    parts.push(
      <strong key={match.index} className="font-bold text-primary">
        {match[1]}
      </strong>
    );
    currentIndex = boldRegex.lastIndex;
  }
  if (currentIndex < text.length) parts.push(text.substring(currentIndex));
  return parts.length > 0 ? parts : text;
}

// Poučka (vysvětlení pro klienta z odborné metodiky) — vizuální callout.
// Zvládne „Poučka:", „**Poučka:**", „**Poučka**:" i odrážku před tím; ořeže zbytkové **.
const POUCKA_RE = /^(?:[-*]\s*)?\*{0,2}\s*Pou[čc]ka\s*\*{0,2}\s*[:–-]\s*\*{0,2}\s*(.*?)\s*\*{0,2}$/i;
// Štítkované odrážky v akčních krocích.
const LABEL_RE = /^[-*]\s*\*\*(Akční krok|Odůvodnění|Doporučení|Pozor|Tip)\*\*\s*:?\s*(.*)$/i;
const LABEL_TONE: Record<string, string> = {
  'Akční krok': 'bg-primary text-white',
  'Doporučení': 'bg-primary text-white',
  'Odůvodnění': 'bg-slate-100 text-slate-600',
  'Tip': 'bg-positive-50 text-positive',
  'Pozor': 'bg-amber-100 text-amber-800',
};

/**
 * Markdown renderer pro finanční plán / podklady. Kromě nadpisů, odrážek a tučně umí
 * vizuální „poučky" (callout) a štítkované akční kroky — aby plán působil jako v eDO.
 * Sdílený mezi „Finanční plán", „Uložené plány" a „Rychlý návrh".
 */
export default function Markdown({ text }: { text: string }) {
  if (!text) return null;
  const lines = text.split('\n');
  return (
    <>
      {lines.map((line, idx) => {
        const trimmed = line.trim();

        // Poučka — callout box se žárovkou.
        const poucka = trimmed.match(POUCKA_RE);
        if (poucka) {
          return (
            <div key={idx} className="my-3 flex gap-2.5 rounded-xl border border-accent-100 bg-accent-50/70 p-3">
              <Lightbulb className="h-4 w-4 text-accent shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed text-slate-700">
                <span className="font-bold text-accent-800">Poučka: </span>
                {parseInlineStyles(poucka[1])}
              </div>
            </div>
          );
        }

        // Štítkovaná odrážka (Akční krok / Odůvodnění …).
        const label = trimmed.match(LABEL_RE);
        if (label) {
          const tone = LABEL_TONE[label[1]] ?? 'bg-slate-100 text-slate-600';
          return (
            <div key={idx} className="flex items-start gap-2 my-1.5 text-sm leading-relaxed text-slate-800">
              <span className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${tone}`}>{label[1]}</span>
              <span>{parseInlineStyles(label[2])}</span>
            </div>
          );
        }

        if (trimmed === '---') return <hr key={idx} className="my-4 border-slate-200" />;
        if (trimmed.startsWith('### '))
          return <h4 key={idx} className="text-base font-bold text-primary mt-4 mb-2">{trimmed.replace('### ', '')}</h4>;
        if (trimmed.startsWith('## '))
          return <h3 key={idx} className="text-lg font-bold text-primary mt-6 mb-3 pb-1 border-b border-slate-100">{trimmed.replace('## ', '')}</h3>;
        if (trimmed.startsWith('# '))
          return <h2 key={idx} className="text-xl font-bold text-primary mt-8 mb-4">{trimmed.replace('# ', '')}</h2>;
        if (trimmed.startsWith('- ') || trimmed.startsWith('* '))
          return (
            <ul key={idx} className="list-disc pl-6 my-1.5 text-sm leading-relaxed text-slate-800">
              <li>{parseInlineStyles(trimmed.substring(2))}</li>
            </ul>
          );
        const numberRegex = /^\d+\.\s/;
        if (numberRegex.test(trimmed)) {
          const num = trimmed.match(/^\d+/) || ['1'];
          return (
            <ol key={idx} className="list-decimal pl-6 my-1.5 text-sm leading-relaxed text-slate-800" start={parseInt(num[0])}>
              <li>{parseInlineStyles(trimmed.replace(numberRegex, ''))}</li>
            </ol>
          );
        }
        if (trimmed.startsWith('> '))
          return (
            <blockquote key={idx} className="border-l-4 border-accent bg-amber-50 p-3 rounded-r-lg text-xs italic text-amber-900 my-3 font-semibold">
              {parseInlineStyles(trimmed.substring(2))}
            </blockquote>
          );
        if (trimmed === '') return <div key={idx} className="h-2.5" />;
        return (
          <p key={idx} className="text-sm leading-relaxed text-slate-800 my-2">
            {parseInlineStyles(line)}
          </p>
        );
      })}
    </>
  );
}
