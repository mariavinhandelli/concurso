'use client';

import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { useStudySession } from '@/hooks/useStudySession';
import { useToast } from '@/components/ui/ToastProvider';
import { useConfirm } from '@/hooks/useConfirm';
import { calculateNextReview, INITIAL_SR_STATE, type RecallGrade } from '@/lib/spaced-repetition';
import { fromDbRow } from '@/lib/spaced-repetition.mapper';
import { theme, kbd as kbdStyle } from '@/lib/theme';
import type { ReviewRating, QueueCard } from '@/services/flashcards.service';

interface Props {
  queue: QueueCard[];
  onFinish: () => void;
  onExit?: () => void;
}

const RATINGS: { key: ReviewRating; grade: RecallGrade; label: string; fg: string; bg: string }[] = [
  { key: 'dificil',       grade: 'dificil', label: 'Difícil',       fg: theme.crit, bg: theme.critBg },
  { key: 'intermediario', grade: 'bom',     label: 'Intermediário',  fg: theme.warn, bg: theme.warnBg },
  { key: 'facil',         grade: 'facil',   label: 'Fácil',          fg: theme.ok,   bg: theme.okBg },
];

function formatDays(days: number): string {
  if (days <= 1) return '1 dia';
  if (days < 7)  return `${days} dias`;
  if (days < 30) return `${Math.round(days / 7)} sem`;
  if (days < 60) return '1 mês';
  if (days < 365) return `${Math.round(days / 30)} meses`;
  return `${Math.round(days / 365)} ano`;
}

