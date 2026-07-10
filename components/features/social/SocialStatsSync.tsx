// components/features/social/SocialStatsSync.tsx
// N11 — mantém os agregados sociais (sequência, minutos, % edital) frescos:
// empurra os do próprio usuário ao carregar o app. É no-op se o perfil social
// não estiver ativo ou se não houver sessão. Montado uma vez no AppShell.
'use client';

import { useEffect } from 'react';
import { pushMyStats } from '@/services/social.service';

export function SocialStatsSync() {
  useEffect(() => {
    pushMyStats().catch(() => { /* silencioso — sync social é best-effort */ });
  }, []);
  return null;
}
