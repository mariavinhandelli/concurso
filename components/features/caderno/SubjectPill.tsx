// components/features/caderno/SubjectPill.tsx
// Item de listagem de matéria (dot colorido + nome + contagem), compartilhado
// entre as abas Anotações e Erros do hub Caderno — antes cada aba tinha seu
// próprio design (pill vs. card), agora as duas usam este mesmo componente.
'use client';

import type { CSSProperties } from 'react';
import { theme } from '@/lib/theme';

export function SubjectPill({
  color, name, count, alwaysShowCount, active, onClick, className, style,
}: {
  color?: string | null;
  name: string;
  count?: number;
  /** Mostra o badge mesmo quando count é 0 (ex.: pill "Todas"), em vez de escondê-lo. */
  alwaysShowCount?: boolean;
  active?: boolean;
  onClick: () => void;
  className?: string;
  style?: CSSProperties;
}) {
  const showCount = alwaysShowCount ? count !== undefined : !!count;
  return (
    <button
      className={className}
      onClick={onClick}
      style={{ ...s.item, ...(active ? s.itemOn : {}), ...style }}
    >
      {color && <span style={{ ...s.dot, background: color }} />}
      <span style={s.name}>{name}</span>
      {showCount && <span style={s.count}>{count}</span>}
    </button>
  );
}

const s: Record<string, CSSProperties> = {
  item: { display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left', padding: '8px 10px', borderRadius: 9, border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', minWidth: 0, flexShrink: 0, whiteSpace: 'nowrap' },
  itemOn: { background: theme.tealBg },
  dot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  name: { fontSize: 13, fontWeight: 600, color: theme.ink, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 },
  count: { fontSize: 12, color: theme.inkFaint, flexShrink: 0, fontVariantNumeric: 'tabular-nums' },
};
