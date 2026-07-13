// components/features/notebook/FlashcardModal.tsx
// Modal para criar flashcard: frente pré-preenchida com a seleção, verso em foco,
// matéria/tópico herdados, opção de entrar na revisão. Vincula ao erro de origem.
'use client';

import { useEffect, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { createFlashcard } from '@/services/flashcards.service';
import { theme } from '@/lib/theme';
import { Button } from '@/components/ui/Button';
import { Overlay } from '@/components/ui/Overlay';
import { Textarea } from '@/components/ui/Textarea';

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
    <Overlay onClose={saving ? () => {} : onClose} maxWidth={480} labelledBy="flashcard-modal-title">
      <h2 id="flashcard-modal-title" style={{ ...styles.title, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Sparkles size={16} strokeWidth={2} />Novo flashcard
      </h2>

        <label style={styles.label}>Frente (pergunta)</label>
        <Textarea value={front} onChange={(e) => setFront(e.target.value)} rows={3} />

        <label style={styles.label}>Verso (resposta)</label>
        <Textarea ref={backRef} value={back} onChange={(e) => setBack(e.target.value)}
          placeholder="Digite a resposta…" rows={3} />

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
    </Overlay>
  );
}

const styles: Record<string, React.CSSProperties> = {
  title: { margin: '0 0 20px', fontSize: 19, color: theme.ink, fontWeight: 700 },
  label: { display: 'block', fontSize: 13, color: theme.inkSoft, fontWeight: 600, marginBottom: 6, marginTop: 10 },
  reviewRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '14px 0', cursor: 'pointer' },
  checkbox: { width: 18, height: 18, accentColor: theme.teal, cursor: 'pointer' },
  reviewText: { fontSize: 14, color: theme.ink },
  error: { color: theme.danger, fontSize: 13 },
  actions: { display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 16 },
};
