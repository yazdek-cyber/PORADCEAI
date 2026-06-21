'use server';

// Server Actions pro přihlášení/odhlášení. Session se ukládá do cookies přes server client
// (@supabase/ssr) → proxy.ts ji pak na každém requestu obnovuje.
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export interface LoginStav {
  error?: string;
}

export async function prihlasAction(_prev: LoginStav, formData: FormData): Promise<LoginStav> {
  const email = String(formData.get('email') || '').trim();
  const heslo = String(formData.get('heslo') || '');
  if (!email || !heslo) return { error: 'Vyplňte e-mail i heslo.' };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password: heslo });
  if (error) return { error: 'Přihlášení se nezdařilo — zkontrolujte e-mail a heslo.' };

  redirect('/');
}

export async function odhlasAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
