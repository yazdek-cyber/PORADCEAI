'use client';

// Sdílené vizuální prvky (bez závislosti na knihovně grafů) — donut alokace a mini graf.

const pct = (x: number) => (x * 100).toFixed(1).replace('.0', '') + ' %';

/** Donut (koláč) alokace akcie/dluhopisy/hotovost (hodnoty 0–1). */
export function Donut({ akcie, dluhopisy, hotovost, velikost = 64 }: { akcie: number; dluhopisy: number; hotovost: number; velikost?: number }) {
  const r = 26;
  const C = 2 * Math.PI * r;
  const segs = [
    { v: akcie, c: 'var(--color-primary)' },
    { v: dluhopisy, c: 'var(--color-accent)' },
    { v: hotovost, c: '#cbd5e1' },
  ];
  let off = 0;
  return (
    <svg viewBox="0 0 64 64" style={{ width: velikost, height: velikost }} className="shrink-0 -rotate-90" aria-hidden="true">
      <circle cx="32" cy="32" r={r} fill="none" stroke="#f1f5f9" strokeWidth="10" />
      {segs.map((s, i) => {
        const len = Math.max(0, s.v) * C;
        const el = (
          <circle key={i} cx="32" cy="32" r={r} fill="none" stroke={s.c} strokeWidth="10"
            strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-off} />
        );
        off += len;
        return el;
      })}
    </svg>
  );
}

/** Donut + textová legenda vedle sebe. */
export function AlokaceVizual({ akcie, dluhopisy, hotovost }: { akcie: number; dluhopisy: number; hotovost: number }) {
  return (
    <div className="mt-2 flex items-center gap-3">
      <Donut akcie={akcie} dluhopisy={dluhopisy} hotovost={hotovost} />
      <div className="flex-1 min-w-0 space-y-0.5 text-[11px] text-slate-600">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-primary" />Akcie {pct(akcie)}</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-accent" />Dluhopisy {pct(dluhopisy)}</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-slate-300" />Hotovost {pct(hotovost)}</span>
      </div>
    </div>
  );
}

/** Mini SVG graf (area + line), hodnoty se normalizují na maximum. */
export function MiniGraf({ hodnoty }: { hodnoty: number[] }) {
  if (!hodnoty || hodnoty.length < 2) return null;
  const max = Math.max(...hodnoty, 1);
  const w = 300, h = 64;
  const pts = hodnoty.map((v, i) => `${(i / (hodnoty.length - 1)) * w},${h - (v / max) * h}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-16 mt-1" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={`0,${h} ${pts} ${w},${h}`} fill="var(--color-primary-100)" stroke="none" />
      <polyline points={pts} fill="none" stroke="var(--color-primary)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
