import { NextRequest, NextResponse } from 'next/server';
import { importujPodminkuAction } from '@/app/actions';

// Hromadný import vybraných objevených podmínek (podle id). Delší běh kvůli embeddingům.
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
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
