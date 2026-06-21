// Supabase BROWSER client (pro klientské komponenty: login formulář, čtení session na klientu).
// Nese session přes cookies spravované @supabase/ssr → respektuje RLS jako přihlášený uživatel.
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
