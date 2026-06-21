'use server';

// Serverové akce pro evidenci KLIENTŮ (per poradce, přes session client → respektuje RLS).
// Klienti dříve žili jen v localStorage; nově jsou na serveru, izolovaní podle auth.uid().
import { createClient } from '@/lib/supabase/server';
import { verifySession } from '@/lib/supabase/dal';
import type { Pripad } from '@/lib/pripadStore';

export interface KlientServerRow {
  id: string;
  profil: Pripad;
  vytvoreno: string;
  aktualizovano: string;
}

/** Načte klienty přihlášeného poradce (RLS filtruje na auth.uid()). */
export async function nactiKlientyAction(): Promise<KlientServerRow[]> {
  await verifySession();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('klienti')
    .select('id, profil, vytvoreno_kdy, aktualizovano_kdy')
    .order('aktualizovano_kdy', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    profil: (r.profil ?? {}) as Pripad,
    vytvoreno: (r.vytvoreno_kdy as string) ?? new Date().toISOString(),
    aktualizovano: (r.aktualizovano_kdy as string) ?? (r.vytvoreno_kdy as string) ?? new Date().toISOString(),
  }));
}

/** Vloží/aktualizuje klienta (id volí klient → synchronní párování plán↔klient). */
export async function ulozKlientaAction(id: string, profil: Pripad): Promise<{ ok: boolean; error?: string }> {
  const user = await verifySession();
  const supabase = await createClient();
  const jmeno = (profil.jmeno ?? '').trim() || null;
  const { error } = await supabase.from('klienti').upsert(
    { id, profil: profil as unknown as Record<string, unknown>, jmeno, poradce_id: user.id, aktualizovano_kdy: new Date().toISOString() },
    { onConflict: 'id' },
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Smaže klienta (RLS zajistí, že jen vlastního). */
export async function smazKlientaServerAction(id: string): Promise<{ ok: boolean; error?: string }> {
  await verifySession();
  const supabase = await createClient();
  const { error } = await supabase.from('klienti').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
