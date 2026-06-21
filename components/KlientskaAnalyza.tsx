'use client';

import type { Vypocty, RizikovyProfil } from '@/lib/financniPlan';
import { ShieldCheck, Wallet, TrendingUp, PiggyBank, Info, Home, Target, Scale, Baby } from 'lucide-react';
import { DonutObecny, Sloupce, AlokaceVizual, MiniGraf } from '@/components/Vizualy';
import { INVALIDITA, STATISTIKY_ZDROJ } from '@/lib/edoStatistiky';
import { portfolioProProfil, barvaTridy } from '@/lib/edoPortfolia';
import { uvery } from '@/lib/kalkulacky';
import { Karta } from '@/components/ui';
import ModelaceRizik from '@/components/ModelaceRizik';
import HorizontyRezerv from '@/components/HorizontyRezerv';
import PenzeOsa from '@/components/PenzeOsa';

// KLIENTSKÁ GRAFICKÁ ANALÝZA (eDO-styl). Výstup „pro klienta" — grafy + kontext (PROČ) napříč
// životními oblastmi (cashflow → rezerva → ochrana → bydlení → cíle/děti → růst majetku → penze).
// Edukační statistiky vysvětlují kontext; čísla klienta jdou z deterministických kalkulaček (Vypocty).

const f = (x: number) => Math.round(x).toLocaleString('cs-CZ');
const pct = (x: number) => (x * 100).toFixed(0) + ' %';

// hypotekaSazba je DECIMAL (0.059) — shodně s FinPlanProfil.
export interface KlientCisla {
  jmeno?: string;
  rizikovyProfil?: RizikovyProfil;
  vek?: number;
  vekOdchodu?: number;
  cistyPrijem?: number;
  vydaje?: number;
  cilovaRentaDuchod?: number;
  ocekavanaStatniPenze?: number;
  hypotekaZustatek?: number;
  hypotekaSazba?: number;
  hypotekaZbyvaMesicu?: number;
  jineDluhy?: number;
  pocetDeti?: number;
  mesicniVkladInvestice?: number;
  penzeMesicniVklad?: number;
  // Aktuální majetek (stav) — pro rozvahu čistého jmění.
  rezervaNasporeno?: number;
  existujiciInvestice?: number;
  penzeNasporeno?: number;
  // Současné krytí z existujících smluv (Kč) — pro mezeru „co smlouva kryje vs. potřeba".
  soucasneKrytiSmrt?: number;
  soucasneKrytiInvalidita?: number;
  soucasneKrytiZO?: number;
  soucasneKrytiTN?: number;
}

function Proc({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 flex gap-2 rounded-xl bg-primary-50/60 p-2.5">
      <Info className="h-4 w-4 text-accent shrink-0 mt-0.5" />
      <p className="text-[11px] leading-relaxed text-slate-600">{children}</p>
    </div>
  );
}

const DETI_FAZE = ['Narození', 'Předškolní', 'ZŠ', 'SŠ', 'VŠ', 'Start do života'];

