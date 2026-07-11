// components/features/notebook/NoteEditor.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useToast } from '@/components/ui/ToastProvider';
import { RichTextEditor } from '@/components/editor/RichTextEditor';
import { ERROR_TYPES, createNote, updateNote, listBoards, type ErrorNote, type NoteInput } from '@/services/notebook.service';
import { listActive as listSubjectOptions } from '@/services/subjects.service';
import { listLeaves as listTopicOptions, type PickerOption } from '@/services/topics.service';
import { getAcertoTopico } from '@/services/metrics.service';
import { FlashcardModal } from '@/components/features/notebook/FlashcardModal';
import { theme } from '@/lib/theme';
import { Button } from '@/components/ui/Button';

interface Props {
  note: ErrorNote | null;
  presetSubjectId?: string | null;
  presetTopicId?: string | null;
  onSaved: () => void;
  onCancel: () => void;
  /** Chamado quando o usuário confirma o agendamento de revisão pós-save. Responsabilidade do pai. */
  onScheduleReview?: (topicId: string, days: number) => Promise<void>;
}

export function NoteEditor({ note, presetSubjectId = null, presetTopicId = null, onSaved, onCancel, onScheduleReview }: Props) {
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState<object>({});
  const [contentText, setContentText] = useState('');
  const [errorType, setErrorType] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [topicId, setTopicId] = useState('');
  const [boardId, setBoardId] = useState('');

  const [subjects, setSubjects] = useState<PickerOption[]>([]);
  const [topics, setTopics] = useState<PickerOption[]>([]);
  const [boards, setBoards] = useState<{ id: string; name: string; color: string }[]>([]);

  const [acerto, setAcerto] = useState<{ pct: number | null; total: number } | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editorKey, setEditorKey] = useState(0);

  const [flashcardText, setFlashcardText] = useState<string | null>(null);

  const loadingSubjectIdRef = useRef<string | null>(null);
  const latestTopicIdRef = useRef<string | null>(null);

  // Sugestão de revisão pós-save: guarda o tópico/nome a sugerir.
  const [reviewSuggestion, setReviewSuggestion] = useState<{ topicId: string; topicName: string } | null>(null);
  const [scheduling, setScheduling] = useState(false);

  // B-3: Escape fecha o overlay de sugestão de revisão
  useEffect(() => {
    if (!reviewSuggestion) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !scheduling) { setReviewSuggestion(null); onSaved(); }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [reviewSuggestion, scheduling, onSaved]);

  useEffect(() => {
    listSubjectOptions().then(setSubjects).catch((e) => toast.error(e instanceof Error ? e.message : 'Erro ao carregar matérias.'));
    listBoards().then(setBoards).catch((e) => toast.error(e instanceof Error ? e.message : 'Erro ao carregar bancas.'));
  }, [toast]);

  // A-3: guarda de ref evita que resposta de subject anterior sobrescreva topics atual
  useEffect(() => {
    if (!subjectId) { setTopics([]); return; }
    loadingSubjectIdRef.current = subjectId;
    listTopicOptions(subjectId)
      .then((ts) => { if (loadingSubjectIdRef.current === subjectId) setTopics(ts); })
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Erro ao carregar tópicos.'));
  }, [subjectId, toast]);

  // A-1: guarda de ref evita que resposta de tópico anterior sobrescreva acerto atual
  useEffect(() => {
    if (!topicId) { setAcerto(null); return; }
    latestTopicIdRef.current = topicId;
    getAcertoTopico(topicId)
      .then((a) => { if (latestTopicIdRef.current === topicId) setAcerto(a); })
      .catch(() => { if (latestTopicIdRef.current === topicId) setAcerto(null); });
  }, [topicId]);

  useEffect(() => {
    setTitle(note?.title ?? '');
    setContent(note?.content ?? {});
    setContentText(note?.content_text ?? '');
    setErrorType(note?.error_type ?? '');
    setSubjectId(note?.subject_id ?? presetSubjectId ?? '');
    setTopicId(note?.topic_id ?? presetTopicId ?? '');
    setBoardId(note?.board_id ?? '');
    setEditorKey((k) => k + 1);
  }, [note, presetSubjectId, presetTopicId]);

  const canSave = title.trim().length > 0 && errorType.length > 0;

  function toggleType(t: string) {
    setErrorType((cur) => (cur === t ? '' : t));
  }

  function acertoColor(pct: number): string {
    if (pct >= 75) return theme.ok;
    if (pct >= 50) return theme.warn;
    return theme.crit;
  }

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    setError('');
    const input: NoteInput = {
      title, content, contentText,
      errorType: errorType || null,
      subjectId: subjectId || null,
      topicId: topicId || null,
      boardId: boardId || null,
    };
    try {
      if (note) await updateNote(note.id, input);
      else await createNote(input);

      // Se há tópico, oferece a sugestão de revisão antes de fechar.
      if (topicId) {
        const topicName = topics.find((t) => t.id === topicId)?.name ?? 'este tópico';
        setReviewSuggestion({ topicId, topicName });
      } else {
        onSaved();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  async function handleScheduleReview(days: number) {
    if (!reviewSuggestion) return;
    setScheduling(true);
    try {
      await onScheduleReview?.(reviewSuggestion.topicId, days);
    } catch {
      // agendamento falhou — fluxo continua, o erro já foi salvo
    } finally {
      setScheduling(false);
      setReviewSuggestion(null);
      onSaved();
    }
  }

  function dismissReview() {
    setReviewSuggestion(null);
    onSaved();
  }

  return (
    <div style={styles.panel}>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Título do erro (ex: Confundi competência da União)"
        style={styles.titleInput}
      />

      {/* Tipo de erro — chips de seleção única */}
      <div>
        <p style={styles.chipsLabel}>Tipo de erro *</p>
        <div style={styles.chipsRow}>
          {ERROR_TYPES.map((t) => {
            const on = errorType === t;
            return (
              <button key={t} onClick={() => toggleType(t)} type="button"
                style={{ ...styles.chip, ...(on ? styles.chipOn : {}) }}>
                {t}
              </button>
            );
          })}
        </div>
      </div>

      <div style={styles.metaRow}>
        <select value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setTopicId(''); }} style={styles.select}>
          <option value="">Matéria</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={topicId} onChange={(e) => setTopicId(e.target.value)} disabled={!subjectId} style={styles.select}>
          <option value="">Tópico</option>
          {topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select value={boardId} onChange={(e) => setBoardId(e.target.value)} style={styles.select}>
          <option value="">Banca</option>
          {boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>

      {topicId && acerto && (
        acerto.pct === null ? (
          <div style={styles.acertoBox}>
            <span style={styles.acertoMuted}>Sem questões registradas neste tópico ainda.</span>
          </div>
        ) : (
          <div style={styles.acertoBox}>
            <span style={styles.acertoLabel}>Acerto neste tópico</span>
            <span style={{ ...styles.acertoPct, color: acertoColor(acerto.pct) }}>{acerto.pct}%</span>
            <span style={styles.acertoMeta}>
              {acerto.total < 10 ? `amostra pequena (${acerto.total} questões)` : `${acerto.total} questões`}
            </span>
          </div>
        )
      )}

      <RichTextEditor
        key={editorKey}
        initialContent={note?.content ?? null}
        onChange={(json, text) => { setContent(json); setContentText(text); }}
        onCreateFlashcard={(text) => setFlashcardText(text)}
        canCreateFlashcard={!!note}
      />

      {error && <p style={styles.error}>{error}</p>}

      <div style={styles.actions}>
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button onClick={handleSave} disabled={!canSave || saving}>
          {saving ? 'Salvando…' : note ? 'Atualizar' : 'Salvar erro'}
        </Button>
      </div>
      {!canSave && <p style={styles.hint}>Preencha o título e o tipo de erro para salvar.</p>}
      {note && <p style={styles.tip}>Dica: selecione um trecho do texto para criar um flashcard.</p>}

      {/* Card de sugestão de revisão (pós-save, com tópico) */}
      {reviewSuggestion && (
        <div style={styles.reviewOverlay} onClick={dismissReview}>
          <div style={styles.reviewCard} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.reviewTitle}>Revisar este tópico?</h3>
            <p style={styles.reviewText}>
              Você registrou um erro em <b>{reviewSuggestion.topicName}</b>. Quer agendar uma revisão para fixar?
            </p>
            <div style={styles.reviewBtns}>
              <Button style={{ flex: 1 }} onClick={() => handleScheduleReview(1)} disabled={scheduling}>Em 24h</Button>
              <Button style={{ flex: 1 }} onClick={() => handleScheduleReview(2)} disabled={scheduling}>Em 48h</Button>
            </div>
            <button onClick={dismissReview} disabled={scheduling} style={styles.reviewDismiss}>Agora não</button>
          </div>
        </div>
      )}

      {flashcardText !== null && note && (
        <FlashcardModal
          frontText={flashcardText}
          sourceErrorId={note.id}
          subjectId={subjectId || null}
          topicId={topicId || null}
          onClose={() => setFlashcardText(null)}
          onCreated={() => { setFlashcardText(null); toast.success('Flashcard criado!'); }}
        />
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  panel: { display: 'flex', flexDirection: 'column', gap: 12, width: '100%', minWidth: 0, maxWidth: '100%' },
  titleInput: { width: '100%', boxSizing: 'border-box', padding: '13px 16px', borderRadius: 12, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, background: theme.card, fontSize: 18, color: theme.ink, fontWeight: 700, fontFamily: theme.font, outline: 'none' },
  chipsLabel: { fontSize: 12.5, fontWeight: 600, color: theme.inkSoft, margin: '0 0 8px' },
  chipsRow: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  chip: { padding: '8px 14px', borderRadius: 999, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, background: theme.card, color: theme.inkSoft, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .12s' },
  chipOn: { background: theme.teal, borderColor: theme.teal, color: theme.onTeal },
  metaRow: { display: 'flex', gap: 12, width: '100%', minWidth: 0, flexWrap: 'wrap' },
  select: { flex: '1 1 0', minWidth: 140, maxWidth: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: theme.radiusSm, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, background: theme.card, fontSize: 14, color: theme.ink, fontFamily: theme.font, cursor: 'pointer', outline: 'none', textOverflow: 'ellipsis' },
  acertoBox: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: theme.radiusSm, background: theme.bg, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line },
  acertoLabel: { fontSize: 12.5, color: theme.inkSoft, fontWeight: 500 },
  acertoPct: { fontSize: 18, fontWeight: 700, fontVariantNumeric: 'tabular-nums' },
  acertoMeta: { fontSize: 11.5, color: theme.inkFaint },
  acertoMuted: { fontSize: 12.5, color: theme.inkFaint },
  error: { color: theme.danger, fontSize: 13 },
  actions: { display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 4 },
  cancelBtn: { padding: '11px 20px', borderRadius: 12, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, background: theme.card, color: theme.inkSoft, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: theme.font },
  saveBtn: { padding: '11px 24px', borderRadius: 12, border: 'none', background: theme.primary, color: theme.onTeal, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: theme.font },
  saveBtnDisabled: { background: theme.muted, color: theme.inkFaint, cursor: 'not-allowed' },
  hint: { fontSize: 12, color: theme.inkFaint, textAlign: 'right', margin: 0 },
  tip: { fontSize: 12, color: theme.inkFaint, margin: '4px 0 0' },
  reviewOverlay: { position: 'fixed', inset: 0, background: 'var(--backdrop)', display: 'grid', placeItems: 'center', zIndex: 70, padding: 20 },
  reviewCard: { background: theme.card, borderRadius: theme.radius, padding: 24, width: '100%', maxWidth: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.18)', fontFamily: theme.font, textAlign: 'center' },
  reviewTitle: { fontSize: 17, fontWeight: 700, color: theme.ink, margin: '0 0 8px' },
  reviewText: { fontSize: 13.5, color: theme.inkSoft, margin: '0 0 18px', lineHeight: 1.5 },
  reviewBtns: { display: 'flex', gap: 10, justifyContent: 'center' },
  reviewBtn: { flex: 1, padding: '11px 0', borderRadius: theme.radiusSm, border: 'none', background: theme.primary, color: theme.onTeal, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  reviewDismiss: { marginTop: 12, border: 'none', background: 'transparent', color: theme.inkFaint, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
};