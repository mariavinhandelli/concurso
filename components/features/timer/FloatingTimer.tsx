// components/features/timer/FloatingTimer.tsx
// Cronômetro flutuante global no canto inferior direito. Três estados:
// parado (botão redondo), rodando (pílula com tempo), expandido (cartão).
// Consome o timer único do TimerContext; encerra abrindo o feedback existente.
'use client';

import { useState } from 'react';
import { useTimer } from './TimerContext';
import { saveStudyLog, type SessionFeedback } from '@/services/studyLogs.service';
import { QualitativeFeedbackForm } from './QualitativeFeedbackForm';
import { theme } from '@/lib/theme';

export function FloatingTimer() {
  const timer = useTimer();
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmitFeedback(feedback: SessionFeedback) {
    if (!timer.pendingSession) return;
    setSaving(true);
    setErrorMsg('');
    try {
      await saveStudyLog(timer.pendingSession, feedback);
      timer.discardPending();
      setExpanded(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  // Encerrando: a tela de feedback aparece centralizada, por cima de tudo.
  if (timer.status === 'awaiting_feedback' && timer.pendingSession) {
    return (
      <div style={styles.overlay}>
        <div style={styles.feedbackCard}>
          {errorMsg && <p style={styles.error}>{errorMsg}</p>}
          <QualitativeFeedbackForm
            session={timer.pendingSession}
            onSubmit={handleSubmitFeedback}
            onDiscard={() => { timer.discardPending(); setExpanded(false); }}
            saving={saving}
          />
        </div>
      </div>
    );
  }

  // PARADO: botão redondo discreto.
  if (timer.status === 'idle') {
    return (
      <button
        onClick={() => timer.start({ mode: 'teoria' })}
        style={styles.fab}
        aria-label="Iniciar sessão de estudo"
        title="Iniciar sessão de estudo"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z" />
        </svg>
      </button>
    );
  }

  // RODANDO ou PAUSADO, recolhido: pílula com tempo.
  if (!expanded) {
    return (
      <button onClick={() => setExpanded(true)} style={styles.pill} aria-label="Abrir cronômetro">
        <span style={{ ...styles.pillDot, background: timer.isRunning ? theme.tealSoft : theme.clay }} />
        <span style={styles.pillTime}>{timer.formatted}</span>
      </button>
    );
  }

  // EXPANDIDO: cartão com controles.
  return (
    <div style={styles.card}>
      <div style={styles.cardHead}>
        <span style={styles.eyebrow}>Sessão de estudo</span>
        <button onClick={() => setExpanded(false)} style={styles.collapseBtn} aria-label="Recolher">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </div>
      <div style={styles.cardTime}>{timer.formatted}</div>
      <div style={styles.cardStatus}>
        <span style={{ ...styles.pillDot, background: timer.isRunning ? theme.tealSoft : theme.clay }} />
        {timer.isRunning ? 'em andamento' : 'pausado'}
      </div>
      <div style={styles.cardActions}>
        {timer.isRunning ? (
          <button onClick={timer.pause} style={styles.secondary}>Pausar</button>
        ) : (
          <button onClick={timer.resume} style={styles.secondary}>Retomar</button>
        )}
        <button onClick={timer.stop} style={styles.primary}>Encerrar</button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  fab: {
    position: 'fixed', bottom: 24, right: 24, zIndex: 50,
    width: 52, height: 52, borderRadius: '50%', border: 'none',
    background: theme.teal, color: theme.onTeal, cursor: 'pointer',
    display: 'grid', placeItems: 'center',
    boxShadow: '0 6px 20px rgba(0,0,0,0.18)', fontFamily: theme.font,
  },
  pill: {
    position: 'fixed', bottom: 24, right: 24, zIndex: 50,
    display: 'flex', alignItems: 'center', gap: 10,
    background: theme.teal, border: 'none', borderRadius: 999,
    padding: '11px 18px 11px 16px', cursor: 'pointer',
    boxShadow: '0 6px 20px rgba(0,0,0,0.18)', fontFamily: theme.font,
  },
  pillDot: { width: 8, height: 8, borderRadius: '50%', display: 'inline-block', flexShrink: 0 },
  pillTime: { fontSize: 16, fontWeight: 600, color: theme.onTeal, fontVariantNumeric: 'tabular-nums', letterSpacing: 0.5 },
  card: {
    position: 'fixed', bottom: 24, right: 24, zIndex: 50, width: 220,
    background: theme.card, borderRadius: theme.radius,
    borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line,
    padding: 16, boxShadow: '0 12px 40px rgba(0,0,0,0.16)', fontFamily: theme.font,
  },
  cardHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  eyebrow: { fontSize: 10, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: theme.inkFaint },
  collapseBtn: { border: 'none', background: 'transparent', color: theme.inkFaint, cursor: 'pointer', padding: 0, display: 'grid', placeItems: 'center' },
  cardTime: { fontSize: 34, fontWeight: 500, color: theme.ink, fontVariantNumeric: 'tabular-nums', letterSpacing: -1, lineHeight: 1 },
  cardStatus: { display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: theme.inkSoft, margin: '8px 0 14px' },
  cardActions: { display: 'flex', gap: 8 },
  secondary: { flex: 1, padding: '9px 0', borderRadius: theme.radiusSm, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, background: theme.card, color: theme.inkSoft, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
  primary: { flex: 1, padding: '9px 0', borderRadius: theme.radiusSm, border: 'none', background: theme.teal, color: theme.onTeal, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  overlay: { position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(30,28,24,0.4)', display: 'grid', placeItems: 'center', padding: 20 },
  feedbackCard: { background: theme.card, borderRadius: theme.radius, padding: 24, width: '100%', maxWidth: 420, maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' },
};