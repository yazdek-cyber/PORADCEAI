'use client';

import { useState, useMemo } from 'react';
import { Calculator, Home, TrendingUp, PiggyBank, ShieldCheck, Target, Landmark, Wallet } from 'lucide-react';
import { uvery, investice, penze, pojisteni } from '@/lib/kalkulacky';

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

function AlokacePruh({ a }: { a: investice.Alokace }) {
  return (
    <div className="mt-2">
      <div className="flex h-2.5 w-full overflow-hidden rounded-full">
        <div style={{ width: `${a.akcie * 100}%` }} className="bg-primary" />
        <div style={{ width: `${a.dluhopisy * 100}%` }} className="bg-accent" />
        <div style={{ width: `${a.hotovost * 100}%` }} className="bg-slate-300" />
      </div>
      <div className="mt-1 text-[10px] text-slate-500">Akcie {pct(a.akcie)} · Dluhopisy {pct(a.dluhopisy)} · Hotovost {pct(a.hotovost)}</div>
    </div>
  );
}

// ── ÚVĚRY ───────────────────────────────────────────────────────────────────
function HypotekaKalk() {
  const [jistina, setJistina] = useState('3000000');
  const [sazba, setSazba] = useState('4.9');
  const [roky, setRoky] = useState('30');
  const r = useMemo(() => uvery.splatkovyKalendar(num(jistina), num(sazba) / 100, Math.max(1, num(roky)) * 12), [jistina, sazba, roky]);
  return (
    <Karta ikona={<Home className="h-4 w-4 text-accent" />} titulek="Hypoteční splátka" popis="Anuitní splátka a přeplatek úvěru.">
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
    </Karta>
  );
}

function MaxUverKalk() {
  const [prijem, setPrijem] = useState('50000');
  const [splatky, setSplatky] = useState('0');
  const [sazba, setSazba] = useState('4.9');
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
    const vynos = investice.ocekavanyVynosCile(let_);
    const mc = investice.monteCarloProjekce({
      pocatecni: num(pocatecni), mesicniVklad: num(mesicni), roky: let_,
      ocekavanyVynos: vynos, volatilita: investice.volatilitaPortfolia(alokace), seed: 12345,
    });
    const vlozeno = num(pocatecni) + num(mesicni) * let_ * 12;
    return { alokace, vynos, mc, vlozeno };
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
      <AlokacePruh a={r.alokace} />
    </Karta>
  );
}

function CilKalk() {
  const [cil, setCil] = useState('500000');
  const [roky, setRoky] = useState('15');
  const [nasporeno, setNasporeno] = useState('0');
  const r = useMemo(() => {
    const let_ = Math.max(0, num(roky));
    const vynos = investice.ocekavanyVynosCile(let_);
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
      <AlokacePruh a={r.alokace} />
    </Karta>
  );
}

// ── RENTA & PENZE ────────────────────────────────────────────────────────────
function RentaKalk() {
  const [renta, setRenta] = useState('30000');
  const [statni, setStatni] = useState('18000');
  const [roky, setRoky] = useState('25');
  const [nasporeno, setNasporeno] = useState('200000');
  const r = useMemo(() => {
    const let_ = Math.max(0, num(roky));
    const potreba = Math.max(0, num(renta) - num(statni));
    const majetek = penze.majetekProRentu(potreba);
    const vynos = investice.ocekavanyVynosCile(let_);
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
  const [vek, setVek] = useState('35');
  const [vekOdchodu, setVekOdchodu] = useState('65');
  const [nasporeno, setNasporeno] = useState('150000');
  const [vlastni, setVlastni] = useState('1700');
  const [zamestnavatel, setZamestnavatel] = useState('0');
  const r = useMemo(() => penze.projekcePenze({
    aktualniKapital: num(nasporeno), vlastniPrispevek: num(vlastni), prispevekZamestnavatele: num(zamestnavatel),
    rocniVynos: 0.045, aktualniVek: num(vek), vekOdchodu: Math.max(num(vek) + 1, num(vekOdchodu)),
  }), [vek, vekOdchodu, nasporeno, vlastni, zamestnavatel]);
  return (
    <Karta ikona={<PiggyBank className="h-4 w-4 text-accent" />} titulek="Penze / DPS" popis="Doplňkové penzijní spoření vč. státního příspěvku.">
      <div className="grid grid-cols-3 gap-2">
        <Pole label="Věk" value={vek} set={setVek} />
        <Pole label="Odchod" value={vekOdchodu} set={setVekOdchodu} suffix="let" />
        <Pole label="Naspořeno" value={nasporeno} set={setNasporeno} suffix="Kč" />
        <Pole label="Vlastní" value={vlastni} set={setVlastni} suffix="Kč/měs" />
        <Pole label="Zaměstnavatel" value={zamestnavatel} set={setZamestnavatel} suffix="Kč/měs" />
      </div>
      <Hlavni label="Kapitál k důchodu (reálně)" hodnota={`${f(r.nasporenyKapital)} Kč`} />
      <div className="mt-2">
        <Radek label="Měsíčně spoří celkem" hodnota={`${f(r.celkemMesicneSpori)} Kč`} />
        <Radek label="Z toho státní příspěvek" hodnota={`${f(r.mesicniStatniPrispevek)} Kč`} />
        <Radek label="Z toho výnos" hodnota={`${f(r.vynosCelkem)} Kč`} />
      </div>
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
  { id: 'investice', nazev: 'Investice', ikona: TrendingUp, kalk: [ProjekceKalk, CilKalk] },
  { id: 'renta', nazev: 'Renta & penze', ikona: PiggyBank, kalk: [RentaKalk, PenzeKalk] },
  { id: 'pojisteni', nazev: 'Pojištění & rezerva', ikona: ShieldCheck, kalk: [PojistnaKalk, RezervaKalk] },
];

export default function KalkulackyPage() {
  const [zalozka, setZalozka] = useState('uvery');
  const aktivni = ZALOZKY.find((z) => z.id === zalozka) ?? ZALOZKY[0];
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

      <div className="flex flex-wrap gap-1.5">
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
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {aktivni.kalk.map((K, i) => <K key={i} />)}
      </div>

      <p className="text-[11px] text-slate-400">
        Orientační výpočty pro licencovaného poradce, nikoliv finanční doporučení. Výnosy jsou reálné (nad inflaci),
        částky v dnešní hodnotě peněz dle metodiky KFP.
      </p>
    </div>
  );
}
