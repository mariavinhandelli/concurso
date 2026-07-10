// lib/supabase/authCache.ts
// Perf F2: reduz os round-trips de auth. supabase.auth.getUser() bate na rede a
// cada chamada (valida o token no servidor) e a Home dispara ~15-20 por load,
// serializados por navigator.locks. getSession() lê a sessão local (sem rede) — e
// o client renova o token em background. Aqui cacheamos o usuário por um TTL curto
// e deduplicamos chamadas concorrentes (uma só resolução para N chamadas do mesmo
// tick de render). Invalida no onAuthStateChange (login/logout/refresh).
//
// Segurança: usar getSession (em vez de getUser) é seguro para este app porque a
// autorização real é a RLS no servidor — writes usam `with check (auth.uid()=user_id)`,
// avaliado a partir do JWT; um user_id local adulterado não passa.

import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

const TTL_MS = 30_000;

let cached: { user: User | null; at: number } | null = null;
let inflight: Promise<User | null> | null = null;
let subscribed = false;

function ensureSubscription(supabase: ReturnType<typeof createClient>) {
  if (subscribed) return;
  subscribed = true;
  // Qualquer mudança de auth zera o cache (login, logout, token refresh).
  supabase.auth.onAuthStateChange(() => { cached = null; inflight = null; });
}

export async function getCachedUser(): Promise<User | null> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.user;
  if (inflight) return inflight;

  inflight = (async () => {
    const supabase = createClient();
    ensureSubscription(supabase);
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user ?? null;
    cached = { user, at: Date.now() };
    inflight = null;
    return user;
  })();

  return inflight;
}

export function clearAuthCache() {
  cached = null;
  inflight = null;
}
