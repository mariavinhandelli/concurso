'use client';

import { useEffect, useRef, useState } from 'react';
import { useStudyTimer } from '@/hooks/useStudyTimer';
import { saveStudyLog, type SessionFeedback } from '@/services/studyLogs.service';
import { QualitativeFeedbackForm } from './QualitativeFeedbackForm';
import { theme } from '@/lib/theme';

interface Props {
  autoStart?: { topicId: string | null; subjectId: string | null } | null;
}

export function StudyTimer({ autoStart = null }: Props) {
  const timer = useStudyTimer();
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const didAutoStart = useRef(false);

  useEffect(() => {
    if (autoStart && !didAutoStart.current && timer.status === 'idle') {
      didAutoStart.current = true;
      timer.start({
        mode: 'teoria',
        topicId: autoStart.topicId,
        subjectId: autoStart.subjectId,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, timer.status]);

  async function handleSubmitFeedback(feedback: SessionFeedback) {
    if (!timer.pendingSession) return;
    setSaving(true);
    setErrorMsg('');
    try {
      await saveStudyLog(timer.pendingSession, feedback);
      timer.discardPending();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  const statusLabel =
    timer.isRunning ? 'em andamento'
    : timer.isPaused ? 'pausado'
    : timer.status === 'awaiting_feedback' ? 'registre a sessão'
    : 'pronto para começar';

  const statusColor = timer.isRunning ? theme.teal : timer.isPaused ? theme.clay : theme.inkFaint;

  return (
    <div style={styles.container}>
      <div style={styles.head}>
        <span style={styles.eyebrow}>Sessão de estudo</span>
        <span style={{ ...styles.status, color: statusColor }}>
          <span style={{ ...styles.dot, background: statusColor }} />
          {statusLabel}
        </span>
      </div>

      <div style={styles.displayWrap}>
        <div style={{ ...styles.display, color: timer.isRunning ? theme.ink : theme.inkSoft }}>
          {timer.formatted}
        </div>
      </div>

      <div style={styles.controls}>
        {timer.status === 'idle' && (
          <button style={styles.primary} onClick={() => timer.start({ mode: 'teoria' })}>
            Iniciar sessão
          </button>
        )}
        {timer.isRunning && (
          <>
            <button style={styles.secondary} onClick={timer.pause}>Pausar</button>
            <button style={styles.primary} onClick={timer.stop}>Encerrar</button>
          </>
        )}
        {timer.isPaused && (
          <>
            <button style={styles.secondary} onClick={timer.resume}>Retomar</button>
            <button style={styles.primary} onClick={timer.stop}>Encerrar</button>
          </>
        )}
      </div>

      {errorMsg && <p style={styles.error}>{errorMsg}</p>}

      {timer.status === 'awaiting_feedback' && timer.pendingSession && (
        <QualitativeFeedbackForm
          session={timer.pendingSession}
          onSubmit={handleSubmitFeedback}
          onDiscard={timer.discardPending}
          saving={saving}
        />
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex', flexDirection: 'column', height: '100%',
    fontFamily: theme.font, gap: 0,
  },
  head: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  eyebrow: {
    fontSize: 11, fontWeight: 500, color: theme.inkFaint,
    letterSpacing: 1, textTransform: 'uppercase',
  },
  status: {
    fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6,
  },
  dot: { width: 7, height: 7, borderRadius: '50%', display: 'inline-block' },
  displayWrap: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-start',
    margin: '12px 0',
  },
  display: {
    fontSize: 72, fontWeight: 500, letterSpacing: -3,
    fontVariantNumeric: 'tabular-nums', lineHeight: 1,
  },
  controls: { display: 'flex', gap: 10 },
  primary: {
    padding: '12px 24px', borderRadius: 12, border: 'none',
    background: theme.teal, color: '#fff', fontSize: 14.5, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s',
  },
  secondary: {
    padding: '12px 24px', borderRadius: 12, border: `0.5px solid ${theme.line}`,
    background: theme.card, color: theme.inkSoft, fontSize: 14.5, fontWeight: 500,
    cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s',
  },
  error: { color: theme.danger, fontSize: 13, marginTop: 8 },
};