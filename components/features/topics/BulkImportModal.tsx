// components/features/topics/BulkImportModal.tsx
// Modal "colar vários tópicos": textarea → preview da lista limpa → confirmar.
'use client';

import { useState } from 'react';
import { parseTopics } from '@/lib/parse-topics';
import { theme } from '@/lib/theme';

interface Props {
  onConfirm: (nomes: string[]) => Promise<void>;
  onClose: () => void;
}

export function BulkImportModal({ onConfirm, onClose }: Props) {
  const [raw, setRaw] = useState('');
  const [saving, setSaving] = useState(false);
  const nomes = parseTopics(raw);

  async function handleConfirm() {
    if (nomes.length === 0) return;
    setSaving(true);
    try {
      await onConfirm(nomes);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 style={styles.h2}>Colar tópicos</h2>
        <p style={styles.hint}>
          Cole o conteúdo programático da disciplina — um tópico por linha.
          Numeração e marcadores (1., a), -, •) são limpos automaticamente.
        </p>

        <div style={styles.split}>
          {/* Entrada */}
          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder={'1. Controle de constitucionalidade\n2. Direitos fundamentais\n3. Organização do Estado'}
            style={styles.textarea}
            autoFocus
          />

          {/* Preview da árvore */}
          <div style={styles.preview}>
            <div style={styles.previewHeader}>
              {nomes.length === 0 ? 'Pré-visualização' : `${nomes.length} tópico(s)`}
            </div>
            {nomes.length === 0 ? (
              <p style={styles.previewEmpty}>Os tópicos limpos aparecem aqui.</p>
            ) : (
              <ol style={styles.previewList}>
                {nomes.map((n, i) => <li key={i} style={styles.previewItem}>{n}</li>)}
              </ol>
            )}
          </div>
        </div>

        <div style={styles.actions}>
          <button onClick={onClose} style={styles.cancelBtn}>Cancelar</button>
          <button
            onClick={handleConfirm}
            disabled={nomes.length === 0 || saving}
            style={{ ...styles.confirmBtn, ...(nomes.length === 0 || saving ? styles.confirmBtnOff : {}) }}
          >
            {saving ? 'Importando…' : `Adicionar ${nomes.length || ''} tópico(s)`}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(30,28,24,0.4)', display: 'grid', placeItems: 'center', zIndex: 50, padding: 20 },
  modal: { background: theme.card, borderRadius: theme.radius, boxShadow: '0 20px 60px rgba(0,0,0,0.18)', padding: 26, width: '100%', maxWidth: 680, fontFamily: theme.font },
  h2: { fontSize: 20, fontWeight: 700, color: theme.ink, margin: 0 },
  hint: { fontSize: 13.5, color: theme.inkSoft, margin: '8px 0 18px', lineHeight: 1.5 },
  split: { display: 'flex', gap: 14, marginBottom: 20 },
  textarea: { flex: 1, minHeight: 240, padding: 14, borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, background: theme.card, fontSize: 14, color: theme.ink, fontFamily: 'inherit', resize: 'vertical', outline: 'none', lineHeight: 1.6 },
  preview: { flex: 1, minHeight: 240, maxHeight: 300, overflowY: 'auto', padding: 14, borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, background: theme.muted },
  previewHeader: { fontSize: 12, fontWeight: 700, color: theme.inkSoft, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.4 },
  previewEmpty: { fontSize: 13, color: theme.inkFaint, margin: 0 },
  previewList: { margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 },
  previewItem: { fontSize: 14, color: theme.ink, lineHeight: 1.4 },
  actions: { display: 'flex', gap: 12, justifyContent: 'flex-end' },
  cancelBtn: { padding: '11px 22px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, background: theme.card, color: theme.inkSoft, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
  confirmBtn: { padding: '11px 22px', borderRadius: theme.radiusSm, border: 'none', background: theme.teal, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  confirmBtnOff: { background: theme.muted, color: theme.inkFaint, cursor: 'not-allowed' },
};