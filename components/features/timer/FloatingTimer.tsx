// components/features/timer/FloatingTimer.tsx
// Cronômetro flutuante global no canto inferior direito. Três estados:
// parado (botão redondo), rodando (pílula com tempo), expandido (cartão).
// Consome o timer único do TimerContext; encerra abrindo o feedback existente.
'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTimer } from './TimerContext';
import { saveStudyLog, type SessionFeedback } from '@/services/studyLogs.service';
import { getSessionTargetLabel } from '@/services/topics.service';
import { refreshHomeAfterSession } from '@/lib/home-refresh';
import { QualitativeFeedbackForm } from './QualitativeFeedbackForm';
import { theme } from '@/lib/theme';
import { useUI } from '@/components/layout/UIContext';
import { useToast } from '@/components/ui/ToastProvider';
import { SESSION_MODES } from '@/lib/session-modes';
import type { LogMode } from '@/lib/timer-storage';

export function FloatingTimer() {
  const timer = useTimer();
  const queryClient = useQueryClient();
  const { isMobile, mobileOpen } = useUI();
  const toast = useToast();
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // O que está sendo cronometrado ("Matéria · Tópico") — sem isso o usuário
  // abria o painel e não sabia a que sessão o tempo pertencia.
  const alvoSubjectId = timer.active?.subjectId ?? null;
  const alvoTopicId = timer.active?.topicId ?? null;
  const { data: alvoLabel } = useQuery({
    queryKey: ['timer-alvo', alvoSubjectId, alvoTopicId],
    queryFn: () => getSessionTargetLabel(alvoSubjectId, alvoTopicId),
    enabled: !!(alvoSubjectId || alvoTopicId),
    staleTime: Infinity,
  });

  // Fecha o picker ao clicar fora dele.
  useEffect(() => {
    if (!showPicker) return;
    function onDown(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [showPicker]);

  // Fecha o picker com Escape.
  useEffect(() => {
    if (!showPicker) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setShowPicker(false); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [showPicker]);

  // O timer continua contando no contexto, mas sua interface não disputa espaço
  // nem camada com o drawer de navegação no mobile.
  if (isMobile && mobileOpen) return null;

  function startWithMode(mode: LogMode) {
    timer.start({ mode });
    setShowPicker(false);
  }

  async function handleSubmitFeedback(feedback: SessionFeedback) {
    if (!timer.pendingSession) return;
    setSaving(true);
    try {
      await saveStudyLog(timer.pendingSession, feedback);
      timer.discardPending();
      setExpanded(false);
      refreshHomeAfterSession(queryClient);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  // Encerrando: QualitativeFeedbackForm já tem overlay próprio — não duplicar.
  if (timer.status === 'awaiting_feedback' && timer.pendingSession) {
    return (
      <QualitativeFeedbackForm
        session={timer.pendingSession}
        onSubmit={handleSubmitFeedback}
        onDiscard={() => { timer.discardPending(); setExpanded(false); }}
        saving={saving}
      />
    );
  }

  const pos = { bottom: isMobile ? 16 : 24, right: isMobile ? 16 : 24 };

  // PARADO: FAB que abre o picker de modo.
  if (timer.status === 'idle') {
    if (showPicker) {
      return (
        <div ref={pickerRef} style={{ ...styles.card, ...pos, width: isMobile ? 'calc(100vw - 32px)' : 236, maxWidth: 340 }}>
          <div style={styles.cardHead}>
            <span style={styles.eyebrow}>Iniciar sessão</span>
            <button className="icon-touch-target" onClick={() => setShowPicker(false)} style={styles.collapseBtn} aria-label="Fechar">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div style={styles.modeGrid}>
            {SESSION_MODES.map((m) => (
              <button
                key={m.value}
                onClick={() => startWithMode(m.value as LogMode)}
                className="touch-target"
                style={styles.modeBtn}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      );
    }

    return (
      <button
        onClick={() => setShowPicker(true)}
        style={{ ...styles.fab, ...pos }}
        aria-label="Iniciar sessão de estudo"
        title="Iniciar sessão de estudo"
      >
        {/* fill explícito (não currentColor) — garante contraste em todas as paletas, inclusive grafite */}
        <svg width="22" height="22" viewBox="0 0 24 24" fill={theme.onTeal}>
          <path d="M8 5v14l11-7z" />
        </svg>
      </button>
    );
  }

  // RODANDO ou PAUSADO, recolhido: pílula com tempo.
  if (!expanded) {
    return (
      <button onClick={() => setExpanded(true)} style={{ ...styles.pill, ...pos }} aria-label="Abrir cronômetro">
        <span style={{ ...styles.pillDot, background: timer.isRunning ? theme.tealSoft : theme.clay }} />
        <span style={styles.pillTime}>{timer.formatted}</span>
      </button>
    );
  }

  // EXPANDIDO: cartão com controles.
  return (
    <div style={{ ...styles.card, ...pos, width: isMobile ? 'calc(100vw - 32px)' : 220, maxWidth: 340 }}>
      <div style={styles.cardHead}>
        <span style={styles.eyebrow}>Sessão de estudo</span>
        <button onClick={() => setExpanded(false)} style={styles.collapseBtn} aria-label="Recolher">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </div>
      <div style={styles.cardTime}>{timer.formatted}</div>
      {alvoLabel && <div style={styles.cardAlvo} title={alvoLabel}>{alvoLabel}</div>}
      <div style={styles.cardStatus}>
        <span style={{ ...styles.pillDot, background: timer.isRunning ? theme.tealSoft : theme.clay }} />
        {timer.isRunning ? 'em andamento' : 'pausado'}
      </div>
      <button
        onClick={() => window.dispatchEvent(new CustomEvent('focali:open-focus'))}
        style={styles.focusBtn}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" /></svg>
        Modo foco
      </button>
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
  cardHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modeGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 },
  modeBtn: {
    padding: '9px 6px', borderRadius: theme.radiusXs, borderWidth: 0.5, borderStyle: 'solid',
    borderColor: theme.line, background: theme.card, color: theme.inkSoft,
    fontSize: 12.5, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
    transition: 'background .12s, color .12s',
  },
  eyebrow: { fontSize: 10, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: theme.inkFaint },
  collapseBtn: { border: 'none', background: 'transparent', color: theme.inkFaint, cursor: 'pointer', padding: 0, display: 'grid', placeItems: 'center' },
  cardTime: { fontSize: 34, fontWeight: 500, color: theme.ink, fontVariantNumeric: 'tabular-nums', letterSpacing: -1, lineHeight: 1 },
  cardAlvo: { fontSize: 12, fontWeight: 600, color: theme.inkSoft, marginTop: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  cardStatus: { display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: theme.inkSoft, margin: '8px 0 14px' },
  focusBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, width: '100%', padding: '9px 0', marginBottom: 8, borderRadius: theme.radiusSm, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, background: theme.card, color: theme.inkSoft, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  cardActions: { display: 'flex', gap: 8 },
  secondary: { flex: 1, padding: '9px 0', borderRadius: theme.radiusSm, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, background: theme.card, color: theme.inkSoft, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
  primary: { flex: 1, padding: '9px 0', borderRadius: theme.radiusSm, border: 'none', background: theme.teal, color: theme.onTeal, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
};
