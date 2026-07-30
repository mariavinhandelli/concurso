// components/features/caderno/ListPanel.tsx
// Coluna central do hub Caderno: toolbar sticky (busca + "+ Novo" + filtros
// extras) sobre a lista de cards. Uma régua só para as três abas — antes cada
// uma tinha busca com estilo, posição e rótulo de criação diferentes.
'use client';

import type { CSSProperties, ReactNode } from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { theme } from '@/lib/theme';

export function ListPanel({
  busca, onBusca, placeholder, onNovo, novoLabel = '+ Novo', extraTools, children,
}: {
  busca: string;
  onBusca: (v: string) => void;
  placeholder: string;
  onNovo?: () => void;
  novoLabel?: string;
  /** Linha extra de ferramentas sob a busca (selects de filtro, chips de período…). */
  extraTools?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <div style={s.tools}>
        <div style={s.toolsRow}>
          <Input
            value={busca}
            onChange={(e) => onBusca(e.target.value)}
            placeholder={placeholder}
            aria-label={placeholder}
            icon={<Search size={15} strokeWidth={2} />}
            style={{ fontSize: 13, padding: '9px 12px 9px 36px' }}
          />
          {onNovo && (
            <Button size="sm" className="touch-target" onClick={onNovo} title={novoLabel}>{novoLabel}</Button>
          )}
        </div>
        {extraTools}
      </div>
      {children}
    </>
  );
}

const s: Record<string, CSSProperties> = {
  tools: { display: 'flex', flexDirection: 'column', gap: 8, position: 'sticky', top: 0, background: theme.bg, paddingBottom: 2, zIndex: 1 },
  toolsRow: { display: 'flex', gap: 8, alignItems: 'center' },
};
