'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { clearAllClientCaches } from '@/lib/client-caches';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            gcTime: 10 * 60_000,
            retry: 1,
            // Auditoria de performance (02/08) — refetchOnWindowFocus (default
            // true no RQ v5) + staleTime de 60s em ~40 queries: qualquer
            // alt-tab/troca de aba após 60s de inatividade disparava um burst
            // de refetches em toda tela montada. O app já invalida
            // explicitamente após mutações (lib/cache-invalidation.ts,
            // invalidateAfter) — refetch por foco só duplicava tráfego.
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  // Segurança multiusuário: o cache do React Query E os caches singleton de
  // módulo (auth, arquivadas, alvo primário, settings do perfil) sobrevivem a
  // logout/login na mesma aba. Sem esta limpeza, dados do usuário anterior
  // (retomada, metas, onboarding-status, concurso-alvo…) vazam para a conta
  // seguinte até o TTL vencer — ex.: usuário novo via "Bem-vindo de volta, foram
  // N dias" do dono anterior, ou o edital do dono anterior no Raio-X.
  // Este handler é o ÚNICO ponto que precisa saber disso: vale para qualquer
  // caminho de saída (Topbar, Configurações, expiração de sessão).
  const lastUserId = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const uid = session?.user?.id ?? null;
      if (lastUserId.current === undefined) {
        lastUserId.current = uid; // primeira emissão: só registra o dono do cache
        return;
      }
      if (uid !== lastUserId.current) {
        lastUserId.current = uid;
        clearAllClientCaches();
        client.clear();
      }
    });
    return () => subscription.unsubscribe();
  }, [client]);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
