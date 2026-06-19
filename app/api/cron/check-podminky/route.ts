import { NextRequest, NextResponse } from 'next/server';
import { zkontrolujPodminkyAction } from '@/app/actions';

// Sken jedné pojišťovny se bez problému vejde do limitu. Na Vercelu vyžaduje
// odpovídající plán; držíme pod 300 s.
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

/**
 * Cron endpoint pro automatické hlídání podmínek.
 * Chráněno CRON_SECRET (Vercel cron posílá Authorization: Bearer <CRON_SECRET>).
 * Bez nastaveného CRON_SECRET je v dev režimu otevřeno.
 *
 * Volitelný `?pojistovna=<název>` skenuje jen jednu pojišťovnu — vercel.json
 * plánuje jeden cron na pojišťovnu (rozložené v čase), aby se každé volání vešlo
 * do serverless timeoutu. Bez parametru skenuje vše (pozor na timeout u velkého plánu).
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

  const pojistovna = req.nextUrl.searchParams.get('pojistovna') || undefined;

  try {
    const vysledek = await zkontrolujPodminkyAction(pojistovna);
    return NextResponse.json(vysledek);
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
