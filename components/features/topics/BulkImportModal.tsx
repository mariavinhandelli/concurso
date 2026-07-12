// components/features/topics/BulkImportModal.tsx
// Modal "colar vários tópicos": textarea → preview da lista limpa → confirmar.
'use client';

import { useState } from 'react';
import { parseTopicsTree, type ParsedTopic } from '@/lib/parse-topics';
import { theme } from '@/lib/theme';
import { Button } from '@/components/ui/Button';
import { Overlay } from '@/components/ui/Overlay';
import { Textarea } from '@/components/ui/Textarea';

interface Props {
  onConfirm: (itens: ParsedTopic[]) => Promise<void>;
  onClose: () => void;
}

export function BulkImportModal({ onConfirm, onClose }: Props) {
  const [raw, setRaw] = useState('');
  const [saving, setSaving] = useState(false);
  const [importError, setImportError] = useState('');
  const itens = parseTopicsTree(raw);
  const nSub = itens.filter((i) => i.child).length;

  async function handleConfirm() {
    if (itens.length === 0) return;
    setSaving(true);
    setImportError('');
    try {
      await onConfirm(itens);
      onClose();
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Erro ao importar tópicos.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Overlay onClose={onClose} maxWidth={680} labelledBy="bulk-import-title">
      <h2 id="bulk-import-title" style={styles.h2}>Colar tópicos</h2>
        <p style={styles.hint}>
          Cole o conteúdo programático da disciplina — um tópico por linha.
          Numeração e marcadores (1., a), -, •) são limpos automaticamente;
          subitens (a), i., 1.1 ou linhas indentadas) viram subtópicos do item anterior.
        </p>

        <div style={styles.split}>
          {/* Entrada */}
          <Textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder={'1. Controle de constitucionalidade\n2. Direitos fundamentais\n3. Organização do Estado'}
            style={{ flex: 1, minHeight: 240, lineHeight: 1.6 }}
            autoFocus
          />

          {/* Preview da árvore */}
          <div style={styles.preview}>
            <div style={styles.previewHeader}>
              {itens.length === 0
                ? 'Pré-visualização'
                : `${itens.length} tópico(s)${nSub > 0 ? ` · ${nSub} subtópico(s)` : ''}`}
            </div>
            {itens.length === 0 ? (
              <p style={styles.previewEmpty}>Os tópicos limpos aparecem aqui.</p>
            ) : (
              <ul style={styles.previewList}>
                {itens.map((t, i) => (
                  <li key={i} style={{ ...styles.previewItem, ...(t.child ? styles.previewChild : {}) }}>
                    {t.child ? '↳ ' : ''}{t.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {importError && <p style={{ color: theme.danger, fontSize: 13, margin: '0 0 10px', textAlign: 'right' }}>{importError}</p>}
        <div style={styles.actions}>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={itens.length === 0 || saving}>
            {saving ? 'Importando…' : `Adicionar ${itens.length || ''} tópico(s)`}
          </Button>
        </div>
    </Overlay>
  );
}

const styles: Record<string, React.CSSProperties> = {
  h2: { fontSize: 20, fontWeight: 700, color: theme.ink, margin: 0 },
  hint: { fontSize: 14, color: theme.inkSoft, margin: '8px 0 18px', lineHeight: 1.5 },
  split: { display: 'flex', gap: 14, marginBottom: 20 },
  preview: { flex: 1, minHeight: 240, maxHeight: 300, overflowY: 'auto', padding: 14, borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, background: theme.muted },
  previewHeader: { fontSize: 12, fontWeight: 700, color: theme.inkSoft, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.4 },
  previewEmpty: { fontSize: 13, color: theme.inkFaint, margin: 0 },
  previewList: { margin: 0, paddingLeft: 6, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 },
  previewItem: { fontSize: 14, color: theme.ink, lineHeight: 1.4 },
  previewChild: { paddingLeft: 18, color: theme.inkSoft, fontSize: 14 },
  actions: { display: 'flex', gap: 12, justifyContent: 'flex-end' },
};
