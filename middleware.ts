// middleware.ts
// Roda a cada navegação: mantém a sessão viva e protege rotas.

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Rotas acessíveis sem login (a pessoa que redefine senha não tem sessão normal).
const ROTAS_PUBLICAS = ['/login', '/reset-password'];

export async function middleware(request: NextRequest) {
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
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Verifica se a rota atual é pública.
  const rotaPublica = ROTAS_PUBLICAS.some((rota) =>
    request.nextUrl.pathname.startsWith(rota),
  );

  // Se não está logado e a rota não é pública → manda pro login.
  if (!user && !rotaPublica) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // Roda em tudo, menos arquivos estáticos e imagens.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};