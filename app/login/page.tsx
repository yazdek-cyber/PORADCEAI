'use client';

import { useActionState } from 'react';
import { Wallet, Loader2, LogIn } from 'lucide-react';
import { prihlasAction, type LoginStav } from './actions';
import { VERZE } from '@/lib/verze';

const VYCHOZI: LoginStav = {};

export default function LoginPage() {
  const [stav, action, pending] = useActionState(prihlasAction, VYCHOZI);

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-white shadow-soft">
            <Wallet className="h-6 w-6 text-accent" />
          </div>
          <span className="text-2xl font-extrabold tracking-tight text-primary">PoradceAI</span>
        </div>

        <form action={action} className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-soft space-y-4">
          <div>
            <h1 className="text-lg font-bold text-primary">Přihlášení poradce</h1>
            <p className="text-sm text-slate-500 mt-0.5">Přihlaste se ke svému účtu.</p>
          </div>

          <label className="block">
            <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">E-mail</span>
            <input
              name="email" type="email" autoComplete="email" required
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary-100 focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Heslo</span>
            <input
              name="heslo" type="password" autoComplete="current-password" required
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary-100 focus:outline-none"
            />
          </label>

          {stav.error && <p className="text-xs text-red-600">{stav.error}</p>}

          <button
            type="submit" disabled={pending}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-600 disabled:bg-slate-300"
          >
            {pending ? <><Loader2 className="h-4 w-4 animate-spin text-accent" /> Přihlašuji…</> : <><LogIn className="h-4 w-4 text-accent" /> Přihlásit se</>}
          </button>
        </form>

        <p className="text-[11px] text-slate-400 text-center mt-4">
          Účet zakládá administrátor. Data klientů jsou chráněna a izolována per poradce.
        </p>
        <p className="text-[10px] text-slate-300 text-center mt-2">PoradceAI v{VERZE}</p>
      </div>
    </div>
  );
}
