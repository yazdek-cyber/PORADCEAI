'use client';

import { useState, useMemo, useContext, createContext } from 'react';
import { Calculator, Home, TrendingUp, PiggyBank, ShieldCheck, Target, Landmark, Wallet, Printer, UserRound, UserCheck } from 'lucide-react';
import { uvery, investice, penze, pojisteni } from '@/lib/kalkulacky';
import { AlokaceVizual, MiniGraf } from '@/components/Vizualy';
import { usePripad, jePripadPrazdny, popisPripadu, type Pripad } from '@/lib/pripadStore';

// Předvyplnění kalkulaček z aktivního případu klienta. Hodnoty jsou UI-ready řetězce;
// kalkulačky je čtou v inicializátoru useState (remount přes `key` zajistí přepsání).
interface KalkInit {
  hypoJistina?: string; hypoSazba?: string; hypoRoky?: string;
  prijem?: string; splatky?: string;
  rentaStatni?: string; rentaNasporeno?: string;
  penzeVek?: string; penzeOdchod?: string; penzeNasporeno?: string; penzeVlastni?: string;
}
const KalkInitCtx = createContext<KalkInit>({});
const iv = (n?: number): string | undefined => (n === undefined || n === null ? undefined : String(n));
function odvoditInit(p: Pripad): KalkInit {
  return {
    hypoJistina: iv(p.hypotekaZustatek),
    hypoSazba: iv(p.hypotekaSazba),
    hypoRoky: p.hypotekaZbyvaMesicu ? String(Math.round(p.hypotekaZbyvaMesicu / 12)) : undefined,
    prijem: iv(p.cistyPrijem),
    splatky: iv(p.mesicniSplatkyDluhu),
    rentaStatni: iv(p.ocekavanaStatniPenze),
    rentaNasporeno: iv(p.penzeNasporeno),
    penzeVek: iv(p.vek),
    penzeOdchod: iv(p.vekOdchodu),
    penzeNasporeno: iv(p.penzeNasporeno),
    penzeVlastni: iv(p.penzeMesicniVklad),
  };
}

// ── Pomocné ───────────────────────────────────────────────────────────────
function num(v: string): number {
  const n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.'));
  return isNaN(n) ? 0 : n;
}
const f = (x: number) => Math.round(x).toLocaleString('cs-CZ');
const pct = (x: number) => (x * 100).toFixed(1).replace('.0', '') + ' %';

function Pole({ label, value, set, suffix }: { label: string; value: string; set: (v: string) => void; suffix?: string }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">{label}</span>
      <div className="relative">
        <input
          value={value}
          onChange={(e) => set(e.target.value)}
          inputMode="decimal"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
        />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">{suffix}</span>}
      </div>
    </label>
  );
}

function Karta({ ikona, titulek, popis, children }: { ikona: React.ReactNode; titulek: string; popis?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-base font-bold text-primary flex items-center gap-2">{ikona}{titulek}</h3>
      {popis && <p className="text-xs text-slate-500 mt-0.5 mb-3">{popis}</p>}
      {children}
    </div>
  );
}

function Hlavni({ label, hodnota, barva = 'text-primary' }: { label: string; hodnota: string; barva?: string }) {
  return (
    <div className="rounded-lg bg-primary-50/60 px-4 py-3 mt-3">
      <div className={`text-2xl font-extrabold ${barva}`}>{hodnota}</div>
      <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{label}</div>
    </div>
  );
}

function Radek({ label, hodnota }: { label: string; hodnota: string }) {
  return (
    <div className="flex justify-between text-sm py-1 border-b border-slate-50 last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-800">{hodnota}</span>
    </div>
  );
}

// Vizuály (donut, mini graf) jsou ve sdílené komponentě components/Vizualy.tsx.

