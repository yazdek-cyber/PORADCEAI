// Data Access Layer — ověření session pro Server Components / Server Actions.
// POZOR: proxy.ts nechrání Server Actions (běží mimo proxy řetězec), proto si KAŽDÁ datová
// akce musí session ověřit sama přes verifySession(). `cache()` zajistí jediné ověření na request.
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from './server';

/** Vrátí přihlášeného uživatele (poradce), nebo přesměruje na /login. Použij v chráněných cestách. */
export const verifySession = cache(async () => {
  const supabase = await createClient();
  // getUser() ověřuje token proti Auth serveru (na rozdíl od getSession, který jen čte cookie).
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return user;
});

/** Jako verifySession, ale bez redirectu — vrátí user | null (pro nepovinné kontroly). */
export const getOptionalUser = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
});
