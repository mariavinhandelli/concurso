'use client';

import { useState, useRef, useEffect } from 'react';
import { createFlashcard, updateFlashcardContent, type Flashcard } from '@/services/flashcards.service';
import { theme } from '@/lib/theme';
import { Button } from '@/components/ui/Button';

interface Props {
  subjectId: string | null;
  topicId: string | null;
  card?: Flashcard;
  onSaved: () => void;
  onCreatedAndNew?: () => void;
  onCancel: () => void;
}

export function CardForm({ subjectId, topicId, card, onSaved, onCreatedAndNew, onCancel }: Props) {
  const isEdit = Boolean(card);
  const [front, setFront] = useState(card?.front ?? '');
  const [back, setBack] = useState(card?.back ?? '');
  const [addToReview, setAddToReview] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const frontRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { frontRef.current?.focus(); }, []);

  const canSave = front.trim().length > 0 && back.trim().length > 0;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    setError('');
    try {
      if (isEdit && card) {
        await updateFlashcardContent(card.id, front, back);
      } else {
        await createFlashcard({ front: front.trim(), back: back.trim(), topicId, subjectId, sourceErrorId: null, addToReview });
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : `Erro ao ${isEdit ? 'atualizar' : 'criar'} card.`);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveAndNew() {
    if (!canSave || !onCreatedAndNew) return;
    setSaving(true);
    setError('');
    try {
      await createFlashcard({ front: front.trim(), back: back.trim(), topicId, subjectId, sourceErrorId: null, addToReview });
      setFront('');
      setBack('');
      onCreatedAndNew();
      setTimeout(() => frontRef.current?.focus(), 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao criar card.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={styles.box}>
      <label style={styles.label}>Frente (pergunta)</label>
      <textarea
        ref={frontRef}
        value={front}
        onChange={(e) => setFront(e.target.value)}
        placeholder="Ex: O que é controle difuso?"
        style={styles.textarea}
        rows={2}
      />

      <label style={styles.label}>Verso (resposta)</label>
      <textarea
        value={back}
        onChange={(e) => setBack(e.target.value)}
        placeholder="A resposta…"
        style={styles.textarea}
        rows={2}
      />

      {!isEdit && (
        <label style={styles.reviewRow}>
          <input type="checkbox" checked={addToReview}
            onChange={(e) => setAddToReview(e.target.checked)} style={styles.checkbox} />
          <span style={styles.reviewText}>Adicionar à revisão espaçada</span>
        </label>
      )}

      {error && <p style={styles.error}>{error}</p>}

      <div style={styles.actions}>
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        {!isEdit && onCreatedAndNew && (
          <Button
            variant="outline"
            style={{ borderColor: theme.teal, borderWidth: 1.5, color: theme.tealDeep }}
            onClick={handleSaveAndNew}
            disabled={!canSave || saving}
          >
            Criar e continuar
          </Button>
        )}
        <Button onClick={handleSave} disabled={!canSave || saving}>
          {saving ? 'Salvando…' : isEdit ? 'Salvar' : 'Criar card'}
        </Button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  box: { background: theme.card, borderRadius: 14, border: `1px solid ${theme.lineStrong}`, boxShadow: '0 1px 4px var(--line)', padding: 18, display: 'flex', flexDirection: 'column', gap: 8, fontFamily: theme.font },
  label: { fontSize: 13, color: theme.inkSoft, marginTop: 4, fontWeight: 500 },
  textarea: { width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: theme.radiusSm, border: `1px solid ${theme.lineStrong}`, background: theme.card, fontSize: 14, color: theme.ink, resize: 'vertical', fontFamily: 'inherit', outline: 'none' },
  reviewRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', cursor: 'pointer' },
  checkbox: { width: 18, height: 18, accentColor: theme.teal, cursor: 'pointer' },
  reviewText: { fontSize: 14, color: theme.ink },
  error: { color: theme.danger, fontSize: 13, margin: 0 },
  actions: { display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6, flexWrap: 'wrap' },
  cancelBtn: { padding: '10px 18px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, background: theme.card, color: theme.inkSoft, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' },
  saveSecondaryBtn: { padding: '10px 18px', borderRadius: theme.radiusSm, border: `1.5px solid ${theme.teal}`, background: 'transparent', color: theme.tealDeep, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  saveBtn: { padding: '10px 20px', borderRadius: theme.radiusSm, border: 'none', background: theme.primary, color: theme.onTeal, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  saveBtnDisabled: { opacity: 0.45, cursor: 'not-allowed' },
};
