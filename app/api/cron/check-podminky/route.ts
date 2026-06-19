import { NextRequest, NextResponse } from 'next/server';
import { zkontrolujPodminkyAction } from '@/app/actions';

// Delší běh (scan více pojišťoven). Na Vercelu vyžaduje odpovídající plán.
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

/**
 * Cron endpoint pro automatické hlídání podmínek.
 * Chráněno CRON_SECRET (Vercel cron posílá Authorization: Bearer <CRON_SECRET>).
 * Bez nastaveného CRON_SECRET je v dev režimu otevřeno.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization');
    const param = req.nextUrl.searchParams.get('secret');
    if (auth !== `Bearer ${secret}` && param !== secret) {
      return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });
    }
  }

  try {
    const vysledek = await zkontrolujPodminkyAction();
    return NextResponse.json(vysledek);
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
