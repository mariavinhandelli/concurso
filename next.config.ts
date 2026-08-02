import type { NextConfig } from "next";

// P1-6 (auditoria de Amigos, 27/07) — o avatar de OUTRO usuário é renderizado
// como <img src> no ranking de amigos e turmas. Sem CSP, uma URL escolhida por
// terceiro vira beacon: cada pessoa que abrisse a tela entregaria IP e
// User-Agent ao servidor de quem escolheu a URL.
//
// De propósito só declaramos `img-src`. Uma CSP completa (script-src) exigiria
// plumbing de nonce no middleware do Next e quebraria a app se saísse errada;
// diretiva não declarada simplesmente não é aplicada, então esta política é
// segura de adicionar e fecha exatamente o vetor encontrado.
//   'self'  → imagens do próprio domínio
//   data:   → SVG/base64 inline
//   blob:   → preview de upload de avatar e o card compartilhável (createObjectURL)
//   *.supabase.co → Storage do projeto (avatares e uploads)
//
// O host vem literal, NÃO de NEXT_PUBLIC_SUPABASE_URL: a env não está garantida
// no momento em que este arquivo é avaliado, e derivá-la dali produzia
// silenciosamente uma CSP sem o Supabase — ou seja, avatar quebrado para todo
// mundo, sem erro em lugar nenhum. Um curinga a mais aqui é bem mais barato que
// esse modo de falha. O beacon para domínio arbitrário, que é o vetor real,
// continua bloqueado; a origem exata é fixada em sanitizeAvatarUrl.
const csp = "img-src 'self' data: blob: https://*.supabase.co";

const nextConfig: NextConfig = {
  // "/configuracoes" é o nome óbvio em pt-BR pra quem digita a URL de cabeça;
  // a rota real é "/settings" (convenção em inglês do resto do app) e sem
  // isto cai em 404 puro.
  async redirects() {
    return [
      { source: '/configuracoes', destination: '/settings', permanent: false },
    ];
  },
  async headers() {
    return [{
      source: '/:path*',
      headers: [{ key: 'Content-Security-Policy', value: csp }],
    }];
  },
  images: {
    remotePatterns: [
      {
        // Supabase Storage — avatares e uploads de usuários.
        protocol: 'https',
        hostname: 'krkbzeqwjrrxvdpwyqar.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        // Supabase Storage — signed URLs (bucket privado notebook-images).
        protocol: 'https',
        hostname: 'krkbzeqwjrrxvdpwyqar.supabase.co',
        pathname: '/storage/v1/object/sign/**',
      },
    ],
  },
};

export default nextConfig;
