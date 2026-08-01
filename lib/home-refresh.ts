// lib/home-refresh.ts
// Invalida as queries afetadas por uma sessão de estudo salva (timer, registro
// manual, quick log ou sessão passiva), para que o Plano de Hoje, o streak, as
// metas, as conquistas e os gráficos reflitam o progresso na hora.
//
// A LISTA DE CHAVES NÃO MORA MAIS AQUI: vive em lib/cache-invalidation.ts, no
// domínio 'session', junto com os outros domínios do app. Esta função continua
// existindo porque o nome diz a intenção no ponto de chamada — mas ela é só um
// atalho para invalidateAfter(qc, 'session').

import type { QueryClient } from '@tanstack/react-query';
import { invalidateAfter } from '@/lib/cache-invalidation';

export function refreshHomeAfterSession(queryClient: QueryClient): void {
  invalidateAfter(queryClient, 'session');
}
