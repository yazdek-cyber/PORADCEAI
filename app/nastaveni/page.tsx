'use client';

import { useState, useEffect, useRef } from 'react';
import { Settings, UploadCloud, Trash2, CheckCircle2 } from 'lucide-react';
import { PageHeader, Card, Button, Field } from '@/components/ui';
import { usePoradce, type Poradce } from '@/lib/poradceStore';

const MAX_LOGO = 400 * 1024; // 400 KB — logo do localStorage

export default function NastaveniPage() {
  const { poradce, nacteno, ulozPoradce } = usePoradce();
  const [stav, setStav] = useState<Poradce>({});
  const [ulozeno, setUlozeno] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (nacteno) setStav(poradce); }, [nacteno, poradce]);

  const uprav = (klic: keyof Poradce, val: string) => setStav((s) => ({ ...s, [klic]: val }));

  const nahrajLogo = (file: File) => {
    setChyba(null);
    if (!file.type.startsWith('image/')) { setChyba('Logo musí být obrázek (PNG, SVG, JPG).'); return; }
    if (file.size > MAX_LOGO) { setChyba(`Logo je příliš velké (${(file.size / 1024).toFixed(0)} kB). Maximum 400 kB.`); return; }
    const reader = new FileReader();
    reader.onload = () => setStav((s) => ({ ...s, logo: reader.result as string }));
    reader.readAsDataURL(file);
  };

  const uloz = () => {
    ulozPoradce(stav);
    setUlozeno(true);
    setTimeout(() => setUlozeno(false), 2500);
  };

  return (
    <div>
      <PageHeader
        ikona={<Settings className="h-5 w-5 text-accent" />}
        titulek="Nastavení poradce"
        popis="Branding pro klientské výstupy (PDF) a záznam z jednání — zobrazí se v hlavičce a patičce."
      />

      <div className="grid lg:grid-cols-2 gap-5">
        <Card>
          <h3 className="text-sm font-bold text-primary mb-3">Identita</h3>
          <div className="space-y-3">
            <Field label="Jméno a příjmení" value={stav.jmeno || ''} set={(v) => uprav('jmeno', v)} placeholder="Jan Poradce" type="text" inputMode="text" />
            <Field label="Firma / síť" value={stav.firma || ''} set={(v) => uprav('firma', v)} placeholder="eDO finance" type="text" inputMode="text" />
            <Field label="Číslo osvědčení ČNB" value={stav.osvedceni || ''} set={(v) => uprav('osvedceni', v)} placeholder="123456PZ" type="text" inputMode="text" />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Telefon" value={stav.telefon || ''} set={(v) => uprav('telefon', v)} placeholder="+420 …" type="text" inputMode="text" />
              <Field label="E-mail" value={stav.email || ''} set={(v) => uprav('email', v)} placeholder="jan@…" type="text" inputMode="text" />
            </div>
          </div>

          <h3 className="text-sm font-bold text-primary mt-5 mb-2">Logo</h3>
          <div
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-3 rounded-xl border-2 border-dashed border-slate-300 hover:border-primary hover:bg-slate-50 p-4 cursor-pointer transition-colors"
          >
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && nahrajLogo(e.target.files[0])} />
            {stav.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={stav.logo} alt="logo" className="h-12 max-w-[160px] object-contain" />
            ) : (
              <UploadCloud className="h-8 w-8 text-slate-300" />
            )}
            <div className="text-sm text-slate-500">{stav.logo ? 'Klikněte pro změnu loga' : 'Nahrát logo (PNG/SVG/JPG, max 400 kB)'}</div>
          </div>
          {stav.logo && (
            <button onClick={() => setStav((s) => ({ ...s, logo: undefined }))} className="mt-2 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-red-600">
              <Trash2 className="h-3.5 w-3.5" /> Odebrat logo
            </button>
          )}
          {chyba && <p className="mt-2 text-xs text-red-600">{chyba}</p>}

          <div className="mt-5 flex items-center gap-3">
            <Button variant="primary" onClick={uloz}>Uložit</Button>
            {ulozeno && <span className="inline-flex items-center gap-1 text-sm font-semibold text-positive"><CheckCircle2 className="h-4 w-4" /> Uloženo</span>}
          </div>
        </Card>

        {/* Náhled hlavičky tisku */}
        <Card>
          <h3 className="text-sm font-bold text-primary mb-3">Náhled hlavičky (jak ji uvidí klient)</h3>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-start justify-between gap-4 pb-4 border-b-2 border-primary">
              <div className="flex items-center gap-3">
                {stav.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={stav.logo} alt="logo" className="h-12 max-w-[170px] object-contain" />
                ) : (
                  <div className="h-12 w-12 rounded-lg bg-slate-100 flex items-center justify-center text-slate-300 text-xs">logo</div>
                )}
                <div>
                  <div className="text-lg font-bold text-primary leading-tight">{stav.firma || 'PoradceAI'}</div>
                  {stav.jmeno && <div className="text-xs text-slate-500">{stav.jmeno}{stav.osvedceni ? `, ČNB ${stav.osvedceni}` : ''}</div>}
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-slate-800 leading-tight">Finanční plán</div>
                <div className="text-xs text-slate-700 mt-1">Klient: <strong>Jan Novák</strong></div>
                <div className="text-xs text-slate-400">{'—'}</div>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-3">Takto začne tisknutý plán a klientská analýza. Vše zůstává jen ve vašem prohlížeči.</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
