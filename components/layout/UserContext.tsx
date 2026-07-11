// Fonte única de verdade para os dados do usuário autenticado.
// Carregado uma vez no topo do (app) layout e compartilhado com todos os consumers
// (Topbar, page.tsx, profile) — elimina as chamadas independentes a auth.getUser().
'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';

function isHttpsUrl(url: unknown): url is string {
  if (typeof url !== 'string') return false;
  try { return new URL(url).protocol === 'https:'; } catch { return false; }
}

interface UserState {
  name: string;
  email: string | null;
  avatarUrl: string | null;
  /* false até a primeira resposta do getUser() — permite skeleton em vez de fallback "?" */
  loaded: boolean;
  refreshUser: () => Promise<void>;
}

const UserContext = createContext<UserState | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Busca o usuário via getUser() — valida o token com o servidor. Usado tanto
  // na leitura inicial quanto em refreshUser (chamado explicitamente após mutations).
  const refreshUser = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) return;
      const meta = u.user_metadata ?? {};
      const display = meta.display_name || meta.full_name || meta.name || '';
      setName(display ? String(display).split(' ')[0].slice(0, 40) : '');
      setEmail(u.email ?? null);
      setAvatarUrl(isHttpsUrl(meta.avatar_url) ? meta.avatar_url : null);
    } catch { /* silencioso — contexto de usuário é best-effort */ }
    finally { setLoaded(true); }
  }, []);

  useEffect(() => { refreshUser(); }, [refreshUser]);

  return (
    <UserContext.Provider value={{ name, email, avatarUrl, loaded, refreshUser }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser(): UserState {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser deve ser usado dentro de <UserProvider>');
  return ctx;
}
