// components/features/notebook/FlashcardModal.tsx
// Modal para criar flashcard: frente pré-preenchida com a seleção, verso em foco,
// matéria/tópico herdados, opção de entrar na revisão. Vincula ao erro de origem.
'use client';

import { useEffect, useRef, useState } from 'react';
import { createFlashcard } from '@/services/flashcards.service';
import { theme } from '@/lib/theme';
import { Button } from '@/components/ui/Button';

interface Props {
  frontText: string;
  // null = flashcard criado a partir de uma anotação livre (Caderno), sem erro de origem.
  sourceErrorId: string | null;
  subjectId: string | null;
  topicId: string | null;
  onClose: () => void;
  onCreated: () => void;
}

export function FlashcardModal({ frontText, sourceErrorId, subjectId, topicId, onClose, onCreated }: Props) {
  const [front, setFront] = useState(frontText);
  const [back, setBack] = useState('');
  const [addToReview, setAddToReview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const backRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { backRef.current?.focus(); }, []);
  useEffect(() => { setFront(frontText); }, [frontText]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape' && !saving) onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  const canSave = front.trim().length > 0 && back.trim().length > 0;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    setError('');
    try {
      await createFlashcard({
        front: front.trim(),
        back: back.trim(),
        topicId,
        subjectId,
        sourceErrorId,
        addToReview,
      });
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao criar flashcard.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 style={styles.title}>✦ Novo flashcard</h2>

        <label style={styles.label}>Frente (pergunta)</label>
        <textarea value={front} onChange={(e) => setFront(e.target.value)}
          style={styles.textarea} rows={3} />

        <label style={styles.label}>Verso (resposta)</label>
        <textarea ref={backRef} value={back} onChange={(e) => setBack(e.target.value)}
          placeholder="Digite a resposta…" style={styles.textarea} rows={3} />

        <label style={styles.reviewRow}>
          <input type="checkbox" checked={addToReview}
            onChange={(e) => setAddToReview(e.target.checked)} style={styles.checkbox} />
          <span style={styles.reviewText}>Adicionar à revisão espaçada</span>
        </label>

        {error && <p style={styles.error}>{error}</p>}

        <div style={styles.actions}>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!canSave || saving}>
            {saving ? 'Salvando…' : 'Criar flashcard'}
          </Button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: { position: 'fixed', inset: 0, background: 'var(--backdrop)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16 },
  modal: { background: theme.card, borderRadius: theme.radius, padding: 28, width: 'min(480px, 95vw)', maxHeight: 'calc(100dvh - 32px)', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.18)', fontFamily: theme.font },
  title: { margin: '0 0 20px', fontSize: 19, color: theme.ink, fontWeight: 700 },
  label: { display: 'block', fontSize: 12.5, color: theme.inkSoft, fontWeight: 600, marginBottom: 6, marginTop: 10 },
  textarea: { width: '100%', boxSizing: 'border-box', padding: 12, borderRadius: theme.radiusSm, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, background: theme.card, fontSize: 14, color: theme.ink, resize: 'vertical', fontFamily: 'inherit', outline: 'none' },
  reviewRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '14px 0', cursor: 'pointer' },
  checkbox: { width: 18, height: 18, accentColor: theme.teal, cursor: 'pointer' },
  reviewText: { fontSize: 14, color: theme.ink },
  error: { color: theme.danger, fontSize: 13 },
  actions: { display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 16 },
  cancelBtn: { padding: '11px 20px', borderRadius: theme.radiusSm, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, background: theme.card, color: theme.inkSoft, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: theme.font },
  saveBtn: { padding: '11px 24px', borderRadius: theme.radiusSm, border: 'none', background: theme.primary, color: theme.onTeal, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: theme.font },
  saveBtnDisabled: { background: theme.muted, color: theme.inkFaint, cursor: 'not-allowed' },
};