// ── ÚVĚRY ───────────────────────────────────────────────────────────────────
function HypotekaKalk() {
  const init = useContext(KalkInitCtx);
  const [jistina, setJistina] = useState(() => init.hypoJistina ?? '3000000');
  const [sazba, setSazba] = useState(() => init.hypoSazba ?? '4.9');
  const [roky, setRoky] = useState(() => init.hypoRoky ?? '30');
  const [kalendar, setKalendar] = useState(false);
  const r = useMemo(() => uvery.splatkovyKalendar(num(jistina), num(sazba) / 100, Math.max(1, num(roky)) * 12), [jistina, sazba, roky]);
  // Agregace splátkového kalendáře po letech (pro tabulku k tisku).
  const poLetech = useMemo(() => {
    const out: { rok: number; urok: number; umor: number; zustatek: number }[] = [];
    r.radky.forEach((x, i) => {
      const rok = Math.floor(i / 12);
      if (!out[rok]) out[rok] = { rok: rok + 1, urok: 0, umor: 0, zustatek: x.zustatek };
      out[rok].urok += x.urok;
      out[rok].umor += x.umor;
      out[rok].zustatek = x.zustatek;
    });
    return out;
  }, [r]);
  return (
    <Karta ikona={<Home className="h-4 w-4 text-accent" />} titulek="Hypoteční splátka" popis="Anuitní splátka, přeplatek a splátkový kalendář.">
      <div className="grid grid-cols-3 gap-2">
        <Pole label="Výše úvěru" value={jistina} set={setJistina} suffix="Kč" />
        <Pole label="Sazba" value={sazba} set={setSazba} suffix="%" />
        <Pole label="Doba" value={roky} set={setRoky} suffix="let" />
      </div>
      <Hlavni label="Měsíční splátka" hodnota={`${f(r.splatka)} Kč`} />
      <div className="mt-2">
        <Radek label="Celkem zaplaceno" hodnota={`${f(r.celkemZaplaceno)} Kč`} />
        <Radek label="Z toho úroky (přeplatek)" hodnota={`${f(r.celkemUroky)} Kč`} />
      </div>
      <div className="text-[10px] text-slate-400 mt-2">Zůstatek úvěru v čase</div>
      <MiniGraf hodnoty={[...r.radky.filter((_, i) => i % 12 === 0).map((x) => x.zustatek), 0]} />
      <button onClick={() => setKalendar((s) => !s)} className="mt-3 text-xs font-bold text-primary hover:text-primary-600 print:hidden">
        {kalendar ? 'Skrýt splátkový kalendář' : 'Zobrazit splátkový kalendář (po letech)'}
      </button>
      {kalendar && (
        <div className="mt-2 max-h-64 overflow-y-auto print:max-h-none print:overflow-visible">
          <table className="w-full text-xs">
            <thead className="text-slate-400 text-left sticky top-0 bg-white">
              <tr><th className="font-semibold py-1">Rok</th><th className="font-semibold text-right">Úroky</th><th className="font-semibold text-right">Úmor</th><th className="font-semibold text-right">Zůstatek</th></tr>
            </thead>
            <tbody className="text-slate-700">
              {poLetech.map((y) => (
                <tr key={y.rok} className="border-t border-slate-50">
                  <td className="py-1">{y.rok}.</td>
                  <td className="text-right">{f(y.urok)}</td>
                  <td className="text-right">{f(y.umor)}</td>
                  <td className="text-right font-medium">{f(y.zustatek)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Karta>
  );
}

function MaxUverKalk() {
  const init = useContext(KalkInitCtx);
  const [prijem, setPrijem] = useState(() => init.prijem ?? '50000');
  const [splatky, setSplatky] = useState(() => init.splatky ?? '0');
  const [sazba, setSazba] = useState(() => init.hypoSazba ?? '4.9');
  const [hodnota, setHodnota] = useState('');
  const r = useMemo(() => uvery.maxUver({
    cistyMesicniPrijem: num(prijem), stavajiciMesicniSplatky: num(splatky),
    rocniSazba: num(sazba) / 100, pocetMesicu: 360,
    hodnotaNemovitosti: num(hodnota) > 0 ? num(hodnota) : undefined,
  }), [prijem, splatky, sazba, hodnota]);
  return (
    <Karta ikona={<Landmark className="h-4 w-4 text-accent" />} titulek="Maximální úvěr" popis="Dle příjmu a limitů ČNB (DSTI/DTI/LTV).">
      <div className="grid grid-cols-2 gap-2">
        <Pole label="Čistý příjem" value={prijem} set={setPrijem} suffix="Kč/měs" />
        <Pole label="Stávající splátky" value={splatky} set={setSplatky} suffix="Kč/měs" />
        <Pole label="Sazba" value={sazba} set={setSazba} suffix="%" />
        <Pole label="Hodnota nemovitosti" value={hodnota} set={setHodnota} suffix="Kč" />
      </div>
      <Hlavni label={`Max. úvěr (30 let) · rozhoduje ${r.rozhodujiciLimit}`} hodnota={`${f(r.maxUver)} Kč`} />
      <div className="mt-2">
        <Radek label="Splátka při max. úvěru" hodnota={`${f(r.splatkaPriMaxUveru)} Kč`} />
        <Radek label="Limity: DSTI / DTI / LTV" hodnota={`${f(r.dleDSTI)} / ${f(r.dleDTI)} / ${r.dleLTV === null ? '–' : f(r.dleLTV)}`} />
      </div>
    </Karta>
  );
}

function RefinancKalk() {
  const [zustatek, setZustatek] = useState('2500000');
  const [mesicu, setMesicu] = useState('240');
  const [stara, setStara] = useState('5.9');
  const [nova, setNova] = useState('4.5');
  const [poplatky, setPoplatky] = useState('15000');
  const r = useMemo(() => uvery.refinancovani({
    zbyvajiciJistina: num(zustatek), zbyvajiciMesicu: Math.max(1, num(mesicu)),
    stavajiciSazba: num(stara) / 100, novaSazba: num(nova) / 100, poplatkyZaRefinancovani: num(poplatky),
  }), [zustatek, mesicu, stara, nova, poplatky]);
  return (
    <Karta ikona={<TrendingUp className="h-4 w-4 text-accent" />} titulek="Refinancování" popis="Úspora při změně sazby a návratnost poplatků.">
      <div className="grid grid-cols-3 gap-2">
        <Pole label="Zůstatek" value={zustatek} set={setZustatek} suffix="Kč" />
        <Pole label="Zbývá" value={mesicu} set={setMesicu} suffix="měs" />
        <Pole label="Poplatky" value={poplatky} set={setPoplatky} suffix="Kč" />
        <Pole label="Stará sazba" value={stara} set={setStara} suffix="%" />
        <Pole label="Nová sazba" value={nova} set={setNova} suffix="%" />
      </div>
      <Hlavni label="Měsíční úspora" hodnota={`${f(r.mesicniUspora)} Kč`} barva={r.vyplati ? 'text-green-600' : 'text-slate-500'} />
      <div className="mt-2">
        <Radek label="Celková úspora na úrocích" hodnota={`${f(r.celkovaUsporaNaUrocich)} Kč`} />
        <Radek label="Návratnost poplatků" hodnota={r.navratnostMesicu ? `${r.navratnostMesicu} měs.` : '–'} />
        <Radek label="Vyplatí se" hodnota={r.vyplati ? 'ANO' : 'NE'} />
      </div>
    </Karta>
  );
}

// ── INVESTICE ────────────────────────────────────────────────────────────────
function ProjekceKalk() {
  const [pocatecni, setPocatecni] = useState('100000');
  const [mesicni, setMesicni] = useState('5000');
  const [roky, setRoky] = useState('20');
  const r = useMemo(() => {
    const let_ = Math.max(1, num(roky));
    const alokace = investice.alokaceDleHorizontu(let_);
    // Výnos i volatilita ze STEJNÉ (zobrazené) alokace → donut, výnos a Monte Carlo jsou konzistentní.
    const vynos = investice.ocekavanyVynosDleHorizontu(let_);
    const mc = investice.monteCarloProjekce({
      pocatecni: num(pocatecni), mesicniVklad: num(mesicni), roky: let_,
      ocekavanyVynos: vynos, volatilita: investice.volatilitaPortfolia(alokace), seed: 12345,
    });
    const vlozeno = num(pocatecni) + num(mesicni) * let_ * 12;
    // Očekávaný (deterministický) růst po letech pro mini graf.
    const rust: number[] = [];
    for (let y = 0; y <= let_; y++) {
      rust.push(investice.budouciHodnota(num(pocatecni), vynos, y) + investice.budouciHodnotaPravidelna(num(mesicni), vynos, y));
    }
    return { alokace, vynos, mc, vlozeno, rust };
  }, [pocatecni, mesicni, roky]);
  return (
    <Karta ikona={<TrendingUp className="h-4 w-4 text-accent" />} titulek="Investiční projekce" popis="Pravděpodobnostní vývoj (Monte Carlo), reálné výnosy dle horizontu.">
      <div className="grid grid-cols-3 gap-2">
        <Pole label="Jednorázově" value={pocatecni} set={setPocatecni} suffix="Kč" />
        <Pole label="Měsíčně" value={mesicni} set={setMesicni} suffix="Kč" />
        <Pole label="Horizont" value={roky} set={setRoky} suffix="let" />
      </div>
      <Hlavni label={`Medián za ${Math.max(1, num(roky))} let (reálně, dnešní hodnota)`} hodnota={`${f(r.mc.median)} Kč`} />
      <div className="mt-2">
        <Radek label="Pesimistický (p10) / Optimistický (p90)" hodnota={`${f(r.mc.p10)} / ${f(r.mc.p90)} Kč`} />
        <Radek label="Vloženo celkem" hodnota={`${f(r.vlozeno)} Kč`} />
        <Radek label="Oček. reálný výnos" hodnota={`${pct(r.vynos)} p.a.`} />
      </div>
      <div className="text-[10px] text-slate-400 mt-2">Očekávaný růst hodnoty</div>
      <MiniGraf hodnoty={r.rust} />
      <AlokaceVizual {...r.alokace} />
    </Karta>
  );
}

function CilKalk() {
  const [cil, setCil] = useState('500000');
  const [roky, setRoky] = useState('15');
  const [nasporeno, setNasporeno] = useState('0');
  const r = useMemo(() => {
    const let_ = Math.max(0, num(roky));
    // Výnos odvozen ze zobrazené alokace (stejný horizont) → donut a výnos jsou konzistentní.
    const vynos = investice.ocekavanyVynosDleHorizontu(let_);
    return { vynos, ...investice.kolikInvestovat(num(cil), let_, vynos, num(nasporeno)), alokace: investice.alokaceDleHorizontu(let_) };
  }, [cil, roky, nasporeno]);
  return (
    <Karta ikona={<Target className="h-4 w-4 text-accent" />} titulek="Kolik investovat na cíl" popis="Vzdělání dětí, auto, bydlení… kolik dnes nebo měsíčně.">
      <div className="grid grid-cols-3 gap-2">
        <Pole label="Cílová částka" value={cil} set={setCil} suffix="Kč" />
        <Pole label="Za" value={roky} set={setRoky} suffix="let" />
        <Pole label="Naspořeno" value={nasporeno} set={setNasporeno} suffix="Kč" />
      </div>
      <Hlavni label="Měsíčně investovat" hodnota={`${f(r.mesicni)} Kč`} />
      <div className="mt-2">
        <Radek label="Nebo jednorázově dnes" hodnota={`${f(r.jednorazove)} Kč`} />
        <Radek label="Oček. reálný výnos" hodnota={`${pct(r.vynos)} p.a.`} />
      </div>
      <AlokaceVizual {...r.alokace} />
    </Karta>
  );
}

const FORMY_INVESTIC: investice.InvesticniForma[] = [
  { nazev: 'ETF (pasivní)', ocekavanyVynos: 0.07, ter: 0.002, vstupniPoplatek: 0 },
  { nazev: 'Aktivní fond', ocekavanyVynos: 0.06, ter: 0.018, vstupniPoplatek: 0.02 },
  { nazev: 'IŽP (rezervotvorné)', ocekavanyVynos: 0.05, ter: 0.03, vstupniPoplatek: 0.02 },
];

function SrovnaniForemKalk() {
  const [pocatecni, setPocatecni] = useState('100000');
  const [mesicni, setMesicni] = useState('3000');
  const [roky, setRoky] = useState('20');
  const r = useMemo(() => investice.srovnejFormy(num(pocatecni), num(mesicni), Math.max(1, num(roky)), FORMY_INVESTIC), [pocatecni, mesicni, roky]);
  const nej = r[0]?.cistaHodnota || 1;
  return (
    <Karta ikona={<TrendingUp className="h-4 w-4 text-accent" />} titulek="Srovnání forem a poplatků" popis="Stejný vklad, různé poplatky → rozdíl ve výsledku.">
      <div className="grid grid-cols-3 gap-2">
        <Pole label="Jednorázově" value={pocatecni} set={setPocatecni} suffix="Kč" />
        <Pole label="Měsíčně" value={mesicni} set={setMesicni} suffix="Kč" />
        <Pole label="Horizont" value={roky} set={setRoky} suffix="let" />
      </div>
      <div className="mt-3 space-y-2">
        {r.map((s) => (
          <div key={s.nazev}>
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-slate-800">{s.poradi}. {s.nazev} <span className="text-slate-400 font-normal">(TER {pct(s.ter)})</span></span>
              <span className="font-bold text-slate-800">{f(s.cistaHodnota)} Kč</span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden mt-0.5">
              <div style={{ width: `${(s.cistaHodnota / nej) * 100}%` }} className={s.poradi === 1 ? 'h-2 bg-green-500' : 'h-2 bg-primary-400'} />
            </div>
            <div className="text-[10px] text-slate-400">ztráta na poplatcích: {f(s.ztrataNaPoplatcichVsHrube)} Kč</div>
          </div>
        ))}
      </div>
    </Karta>
  );
}

// ── RENTA & PENZE ────────────────────────────────────────────────────────────
function RentaKalk() {
  const init = useContext(KalkInitCtx);
  const [renta, setRenta] = useState('30000');
  const [statni, setStatni] = useState(() => init.rentaStatni ?? '18000');
  const [roky, setRoky] = useState('25');
  const [nasporeno, setNasporeno] = useState(() => init.rentaNasporeno ?? '200000');
  const r = useMemo(() => {
    const let_ = Math.max(0, num(roky));
    const potreba = Math.max(0, num(renta) - num(statni));
    const majetek = penze.majetekProRentu(potreba);
    // Akumulační fáze: výnos dle horizontu (konzistentní s ostatními kalkulačkami).
    const vynos = investice.ocekavanyVynosDleHorizontu(let_);
    const ki = investice.kolikInvestovat(majetek, let_, vynos, num(nasporeno));
    return { majetek, vynos, ...ki };
  }, [renta, statni, roky, nasporeno]);
  return (
    <Karta ikona={<Wallet className="h-4 w-4 text-accent" />} titulek="Renta / finanční nezávislost" popis="Pravidlo KFP ×200 (1 mil. = 5 000 Kč/měs).">
      <div className="grid grid-cols-2 gap-2">
        <Pole label="Cílová renta" value={renta} set={setRenta} suffix="Kč/měs" />
        <Pole label="Státní penze" value={statni} set={setStatni} suffix="Kč/měs" />
        <Pole label="Za" value={roky} set={setRoky} suffix="let" />
        <Pole label="Naspořeno" value={nasporeno} set={setNasporeno} suffix="Kč" />
      </div>
      <Hlavni label="Potřebný majetek" hodnota={`${f(r.majetek)} Kč`} />
      <div className="mt-2">
        <Radek label="Spořit měsíčně" hodnota={`${f(r.mesicni)} Kč`} />
        <Radek label="Nebo jednorázově dnes" hodnota={`${f(r.jednorazove)} Kč`} />
      </div>
    </Karta>
  );
}

function PenzeKalk() {
  const init = useContext(KalkInitCtx);
  const [vek, setVek] = useState(() => init.penzeVek ?? '35');
  const [vekOdchodu, setVekOdchodu] = useState(() => init.penzeOdchod ?? '65');
  const [nasporeno, setNasporeno] = useState(() => init.penzeNasporeno ?? '150000');
  const [vlastni, setVlastni] = useState(() => init.penzeVlastni ?? '1700');
  const [zamestnavatel, setZamestnavatel] = useState('0');
  const [vynos, setVynos] = useState('3'); // % reálně p.a. — volitelné dle strategie fondu
  const neplatnyVek = num(vekOdchodu) <= num(vek);
  const r = useMemo(() => penze.projekcePenze({
    aktualniKapital: num(nasporeno), vlastniPrispevek: num(vlastni), prispevekZamestnavatele: num(zamestnavatel),
    rocniVynos: num(vynos) / 100, aktualniVek: num(vek), vekOdchodu: num(vekOdchodu),
  }), [vek, vekOdchodu, nasporeno, vlastni, zamestnavatel, vynos]);
  return (
    <Karta ikona={<PiggyBank className="h-4 w-4 text-accent" />} titulek="Penze / DPS" popis="Doplňkové penzijní spoření vč. státního příspěvku.">
      <div className="grid grid-cols-3 gap-2">
        <Pole label="Věk" value={vek} set={setVek} />
        <Pole label="Odchod" value={vekOdchodu} set={setVekOdchodu} suffix="let" />
        <Pole label="Naspořeno" value={nasporeno} set={setNasporeno} suffix="Kč" />
        <Pole label="Vlastní" value={vlastni} set={setVlastni} suffix="Kč/měs" />
        <Pole label="Zaměstnavatel" value={zamestnavatel} set={setZamestnavatel} suffix="Kč/měs" />
        <Pole label="Výnos" value={vynos} set={setVynos} suffix="% reálně" />
      </div>
      <p className="text-[10px] text-slate-400 mt-1">Výnos reálně (nad inflaci) p.a. — konzervativní fond ~1–2 %, dynamická strategie ~4–5 %.</p>
      {neplatnyVek && <p role="alert" className="text-[11px] text-red-600 mt-1.5">Věk odchodu musí být vyšší než aktuální věk.</p>}
      <Hlavni label="Kapitál k důchodu (reálně)" hodnota={`${f(r.nasporenyKapital)} Kč`} />
      <div className="mt-2">
        <Radek label="Měsíčně spoří celkem" hodnota={`${f(r.celkemMesicneSpori)} Kč`} />
        <Radek label="Z toho státní příspěvek" hodnota={`${f(r.mesicniStatniPrispevek)} Kč`} />
        <Radek label="Z toho výnos" hodnota={`${f(r.vynosCelkem)} Kč`} />
      </div>
    </Karta>
  );
}

function DanovaUsporaKalk() {
  const [dps, setDps] = useState('1700');
  const [zp, setZp] = useState('1000');
  const SAZBA_DANE = 0.15;
  const LIMIT_ODPOCTU = 48000; // společný roční strop DPS+ŽP+… (orientačně, reforma 2024)
  const r = useMemo(() => {
    // U DPS je daňově odpočitatelná část NAD 1 700 Kč/měs (do 1 700 jede státní příspěvek).
    const dpsRocniOdpocet = Math.max(0, num(dps) - 1700) * 12;
    const zpRocniOdpocet = num(zp) * 12;
    const odpocet = Math.min(LIMIT_ODPOCTU, dpsRocniOdpocet + zpRocniOdpocet);
    const uspora = odpocet * SAZBA_DANE;
    const statniRocni = penze.statniPrispevekDPS(num(dps)) * 12;
    return { odpocet, uspora, statniRocni, dpsRocniOdpocet, zpRocniOdpocet };
  }, [dps, zp]);
  return (
    <Karta ikona={<Landmark className="h-4 w-4 text-accent" />} titulek="Daňová úspora (DPS + ŽP)" popis="Roční úspora na dani z příspěvků (orientačně, limity 2024).">
      <div className="grid grid-cols-2 gap-2">
        <Pole label="Příspěvek DPS" value={dps} set={setDps} suffix="Kč/měs" />
        <Pole label="Příspěvek ŽP" value={zp} set={setZp} suffix="Kč/měs" />
      </div>
      <Hlavni label="Roční úspora na dani (15 %)" hodnota={`${f(r.uspora)} Kč`} barva="text-green-600" />
      <div className="mt-2">
        <Radek label="Odečitatelná částka (ročně)" hodnota={`${f(r.odpocet)} Kč`} />
        <Radek label="Státní příspěvek DPS (ročně)" hodnota={`${f(r.statniRocni)} Kč`} />
      </div>
      <p className="text-[10px] text-slate-400 mt-1">DPS odečet jen z části nad 1 700 Kč/měs; společný strop {f(48000)} Kč/rok. Ověřte aktuální legislativu.</p>
    </Karta>
  );
}

// ── POJIŠTĚNÍ & REZERVA ──────────────────────────────────────────────────────
function PojistnaKalk() {
  const [prijem, setPrijem] = useState('50000');
  const [vek, setVek] = useState('38');
  const [deti, setDeti] = useState('2');
  const [sezdany, setSezdany] = useState(true);
  const [hypoteka, setHypoteka] = useState('2500000');
  const [majetek, setMajetek] = useState('0');
  const r = useMemo(() => {
    const efpa = pojisteni.pojistnaPotreba_EFPA({
      mesicniDeficitSmrt: Math.round(num(prijem) * 0.8), mesicniDeficitInvalidita: Math.round(num(prijem) * 1.2),
      pocetDeti: num(deti), sezdany, soucasnyMajetek: num(majetek),
    });
    const edo = pojisteni.pojistnaPotreba_eDO({ mesicniCistyPrijem: num(prijem), vek: num(vek) });
    const dime = pojisteni.pojistnaPotreba_DIME({
      dluhy: 0, mesicniPrijem: num(prijem), rokyNahradyPrijmu: num(deti) > 0 ? 18 : 5,
      hypoteka: num(hypoteka), nakladyNaDeti: num(deti) * 600000, jizKDispozici: num(majetek),
    });
    return { efpa, edo, dime };
  }, [prijem, vek, deti, sezdany, hypoteka, majetek]);
  return (
    <Karta ikona={<ShieldCheck className="h-4 w-4 text-accent" />} titulek="Pojistná potřeba" popis="Tři metody vedle sebe: EFPA, praxe eDO, DIME.">
      <div className="grid grid-cols-3 gap-2">
        <Pole label="Čistý příjem" value={prijem} set={setPrijem} suffix="Kč/měs" />
        <Pole label="Věk" value={vek} set={setVek} />
        <Pole label="Počet dětí" value={deti} set={setDeti} />
        <Pole label="Hypotéka" value={hypoteka} set={setHypoteka} suffix="Kč" />
        <Pole label="Majetek/úspory" value={majetek} set={setMajetek} suffix="Kč" />
        <label className="flex items-center gap-2 text-sm text-slate-700 mt-5">
          <input type="checkbox" checked={sezdany} onChange={(e) => setSezdany(e.target.checked)} className="h-4 w-4" /> Sezdaný/á
        </label>
      </div>
      <table className="w-full text-sm mt-3">
        <thead><tr className="text-slate-400 text-left text-xs"><th className="font-semibold">Metoda</th><th className="font-semibold text-right">Smrt</th><th className="font-semibold text-right">Invalidita</th></tr></thead>
        <tbody className="text-slate-700">
          <tr><td>EFPA (×200 − dávky)</td><td className="text-right font-semibold">{f(r.efpa.smrt)}</td><td className="text-right font-semibold">{f(r.efpa.invalidita)}</td></tr>
          <tr><td>eDO (3× příjem)</td><td className="text-right">{f(r.edo.smrt)}</td><td className="text-right">{f(r.edo.invalidita)}</td></tr>
          <tr><td>DIME (celkem)</td><td className="text-right" colSpan={2}>{f(r.dime.doporucenaPojistnaCastka)} Kč</td></tr>
        </tbody>
      </table>
      <div className="text-[11px] text-slate-500 mt-1">eDO závažná onem. {f(r.edo.zavazneOnemocneni)} Kč · TNÚ {f(r.efpa.trvaleNasledkyUrazu)} Kč</div>
    </Karta>
  );
}

function RezervaKalk() {
  const [vydaje, setVydaje] = useState('35000');
  const [nasporeno, setNasporeno] = useState('80000');
  const r = useMemo(() => ({ urovne: pojisteni.rezervaUrovne(num(vydaje)), zaklad: pojisteni.rezerva(num(vydaje), 6, num(nasporeno)) }), [vydaje, nasporeno]);
  return (
    <Karta ikona={<Wallet className="h-4 w-4 text-accent" />} titulek="Likvidní rezerva" popis="Doporučení KFP: 6× výdaje (úrovně 3/6/12×).">
      <div className="grid grid-cols-2 gap-2">
        <Pole label="Měsíční výdaje" value={vydaje} set={setVydaje} suffix="Kč" />
        <Pole label="Naspořeno" value={nasporeno} set={setNasporeno} suffix="Kč" />
      </div>
      <Hlavni label="Doporučená rezerva (6×)" hodnota={`${f(r.zaklad.doporucenaRezerva)} Kč`} barva={r.zaklad.chybiDoRezervy > 0 ? 'text-amber-600' : 'text-green-600'} />
      <div className="mt-2">
        <Radek label="Chybí do rezervy" hodnota={`${f(r.zaklad.chybiDoRezervy)} Kč`} />
        <Radek label="Krátkodobá (3×)" hodnota={`${f(r.urovne.kratkodoba)} Kč`} />
        <Radek label="Ztráta práce (6×)" hodnota={`${f(r.urovne.ztrataPrace)} Kč`} />
        <Radek label="Dlouhodobá nemoc (12×)" hodnota={`${f(r.urovne.dlouhodobaNemoc)} Kč`} />
      </div>
    </Karta>
  );
}

// ── Stránka ──────────────────────────────────────────────────────────────────
const ZALOZKY = [
  { id: 'uvery', nazev: 'Úvěry', ikona: Home, kalk: [HypotekaKalk, MaxUverKalk, RefinancKalk] },
  { id: 'investice', nazev: 'Investice', ikona: TrendingUp, kalk: [ProjekceKalk, CilKalk, SrovnaniForemKalk] },
  { id: 'renta', nazev: 'Renta & penze', ikona: PiggyBank, kalk: [RentaKalk, PenzeKalk, DanovaUsporaKalk] },
  { id: 'pojisteni', nazev: 'Pojištění & rezerva', ikona: ShieldCheck, kalk: [PojistnaKalk, RezervaKalk] },
];

export default function KalkulackyPage() {
  const [zalozka, setZalozka] = useState('uvery');
  const aktivni = ZALOZKY.find((z) => z.id === zalozka) ?? ZALOZKY[0];

  // Předvyplnění z aktivního případu klienta. `verze` = remount klíč kalkulaček.
  const { pripad, nacteno } = usePripad();
  const maPripad = nacteno && !jePripadPrazdny(pripad);
  const [init, setInit] = useState<KalkInit>({});
  const [verze, setVerze] = useState(0);
  const predvyplnit = () => { setInit(odvoditInit(pripad)); setVerze((v) => v + 1); };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-primary flex items-center gap-2">
          <Calculator className="h-7 w-7 text-accent" /> Kalkulačky
        </h1>
        <p className="mt-2 text-slate-600 text-sm max-w-3xl">
          Rychlé interaktivní výpočty bez nutnosti dat — počítají se živě dle metodiky eDO/KFP.
          Hodnoty si nastav sám; výsledek se přepočítá okamžitě. (Komplexní plán napříč pilíři najdeš v sekci Finanční plán.)
        </p>
      </div>

      {/* Lišta sdíleného případu — předvyplní relevantní kalkulačky z profilu klienta */}
      {maPripad && (
        <div className="print:hidden flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary-100 bg-primary-50/60 px-4 py-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-primary shadow-soft">
              <UserRound className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Případ klienta</div>
              <div className="text-sm font-semibold text-primary truncate">{popisPripadu(pripad)}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={predvyplnit}
            className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-primary hover:border-primary-200 transition-colors"
          >
            <UserCheck className="h-3.5 w-3.5" /> Předvyplnit z případu
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5 print:hidden">
        {ZALOZKY.map((z) => {
          const I = z.ikona;
          return (
            <button
              key={z.id}
              onClick={() => setZalozka(z.id)}
              className={`flex items-center gap-1.5 text-sm font-bold rounded-lg px-3 py-2 border transition-colors ${
                zalozka === z.id ? 'bg-primary text-white border-primary' : 'bg-white text-slate-600 border-slate-200 hover:border-primary-200'
              }`}
            >
              <I className={`h-4 w-4 ${zalozka === z.id ? 'text-accent' : ''}`} /> {z.nazev}
            </button>
          );
        })}
        <button
          onClick={() => window.print()}
          className="ml-auto flex items-center gap-1.5 text-sm font-bold rounded-lg px-3 py-2 bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100"
        >
          <Printer className="h-4 w-4 text-accent" /> Tisk
        </button>
      </div>

      <KalkInitCtx.Provider value={init}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {aktivni.kalk.map((K, i) => <K key={`${i}-${verze}`} />)}
        </div>
      </KalkInitCtx.Provider>

      <p className="text-[11px] text-slate-400">
        Orientační výpočty pro licencovaného poradce, nikoliv finanční doporučení. Výnosy jsou reálné (nad inflaci),
        částky v dnešní hodnotě peněz dle metodiky KFP.
      </p>
    </div>
  );
}
