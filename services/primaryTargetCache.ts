'use client';
// services/primaryTargetCache.ts
// H12 — coverage.service, raiox.service e suggestion.service faziam,
// cada um, a MESMA query (target_exams do usuário, ordenado por is_primary
// desc + created_at asc, limit 1) de forma independente — 3-4 leituras
// idênticas por carga da Home. Mesmo padrão de services/archivedCache.ts:
// promise coalescing com TTL curto, singleton em memória do processo do
// browser. 'use client' é OBRIGATÓRIO — nunca importar de Server Component
// (vazaria o alvo primário entre usuários no processo do servidor).
//
// Invalidar (invalidatePrimaryTargetCache) após qualquer escrita em
// target_exams que possa mudar QUEM é o alvo primário ou seus dados
// (orgao/cargo/slug): criar, promover a pós-edital, marcar como primário,
// arquivar, restaurar, excluir.

import { createClient } from '@/lib/supabase/client';
import { getCachedUser } from '@/lib/supabase/authCache';

export interface PrimaryTargetRow {
  id: string;
  orgao: string | null;
  cargo: string | null;
  slug: string;
}

let _cache: Promise<PrimaryTargetRow | null> | null = null;
let _expiry = 0;
let _cachedUserId: string | null = null;

export async function getPrimaryTargetExam(): Promise<PrimaryTargetRow | null> {
  const now = Date.now();
  if (_cache && now < _expiry) return _cache;
  _expiry = now + 30_000; // 30s — invalidação manual cobre as mutações relevantes
  const fetchPromise = (async () => {
    const user = await getCachedUser();
    if (!user) { _cachedUserId = null; return null; }
    if (_cachedUserId !== null && _cachedUserId !== user.id) {
      _cache = null;
      _expiry = 0;
    }
    _cachedUserId = user.id;
    const supabase = createClient();
    const { data } = await supabase
      .from('target_exams')
      .select('id, orgao, cargo, slug')
      .eq('user_id', user.id)
      .is('archived_at', null)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(1);
    return data?.[0] ?? null;
  })();
  _cache = fetchPromise;
  fetchPromise.catch(() => {
    if (_cache === fetchPromise) _cache = null;
  });
  return fetchPromise;
}

export function invalidatePrimaryTargetCache(): void {
  _cache = null;
  _cachedUserId = null;
}
