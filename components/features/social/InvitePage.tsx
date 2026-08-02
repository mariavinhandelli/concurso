// components/features/social/InvitePage.tsx
// Wrapper compartilhado das telas de convite por link (amigos/adicionar/[code]
// e turmas/entrar/[code]) — mesmo card, mesma largura (PageContainer narrow) e
// mesmos tokens de texto, para os dois fluxos gêmeos não divergirem de novo.
'use client';

import type { CSSProperties, ReactNode } from 'react';
import { PageContainer } from '@/components/ui/Page';
import { theme } from '@/lib/theme';

export function InvitePage({ children }: { children: ReactNode }) {
  return (
    <PageContainer width="narrow">
      <section style={inviteStyles.card}>{children}</section>
    </PageContainer>
  );
}

export const inviteStyles: Record<string, CSSProperties> = {
  card: { background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: theme.radius, boxShadow: theme.shadow, padding: 32, textAlign: 'center' },
  avatarBig: { width: 72, height: 72, borderRadius: '50%', background: theme.primary, color: theme.onTeal, display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 30, margin: '0 auto 14px' },
  h1: { fontSize: 22, fontWeight: 800, color: theme.ink, margin: '0 0 8px', letterSpacing: -0.4 },
  body: { fontSize: 15, color: theme.inkSoft, lineHeight: 1.6, margin: '0 0 18px' },
  note: { fontSize: 13, color: theme.inkFaint, lineHeight: 1.55, margin: '0 0 18px', background: theme.bg, border: `0.5px solid ${theme.line}`, borderRadius: theme.radiusSm, padding: '10px 12px' },
  strong: { color: theme.ink, fontWeight: 700 },
  code: { fontFamily: 'ui-monospace, monospace', fontWeight: 700, letterSpacing: 1, color: theme.ink },
  actions: { display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' },
  muted: { fontSize: 14, color: theme.inkFaint, textAlign: 'center', margin: 0 },
};
