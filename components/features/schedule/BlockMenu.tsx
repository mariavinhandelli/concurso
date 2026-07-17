// components/features/schedule/BlockMenu.tsx
// Menu de três pontinhos no bloco. Ações conforme a origem:
// recorrência → pular este dia + editar a regra; manual → editar + excluir.
'use client';

import { EllipsisVertical } from 'lucide-react';
import type { ScheduleBlock } from '@/services/scheduleEngine.service';
import { theme } from '@/lib/theme';
import { Menu, MenuItem } from '@/components/ui/Menu';

interface Props {
  block: ScheduleBlock;
  onEditManual: () => void;
  onDeleteManual: () => void;
  onSkipRecurrence: () => void;
  onEditRule: () => void;
}

export function BlockMenu({ block, onEditManual, onDeleteManual, onSkipRecurrence, onEditRule }: Props) {
  const isRec = block.origin === 'recorrencia';

  return (
    <Menu
      width={160}
      trigger={({ onClick }) => (
        <button onClick={onClick} style={styles.dotsBtn} aria-label="Ações">
          <EllipsisVertical size={14} fill="currentColor" stroke="none" />
        </button>
      )}
    >
      {isRec ? (
        <>
          <MenuItem onClick={onSkipRecurrence}>Pular este dia</MenuItem>
          <MenuItem onClick={onEditRule}>Editar a recorrência</MenuItem>
        </>
      ) : (
        <>
          <MenuItem onClick={onEditManual}>Editar bloco</MenuItem>
          <MenuItem danger onClick={onDeleteManual}>Excluir</MenuItem>
        </>
      )}
    </Menu>
  );
}

const styles: Record<string, React.CSSProperties> = {
  dotsBtn: { border: 'none', background: 'transparent', color: theme.inkFaint, cursor: 'pointer', padding: 2, display: 'grid', placeItems: 'center', opacity: 0.6 },
};
