// components/ui/Page.tsx
// Réguas de página do design system — 3 larguras, padding e cabeçalho únicos.
//   narrow  (720): formulários e leitura (perfil, configurações, revisão)
//   default (960): páginas comuns (home, hubs de conteúdo)
//   wide   (1080): dashboards e grades densas (agenda, performance, caderno)
// Use PageHeader logo dentro do PageContainer para título + subtítulo + ações.
'use client';

import type { CSSProperties, ReactNode } from 'react';
import { theme } from '@/lib/theme';
import { useUI } from '@/components/layout/UIContext';

const WIDTHS = { narrow: 720, default: 960, wide: 1080 } as const;

export type PageWidth = keyof typeof WIDTHS;

export function PageContainer({ width = 'default', children, style }: {
  width?: PageWidth;
  children: ReactNode;
  style?: CSSProperties;
}) {
  const { isMobile } = useUI();
  return (
    <div style={{
      maxWidth: WIDTHS[width],
      margin: '0 auto',
      padding: isMobile ? '20px 16px' : '34px 40px',
      fontFamily: theme.font,
      minWidth: 0,
      ...style,
    }}>
      {children}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, style }: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  style?: CSSProperties;
}) {
  const { isMobile } = useUI();
  return (
    <header style={{
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      gap: 16, flexWrap: 'wrap', marginBottom: 24, minWidth: 0,
      ...style,
    }}>
      <div style={{ minWidth: 0 }}>
        <h1 style={{ fontSize: isMobile ? 24 : 28, fontWeight: 800, color: theme.ink, letterSpacing: -0.6, margin: 0 }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{ fontSize: 14, color: theme.inkSoft, margin: '6px 0 0', fontWeight: 500, lineHeight: 1.5 }}>
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>{actions}</div>}
    </header>
  );
}
