// components/features/social/SocialStatsSync.tsx
// N11 — mantém os agregados sociais (sequência, minutos, % edital) frescos:
// empurra os do próprio usuário ao carregar o app. É no-op se o perfil social
// não estiver ativo ou se não houver sessão. Montado uma vez no AppShell.
'use client';

import { useEffect } from 'react';
import { pushMyStats, syncMySocialIdentity } from '@/services/social.service';

export function SocialStatsSync() {
  useEffect(() => {
    // Números e identidade (nome + foto) andam juntos: sem o segundo, trocar a
    // foto no perfil não mudava nada do que os amigos viam.
    pushMyStats().catch(() => { /* silencioso — sync social é best-effort */ });
    syncMySocialIdentity().catch(() => { /* idem */ });
  }, []);
  return null;
}
