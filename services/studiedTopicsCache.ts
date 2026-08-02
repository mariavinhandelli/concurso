'use client';
// services/studiedTopicsCache.ts
// Auditoria de performance (02/08) — coverage.service e raiox.service faziam,
// cada um, a MESMA query de study_logs.topic_id (sem .limit(), risco de
// truncar em contas com histórico muito grande). Mesmo padrão de
// primaryTargetCache.ts: promise coalescing com TTL curto, singleton em
// memória do processo do browser. 'use client' é OBRIGATÓRIO — nunca importar
// de Server Component (vazaria tópicos estudados entre usuários no processo
// do servidor).
//
// TTL curto (15s, não 30s como o alvo primário) porque este dado muda a cada
// sessão de estudo registrada — invalidateStudiedTopicsCache() é chamado em
// refreshHomeAfterSession() para não servir um conjunto desatualizado logo
// após salvar uma sessão (mesmo cuidado de resetStudyDayTotalsInflight()).

import { createClient } from '@/lib/supabase/client';
import { getCachedUser } from '@/lib/supabase/authCache';

let _cache: Promise<Set<string>> | null = null;
let _expiry = 0;
let _cachedUserId: string | null = null;

export async function getStudiedTopicIds(): Promise<Set<string>> {
  // Achado da auditoria de isolamento (02/08): a checagem de usuário rodava só
  // dentro da fetchPromise nova — enquanto o TTL de 15s não expirava, o cache
  // era servido sem nunca confirmar de quem é. Agora o usuário é resolvido
  // ANTES de decidir se o cache em memória pode ser reaproveitado.
  const user = await getCachedUser();
  if (!user) {
    invalidateStudiedTopicsCache();
    return new Set<string>();
  }
  if (_cachedUserId !== user.id) {
    _cache = null;
    _expiry = 0;
    _cachedUserId = user.id;
  }
  const now = Date.now();
  if (_cache && now < _expiry) return _cache;
  _expiry = now + 15_000;
  const fetchPromise = (async () => {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('get_studied_topic_ids');
    if (error) throw new Error('Erro ao buscar tópicos estudados: ' + error.message);
    const rows = (data ?? []) as { topic_id: string }[];
    return new Set(rows.map((r) => r.topic_id));
  })();
  _cache = fetchPromise;
  fetchPromise.catch(() => {
    if (_cache === fetchPromise) _cache = null;
  });
  return fetchPromise;
}

export function invalidateStudiedTopicsCache(): void {
  _cache = null;
  _cachedUserId = null;
}
