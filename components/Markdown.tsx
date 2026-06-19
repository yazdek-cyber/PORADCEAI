'use client';

import React from 'react';

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

/**
 * Jednoduchý Markdown renderer (nadpisy, odrážky, číslované, oddělovač, tučně).
 * Sdílený mezi „Řeším případ" a „Finanční plán", aby se logika neduplikovala.
 */
export default function Markdown({ text }: { text: string }) {
  if (!text) return null;
  const lines = text.split('\n');
  return (
    <>
      {lines.map((line, idx) => {
        const trimmed = line.trim();
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