export function FlashcardEngine({ queue, onFinish, onExit }: Props) {
  const toast = useToast();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const onError = useCallback((msg: string) => toast.error(msg), [toast]);
  const session = useStudySession(queue, onError);

  const sessionRef = useRef(session);
  sessionRef.current = session;

  const liftingRef = useRef(false);
  const [lifting, setLifting] = useState(false);
  const [ghostRating, setGhostRating] = useState<{ label: string; days: number } | null>(null);

  const progressBarStyle = useMemo(
    () => ({ ...styles.progressBar, width: `${session.progress}%` }),
    [session.progress],
  );
  const badgeStyle = useMemo(
    () => ({ ...styles.badge, background: session.current?.subjectColor ?? theme.teal }),
    [session.current?.subjectColor],
  );
  const cardStyle = useMemo(() => ({
    ...styles.card,
    opacity: lifting ? 0 : 1,
    transform: lifting ? 'translateY(-6px) scale(0.98)' : 'translateY(0) scale(1)',
    transition: 'opacity 0.1s ease, transform 0.1s ease',
  }), [lifting]);

  // Intervalos previsionais para o card atual
  const intervals = useMemo(() => {
    const c = session.current;
    if (!c) return null;
    const srState = c.isNew
      ? INITIAL_SR_STATE
      : fromDbRow({
          ease_factor: c.easeFactor ?? null,
          interval_days: c.intervalDays ?? null,
          repetitions: c.repetitions ?? null,
        });
    const result: Record<string, number> = {};
    for (const r of RATINGS) {
      result[r.key] = calculateNextReview(srState, r.grade).intervalDays;
    }
    return result as Record<ReviewRating, number>;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.current?.id]);

  const handleFlip = useCallback(() => {
    if (liftingRef.current) return;
    liftingRef.current = true;
    setLifting(true);
    setTimeout(() => {
      sessionRef.current.flip();
      setLifting(false);
      setTimeout(() => { liftingRef.current = false; }, 100);
    }, 100);
  }, []);

  const handleRate = useCallback(async (r: (typeof RATINGS)[0]) => {
    const days = intervals?.[r.key];
    await sessionRef.current.rate(r.key);
    if (days != null) {
      setGhostRating({ label: r.label, days });
      setTimeout(() => setGhostRating(null), 1800);
    }
  }, [intervals]);

  // Refs estáveis para o keyboard handler (registrado uma única vez)
  const handleFlipRef = useRef(handleFlip);
  handleFlipRef.current = handleFlip;
  const handleRateRef = useRef(handleRate);
  handleRateRef.current = handleRate;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const s = sessionRef.current;
      if (s.isFinished) return;
      if (e.key === ' ' || e.code === 'Space') { e.preventDefault(); handleFlipRef.current(); }
      if (s.flipped) {
        if (e.key === '1') void handleRateRef.current(RATINGS[0]);
        if (e.key === '2') void handleRateRef.current(RATINGS[1]);
        if (e.key === '3') void handleRateRef.current(RATINGS[2]);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  async function handleExitClick() {
    if (!onExit) return;
    if (session.index === 0) { onExit(); return; }
    const ok = await confirm({
      title: 'Sair da sessão?',
      description: `Você completou ${session.index} de ${session.total} cards. O progresso feito já foi salvo.`,
      confirmLabel: 'Sair',
    });
    if (ok) onExit();
  }

  if (session.isFinished) {
    return (
      <div style={styles.done}>
        {confirmDialog}
        <span style={styles.doneIcon}>✓</span>
        <p style={styles.doneText}>Sessão concluída!</p>
        <div style={styles.doneSummary}>
          <div style={styles.doneStatBox}>
            <span style={styles.doneStatNum}>{session.total}</span>
            <span style={styles.doneStatLabel}>revisados</span>
          </div>
          {session.newLearned > 0 && (
            <div style={styles.doneStatBox}>
              <span style={{ ...styles.doneStatNum, color: theme.teal }}>{session.newLearned}</span>
              <span style={styles.doneStatLabel}>novos</span>
            </div>
          )}
        </div>
        <button onClick={onFinish} style={styles.finishBtn}>Voltar</button>
      </div>
    );
  }

  const { current, flipped, saving, remaining, pendingCount, newCount } = session;

  return (
    <div style={styles.engine}>
      {confirmDialog}

      <div style={styles.topBar}>
        {onExit && (
          <button onClick={handleExitClick} style={styles.exitBtn}>✕ Sair</button>
        )}
        <div style={styles.progressTrack}>
          <div style={progressBarStyle} />
        </div>
        <span style={styles.progressLabel}>{session.index}/{session.total}</span>
      </div>

      <div style={styles.counters}>
        <span style={styles.counterPending}>Revisões: {pendingCount}</span>
        <span style={styles.counterNew}>Novos: {newCount}</span>
      </div>

      <div style={cardStyle} onClick={handleFlip}>
        {current?.subjectName && (
          <span style={badgeStyle}>{current.subjectName}{current.isNew ? ' · novo' : ''}</span>
        )}
        <div style={styles.cardContent}>
          <p style={styles.face}>{current?.front}</p>
          {flipped && (
            <>
              <div style={styles.sep} />
              <p style={styles.faceBack}>{current?.back}</p>
            </>
          )}
        </div>
        {!flipped && <p style={styles.flipHint}>clique ou pressione Espaço para ver a resposta</p>}
      </div>

      {flipped ? (
        <>
          <div style={styles.ratings}>
            {RATINGS.map((r, i) => (
              <button
                key={r.key}
                onClick={() => handleRate(r)}
                disabled={saving}
                style={{ ...ratingStyles[i], opacity: saving ? 0.55 : 1 }}
              >
                <span style={styles.ratingKey}>{i + 1}</span>
                <span style={styles.ratingLabel}>{r.label}</span>
                {intervals && (
                  <span style={styles.ratingInterval}>{formatDays(intervals[r.key])}</span>
                )}
              </button>
            ))}
          </div>
          <p style={styles.keyHint}>
            <kbd style={kbdStyle}>1</kbd>
            {' · '}
            <kbd style={kbdStyle}>2</kbd>
            {' · '}
            <kbd style={kbdStyle}>3</kbd>
          </p>
        </>
      ) : (
        ghostRating ? (
          <p style={styles.ghostFeedback}>
            ✓ {ghostRating.label} — próxima revisão em {formatDays(ghostRating.days)}
          </p>
        ) : (
          <p style={styles.remainingHint}>
            {remaining} {remaining === 1 ? 'card restante' : 'cards restantes'}
          </p>
        )
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  engine: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, width: '100%', fontFamily: theme.font },
  topBar: { display: 'flex', alignItems: 'center', gap: 10, width: '100%' },
  exitBtn: { border: 'none', background: 'transparent', color: theme.inkFaint, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, padding: '4px 0' },
  progressTrack: { flex: 1, height: 4, background: theme.line, borderRadius: 2, overflow: 'hidden' },
  progressBar: { height: '100%', background: theme.teal, borderRadius: 2, transition: 'width 0.3s ease' },
  progressLabel: { fontSize: 12, color: theme.inkFaint, flexShrink: 0, fontVariantNumeric: 'tabular-nums' },
  counters: { display: 'flex', gap: 16 },
  counterPending: { fontSize: 13, color: theme.inkSoft, background: 'rgba(15,23,42,.05)', padding: '4px 12px', borderRadius: 10, fontWeight: 500 },
  counterNew: { fontSize: 13, color: theme.tealDeep, background: theme.tealBg, padding: '4px 12px', borderRadius: 10, fontWeight: 500 },
  card: { width: '100%', minHeight: 260, background: theme.card, borderRadius: 20, border: `0.5px solid ${theme.line}`, padding: 32, cursor: 'pointer', display: 'flex', flexDirection: 'column', boxShadow: theme.shadow, minWidth: 0, boxSizing: 'border-box' },
  badge: { alignSelf: 'flex-start', fontSize: 12, color: '#fff', padding: '3px 10px', borderRadius: 8, fontWeight: 600, marginBottom: 8 },
  cardContent: { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' },
  face: { fontSize: 20, color: theme.ink, textAlign: 'center', margin: 0, fontWeight: 600, overflowWrap: 'break-word', wordBreak: 'break-word' },
  sep: { height: 1, background: theme.line, margin: '20px 0' },
  faceBack: { fontSize: 17, color: theme.inkSoft, textAlign: 'center', margin: 0, overflowWrap: 'break-word', wordBreak: 'break-word' },
  flipHint: { fontSize: 12, color: theme.inkFaint, textAlign: 'center', margin: '12px 0 0' },
  remainingHint: { fontSize: 13, color: theme.inkFaint, margin: 0 },
  ghostFeedback: { fontSize: 13, color: theme.ok, margin: 0, fontWeight: 500 },
  ratings: { display: 'flex', gap: 8, width: '100%' },
  ratingBtn: { flex: 1, minWidth: 0, padding: '12px 6px 10px', borderRadius: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 },
  ratingKey: { fontSize: 10, opacity: 0.5 },
  ratingLabel: { fontWeight: 600, fontSize: 14 },
  ratingInterval: { fontSize: 11, opacity: 0.65, fontWeight: 400 },
  keyHint: { fontSize: 11, color: theme.inkFaint, margin: 0 },
  done: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '60px 0' },
  doneIcon: { fontSize: 48, color: theme.ok },
  doneText: { fontSize: 18, color: theme.ink, margin: 0, fontWeight: 600 },
  doneSummary: { display: 'flex', gap: 32, alignItems: 'center' },
  doneStatBox: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 },
  doneStatNum: { fontSize: 36, color: theme.ink, fontWeight: 700, letterSpacing: -1, fontVariantNumeric: 'tabular-nums', lineHeight: 1 },
  doneStatLabel: { fontSize: 12, color: theme.inkFaint, fontWeight: 500 },
  finishBtn: { marginTop: 8, padding: '12px 28px', borderRadius: 12, border: 'none', background: theme.teal, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
};

const ratingStyles = RATINGS.map(r => ({ ...styles.ratingBtn, color: r.fg, background: r.bg }));
