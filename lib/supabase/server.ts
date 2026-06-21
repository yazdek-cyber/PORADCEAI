// Supabase SERVER client (pro Server Components, Server Actions, Route Handlers).
// Čte/zapisuje session cookies přes next/headers (v Next 16 je `cookies()` ASYNC → await).
// Tento klient nese identitu poradce (auth.uid()) → datové operace přes něj respektují RLS.
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Voláno ze Server Componentu (cookies jsou read-only) — ignorujeme; session
            // obnovuje proxy.ts na každém requestu, takže o nic nepřijdeme.
          }
        },
      },
    },
  );
}
