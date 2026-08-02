// components/ui/BackLink.tsx
// Link "← Voltar" único do design system — usado no topo de páginas de detalhe
// para retornar ao hub/lista anterior. Substitui as várias cópias de estilo
// inline que haviam divergido entre si em cor, padding e alvo de toque.
'use client';

import { useRouter } from 'next/navigation';
import type { CSSProperties, ReactNode } from 'react';
import { theme } from '@/lib/theme';

export function BackLink({ href, onClick, children, style }: {
  href?: string;
  onClick?: () => void;
  children: ReactNode;
  style?: CSSProperties;
}) {
  const router = useRouter();
  return (
    <button
      onClick={onClick ?? (() => { if (href) router.push(href); })}
      className="back-link touch-target"
      style={{
        border: 'none', background: 'transparent', color: theme.teal,
        fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
        padding: '10px 12px', marginBottom: 10, marginLeft: -12,
        minHeight: 44, display: 'inline-flex', alignItems: 'center',
        borderRadius: theme.radiusSm,
        ...style,
      }}
    >
      ← {children}
    </button>
  );
}