export default function KlientskaAnalyza({ v, klient }: { v: Vypocty; klient: KlientCisla }) {
  if (!v || !v.rezerva || !v.rezervaUrovne || !v.investice || !v.penze || !v.uvery) return null;
  const prijem = klient.cistyPrijem ?? 0;
  const vydaje = klient.vydaje ?? 0;

  // — Cashflow —
  const volne = Math.max(0, prijem - vydaje);
  const investVklad = klient.mesicniVkladInvestice ?? 0;
  const penzeVklad = klient.penzeMesicniVklad ?? 0;
  const zbytekVolne = Math.max(0, volne - investVklad - penzeVklad);

  // — Aktuální majetek (rozvaha) —
  const majRezerva = klient.rezervaNasporeno ?? 0;
  const majInvestice = klient.existujiciInvestice ?? 0;
  const majPenze = klient.penzeNasporeno ?? 0;
  const aktivaCelkem = majRezerva + majInvestice + majPenze;
  const dluhyCelkem = (klient.hypotekaZustatek ?? 0) + (klient.jineDluhy ?? 0);
  const cisteJmeni = aktivaCelkem - dluhyCelkem;
  const maMajetek = aktivaCelkem > 0 || dluhyCelkem > 0;

  // — Ochrana —
  const invalKryti = v.efpaKryti?.invalidita ?? v.edoKryti?.invalidita ?? 0;
  const inval3 = INVALIDITA[2];
  const nahradaInval = prijem > 0 ? inval3.prumernyDuchod / prijem : 0;

  // — Rezerva —
  const naspureno = Math.max(0, v.rezerva.doporucenaRezerva - v.rezerva.chybiDoRezervy);

  // — Bydlení —
  const maHypoteku = (klient.hypotekaZustatek ?? 0) > 0;
  const hypoMesicu = (klient.hypotekaZbyvaMesicu ?? 0) > 0 ? (klient.hypotekaZbyvaMesicu as number) : 300;
  const hypo = maHypoteku
    ? uvery.splatkovyKalendar(klient.hypotekaZustatek as number, klient.hypotekaSazba ?? v.uvery.trzniSazba, hypoMesicu)
    : null;
  const hypoKrivka = hypo ? [...hypo.radky.filter((_, i) => i % 12 === 0).map((x) => x.zustatek), 0] : [];
  // Citlivost splátky na sazbu (edukace) — pro částku úvěru klienta (nebo 1 mil.).
  const castkaUveru = maHypoteku ? (klient.hypotekaZustatek as number) : 1_000_000;
  const citlivost = [0.03, 0.04, 0.05, 0.06, 0.07].map((s) => ({
    label: `${(s * 100).toFixed(0)} % p.a.`,
    hodnota: uvery.splatkovyKalendar(castkaUveru, s, maHypoteku ? hypoMesicu : 360).splatka,
    barva: Math.abs(s - (klient.hypotekaSazba ?? v.uvery.trzniSazba)) < 0.006 ? 'var(--color-accent)' : 'var(--color-primary)',
  }));

  // — Penze —
  const statni = klient.ocekavanaStatniPenze ?? 0;
  const mezera = Math.max(0, v.penze.mezera?.mesicniMezera ?? 0);
  const potrebaRenty = klient.cilovaRentaDuchod && klient.cilovaRentaDuchod > 0 ? klient.cilovaRentaDuchod : statni + mezera;
  const nahradaPenze = prijem > 0 ? statni / prijem : 0;

  const maDeti = (klient.pocetDeti ?? 0) > 0;
  const maCile = v.cile && v.cile.length > 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 print:grid-cols-2 gap-4">
      {/* PŘÍJMY A VÝDAJE */}
      <Karta ikona={<Scale className="h-4 w-4 text-accent" />} titulek="Příjmy a výdaje" popis="Kolik měsíčně zbývá na tvorbu majetku a zajištění.">
        <Sloupce data={[
          { label: 'Čistý příjem', hodnota: prijem, barva: 'var(--color-positive)' },
          { label: 'Výdaje', hodnota: vydaje, barva: '#cbd5e1' },
          { label: 'Volné prostředky', hodnota: volne, barva: 'var(--color-primary)' },
        ]} format={(n) => `${f(n)} Kč/měs`} />
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          {[['Investice', investVklad], ['Penze/DPS', penzeVklad], ['K rozdělení', zbytekVolne]].map(([l, val]) => (
            <div key={l as string} className="rounded-lg bg-slate-50 py-1.5">
              <div className="text-sm font-bold text-slate-800">{f(val as number)}</div>
              <div className="text-[10px] text-slate-400">{l as string} Kč/měs</div>
            </div>
          ))}
        </div>
        <Proc>
          {volne > 0
            ? `Z příjmu zbývá ${f(volne)} Kč/měs. Aktuálně směřujete ${f(investVklad + penzeVklad)} Kč do tvorby majetku — zbývá ${f(zbytekVolne)} Kč na cíle, rezervu a zajištění.`
            : 'Výdaje aktuálně vyčerpávají celý příjem — prvním krokem je najít prostor v rozpočtu na rezervu a zajištění.'}
        </Proc>
      </Karta>

      {/* AKTUÁLNÍ MAJETEK (rozvaha) */}
      {maMajetek && (
        <Karta ikona={<Scale className="h-4 w-4 text-accent" />} titulek="Aktuální majetek" popis="Co klient dnes má a dluží — čisté jmění jako výchozí bod plánu.">
          <div className="flex items-center gap-3">
            {aktivaCelkem > 0 && (
              <div className="text-center shrink-0">
                <DonutObecny segmenty={[
                  { podil: majRezerva / aktivaCelkem, barva: '#94a3b8' },
                  { podil: majInvestice / aktivaCelkem, barva: 'var(--color-primary)' },
                  { podil: majPenze / aktivaCelkem, barva: 'var(--color-accent)' },
                ]} velikost={88} />
                <div className="text-[10px] text-slate-400 mt-1">Složení aktiv</div>
              </div>
            )}
            <div className="flex-1 space-y-1 text-[12px]">
              {([['Rezerva', majRezerva, '#94a3b8'], ['Investice', majInvestice, 'var(--color-primary)'], ['Penze (naspořeno)', majPenze, 'var(--color-accent)']] as [string, number, string][]).map(([l, val, c]) => (
                <div key={l} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-slate-600"><span className="h-2 w-2 rounded-full" style={{ background: c }} />{l}</span>
                  <span className="font-semibold text-slate-800">{f(val)} Kč</span>
                </div>
              ))}
              <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-1 mt-1">
                <span className="text-slate-600">Aktiva celkem</span>
                <span className="font-bold text-slate-800">{f(aktivaCelkem)} Kč</span>
              </div>
              {dluhyCelkem > 0 && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-600">Závazky (hypotéka + dluhy)</span>
                  <span className="font-semibold text-red-600">− {f(dluhyCelkem)} Kč</span>
                </div>
              )}
            </div>
          </div>
          <div className={`mt-3 rounded-xl px-3 py-2 ${cisteJmeni >= 0 ? 'bg-primary-50/60' : 'bg-red-50'}`}>
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Čisté jmění (aktiva − závazky)</div>
            <div className={`text-xl font-extrabold ${cisteJmeni >= 0 ? 'text-primary' : 'text-red-600'}`}>{f(cisteJmeni)} Kč</div>
          </div>
          <Proc>
            {cisteJmeni >= 0
              ? `Čisté jmění ${f(cisteJmeni)} Kč je odrazový můstek plánu. Cílem je nechat aktiva pracovat (investice, penze) a postupně snižovat drahé závazky.`
              : `Závazky zatím převyšují aktiva o ${f(-cisteJmeni)} Kč — priorita je rezerva a řízené splácení dluhů před budováním investic.`}
          </Proc>
        </Karta>
      )}

      {/* FINANČNÍ REZERVA */}
      <Karta ikona={<Wallet className="h-4 w-4 text-accent" />} titulek="Finanční rezerva" popis="Polštář pro nečekané výdaje a výpadek příjmu.">
        <Sloupce data={[
          { label: 'Naspořeno', hodnota: naspureno, barva: 'var(--color-positive)' },
          { label: 'Doporučeno (6× výdaje)', hodnota: v.rezerva.doporucenaRezerva, barva: 'var(--color-primary)' },
        ]} format={(n) => `${f(n)} Kč`} />
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          {[['3× krátkodobá', v.rezervaUrovne.kratkodoba], ['6× ztráta práce', v.rezervaUrovne.ztrataPrace], ['12× nemoc', v.rezervaUrovne.dlouhodobaNemoc]].map(([l, val]) => (
            <div key={l as string} className="rounded-lg bg-slate-50 py-1.5">
              <div className="text-sm font-bold text-slate-800">{f(val as number)}</div>
              <div className="text-[10px] text-slate-400">{l as string}</div>
            </div>
          ))}
        </div>
        <Proc>
          {v.rezerva.chybiDoRezervy > 0
            ? `Do doporučené rezervy chybí ${f(v.rezerva.chybiDoRezervy)} Kč. Rezerva je první priorita — bez ní hrozí drahé úvěry při výpadku příjmu.`
            : 'Rezerva je naplněna — výborný základ. Dál ji držte likvidní (spořicí účet / fond peněžního trhu).'}
        </Proc>
      </Karta>

      {/* OCHRANA PŘÍJMŮ */}
      <Karta ikona={<ShieldCheck className="h-4 w-4 text-accent" />} titulek="Ochrana příjmů" popis="Proč na pojistné ochraně záleží — a kolik krýt.">
        <div className="flex items-center gap-3">
          <div className="text-center">
            <DonutObecny segmenty={INVALIDITA.map((i) => ({ podil: i.podil, barva: i.barva }))} velikost={88} />
            <div className="text-[10px] text-slate-400 mt-1">Stupně invalidity v ČR</div>
          </div>
          <div className="flex-1 space-y-0.5 text-[11px] text-slate-600">
            {INVALIDITA.map((i) => (
              <span key={i.stupen} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: i.barva }} />{i.stupen}</span>
                <span className="text-slate-400">{pct(i.podil)} · ⌀ {f(i.prumernyDuchod)} Kč</span>
              </span>
            ))}
          </div>
        </div>
        <div className="mt-3">
          <Sloupce data={[
            { label: 'Váš čistý příjem', hodnota: prijem, barva: 'var(--color-primary)' },
            { label: 'Invalidní důchod III. st.', hodnota: INVALIDITA[2].prumernyDuchod, barva: '#cbd5e1' },
            { label: 'Invalidní důchod II. st.', hodnota: INVALIDITA[1].prumernyDuchod, barva: '#cbd5e1' },
            { label: 'Invalidní důchod I. st.', hodnota: INVALIDITA[0].prumernyDuchod, barva: '#cbd5e1' },
          ]} format={(n) => `${f(n)} Kč`} />
        </div>
        <div className="mt-3 rounded-xl bg-accent-50 px-3 py-2">
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Doporučené krytí invalidity</div>
          <div className="text-xl font-extrabold text-accent-700">{f(invalKryti)} Kč</div>
        </div>
        <Proc>
          Státní invalidní důchod při III. stupni (⌀ {f(inval3.prumernyDuchod)} Kč) pokryje jen
          ~{pct(nahradaInval)} vašeho příjmu. Pojištění má dorovnat zbytek, aby rodina udržela životní úroveň.
        </Proc>
      </Karta>

      {/* MODELACE RIZIK — krytí vs. potřeba (eDO obchodní rozhovor) */}
      <ModelaceRizik v={v} klient={klient} />

      {/* BYDLENÍ */}
      <Karta ikona={<Home className="h-4 w-4 text-accent" />} titulek="Bydlení a úvěry" popis={maHypoteku ? 'Vaše hypotéka a možnosti optimalizace.' : 'Vaše úvěrová kapacita a náklady financování.'}>
        {hypo ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-slate-50 px-3 py-2"><div className="text-sm font-bold text-slate-800">{f(hypo.splatka)} Kč</div><div className="text-[10px] text-slate-400">Měsíční splátka</div></div>
              <div className="rounded-lg bg-slate-50 px-3 py-2"><div className="text-sm font-bold text-slate-800">{f(hypo.celkemUroky)} Kč</div><div className="text-[10px] text-slate-400">Přeplatek (úroky)</div></div>
            </div>
            <div className="text-[10px] text-slate-400 mt-2">Zůstatek úvěru v čase</div>
            <MiniGraf hodnoty={hypoKrivka} />
          </>
        ) : (
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <div className="text-sm font-bold text-slate-800">Max. úvěr {f(v.uvery.maxUver.maxUver)} Kč</div>
            <div className="text-[10px] text-slate-400">splátka ~{f(v.uvery.maxUver.splatkaPriMaxUveru)} Kč · rozhoduje {v.uvery.maxUver.rozhodujiciLimit}</div>
          </div>
        )}
        <div className="mt-3">
          <div className="text-[11px] font-semibold text-slate-500 mb-1">Měsíční splátka {f(castkaUveru)} Kč úvěru dle sazby</div>
          <Sloupce data={citlivost} format={(n) => `${f(n)} Kč`} vyska="h-2" />
        </div>
        {v.uvery.refinancovani && (
          <Proc>
            {v.uvery.refinancovani.vyplati
              ? `Refinancování by přineslo úsporu ${f(v.uvery.refinancovani.mesicniUspora)} Kč/měs (návratnost ${v.uvery.refinancovani.navratnostMesicu} měs.) — vyplatí se prověřit.`
              : 'Refinancování se při aktuálních sazbách spíše nevyplatí; sledujte vývoj před koncem fixace.'}
          </Proc>
        )}
      </Karta>

      {/* CÍLE A DĚTI */}
      {(maCile || maDeti) && (
        <Karta ikona={<Target className="h-4 w-4 text-accent" />} titulek="Cíle a děti" popis="Co chcete dosáhnout a kolik na to měsíčně odkládat." className="lg:col-span-2 print:col-span-2">
          {maDeti && (
            <div className="mb-3">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 mb-1"><Baby className="h-3.5 w-3.5 text-accent" />Životní fáze dětí ({klient.pocetDeti})</div>
              <div className="flex items-center gap-1">
                {DETI_FAZE.map((fz, i) => (
                  <div key={fz} className="flex-1 flex items-center gap-1">
                    <div className="flex-1 text-center">
                      <div className="h-1.5 rounded-full bg-primary-100" />
                      <div className="text-[9px] text-slate-500 mt-1 leading-tight">{fz}</div>
                    </div>
                    {i < DETI_FAZE.length - 1 && <span className="text-slate-300 text-[10px]">›</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {maCile && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {v.cile.map((c, i) => (
                <div key={i} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-800 text-sm truncate">{c.nazev}</span>
                    <span className="text-[10px] text-slate-400 shrink-0">{c.roky} let</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">cíl {f(c.castka)} Kč · akcie {pct(c.alokace.akcie)}</div>
                  <div className="mt-1.5 text-sm font-extrabold text-primary">{f(c.mesicni)} Kč<span className="text-[10px] font-normal text-slate-400">/měs</span></div>
                  <div className="text-[10px] text-slate-400">nebo jednorázově {f(c.jednorazove)} Kč</div>
                </div>
              ))}
            </div>
          )}
          <Proc>
            {maCile
              ? 'Dlouhé cíle financujte dynamičtěji (více akcií), krátké konzervativně. Pravidelná měsíční investice rozloží riziko v čase.'
              : 'Děti procházejí fázemi s rostoucími náklady (škola, kroužky, studium, start do života) — vyplatí se na ně tvořit prostředky včas.'}
          </Proc>
        </Karta>
      )}

      {/* HORIZONTY — peníze podle času (eDO rozdělení dle horizontu) */}
      <HorizontyRezerv v={v} klient={klient} />

      {/* RŮST MAJETKU */}
      <Karta ikona={<TrendingUp className="h-4 w-4 text-accent" />} titulek="Růst majetku" popis={`Investiční horizont ${v.investice.horizontLet} let · oček. reálný výnos ${(v.investice.ocekavanyVynosKFP * 100).toFixed(1)} % p.a.`}>
        <AlokaceVizual {...v.investice.doporucenaAlokace} />
        <div className="mt-3">
          <Sloupce data={[
            { label: 'Optimistický scénář (p90)', hodnota: v.investice.monteCarlo.p90, barva: 'var(--color-positive)' },
            { label: 'Očekávaný (medián)', hodnota: v.investice.monteCarlo.median, barva: 'var(--color-primary)' },
            { label: 'Pesimistický (p10)', hodnota: v.investice.monteCarlo.p10, barva: '#cbd5e1' },
          ]} format={(n) => `${f(n)} Kč`} />
        </div>
        {(() => {
          const p = portfolioProProfil(klient.rizikovyProfil);
          return (
            <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                Doporučené eDO portfolio — {p.nazev} (cíl {(p.cilovyVynos * 100).toFixed(1).replace('.0', '')} % p.a.)
              </div>
              <div className="space-y-1.5">
                {p.fondy.map((fo) => (
                  <div key={fo.isin} className="text-[11px]">
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-700 truncate">{fo.nazev} <span className="text-slate-400">· {fo.trida}</span></span>
                      <span className="font-bold text-slate-800 shrink-0">{Math.round(fo.vaha * 100)} %</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div style={{ width: `${fo.vaha * 100}%`, background: barvaTridy(fo.trida) }} className="h-1.5 rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
        <Proc>
          Při zvolené alokaci je očekávaná hodnota investice {f(v.investice.monteCarlo.median)} Kč; i pesimistický
          scénář ({f(v.investice.monteCarlo.p10)} Kč) počítá s výkyvy trhu. Konkrétní eDO portfolio výše odpovídá rizikovému profilu.
        </Proc>
      </Karta>

      {/* PENZE */}
      <Karta ikona={<PiggyBank className="h-4 w-4 text-accent" />} titulek="Penze a renta" popis="Kolik nahradí stát a kolik si musíte zajistit sami.">
        <Sloupce data={[
          { label: 'Potřeba renty (cíl)', hodnota: potrebaRenty, barva: 'var(--color-primary)' },
          { label: 'Z toho státní penze', hodnota: statni, barva: '#cbd5e1' },
          { label: 'Měsíční mezera (řešit)', hodnota: mezera, barva: 'var(--color-accent)' },
        ]} format={(n) => `${f(n)} Kč/měs`} />
        <div className="mt-3 rounded-xl bg-accent-50 px-3 py-2">
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Potřebný kapitál pro rentu (pravidlo ×200)</div>
          <div className="text-xl font-extrabold text-accent-700">{f(v.penze.potrebnyKapitalRentaKFP)} Kč</div>
        </div>
        <Proc>
          {prijem > 0 ? `Státní penze nahradí jen ~${pct(nahradaPenze)} dnešního příjmu. ` : ''}
          {mezera > 0
            ? `Měsíční mezeru ${f(mezera)} Kč pokryjete vlastní rentou — proto včas tvořte kapitál.`
            : 'Důchodový cíl je dle projekce pokryt — držte nastavené spoření.'}
        </Proc>
      </Karta>

      {/* PENZE — v kolika s kolika (eDO osa + daňová úspora) */}
      <PenzeOsa v={v} klient={klient} vek={klient.vek} vekOdchodu={klient.vekOdchodu} />

      <div className="lg:col-span-2 print:col-span-2 text-[10px] text-slate-400 px-1">
        Statistické grafy (rozložení invalidity): {STATISTIKY_ZDROJ}. Částky klienta z deterministických
        kalkulaček v dnešní hodnotě peněz. Orientační podklad, nikoliv individualizované finanční doporučení.
      </div>
    </div>
  );
}
