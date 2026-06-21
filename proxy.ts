// Next 16 PROXY (dříve „middleware"). Obnovuje Supabase session na každém requestu, aby
// nevypršela (refresh tokenu) a cookies byly aktuální pro Server Components/Actions.
//
// POZOR — GATING (přesměrování nepřihlášených na /login) je zatím VYPNUTÉ. Zapne se až poté,
// co bude v Supabase zapnutý Auth provider a vytvořený první uživatel (jinak by se nikdo nedostal
// do appky). Do té doby proxy jen udržuje session, nic neblokuje. Viz NOCNI-BACKLOG / POKROK.
import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const AUTH_GATING = true; // Auth zapnutý (Supabase email/heslo) → nepřihlášení jdou na /login
const VEREJNE = ['/login']; // routy dostupné bez přihlášení

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  // getUser() ověří token proti Auth serveru a (díky setAll výše) obnoví session cookies.
  const { data: { user } } = await supabase.auth.getUser();

  if (AUTH_GATING) {
    const path = request.nextUrl.pathname;
    const jeVerejna = VEREJNE.some((p) => path === p || path.startsWith(p + '/'));
    if (!user && !jeVerejna) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }
    if (user && path === '/login') {
      const url = request.nextUrl.clone();
      url.pathname = '/';
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  // Spouštět všude kromě statiky a obrázků (jinak by proxy běžela i na _next/static apod.).
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
