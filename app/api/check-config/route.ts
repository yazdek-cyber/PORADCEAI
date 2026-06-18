import { checkEnvConfigured } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    configured: checkEnvConfigured(),
  });
}
