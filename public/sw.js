// Service Worker — Focali PWA
// Estratégia: cache-first para assets estáticos, network-first para API/navegação.

const CACHE_NAME = 'focali-v1';

// Único asset pré-cacheado: é o único lido pelo fetch handler (fallback de
// navegação offline, abaixo). Páginas dinâmicas (/, /jurisprudencias) não são
// servidas do cache — a estratégia de navegação é network-first.
const PRECACHE_URLS = ['/offline.html'];

// Instala e pré-cacha
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).catch(() => {})
      .then(() => self.skipWaiting())
  );
});

// Ativa e limpa caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignora requisições não-HTTP (chrome-extension, etc.)
  if (!url.protocol.startsWith('http')) return;

  // Em desenvolvimento (localhost) não faz cache — chunks do Turbopack reutilizam nomes
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return;

  // Supabase API → network-first; retorna 503 em falha de rede para que o
  // cliente distinga "sem dados" de "falha real" (evita mascarar 401/403/500).
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(
      fetch(request).catch(() => new Response(null, { status: 503 }))
    );
    return;
  }

  // Arquivos _next/static → cache-first (imutáveis com hash)
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, clone));
        }
        return res;
      }))
    );
    return;
  }

  // Navegação de página → network-first, fallback para /offline.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match('/offline.html').then((r) => r || new Response('Você está offline.', { headers: { 'Content-Type': 'text/html' } }))
      )
    );
    return;
  }

  // Demais recursos (fontes, imagens, etc.) → stale-while-revalidate
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(request).then((cached) => {
        const fresh = fetch(request).then((res) => {
          if (res.ok) cache.put(request, res.clone());
          return res;
        }).catch(() => cached || new Response(null, { status: 503 }));
        return cached || fresh;
      })
    )
  );
});
