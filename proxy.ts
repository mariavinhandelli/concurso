// proxy.ts
// Protege todas as rotas da aplicação: redireciona para /login se não autenticado.
// Também refresca o token Supabase nas cookies a cada request (necessário para SSR).

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

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
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          // Propaga headers de cache-control que o Supabase exige ao renovar tokens.
          Object.entries(headers ?? {}).forEach(([key, value]) =>
            response.headers.set(key, value),
          );
        },
      },
    },
  );

  // Valida o token com o servidor (getUser — não usa getSession local).
  // O Supabase refresha o token se necessário e escreve nas cookies via setAll acima.
  // Fail open: se o Supabase estiver inacessível, não bloqueia a navegação.
  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    return response;
  }

  const { pathname } = request.nextUrl;
  const isLoginPage = pathname === '/login' || pathname.startsWith('/login/');
  const isResetPasswordPage = pathname === '/reset-password' || pathname.startsWith('/reset-password/');
  // Páginas legais são públicas (indexáveis, linkadas do cadastro): não exigem login.
  const isPublicPage = pathname === '/termos' || pathname === '/privacidade';

  if (!user && !isLoginPage && !isResetPasswordPage && !isPublicPage) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.search = '';
    loginUrl.searchParams.set('returnTo', pathname + request.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  if (user && isLoginPage) {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = '/';
    return NextResponse.redirect(homeUrl);
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|sw\\.js|manifest\\.json|offline\\.html|.*\\.svg|.*\\.png|.*\\.webp|.*\\.ico).*)',
  ],
};
