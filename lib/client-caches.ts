'use client';
// lib/client-caches.ts
// Registro central dos caches singleton do browser (estado de nível de módulo).
//
// POR QUE ISSO EXISTE: authCache, archivedCache, primaryTargetCache e
// profileSettingsCache guardam dados DO USUÁRIO ATUAL em variáveis de módulo com
// TTL de 30–60 s. Esse estado sobrevive a logout/login na mesma aba. Cada ponto
// de saída (Topbar, Configurações → "encerrar em todos os dispositivos", troca de
// sessão por refresh de token) precisava lembrar de limpar os quatro — e não
// lembrava: só o logout da Topbar limpava, e só o archivedCache. Resultado: quem
// entrasse na conta B nos 30 s seguintes ao logout da conta A via o concurso-alvo
// e a meta diária de A.
//
// Regra: NÃO limpe caches à mão nos componentes. Chame clearAllClientCaches().
// Ao criar um cache singleton novo, registre o invalidador aqui.

import { clearAuthCache } from '@/lib/supabase/authCache';
import { invalidateArchivedCache } from '@/services/archivedCache';
import { invalidatePrimaryTargetCache } from '@/services/primaryTargetCache';
import { invalidateProfileSettingsCache } from '@/services/profileSettingsCache';
import { invalidateCatalogCache } from '@/services/catalog.service';

export function clearAllClientCaches(): void {
  clearAuthCache();
  invalidateArchivedCache();
  invalidatePrimaryTargetCache();
  invalidateProfileSettingsCache();
  // O catálogo de matérias parece dado global, mas cada linha carrega
  // `is_activated`, que é do USUÁRIO — sem limpar, o Banco de Matérias mostrava
  // "já ativada" para matérias da conta anterior.
  invalidateCatalogCache();
}
