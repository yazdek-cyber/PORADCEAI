# Nasazení na Vercel

Aplikace je Next.js 16 (App Router, Turbopack). Na Vercelu běží bez speciální konfigurace;
crony a env proměnné níže.

## 1. Env proměnné (Vercel → Project → Settings → Environment Variables)
Nastav pro **Production** (a ideálně i Preview):

| Proměnná | Kde vzít | Pozn. |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | veřejné |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | tamtéž (anon/public) | veřejné |
| `SUPABASE_SERVICE_ROLE_KEY` | tamtéž (service_role) | **TAJNÉ**, nikdy ne `NEXT_PUBLIC_` |
| `GEMINI_API_KEY` | Google AI Studio (Tier 1) | TAJNÉ |
| `CRON_SECRET` | vygeneruj náhodný řetězec | TAJNÉ; bez něj je cron 503 |

> Hodnoty máš v `.env.local` (vyjma `CRON_SECRET`, ten vygeneruj). Vzor je v `.env.example`.

## 2. Deploy — dvě varianty

### A) GitHub → Vercel (doporučeno, auto-deploy)
1. Vytvoř **privátní** GitHub repo a pushni:
   ```bash
   git remote add origin git@github.com:<ty>/poradcea-ai.git
   git push -u origin main
   ```
   `.gitignore` chrání `.env*` a `.vercel` — tajné klíče se nepushnou.
2. Ve Vercelu *Add New → Project → Import* ten repo. Framework se detekuje (Next.js).
3. Doplň env proměnné (krok 1) a *Deploy*.

### B) Vercel CLI (bez GitHubu)
```bash
npm i -g vercel
vercel login
vercel            # první nasazení (preview)
vercel --prod     # produkce
```
Env proměnné nastav přes dashboard nebo `vercel env add`.

## 3. Po prvním deployi
- **Supabase → Authentication → URL Configuration**: do *Site URL* / *Redirect URLs* přidej produkční doménu
  (`https://<projekt>.vercel.app`). Pro e-mail/heslo login to není kritické (neposíláme magic linky), ale je to čisté.
- **Cron**: `vercel.json` plánuje denní sken podmínek po pojišťovnách (06:00–06:50). Funguje jen s `CRON_SECRET`.
- Ověř: otevři doménu → přesměruje na `/login` → přihlas se (`dominik.klimek@edofinance.cz`).

## 4. Bezpečnost (stav)
- `klienti` a `financni_plany` jsou izolované **per poradce** (RLS `poradce_id = auth.uid()`).
- Sdílená znalostní báze (`dokumenty`/`chunky`/`produkty`/`workspaces`) je zatím permisivní (přístup jen přes
  server service-role). Follow-up: zúžit na authenticated-read / service-write.
- Doporučeno: v Supabase zapnout *Leaked Password Protection* a po prvním loginu změnit heslo.
