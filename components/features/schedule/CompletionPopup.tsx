'use client';

import { useState } from 'react';
import { theme } from '@/lib/theme';

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
    onConfirm((Number(h) || 0) * 60 + (Number(m) || 0));
  }

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.popup} onClick={(e) => e.stopPropagation()}>
        <h3 style={styles.title}>Quanto você estudou?</h3>
        <div style={styles.durRow}>
          <input type="number" min="0" value={h} autoFocus onChange={(e) => setH(e.target.value)} style={styles.durInput} />
          <span style={styles.durUnit}>h</span>
          <input type="number" min="0" max="59" value={m} onChange={(e) => setM(e.target.value)} style={styles.durInput} />
          <span style={styles.durUnit}>min</span>
        </div>
        <div style={styles.actions}>
          <button onClick={onClose} style={styles.cancel}>Cancelar</button>
          <button onClick={handleConfirm} disabled={saving} style={styles.confirm}>
            {saving ? 'Registrando…' : 'Registrar'}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(30,28,24,0.4)', display: 'grid', placeItems: 'center', zIndex: 60, padding: 20 },
  popup: { background: theme.card, borderRadius: theme.radius, boxShadow: '0 20px 60px rgba(0,0,0,0.18)', padding: 24, width: '100%', maxWidth: 340, fontFamily: theme.font },
  title: { fontSize: 16, fontWeight: 700, color: theme.ink, margin: '0 0 16px' },
  durRow: { display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' },
  durInput: { width: 70, boxSizing: 'border-box', padding: '10px 12px', borderRadius: theme.radiusSm, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, background: theme.card, fontSize: 16, color: theme.ink, fontFamily: 'inherit', outline: 'none', textAlign: 'center' },
  durUnit: { fontSize: 13, color: theme.inkSoft },
  actions: { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 },
  cancel: { padding: '9px 16px', borderRadius: theme.radiusSm, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, background: theme.card, color: theme.inkSoft, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
  confirm: { padding: '9px 18px', borderRadius: theme.radiusSm, border: 'none', background: theme.teal, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
};
