import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    geminiKey: !!process.env.GEMINI_API_KEY,
    supabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    supabaseServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
}
