// components/features/timer/QualitativeFeedbackForm.tsx
// Tela de encerramento da sessão — visual alinhado ao registro manual.
// Energia (slider, obrigatória), tipo, matéria/tópico, revisão e um campo de texto.
'use client';

import { useEffect, useState } from 'react';
import { useConfirm } from '@/hooks/useConfirm';
import { useToast } from '@/components/ui/ToastProvider';
import type { PendingSession } from '@/hooks/useStudyTimer';
import type { SessionFeedback, ErrorCause } from '@/services/studyLogs.service';
import {
  listSubjectOptions, listTopicOptions, type PickerOption,
} from '@/services/picker.service';
import { getReviewStatus } from '@/services/reviews.service';
import { SESSION_MODES, modeUsesQuestions } from '@/lib/session-modes';
import type { LogMode } from '@/lib/timer-storage';
import { theme } from '@/lib/theme';

interface Props {
  session: PendingSession;
  onSubmit: (feedback: SessionFeedback) => void;
  onDiscard: () => void;
  saving: boolean;
}

const ERROR_CAUSES: { value: ErrorCause; label: string }[] = [
  { value: 'teoria', label: 'Teoria' },
  { value: 'interpretacao', label: 'Interpretação' },
  { value: 'tempo', label: 'Tempo' },
];

