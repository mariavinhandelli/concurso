'use client';
// services/archivedCache.ts
// Cache em memória dos IDs de matérias arquivadas do usuário atual.
//
// ⚠️  RISCO ARQUITETURAL — LEIA ANTES DE MODIFICAR:
// 'use client' é OBRIGATÓRIO e não pode ser removido.
// Esse módulo usa estado de nível de módulo (singleton em memória).
// Se importado por um Server Component ou Server Action, o cache passa a ser
// COMPARTILHADO entre todos os usuários simultâneos no processo do servidor —
// vazamento grave de dados entre usuários.
// Se precisar desse dado em contexto server-side, use uma query direta
// com o userId do request, nunca este módulo.
//
// Promise coalescing com TTL de 60 s: chamadas paralelas na mesma renderização
// compartilham a mesma promise e fazem apenas 1 round-trip ao banco.
// Chamar invalidateArchivedCache() após qualquer operação de archive/unarchive.

import { createClient } from '@/lib/supabase/client';
import { getCachedUser } from '@/lib/supabase/authCache';

let _archivedCache: Promise<string[]> | null = null;
let _archivedCacheExpiry = 0;
let _cachedUserId: string | null = null;

export async function getArchivedSubjectIds(): Promise<string[]> {
  const now = Date.now();
  if (_archivedCache && now < _archivedCacheExpiry) return _archivedCache;
  _archivedCacheExpiry = now + 60_000; // 60s — invalidação manual já existe em archive/unarchive
  const fetchPromise = (async () => {
    const supabase = createClient();
    // getCachedUser evita um getUser() de rede por carga — mesma fonte dos services.
    const user = await getCachedUser();
    if (!user) {
      _cachedUserId = null;
      return [];
    }
    // Invalida automaticamente se o usuário mudou (ex: logout → login de outro usuário)
    if (_cachedUserId !== null && _cachedUserId !== user.id) {
      _archivedCache = null;
      _archivedCacheExpiry = 0;
    }
    _cachedUserId = user.id;
    const { data } = await supabase
      .from('subjects')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'arquivado');
    return (data ?? []).map((s) => s.id);
  })();
  _archivedCache = fetchPromise;
  fetchPromise.catch(() => {
    if (_archivedCache === fetchPromise) _archivedCache = null;
  });
  return fetchPromise;
}

export function invalidateArchivedCache(): void {
  _archivedCache = null;
  _cachedUserId = null;
}
