'use client';

import { useState } from 'react';
import { theme } from '@/lib/theme';
import { Button } from '@/components/ui/Button';
import { Overlay } from '@/components/ui/Overlay';

interface Props {
  plannedMinutes: number;
  saving: boolean;
  onConfirm: (minutes: number) => void;
  onClose: () => void;
}

export function CompletionPopup({ plannedMinutes, saving, onConfirm, onClose }: Props) {
  const [h, setH] = useState(String(Math.floor(plannedMinutes / 60)));
  const [m, setM] = useState(String(plannedMinutes % 60));

  function handleConfirm() {
    // Saneia: valores negativos deixavam o ciclo com "-2h de 3h" e "-2ª volta",
    // sem botão de desfazer para se recuperar.
    onConfirm(Math.min(1440, Math.max(0, (Number(h) || 0) * 60 + (Number(m) || 0))));
  }

  return (
    <Overlay onClose={onClose} maxWidth={340} labelledBy="completion-popup-title">
      <h3 id="completion-popup-title" style={styles.title}>Quanto você estudou?</h3>
      <div style={styles.durRow}>
        <input type="number" min="0" value={h} autoFocus onChange={(e) => setH(e.target.value)} style={styles.durInput} />
        <span style={styles.durUnit}>h</span>
        <input type="number" min="0" max="59" value={m} onChange={(e) => setM(e.target.value)} style={styles.durInput} />
        <span style={styles.durUnit}>min</span>
      </div>
      <div style={styles.actions}>
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button onClick={handleConfirm} disabled={saving}>
          {saving ? 'Registrando…' : 'Registrar'}
        </Button>
      </div>
    </Overlay>
  );
}

const styles: Record<string, React.CSSProperties> = {
  title: { fontSize: 16, fontWeight: 700, color: theme.ink, margin: '0 0 16px' },
  durRow: { display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' },
  durInput: { width: 70, boxSizing: 'border-box', padding: '10px 12px', borderRadius: theme.radiusSm, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, background: theme.card, fontSize: 16, color: theme.ink, fontFamily: 'inherit', outline: 'none', textAlign: 'center' },
  durUnit: { fontSize: 13, color: theme.inkSoft },
  actions: { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 },
};
