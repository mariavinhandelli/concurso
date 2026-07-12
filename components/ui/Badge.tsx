// components/ui/Badge.tsx
// Primitivo de badge/pill do design system — substitui os 90+ objetos de
// estilo locais com borderRadius:999 repetidos por módulo.
import type { CSSProperties, ReactNode } from 'react';
import { theme } from '@/lib/theme';

export type BadgeVariant = 'neutral' | 'ok' | 'warn' | 'danger' | 'info' | 'brand';
export type BadgeTone = 'soft' | 'solid';

const SOFT: Record<BadgeVariant, CSSProperties> = {
  neutral: { background: theme.muted, color: theme.inkSoft },
  ok:      { background: theme.okBg, color: theme.okDeep },
  warn:    { background: theme.warnBg, color: theme.warnDeep },
  danger:  { background: theme.dangerBg, color: theme.danger },
  info:    { background: theme.infoBg, color: theme.info },
  brand:   { background: theme.tealBg, color: theme.tealDeep },
};

const SOLID: Record<BadgeVariant, CSSProperties> = {
  neutral: { background: theme.inkSoft, color: theme.card },
  ok:      { background: theme.ok, color: theme.onOk },
  warn:    { background: theme.warn, color: theme.onWarn },
  danger:  { background: theme.danger, color: theme.onDanger },
  info:    { background: theme.info, color: '#FFFFFF' },
  brand:   { background: theme.primary, color: theme.onPrimary },
};

interface Props {
  children: ReactNode;
  variant?: BadgeVariant;
  tone?: BadgeTone;
  style?: CSSProperties;
}

export function Badge({ children, variant = 'neutral', tone = 'soft', style }: Props) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 12, fontWeight: 700, lineHeight: 1,
      borderRadius: theme.radiusPill, padding: '4px 10px',
      whiteSpace: 'nowrap',
      ...(tone === 'soft' ? SOFT[variant] : SOLID[variant]),
      ...style,
    }}>
      {children}
    </span>
  );
}
