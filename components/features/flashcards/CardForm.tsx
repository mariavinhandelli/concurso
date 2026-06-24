// components/features/flashcards/CardForm.tsx
// Formulário simples para criar um flashcard do zero (frente, verso, revisão).
'use client';

import { useState } from 'react';
import { createFlashcard } from '@/services/flashcards.service';
import { theme } from '@/lib/theme';

interface Props {
  subjectId: string | null;
  topicId: string | null;
  onCreated: () => void;
  onCancel: () => void;
}

export function CardForm({ subjectId, topicId, onCreated, onCancel }: Props) {
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [addToReview, setAddToReview] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const canSave = front.trim().length > 0 && back.trim().length > 0;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    setError('');
    try {
      await createFlashcard({
        front: front.trim(), back: back.trim(),
        topicId, subjectId, sourceErrorId: null, addToReview,
      });
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao criar card.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={styles.box}>
      <label style={styles.label}>Frente (pergunta)</label>
      <textarea value={front} onChange={(e) => setFront(e.target.value)}
        placeholder="Ex: O que é controle difuso?" style={styles.textarea} rows={2} />

      <label style={styles.label}>Verso (resposta)</label>
      <textarea value={back} onChange={(e) => setBack(e.target.value)}
        placeholder="A resposta…" style={styles.textarea} rows={2} />

      <label style={styles.reviewRow}>
        <input type="checkbox" checked={addToReview}
          onChange={(e) => setAddToReview(e.target.checked)} style={styles.checkbox} />
        <span style={styles.reviewText}>Adicionar à revisão espaçada</span>
      </label>

      {error && <p style={styles.error}>{error}</p>}

      <div style={styles.actions}>
        <button onClick={onCancel} style={styles.cancelBtn}>Cancelar</button>
        <button onClick={handleSave} disabled={!canSave || saving}
          style={{ ...styles.saveBtn, ...(canSave && !saving ? {} : styles.saveBtnDisabled) }}>
          {saving ? 'Salvando…' : 'Criar card'}
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  box: { background: theme.bg, borderRadius: 14, border: `0.5px solid ${theme.line}`, padding: 18, display: 'flex', flexDirection: 'column', gap: 8, fontFamily: theme.font },
  label: { fontSize: 13, color: theme.inkSoft, marginTop: 4, fontWeight: 500 },
  textarea: { width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, background: theme.card, fontSize: 14, color: theme.ink, resize: 'vertical', fontFamily: 'inherit', outline: 'none' },
  reviewRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', cursor: 'pointer' },
  checkbox: { width: 18, height: 18, accentColor: theme.teal, cursor: 'pointer' },
  reviewText: { fontSize: 14, color: theme.ink },
  error: { color: theme.danger, fontSize: 13 },
  actions: { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 6 },
  cancelBtn: { padding: '10px 18px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, background: theme.card, color: theme.inkSoft, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' },
  saveBtn: { padding: '10px 20px', borderRadius: theme.radiusSm, border: 'none', background: theme.teal, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  saveBtnDisabled: { background: theme.muted, color: theme.inkFaint, cursor: 'not-allowed' },
};