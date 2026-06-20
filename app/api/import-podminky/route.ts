import { NextRequest, NextResponse } from 'next/server';
import { importujPodminkuAction } from '@/app/actions';

// Hromadný import vybraných objevených podmínek (podle id). Delší běh kvůli embeddingům.
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // Autorizace: mutující endpoint (stahuje a embeduje) — chráníme CRON_SECRET / admin tokenem.
  // Bez nastaveného tajemství povolíme jen mimo produkci (fail-closed na produkci).
  const secret = process.env.CRON_SECRET;
  if (secret) {
    if (req.headers.get('authorization') !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Endpoint není nakonfigurován (chybí CRON_SECRET).' }, { status: 503 });
  }

  const { ids } = await req.json();
  if (!Array.isArray(ids)) {
    return NextResponse.json({ error: 'Očekávám { ids: [...] }' }, { status: 400 });
  }
  const vysledky: { id: string; success: boolean; chunkCount?: number; error?: string }[] = [];
  for (const id of ids) {
    const r = await importujPodminkuAction(id);
    vysledky.push({ id, success: r.success, chunkCount: r.chunkCount, error: r.error });
  }
  return NextResponse.json({ vysledky });
}
