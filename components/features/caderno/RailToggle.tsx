// components/features/caderno/RailToggle.tsx
// Chip "+N matérias" / "Mostrar menos" que expande/colapsa o rail de filtros
// do Caderno (Anotações e Erros). Borda tracejada para não se confundir com
// as SubjectPill de filtro — é uma ação, não uma opção de filtro.
'use client';

import type { CSSProperties } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { theme } from '@/lib/theme';

export function RailToggle({ expanded, hiddenCount, onClick }: {
  expanded: boolean;
  hiddenCount: number;
  onClick: () => void;
}) {
  return (
    <button className="touch-target" onClick={onClick} style={s.item}>
      {expanded ? 'Mostrar menos' : `+${hiddenCount} matéria${hiddenCount === 1 ? '' : 's'}`}
      {expanded ? <ChevronUp size={13} strokeWidth={2.2} /> : <ChevronDown size={13} strokeWidth={2.2} />}
    </button>
  );
}

const s: Record<string, CSSProperties> = {
  item: { display: 'flex', alignItems: 'center', gap: 4, padding: '5px 11px', borderRadius: theme.radiusPill, borderWidth: 1, borderStyle: 'dashed', borderColor: theme.line, background: 'transparent', color: theme.inkSoft, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, whiteSpace: 'nowrap' },
};
