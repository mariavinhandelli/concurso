// app/robots.ts
// Indexação: só as páginas públicas (Banco de Editais + legais). O resto do
// app é logado — crawler seria redirecionado para /login de qualquer forma.
import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/editais', '/termos', '/privacidade', '/login'],
        disallow: '/',
      },
    ],
    sitemap: 'https://www.focali.com.br/sitemap.xml',
  };
}
