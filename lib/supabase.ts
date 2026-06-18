import { createClient } from '@supabase/supabase-js';

// Použijeme zástupné hodnoty pro sestavení (Next.js build), aby nedošlo k chybě při inicializaci,
// pokud uživatel ještě nedodal své vlastní proměnné v .env.local.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-key';

// standard public client for client-side interactions
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// admin client with service role key for secure server-side operations (chunk ingestion, deletion)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

export function checkEnvConfigured() {
  const isUrlValid = process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
  const isAnonValid = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.includes('placeholder');
  const isServiceValid = process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY.includes('placeholder');
  const isGeminiValid = !!process.env.GEMINI_API_KEY;

  return !!(isUrlValid && isAnonValid && isServiceValid && isGeminiValid);
}
