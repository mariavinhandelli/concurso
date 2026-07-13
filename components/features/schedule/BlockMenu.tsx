// components/features/schedule/BlockMenu.tsx
// Menu de três pontinhos no bloco. Ações conforme a origem:
// recorrência → pular este dia + editar a regra; manual → editar + excluir.
'use client';

import { useEffect, useRef, useState } from 'react';
import { EllipsisVertical } from 'lucide-react';
import type { ScheduleBlock } from '@/services/scheduleEngine.service';
import { theme } from '@/lib/theme';

interface Props {
  block: ScheduleBlock;
  onEditManual: () => void;
  onDeleteManual: () => void;
  onSkipRecurrence: () => void;
  onEditRule: () => void;
}

export function BlockMenu({ block, onEditManual, onDeleteManual, onSkipRecurrence, onEditRule }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false); }
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const isRec = block.origin === 'recorrencia';

  function act(fn: () => void) {
    setOpen(false);
    fn();
  }

  return (
    <div ref={ref} style={styles.wrap}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        style={styles.dotsBtn}
        aria-label="Ações"
      >
        <EllipsisVertical size={14} fill="currentColor" stroke="none" />
      </button>

      {open && (
        <div style={styles.menu}>
          {isRec ? (
            <>
              <button style={styles.item} onClick={() => act(onSkipRecurrence)}>
                Pular este dia
              </button>
              <button style={styles.item} onClick={() => act(onEditRule)}>
                Editar a recorrência
              </button>
            </>
          ) : (
            <>
              <button style={styles.item} onClick={() => act(onEditManual)}>
                Editar bloco
              </button>
              <button style={{ ...styles.item, color: theme.danger }} onClick={() => act(onDeleteManual)}>
                Excluir
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { position: 'relative', flexShrink: 0 },
  dotsBtn: { border: 'none', background: 'transparent', color: theme.inkFaint, cursor: 'pointer', padding: 2, display: 'grid', placeItems: 'center', opacity: 0.6 },
  menu: { position: 'absolute', top: '100%', right: 0, marginTop: 4, background: theme.card, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, borderRadius: theme.radiusSm, boxShadow: theme.shadowHover, padding: 4, zIndex: 30, minWidth: 160 },
  item: { display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', borderRadius: 7, border: 'none', background: 'transparent', color: theme.ink, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
};