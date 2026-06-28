// components/features/timer/ManualLogModal.tsx
// Registro manual de estudo (retroativo): pra quando esqueceu o timer ou
// estudou offline. Reaproveita saveStudyLog — mesmos efeitos de uma sessão real.
'use client';

import { useEffect, useRef, useState } from 'react';
import { listSubjects, type Subject } from '@/services/subjects.service';
import { listTopics, type Topic } from '@/services/topics.service';
import { saveStudyLog, type ErrorCause } from '@/services/studyLogs.service';
import { SESSION_MODES, modeUsesQuestions } from '@/lib/session-modes';
import { createClient } from '@/lib/supabase/client';
import { useConfirm } from '@/hooks/useConfirm';
import {
  createSessionId,
  type LogMode,
  type PendingSession,
} from '@/lib/timer-storage';
import { theme } from '@/lib/theme';
import { toLocalDateString } from '@/lib/local-date';

interface Props {
  onClose: () => void;
  onSaved: () => void;
}

const ERROR_CAUSES: { value: ErrorCause; label: string }[] = [
  { value: 'teoria', label: 'Teoria' },
  { value: 'interpretacao', label: 'Interpretação' },
  { value: 'tempo', label: 'Tempo' },
];

export function ManualLogModal({ onClose, onSaved }: Props) {
  const sessionIdRef = useRef(createSessionId());
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);

  const [date, setDate] = useState(() => toLocalDateString());
  const [subjectId, setSubjectId] = useState('');
  const [topicId, setTopicId] = useState('');
  const [hours, setHours] = useState('0');
  const [minutes, setMinutes] = useState('30');
  const [mode, setMode] = useState<LogMode>('teoria');
  const [qFeedback, setQFeedback] = useState('');
  const [energy, setEnergy] = useState(0);
  const [qTotal, setQTotal] = useState('');
  const [qCorrect, setQCorrect] = useState('');
  const [errorCause, setErrorCause] = useState<ErrorCause | null>(null);
  const [scheduleReview, setScheduleReview] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const { confirm: confirmDiscard, dialog: discardDialog } = useConfirm();

  const isDirty = subjectId !== '' || energy > 0 || qFeedback.trim() !== '';

  async function handleOverlayClick() {
    if (isDirty) {
      if (!await confirmDiscard({ title: 'Descartar o registro?', description: 'As informações preenchidas serão perdidas.', confirmLabel: 'Descartar' })) return;
    }
    onClose();
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') handleOverlayClick(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDirty]);

  useEffect(() => {
    listSubjects().then(setSubjects).catch(() => setError('Erro ao carregar matérias. Recarregue a página.'));
  }, []);

  useEffect(() => {
    if (!subjectId) { setTopics([]); setTopicId(''); return; }
    listTopics(subjectId).then(setTopics).catch(() => setTopics([]));
    setTopicId('');
  }, [subjectId]);

  // Se trocar de tópico e ficar sem tópico, desliga o agendar revisão.
  useEffect(() => {
    if (!topicId) setScheduleReview(false);
  }, [topicId]);

  const isQuestoes = modeUsesQuestions(mode);
  // Só pergunta a causa quando houve erro de fato nesta sessão.
  const houveErro = isQuestoes && Number(qTotal) > 0 && Number(qTotal) > Number(qCorrect);

  // Limpa a causa se o cenário deixou de ter erro (corrigiu números, trocou tipo).
  useEffect(() => {
    if (!houveErro && errorCause !== null) setErrorCause(null);
  }, [houveErro, errorCause]);

  async function handleSave() {
    if (!subjectId) { setError('Escolha uma matéria.'); return; }
    const totalMin = (Number(hours) || 0) * 60 + (Number(minutes) || 0);
    if (totalMin <= 0) { setError('Informe uma duração maior que zero.'); return; }
    if (energy === 0) { setError('Marque o nível de energia da sessão.'); return; }

    setSaving(true);
    setError('');

    if (!date) { setError('Informe a data.'); setSaving(false); return; }
    const start = new Date(date + 'T12:00:00');
    if (isNaN(start.getTime())) { setError('Data inválida. Verifique o campo de data.'); setSaving(false); return; }
    const end = new Date(start.getTime() + totalMin * 60 * 1000);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError('Você precisa estar logado.'); setSaving(false); return; }

    const session: PendingSession = {
      userId: user.id,
      sessionId: sessionIdRef.current,
      topicId: topicId || null,
      subjectId,
      boardId: null,
      mode,
      startedAt: start.getTime(),
      endedAt: end.getTime(),
      durationSec: totalMin * 60,
      source: 'manual',
    };

    const feedback = {
      mode,
      subjectId,
      topicId: topicId || null,
      qualitativeFeedback: qFeedback.trim(),
      energyLevel: energy,
      insight: '',
      questionsTotal: isQuestoes ? Number(qTotal) || 0 : 0,
      questionsCorrect: isQuestoes ? Number(qCorrect) || 0 : 0,
      errorCause: houveErro ? errorCause : null,
      // Agendar revisão: só quando há tópico e o usuário marcou.
      reviewIntent: (topicId && scheduleReview) ? { active: true, was: false } : null,
    };

    try {
      await saveStudyLog(session, feedback);
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar.');
      setSaving(false);
    }
  }

  return (
    <>
    {discardDialog}
    <div style={styles.overlay} onClick={handleOverlayClick}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 style={styles.h2}>Registrar estudo</h2>
        <p style={styles.subtitle}>Pra quando você estudou sem o cronômetro.</p>

        <div style={styles.row2}>
          <div style={styles.col}>
            <label style={styles.label}>Data</label>
            <input type="date" value={date} max={toLocalDateString()} onChange={(e) => setDate(e.target.value)} style={styles.input} />
          </div>
          <div style={styles.col}>
            <label style={styles.label}>Tipo</label>
            <select value={mode} onChange={(e) => setMode(e.target.value as LogMode)} style={styles.input}>
              {SESSION_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
        </div>

        <label style={styles.label}>Matéria</label>
        <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} style={styles.input}>
          <option value="">Selecione…</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>

        <label style={styles.label}>Tópico (opcional)</label>
        <select value={topicId} onChange={(e) => setTopicId(e.target.value)} style={styles.input} disabled={!subjectId || topics.length === 0}>
          <option value="">— sem tópico específico —</option>
          {topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>

        {/* Agendar revisão — só com tópico selecionado */}
        {topicId && (
          <label style={styles.checkRow}>
            <input type="checkbox" checked={scheduleReview} onChange={(e) => setScheduleReview(e.target.checked)} style={styles.checkbox} />
            <span>Agendar revisão deste tópico (entra no ciclo a partir de amanhã)</span>
          </label>
        )}

        <label style={styles.label}>Duração</label>
        <div style={styles.durRow}>
          <input type="number" min="0" value={hours} onChange={(e) => setHours(e.target.value)} style={styles.durInput} />
          <span style={styles.durUnit}>h</span>
          <input type="number" min="0" max="59" value={minutes} onChange={(e) => setMinutes(e.target.value)} style={styles.durInput} />
          <span style={styles.durUnit}>min</span>
        </div>

        {isQuestoes && (
          <div style={styles.row2}>
            <div style={styles.col}>
              <label style={styles.label}>Questões feitas</label>
              <input type="number" min="0" value={qTotal} onChange={(e) => setQTotal(e.target.value)} style={styles.input} />
            </div>
            <div style={styles.col}>
              <label style={styles.label}>Acertos</label>
              <input type="number" min="0" value={qCorrect} onChange={(e) => setQCorrect(e.target.value)} style={styles.input} />
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
        <textarea value={qFeedback} onChange={(e) => setQFeedback(e.target.value)} rows={2} style={styles.textarea} placeholder="O que rendeu, o que travou…" />

        <label style={styles.label}>Energia: {energy === 0 ? '—' : `${energy}/5`}</label>
        <input type="range" min="0" max="5" value={energy} onChange={(e) => setEnergy(Number(e.target.value))} style={styles.range} />

        {error && <p role="alert" aria-live="polite" style={styles.error}>{error}</p>}

        <div style={styles.actions}>
          <button onClick={onClose} style={styles.cancel}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} style={styles.save}>
            {saving ? 'Salvando…' : 'Registrar'}
          </button>
        </div>
      </div>
    </div>
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(30,28,24,0.4)', display: 'grid', placeItems: 'center', zIndex: 60, padding: 20 },
  modal: { background: theme.card, borderRadius: theme.radius, boxShadow: '0 20px 60px rgba(0,0,0,0.18)', padding: 24, width: '100%', maxWidth: 420, maxHeight: '88vh', overflowY: 'auto', fontFamily: theme.font },
  h2: { fontSize: 18, fontWeight: 700, color: theme.ink, margin: 0 },
  subtitle: { fontSize: 13, color: theme.inkSoft, margin: '4px 0 14px' },
  row2: { display: 'flex', gap: 12 },
  col: { flex: 1 },
  label: { display: 'block', fontSize: 12.5, fontWeight: 600, color: theme.inkSoft, margin: '14px 0 6px' },
  opt: { fontWeight: 400, color: theme.inkFaint },
  input: { width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: theme.radiusSm, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, background: theme.card, fontSize: 14, color: theme.ink, fontFamily: 'inherit', outline: 'none' },
  checkRow: { display: 'flex', alignItems: 'flex-start', gap: 9, margin: '14px 0 0', fontSize: 13, color: theme.inkSoft, cursor: 'pointer', lineHeight: 1.4 },
  checkbox: { width: 16, height: 16, accentColor: theme.teal, marginTop: 1, flexShrink: 0, cursor: 'pointer' },
  segment: { display: 'flex', gap: 6 },
  segBtn: { flex: 1, padding: '9px 8px', borderRadius: theme.radiusSm, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, background: theme.card, color: theme.inkSoft, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
  segBtnActive: { borderColor: theme.teal, background: theme.teal, color: '#fff', fontWeight: 600 },
  durRow: { display: 'flex', alignItems: 'center', gap: 8 },
  durInput: { width: 64, boxSizing: 'border-box', padding: '10px 12px', borderRadius: theme.radiusSm, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, background: theme.card, fontSize: 14, color: theme.ink, fontFamily: 'inherit', outline: 'none', textAlign: 'center' },
  durUnit: { fontSize: 13, color: theme.inkSoft },
  textarea: { width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: theme.radiusSm, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, background: theme.card, fontSize: 14, color: theme.ink, fontFamily: 'inherit', outline: 'none', resize: 'vertical' },
  range: { width: '100%', accentColor: theme.teal },
  error: { color: theme.danger, fontSize: 13, margin: '12px 0 0' },
  actions: { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 },
  cancel: { padding: '10px 18px', borderRadius: theme.radiusSm, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, background: theme.card, color: theme.inkSoft, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
  save: { padding: '10px 18px', borderRadius: theme.radiusSm, border: 'none', background: theme.teal, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
};