export function QualitativeFeedbackForm({ session, onSubmit, onDiscard, saving }: Props) {
  const toast = useToast();
  const [mode, setMode] = useState<LogMode>(session.mode);
  const [energy, setEnergy] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [total, setTotal] = useState('');
  const [correct, setCorrect] = useState('');
  const [errorCause, setErrorCause] = useState<ErrorCause | null>(null);

  const [subjects, setSubjects] = useState<PickerOption[]>([]);
  const [topics, setTopics] = useState<PickerOption[]>([]);
  const [subjectId, setSubjectId] = useState<string>(session.subjectId ?? '');
  const [topicId, setTopicId] = useState<string>(session.topicId ?? '');

  const [reviewActive, setReviewActive] = useState(false);
  const [wantReview, setWantReview] = useState(false);
  const { confirm: confirmDiscard, dialog: discardDialog } = useConfirm();

  async function handleDiscard() {
    const min = Math.floor(session.durationSec / 60);
    if (!await confirmDiscard({ title: `Descartar sessão de ${min} min?`, description: 'O tempo estudado não será registrado.', confirmLabel: 'Descartar', danger: true })) return;
    onDiscard();
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') handleDiscard(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    listSubjectOptions().then(setSubjects).catch((e) => toast.error(e instanceof Error ? e.message : 'Erro ao carregar matérias.'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!subjectId) { setTopics([]); return; }
    listTopicOptions(subjectId).then(setTopics).catch((e) => toast.error(e instanceof Error ? e.message : 'Erro ao carregar tópicos.'));
  }, [subjectId, toast]);

  useEffect(() => {
    if (!topicId) { setReviewActive(false); setWantReview(false); return; }
    getReviewStatus(topicId).then((active) => {
      setReviewActive(active);
      setWantReview(active);
    }).catch(() => {});
  }, [topicId]);

  const isQuestoes = modeUsesQuestions(mode);
  const min = Math.floor(session.durationSec / 60);

  // Só pergunta a causa quando houve erro de fato nesta sessão.
  const houveErro = isQuestoes && Number(total) > 0 && Number(total) > Number(correct);

  // Limpa a causa se o cenário deixou de ter erro (ex.: corrigiu os números).
  useEffect(() => {
    if (!houveErro && errorCause !== null) setErrorCause(null);
  }, [houveErro, errorCause]);

  function handleSubmit() {
    if (energy === 0) {
      toast.error('Marque seu nível de energia antes de salvar.');
      return;
    }
    onSubmit({
      mode,
      subjectId: subjectId || null,
      topicId: topicId || null,
      qualitativeFeedback: feedback.trim(),
      energyLevel: energy,
      insight: '',
      questionsTotal: isQuestoes ? Number(total) || 0 : undefined,
      questionsCorrect: isQuestoes ? Number(correct) || 0 : undefined,
      errorCause: houveErro ? errorCause : null,
      reviewIntent: topicId ? { active: wantReview, was: reviewActive } : null,
    });
  }

  return (
    <>
    {discardDialog}
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <h2 style={styles.h2}>Sessão concluída</h2>
        <p style={styles.subtitle}>{min} min de estudo. Registre antes de fechar.</p>

        <div style={styles.row2}>
          <div style={styles.col}>
            <label style={styles.label}>Tipo</label>
            <select value={mode} onChange={(e) => setMode(e.target.value as LogMode)} style={styles.input}>
              {SESSION_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div style={styles.col}>
            <label style={styles.label}>Energia: {energy === 0 ? '—' : `${energy}/5`}</label>
            <input type="range" min="0" max="5" value={energy} onChange={(e) => setEnergy(Number(e.target.value))} style={styles.range} />
          </div>
        </div>

        <label style={styles.label}>Matéria</label>
        <select value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setTopicId(''); }} style={styles.input}>
          <option value="">— nenhuma —</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>

        <label style={styles.label}>Tópico (opcional)</label>
        <select value={topicId} onChange={(e) => setTopicId(e.target.value)} disabled={!subjectId} style={styles.input}>
          <option value="">— sem tópico específico —</option>
          {topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>

        {topicId && (
          <label style={styles.checkRow}>
            <input type="checkbox" checked={wantReview} onChange={(e) => setWantReview(e.target.checked)} style={styles.checkbox} />
            <span>{reviewActive ? 'Este tópico está em revisão espaçada' : 'Adicionar à revisão espaçada'}</span>
          </label>
        )}

        {isQuestoes && (
          <div style={styles.row2}>
            <div style={styles.col}>
              <label style={styles.label}>Questões feitas</label>
              <input type="number" min="0" value={total} onChange={(e) => setTotal(e.target.value)} style={styles.input} />
            </div>
            <div style={styles.col}>
              <label style={styles.label}>Acertos</label>
              <input type="number" min="0" value={correct} onChange={(e) => setCorrect(e.target.value)} style={styles.input} />
            </div>
          </div>
        )}

        {houveErro && (
          <>
            <label style={styles.label}>O que mais te derrubou? <span style={styles.opt}>(opcional)</span></label>
            <div style={styles.segment}>
              {ERROR_CAUSES.map((c) => {
                const sel = errorCause === c.value;
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setErrorCause(sel ? null : c.value)}
                    style={{ ...styles.segBtn, ...(sel ? styles.segBtnActive : {}) }}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </>
        )}

        <label style={styles.label}>Como foi a sessão? <span style={styles.opt}>(opcional)</span></label>
        <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={2} style={styles.textarea} placeholder="O que rendeu, o que travou…" />

        <div style={styles.actions}>
          <button onClick={handleDiscard} style={styles.cancel} disabled={saving}>Descartar</button>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            {energy === 0 && <p style={styles.hint}>Marque sua energia para salvar.</p>}
            <button
              onClick={handleSubmit}
              style={{ ...styles.save, opacity: energy === 0 || saving ? 0.5 : 1, cursor: energy === 0 || saving ? 'not-allowed' : 'pointer' }}
              disabled={saving || energy === 0}
              title={energy === 0 ? 'Marque seu nível de energia antes de salvar' : undefined}
            >
              {saving ? 'Salvando…' : 'Salvar sessão'}
            </button>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(30,28,24,0.4)', display: 'grid', placeItems: 'center', zIndex: 70, padding: 20, fontFamily: theme.font },
  modal: { background: theme.card, borderRadius: theme.radius, boxShadow: '0 20px 60px rgba(0,0,0,0.18)', padding: 24, width: '100%', maxWidth: 420, maxHeight: '88vh', overflowY: 'auto', fontFamily: theme.font },
  h2: { fontSize: 18, fontWeight: 700, color: theme.ink, margin: 0 },
  subtitle: { fontSize: 13, color: theme.inkSoft, margin: '4px 0 14px' },
  row2: { display: 'flex', gap: 12 },
  col: { flex: 1 },
  label: { display: 'block', fontSize: 12.5, fontWeight: 600, color: theme.inkSoft, margin: '14px 0 6px' },
  opt: { fontWeight: 400, color: theme.inkFaint },
  input: { width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: theme.radiusSm, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, background: theme.card, fontSize: 14, color: theme.ink, fontFamily: 'inherit', outline: 'none' },
  range: { width: '100%', accentColor: theme.teal, marginTop: 8 },
  checkRow: { display: 'flex', alignItems: 'flex-start', gap: 9, margin: '14px 0 0', fontSize: 13, color: theme.inkSoft, cursor: 'pointer', lineHeight: 1.4 },
  checkbox: { width: 16, height: 16, accentColor: theme.teal, marginTop: 1, flexShrink: 0, cursor: 'pointer' },
  segment: { display: 'flex', gap: 6 },
  segBtn: { flex: 1, padding: '9px 8px', borderRadius: theme.radiusSm, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, background: theme.card, color: theme.inkSoft, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
  segBtnActive: { borderColor: theme.teal, background: theme.teal, color: '#fff', fontWeight: 600 },
  textarea: { width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: theme.radiusSm, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, background: theme.card, fontSize: 14, color: theme.ink, fontFamily: 'inherit', outline: 'none', resize: 'vertical' },
  hint: { fontSize: 12, color: theme.inkFaint, textAlign: 'center', marginTop: 12, marginBottom: 0 },
  actions: { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 },
  cancel: { padding: '10px 18px', borderRadius: theme.radiusSm, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, background: theme.card, color: theme.inkSoft, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
  save: { padding: '10px 18px', borderRadius: theme.radiusSm, border: 'none', background: theme.teal, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  saveDisabled: { opacity: 0.5, cursor: 'not-allowed' },
};
