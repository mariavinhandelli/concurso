'use client';

import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { X, CheckCircle2, ChevronDown } from 'lucide-react';
import { useStudySession } from '@/hooks/useStudySession';
import { useToast } from '@/components/ui/ToastProvider';
import { useConfirm } from '@/hooks/useConfirm';
import { calculateNextReview, INITIAL_SR_STATE, type RecallGrade } from '@/lib/spaced-repetition';
import { fromDbRow } from '@/lib/spaced-repetition.mapper';
import { theme, kbd as kbdStyle } from '@/lib/theme';
import { Button } from '@/components/ui/Button';
import type { ReviewRating, QueueCard } from '@/services/flashcards.service';

interface Props {
  queue: QueueCard[];
  onFinish: () => void;
  onExit?: () => void;
}

const RATINGS: { key: ReviewRating; grade: RecallGrade; label: string; fg: string; bg: string }[] = [
  { key: 'errei',         grade: 'errou',   label: 'Errei',   fg: theme.danger,  bg: theme.dangerBg },
  { key: 'dificil',       grade: 'dificil', label: 'Difícil', fg: theme.inkSoft, bg: theme.muted  },
  { key: 'intermediario', grade: 'bom',     label: 'Médio',   fg: theme.info,    bg: theme.infoBg },
  { key: 'facil',         grade: 'facil',   label: 'Fácil',   fg: theme.okDeep,  bg: theme.okBg   },
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

  const liftingRef = useRef(false);
  const [lifting, setLifting] = useState(false);
  const [ghostRating, setGhostRating] = useState<{ label: string; days: number } | null>(null);

  // Timeouts das animações de flip/rate — precisam ser cancelados ao desmontar
  // (ex: saída no meio da sessão) para não chamar setState após o unmount.
  const timeoutsRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  useEffect(() => {
    const timeouts = timeoutsRef.current;
    return () => { timeouts.forEach(clearTimeout); timeouts.clear(); };
  }, []);
  const trackedTimeout = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(() => { timeoutsRef.current.delete(id); fn(); }, ms);
    timeoutsRef.current.add(id);
  }, []);

  const progressBarStyle = useMemo(
    () => ({ ...styles.progressBar, width: `${session.progress}%` }),
    [session.progress],
  );
  const badgeStyle = useMemo(
    () => ({
      ...styles.badge,
      background: session.current?.subjectColor ?? theme.teal,
      color: session.current?.subjectColor ? '#fff' : theme.onTeal,
    }),
    [session.current?.subjectColor],
  );
  const cardStyle = useMemo(() => ({
    ...styles.card,
    opacity: lifting ? 0 : 1,
    transform: lifting ? 'translateY(-6px) scale(0.98)' : 'translateY(0) scale(1)',
    transition: 'opacity 0.1s ease, transform 0.1s ease',
  }), [lifting]);

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
  }, [session.current?.id, session.current?.isNew, session.current?.easeFactor, session.current?.intervalDays, session.current?.repetitions]);

  const handleFlip = useCallback(() => {
    if (liftingRef.current) return;
    liftingRef.current = true;
    setLifting(true);
    trackedTimeout(() => {
      sessionRef.current.flip();
      setLifting(false);
      trackedTimeout(() => { liftingRef.current = false; }, 100);
    }, 100);
  }, [trackedTimeout]);

  const handleRate = useCallback(async (r: (typeof RATINGS)[0]) => {
    const days = r.key === 'errei' ? -1 : intervals?.[r.key]; // -1 = volta nesta sessão
    await sessionRef.current.rate(r.key);
    if (days != null) {
      setGhostRating({ label: r.label, days });
      trackedTimeout(() => setGhostRating(null), 1800);
    }
  }, [intervals, trackedTimeout]);

  const handleFlipRef = useRef(handleFlip);
  const handleRateRef = useRef(handleRate);

  // Refs só podem ser escritas fora do render — um único efeito pós-commit
  // mantém as três sincronizadas com os valores mais recentes.
  useEffect(() => {
    sessionRef.current = session;
    handleFlipRef.current = handleFlip;
    handleRateRef.current = handleRate;
  });

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
        if (e.key === '4') void handleRateRef.current(RATINGS[3]);
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
        <CheckCircle2
          size={52}
          strokeWidth={1.5}
          color={theme.ok}
          style={{ animation: 'done-pop 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards' }}
        />
        <p style={{ ...styles.doneText, animation: 'fade-up-in 0.3s ease 0.15s both' }}>Sessão concluída!</p>
        <div style={{ ...styles.doneSummary, animation: 'fade-up-in 0.3s ease 0.25s both' }}>
          <div style={styles.doneStatBox}>
            <span style={styles.doneStatNum}>{session.total}</span>
            <span style={styles.doneStatLabel}>revisados</span>
          </div>
          {session.newLearned > 0 && (
            <div style={styles.doneStatBox}>
              <span style={{ ...styles.doneStatNum, color: theme.ok }}>{session.newLearned}</span>
              <span style={styles.doneStatLabel}>novos</span>
            </div>
          )}
        </div>
        <Button onClick={onFinish} style={{ marginTop: 8, padding: '12px 28px', animation: 'fade-up-in 0.3s ease 0.35s both' }}>
          Voltar
        </Button>
      </div>
    );
  }

  const { current, flipped, saving, remaining, pendingCount, newCount } = session;

  return (
    <div style={styles.engine}>
      {confirmDialog}

      <div style={styles.topBar}>
        {onExit && (
          <button onClick={handleExitClick} style={styles.exitBtn}>
            <X size={13} strokeWidth={2} />
            Sair
          </button>
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
        {!flipped && (
          <div style={styles.flipHint}>
            <ChevronDown size={15} strokeWidth={1.5} />
          </div>
        )}
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
                  <span style={styles.ratingInterval}>
                    {r.key === 'errei' ? 'rever hoje' : formatDays(intervals[r.key])}
                  </span>
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
            {' · '}
            <kbd style={kbdStyle}>4</kbd>
          </p>
        </>
      ) : (
        ghostRating ? (
          <p style={{ ...styles.ghostFeedback, ...(ghostRating.days < 0 ? { color: theme.danger } : {}) }}>
            {ghostRating.days < 0
              ? '↩ Errei — o card volta no fim desta sessão'
              : `✓ ${ghostRating.label} — próxima revisão em ${formatDays(ghostRating.days)}`}
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
  exitBtn: { border: 'none', background: 'transparent', color: theme.inkFaint, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, padding: '4px 0', display: 'flex', alignItems: 'center', gap: 5 },
  progressTrack: { flex: 1, height: 4, background: theme.line, borderRadius: 2, overflow: 'hidden' },
  progressBar: { height: '100%', background: theme.teal, borderRadius: 2, transition: 'width 0.3s ease' },
  progressLabel: { fontSize: 12, color: theme.inkFaint, flexShrink: 0, fontVariantNumeric: 'tabular-nums' },
  counters: { display: 'flex', gap: 16 },
  counterPending: { fontSize: 13, color: theme.inkSoft, background: 'rgba(15,23,42,.05)', padding: '4px 12px', borderRadius: 10, fontWeight: 500 },
  counterNew: { fontSize: 13, color: theme.okDeep, background: theme.okBg, padding: '4px 12px', borderRadius: 10, fontWeight: 500 },
  card: { width: '100%', minHeight: 260, background: theme.card, borderRadius: 20, border: `1px solid ${theme.lineStrong}`, padding: 32, cursor: 'pointer', display: 'flex', flexDirection: 'column', boxShadow: '0 1px 2px var(--line), var(--shadow-card)', minWidth: 0, boxSizing: 'border-box' },
  badge: { alignSelf: 'flex-start', fontSize: 12, color: '#fff', padding: '3px 10px', borderRadius: 8, fontWeight: 600, marginBottom: 8 },
  cardContent: { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' },
  face: { fontSize: 20, color: theme.ink, textAlign: 'center', margin: 0, fontWeight: 600, overflowWrap: 'break-word', wordBreak: 'break-word' },
  sep: { height: 1, background: theme.line, margin: '20px 0' },
  faceBack: { fontSize: 17, color: theme.inkSoft, textAlign: 'center', margin: 0, overflowWrap: 'break-word', wordBreak: 'break-word' },
  flipHint: { display: 'flex', justifyContent: 'center', marginTop: 14, color: theme.inkFaint, opacity: 0.45 },
  remainingHint: { fontSize: 13, color: theme.inkFaint, margin: 0 },
  ghostFeedback: { fontSize: 13, color: theme.ok, margin: 0, fontWeight: 500 },
  ratings: { display: 'flex', gap: 8, width: '100%' },
  ratingBtn: { flex: 1, minWidth: 0, padding: '12px 6px 10px', borderRadius: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 },
  ratingKey: { fontSize: 10, opacity: 0.5 },
  ratingLabel: { fontWeight: 600, fontSize: 14 },
  ratingInterval: { fontSize: 11, opacity: 0.65, fontWeight: 400 },
  keyHint: { fontSize: 11, color: theme.inkFaint, margin: 0 },
  done: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '60px 0' },
  doneText: { fontSize: 18, color: theme.ink, margin: 0, fontWeight: 600 },
  doneSummary: { display: 'flex', gap: 32, alignItems: 'center' },
  doneStatBox: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 },
  doneStatNum: { fontSize: 36, color: theme.ink, fontWeight: 700, letterSpacing: -1, fontVariantNumeric: 'tabular-nums', lineHeight: 1 },
  doneStatLabel: { fontSize: 12, color: theme.inkFaint, fontWeight: 500 },
  finishBtn: { marginTop: 8, padding: '12px 28px', borderRadius: 12, border: 'none', background: theme.primary, color: theme.onTeal, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
};

const ratingStyles = RATINGS.map(r => ({ ...styles.ratingBtn, color: r.fg, background: r.bg }));
