'use client';
// Sdílené UI primitivy (design systém v0.18). Cíl: jeden vizuální jazyk napříč všemi
// stránkami — místo duplikovaných Karta/Pole/hlaviček na každé stránce. Vše čistě
// prezentační, bez stavu (kromě drobností), aby se daly bezpečně sdílet i v 'use client'.
import { useId, type ReactNode } from 'react';

// ── Hlavička stránky ────────────────────────────────────────────────────────
export function PageHeader({
  ikona, titulek, popis, akce,
}: { ikona?: ReactNode; titulek: string; popis?: string; akce?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
      <div className="flex items-start gap-3">
        {ikona && (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-white shadow-soft">
            {ikona}
          </div>
        )}
        <div>
          <h1 className="text-xl font-bold tracking-tight text-primary">{titulek}</h1>
          {popis && <p className="text-sm text-slate-500 mt-0.5 max-w-2xl">{popis}</p>}
        </div>
      </div>
      {akce && <div className="flex items-center gap-2 print:hidden">{akce}</div>}
    </div>
  );
}

// ── Karta (plocha) ──────────────────────────────────────────────────────────
export function Card({
  children, className = '', padding = 'p-5',
}: { children: ReactNode; className?: string; padding?: string }) {
  return (
    <div className={`rounded-2xl border border-slate-200/70 bg-white ${padding} shadow-soft ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({
  ikona, titulek, popis, akce,
}: { ikona?: ReactNode; titulek: string; popis?: string; akce?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 mb-3">
      <div>
        <h3 className="text-base font-bold text-primary flex items-center gap-2">
          {ikona}{titulek}
        </h3>
        {popis && <p className="text-xs text-slate-500 mt-0.5">{popis}</p>}
      </div>
      {akce && <div className="shrink-0">{akce}</div>}
    </div>
  );
}

// ── Karta s hlavičkou (ikona + titulek + popis) ─────────────────────────────
// Sjednocuje dříve duplikované „Karta" z kalkulaček, KlientskaAnalyza a PlanPrehled.
// `break-inside-avoid` drží kartu pohromadě při tisku.
export function Karta({
  ikona, titulek, popis, children, className = '',
}: { ikona?: ReactNode; titulek: string; popis?: string; children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-slate-200/70 bg-white p-5 shadow-soft break-inside-avoid ${className}`}>
      <h4 className="text-base font-bold text-primary flex items-center gap-2">{ikona}{titulek}</h4>
      {popis && <p className="text-xs text-slate-500 mt-0.5 mb-2">{popis}</p>}
      {children}
    </div>
  );
}

// ── Pole (vstup s popiskem) ─────────────────────────────────────────────────
// DŮLEŽITÉ: definováno na úrovni modulu, aby input neztrácel fokus po každém znaku
// (kdyby byl uvnitř renderu rodiče, React by ho remountoval).
export function Field({
  label, value, set, placeholder, suffix, type = 'text', inputMode = 'decimal',
}: {
  label: string; value: string; set: (v: string) => void;
  placeholder?: string; suffix?: string; type?: string;
  inputMode?: 'text' | 'decimal' | 'numeric';
}) {
  const id = useId(); // unikátní id na instanci → správné label↔input spojení i při shodných popiscích
  return (
    <div>
      <label htmlFor={id} className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={type}
          inputMode={inputMode}
          value={value}
          onChange={(e) => set(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm transition-colors focus:border-primary focus:ring-2 focus:ring-primary-100 focus:outline-none placeholder-slate-400"
        />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">{suffix}</span>}
      </div>
    </div>
  );
}

// ── Velké číslo / KPI ───────────────────────────────────────────────────────
export function Stat({
  label, hodnota, tone = 'primary',
}: { label: string; hodnota: string; tone?: 'primary' | 'positive' | 'accent' | 'slate' }) {
  const tones: Record<string, { box: string; txt: string }> = {
    primary: { box: 'bg-primary-50/70', txt: 'text-primary' },
    positive: { box: 'bg-positive-50', txt: 'text-positive' },
    accent: { box: 'bg-accent-50', txt: 'text-accent-700' },
    slate: { box: 'bg-slate-50', txt: 'text-slate-700' },
  };
  const t = tones[tone] ?? tones.primary;
  return (
    <div className={`rounded-xl ${t.box} px-4 py-3`}>
      <div className={`text-2xl font-extrabold ${t.txt}`}>{hodnota}</div>
      <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{label}</div>
    </div>
  );
}

// ── Řádek hodnoty ───────────────────────────────────────────────────────────
export function Radek({ label, hodnota }: { label: string; hodnota: string }) {
  return (
    <div className="flex justify-between gap-3 text-sm py-1 border-b border-slate-100 last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-800 text-right">{hodnota}</span>
    </div>
  );
}

// ── Odznak ──────────────────────────────────────────────────────────────────
const BADGE_TONES: Record<string, string> = {
  primary: 'bg-primary-50 text-primary border-primary-100',
  accent: 'bg-accent-50 text-accent-700 border-accent-100',
  positive: 'bg-positive-50 text-positive border-positive/20',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  slate: 'bg-slate-100 text-slate-600 border-slate-200',
};
export function Badge({
  children, tone = 'slate', className = '',
}: { children: ReactNode; tone?: keyof typeof BADGE_TONES; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${BADGE_TONES[tone]} ${className}`}>
      {children}
    </span>
  );
}

// ── Tlačítko ────────────────────────────────────────────────────────────────
const BTN_VARIANTS: Record<string, string> = {
  primary: 'bg-primary text-white hover:bg-primary-600 shadow-soft disabled:bg-slate-300 disabled:shadow-none',
  accent: 'bg-accent text-white hover:bg-accent-700 shadow-soft disabled:bg-slate-300 disabled:shadow-none',
  ghost: 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:text-primary',
  subtle: 'bg-primary-50 text-primary hover:bg-primary-100',
};
export function Button({
  children, variant = 'primary', className = '', ...props
}: { children: ReactNode; variant?: keyof typeof BTN_VARIANTS } &
  React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-200 disabled:cursor-not-allowed ${BTN_VARIANTS[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

// ── Sekční popisek (drobné nadpisy uvnitř panelů) ───────────────────────────
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-[10px] font-bold text-slate-400 tracking-wider uppercase mb-2">{children}</div>
  );
}
