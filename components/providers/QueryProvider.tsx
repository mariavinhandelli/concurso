'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { clearAuthCache } from '@/lib/supabase/authCache';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            gcTime: 10 * 60_000,
            retry: 1,
          },
        },
      }),
  );

  // Segurança multiusuário: o cache do React Query sobrevive a logout/login na
  // mesma aba. Sem esta limpeza, dados do usuário anterior (retomada, metas,
  // onboarding-status…) vazam para a conta seguinte até o staleTime vencer —
  // ex.: usuário novo via "Bem-vindo de volta, foram N dias" do dono anterior.
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
        clearAuthCache();
        client.clear();
      }
    });
    return () => subscription.unsubscribe();
  }, [client]);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
