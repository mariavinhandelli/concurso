// components/features/timer/QualitativeFeedbackForm.tsx
// Tela de encerramento da sessão — visual alinhado ao registro manual.
// Energia (slider, obrigatória), tipo, matéria/tópico, revisão e um campo de texto.
'use client';

import { useEffect, useState } from 'react';
import { useConfirm } from '@/hooks/useConfirm';
import { useToast } from '@/components/ui/ToastProvider';
import type { PendingSession } from '@/hooks/useStudyTimer';
import type { SessionFeedback, ErrorCause } from '@/services/studyLogs.service';
import { listActive as listSubjectOptions } from '@/services/subjects.service';
import { listLeaves as listTopicOptions, type PickerOption } from '@/services/topics.service';
import { getReviewStatus } from '@/services/reviews.service';
import { SESSION_MODES, modeUsesQuestions } from '@/lib/session-modes';
import type { LogMode } from '@/lib/timer-storage';
import { theme } from '@/lib/theme';
import { Overlay } from '@/components/ui/Overlay';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';

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
    <Overlay onClose={handleDiscard} maxWidth={420} labelledBy="qualitative-feedback-title" closeOnBackdrop={false}>
        <h2 id="qualitative-feedback-title" style={styles.h2}>Sessão concluída</h2>
        <p style={styles.subtitle}>{min} min de estudo. Registre antes de fechar.</p>

        <div style={styles.row2}>
          <div style={styles.col}>
            <label style={styles.label}>Tipo</label>
            <Select value={mode} onChange={(e) => setMode(e.target.value as LogMode)}>
              {SESSION_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </Select>
          </div>
          <div style={styles.col}>
            <label style={styles.label}>Energia: {energy === 0 ? '—' : `${energy}/5`}</label>
            <input type="range" min="0" max="5" value={energy} onChange={(e) => setEnergy(Number(e.target.value))} style={styles.range} />
          </div>
        </div>

        <label style={styles.label}>Matéria</label>
        <Select value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setTopicId(''); }}>
          <option value="">— nenhuma —</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>

        <label style={styles.label}>Tópico (opcional)</label>
        <Select value={topicId} onChange={(e) => setTopicId(e.target.value)} disabled={!subjectId}>
          <option value="">— sem tópico específico —</option>
          {topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </Select>

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
              <Input type="number" min="0" value={total} onChange={(e) => setTotal(e.target.value)} />
            </div>
            <div style={styles.col}>
              <label style={styles.label}>Acertos</label>
              <Input type="number" min="0" value={correct} onChange={(e) => setCorrect(e.target.value)} />
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
        <Textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={2} placeholder="O que rendeu, o que travou…" />

        <div style={styles.actions}>
          <Button variant="outline" onClick={handleDiscard} disabled={saving}>Descartar</Button>
          <Button onClick={handleSubmit} loading={saving}>
            {saving ? 'Salvando…' : 'Salvar sessão'}
          </Button>
        </div>
    </Overlay>
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  h2: { fontSize: 18, fontWeight: 700, color: theme.ink, margin: 0 },
  subtitle: { fontSize: 13, color: theme.inkSoft, margin: '4px 0 14px' },
  row2: { display: 'flex', gap: 12 },
  col: { flex: 1 },
  label: { display: 'block', fontSize: 13, fontWeight: 600, color: theme.inkSoft, margin: '14px 0 6px' },
  opt: { fontWeight: 400, color: theme.inkFaint },
  range: { width: '100%', accentColor: theme.teal, marginTop: 8 },
  checkRow: { display: 'flex', alignItems: 'flex-start', gap: 9, margin: '14px 0 0', fontSize: 13, color: theme.inkSoft, cursor: 'pointer', lineHeight: 1.4 },
  checkbox: { width: 16, height: 16, accentColor: theme.teal, marginTop: 1, flexShrink: 0, cursor: 'pointer' },
  segment: { display: 'flex', gap: 6 },
  segBtn: { flex: 1, padding: '9px 8px', borderRadius: theme.radiusSm, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, background: theme.card, color: theme.inkSoft, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
  segBtnActive: { borderColor: theme.teal, background: theme.teal, color: theme.onTeal, fontWeight: 600 },
  actions: { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 },
};
