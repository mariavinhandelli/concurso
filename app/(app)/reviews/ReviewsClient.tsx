'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, TriangleAlert, CircleCheckBig, Layers } from 'lucide-react';
import { useReviews } from '@/hooks/useReviews';
import { ReviewCard } from '@/components/features/reviews/ReviewCard';
import { Skeleton } from '@/components/ui/Skeleton';
import { getNextScheduledDate } from '@/services/reviews.service';
import { getFlashcardStreak } from '@/services/flashcard-streak.service';
import { localDateInDays } from '@/lib/local-date';
import { theme } from '@/lib/theme';
import { PageContainer, PageHeader } from '@/components/ui/Page';
import type { ReviewRating } from '@/services/reviews.service';
import { REVIEWS_DUE_KEY } from '@/hooks/reviews.keys';

const QUICK_DEFER = [
  { label: '+1 dia',    days: 1  },
  { label: '+3 dias',   days: 3  },
  { label: '+1 semana', days: 7  },
  { label: '+1 mês',    days: 30 },
];

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
}

// ── Ícones SVG inline — mesma linguagem visual do Topbar ─────────────────

function WarnIcon({ color = theme.crit }: { color?: string }) {
  return <TriangleAlert size={22} color={color} strokeWidth={1.8} aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }} />;
}

function CheckCircleIcon({ size = 52 }: { size?: number }) {
  return (
    <CircleCheckBig size={size} fill={theme.okBg} color={theme.ok} strokeWidth={1.5}
      aria-hidden="true" style={{ display: 'block', margin: '0 auto 16px' }} />
  );
}

function CardDeckIcon() {
  return <Layers size={14} strokeWidth={2} aria-hidden="true" />;
}

function ChevronIcon({ rotated }: { rotated: boolean }) {
  return (
    <ChevronDown size={12} strokeWidth={2.5} aria-hidden="true"
      style={{
        transform: rotated ? 'rotate(180deg)' : 'rotate(0deg)',
        transition: 'transform 0.2s ease',
        flexShrink: 0,
      }} />
  );
}

// ── Botão com hover gerenciado por JS (inline styles não têm :hover) ──────

function HovBtn({
  base, hov, onClick, children,
}: {
  base: React.CSSProperties;
  hov: React.CSSProperties;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const [over, setOver] = useState(false);
  return (
    <button
      onMouseEnter={() => setOver(true)}
      onMouseLeave={() => setOver(false)}
      onClick={onClick}
      style={{ ...base, ...(over ? hov : {}) }}
    >
      {children}
    </button>
  );
}

// ── Badge de streak — sempre renderizado para evitar layout shift ─────────

function FlashcardStreakBadge({ streak }: { streak: { current: number; reviewedToday: boolean } | null }) {
  const visible = !!streak && streak.current > 0;
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '6px 12px', borderRadius: theme.radiusPill, flexShrink: 0,
        background: streak?.reviewedToday ? theme.tealBg : theme.muted,
        border: `0.5px solid ${streak?.reviewedToday ? theme.teal : theme.line}`,
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
        transition: 'opacity 0.3s ease',
      }}
      title={streak?.reviewedToday
        ? `${streak.current} dias seguidos revisando flashcards — você revisou hoje!`
        : `${streak?.current ?? 0} dias seguidos — revise hoje para manter a sequência!`}
    >
      <span style={{ color: streak?.reviewedToday ? theme.teal : theme.inkSoft, display: 'flex' }}>
        <CardDeckIcon />
      </span>
      <span style={{
        fontSize: 13, fontWeight: 600, fontFamily: theme.font,
        color: streak?.reviewedToday ? theme.teal : theme.inkSoft,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {streak?.current ?? 0} {(streak?.current ?? 0) === 1 ? 'dia' : 'dias'}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export function ReviewsClient() {
  const router      = useRouter();
  const queryClient = useQueryClient();
  const { items, isLoading, error, dialog, handleRate, handleReschedule, handleRemove } = useReviews();

  // ── Sessão: snapshot do total ao primeiro carregamento ───────────────────
  const [sessionTotal, setSessionTotal] = useState(0);
  const snappedRef = useRef(false);
  useEffect(() => {
    if (!snappedRef.current && items.length > 0) {
      snappedRef.current = true;
      setSessionTotal(items.length);
    }
  }, [items.length]);

  const doneCount   = Math.max(0, sessionTotal - items.length);
  const progressPct = sessionTotal > 0 ? Math.round((doneCount / sessionTotal) * 100) : 0;
  const current     = items[0] ?? null;

  // ── Animação de saída ────────────────────────────────────────────────────
  const [isExiting, setIsExiting] = useState(false);

  // ── Painel de adiamento ──────────────────────────────────────────────────
  const [showReschedule, setShowReschedule] = useState(false);

  const animateAndRate = useCallback((topicId: string, rating: ReviewRating) => {
    setIsExiting(true);
    setShowReschedule(false);
    setTimeout(() => { handleRate(topicId, rating); setIsExiting(false); }, 150);
  }, [handleRate]);

  const animateAndReschedule = useCallback((topicId: string, dateStr: string) => {
    setIsExiting(true);
    setShowReschedule(false);
    setTimeout(() => { handleReschedule(topicId, dateStr); setIsExiting(false); }, 150);
  }, [handleReschedule]);

  // ── Hover state local dos botões secundários ─────────────────────────────
  const [hovBtn,   setHovBtn]   = useState<string | null>(null);
  const [hovQuick, setHovQuick] = useState<number | null>(null);

  // ── Empty state: próxima data agendada ───────────────────────────────────
  const sessionDone = sessionTotal > 0 && items.length === 0 && !isLoading;
  const { data: nextDate } = useQuery({
    queryKey: ['reviews', 'next-date'],
    queryFn: getNextScheduledDate,
    enabled: sessionDone,
    staleTime: Infinity,
  });

  // ── Streak de flashcards ──────────────────────────────────────────────────
  const { data: fcStreak } = useQuery({
    queryKey: ['flashcard-streak'],
    queryFn: getFlashcardStreak,
    staleTime: 5 * 60_000,
  });

  // ── Skeleton ──────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <PageContainer width="narrow">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
          <Skeleton width={180} height={28} borderRadius={6} />
          <Skeleton width={90} height={28} borderRadius={99} />
        </div>
        <Skeleton width="100%" height={6} borderRadius={99} style={{ marginBottom: 32 }} />
        <div style={{ background: theme.card, borderRadius: theme.radius, border: `0.5px solid ${theme.line}`, padding: '28px' }}>
          <Skeleton width={80} height={20} borderRadius={8} style={{ marginBottom: 18 }} />
          <Skeleton width="80%" height={24} borderRadius={6} style={{ marginBottom: 8 }} />
          <Skeleton width="55%" height={24} borderRadius={6} style={{ marginBottom: 28 }} />
          <div style={{ display: 'flex', gap: 10 }}>
            <Skeleton height={70} borderRadius={12} style={{ flex: 1 }} />
            <Skeleton height={70} borderRadius={12} style={{ flex: 1 }} />
            <Skeleton height={70} borderRadius={12} style={{ flex: 1 }} />
          </div>
        </div>
      </PageContainer>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <PageContainer width="narrow">
        <PageHeader title="Revisões de hoje" />
        <div style={s.errorBox}>
          <WarnIcon />
          <div>
            <p style={s.errorMsg}>Não foi possível carregar as revisões.</p>
            <HovBtn
              base={s.retryBtn}
              hov={{ opacity: 0.85 }}
              onClick={() => queryClient.invalidateQueries({ queryKey: REVIEWS_DUE_KEY })}
            >
              Tentar novamente
            </HovBtn>
          </div>
        </div>
      </PageContainer>
    );
  }

  // ── Zero revisões ao entrar ────────────────────────────────────────────────
  if (items.length === 0 && !sessionDone) {
    return (
      <PageContainer width="narrow">
        <PageHeader title="Revisões de hoje" actions={<FlashcardStreakBadge streak={fcStreak ?? null} />} />
        <div style={s.emptyWrap}>
          <CheckCircleIcon size={52} />
          <p style={s.emptyTitle}>Tudo em dia!</p>
          <p style={s.emptySub}>Nenhum tópico para revisar agora.</p>
          <HovBtn
            base={s.ctaBtn}
            hov={{ background: theme.primaryHover }}
            onClick={() => router.push('/flashcards')}
          >
            Estudar flashcards →
          </HovBtn>
        </div>
      </PageContainer>
    );
  }

  // ── Sessão concluída ───────────────────────────────────────────────────────
  if (sessionDone) {
    return (
      <PageContainer width="narrow">
        <PageHeader title="Revisões de hoje" actions={<FlashcardStreakBadge streak={fcStreak ?? null} />} />
        <div style={s.celebrationWrap}>
          <CheckCircleIcon size={56} />
          <p style={s.celebrationTitle}>Sessão completa!</p>
          <p style={s.celebrationSub}>
            Você revisou <b>{sessionTotal}</b> {sessionTotal === 1 ? 'tópico' : 'tópicos'} hoje.
          </p>
          {nextDate && (
            <p style={s.nextDate}>Próxima revisão: <b>{fmtDate(nextDate)}</b></p>
          )}
          <div style={s.ctaRow}>
            <HovBtn
              base={s.ctaBtn}
              hov={{ background: theme.primaryHover }}
              onClick={() => router.push('/flashcards?study=now')}
            >
              Estudar flashcards →
            </HovBtn>
            <HovBtn
              base={s.ctaBtnSecondary}
              hov={{ background: theme.muted }}
              onClick={() => router.push('/')}
            >
              Voltar ao início
            </HovBtn>
          </div>
        </div>
      </PageContainer>
    );
  }

  // ── Modo sequencial ────────────────────────────────────────────────────────
  return (
    <>
      {dialog}
      <PageContainer width="narrow">

        {/* Header */}
        <PageHeader title="Revisões de hoje" actions={<FlashcardStreakBadge streak={fcStreak ?? null} />} />

        {/* Progresso da sessão */}
        {sessionTotal > 0 && (
          <div style={s.progressWrap}>
            <div style={s.progressTrack}>
              <div style={{ ...s.progressFill, width: `${progressPct}%` }} />
            </div>
            <span style={s.progressLabel}>{doneCount} / {sessionTotal}</span>
          </div>
        )}

        {/* Card único — key força remontagem a cada novo tópico */}
        {current && (
          <div style={s.cardWrap}>
            <ReviewCard
              key={current.id}
              item={current}
              isExiting={isExiting}
              onRate={animateAndRate}
            />
          </div>
        )}

        {/* Ações secundárias */}
        {current && (
          <div style={s.secondaryActions}>
            <button
              onMouseEnter={() => setHovBtn('adiar')}
              onMouseLeave={() => setHovBtn(null)}
              onClick={() => setShowReschedule(v => !v)}
              style={{
                ...s.secondaryBtn,
                background: hovBtn === 'adiar' ? theme.muted : 'transparent',
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              Adiar <ChevronIcon rotated={showReschedule} />
            </button>

            <button
              onMouseEnter={() => setHovBtn('remover')}
              onMouseLeave={() => setHovBtn(null)}
              onClick={() => handleRemove(current.id)}
              style={{
                ...s.secondaryBtn,
                color: theme.danger,
                background: hovBtn === 'remover' ? theme.dangerBg : 'transparent',
              }}
            >
              Tirar da revisão
            </button>
          </div>
        )}

        {/* Painel de adiamento */}
        {showReschedule && current && (
          <div style={s.reschedBox}>
            <p style={s.reschedTitle}>Adiar para</p>
            <div style={s.quickRow}>
              {QUICK_DEFER.map((q) => (
                <button
                  key={q.days}
                  onMouseEnter={() => setHovQuick(q.days)}
                  onMouseLeave={() => setHovQuick(null)}
                  onClick={() => animateAndReschedule(current.id, localDateInDays(q.days))}
                  style={{
                    ...s.quickBtn,
                    background: hovQuick === q.days ? theme.muted : theme.card,
                  }}
                >
                  {q.label}
                </button>
              ))}
            </div>
            <div>
              <p style={s.dateLabel}>Data específica</p>
              <input
                type="date"
                min={localDateInDays(1)}
                onChange={(e) => {
                  if (!e.target.value) return;
                  animateAndReschedule(current.id, e.target.value);
                }}
                style={s.dateInput}
              />
            </div>
          </div>
        )}

        {/* Contador de pendentes */}
        {items.length > 1 && (
          <p style={s.remaining}>
            + {items.length - 1} {items.length - 1 === 1 ? 'tópico restante' : 'tópicos restantes'}
          </p>
        )}
      </PageContainer>
    </>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────
const s: Record<string, React.CSSProperties> = {
  progressWrap:  { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 },
  progressTrack: { flex: 1, height: 6, background: theme.muted, borderRadius: theme.radiusPill, overflow: 'hidden' },
  progressFill:  { height: '100%', background: theme.ok, borderRadius: theme.radiusPill, transition: 'width 0.4s ease' },
  progressLabel: {
    fontSize: 12, color: theme.inkFaint, fontWeight: 600,
    whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums',
  },

  cardWrap: { marginBottom: 16 },

  secondaryActions: { display: 'flex', gap: 16, marginBottom: 4 },
  secondaryBtn: {
    border: 'none', color: theme.inkSoft,
    fontSize: 13, fontWeight: 500, cursor: 'pointer',
    fontFamily: 'inherit', padding: '6px 10px',
    borderRadius: theme.radiusXs, transition: 'background 0.15s ease',
  },

  reschedBox:   { background: theme.muted, borderRadius: theme.radius, padding: '16px 18px', marginBottom: 12 },
  reschedTitle: {
    fontSize: 11, fontWeight: 700, color: theme.inkFaint,
    textTransform: 'uppercase', letterSpacing: 0.8, margin: '0 0 10px',
  },
  quickRow: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 },
  quickBtn: {
    padding: '8px 14px', borderRadius: theme.radiusXs,
    border: `0.5px solid ${theme.line}`, cursor: 'pointer',
    fontSize: 13, fontFamily: 'inherit', fontWeight: 500,
    color: theme.inkSoft, transition: 'background 0.15s ease',
  },
  dateLabel: { fontSize: 12, color: theme.inkFaint, fontWeight: 500, margin: '0 0 6px' },
  dateInput: {
    width: '100%', boxSizing: 'border-box',
    padding: '8px 10px', borderRadius: theme.radiusXs,
    border: `0.5px solid ${theme.line}`,
    background: theme.card, fontSize: 13,
    color: theme.ink, fontFamily: 'inherit',
  },

  remaining: { fontSize: 13, color: theme.inkFaint, margin: '12px 0 0', textAlign: 'center' },

  errorBox: {
    display: 'flex', alignItems: 'flex-start', gap: 14,
    padding: '20px 24px', marginTop: 24,
    background: theme.critBg, borderRadius: theme.radius,
    border: `0.5px solid ${theme.crit}`,
  },
  errorMsg: { margin: '0 0 12px', fontSize: 14, color: theme.ink, fontWeight: 500 },
  retryBtn: {
    border: 'none', background: theme.crit, color: theme.onDanger,
    fontSize: 13, fontWeight: 600, padding: '8px 16px',
    borderRadius: theme.radiusXs, cursor: 'pointer', fontFamily: 'inherit',
    transition: 'opacity 0.15s ease',
  },

  emptyWrap:  { textAlign: 'center', padding: '56px 0 32px' },
  emptyTitle: { fontSize: 22, fontWeight: 700, color: theme.ink, margin: '0 0 8px' },
  emptySub:   { fontSize: 14, color: theme.inkSoft, margin: '0 0 28px' },

  celebrationWrap:  { textAlign: 'center', padding: '56px 0 32px' },
  celebrationTitle: { fontSize: 24, fontWeight: 700, color: theme.ink, margin: '0 0 8px', letterSpacing: -0.5 },
  celebrationSub:   { fontSize: 15, color: theme.inkSoft, margin: '0 0 10px' },
  nextDate:         { fontSize: 14, color: theme.inkFaint, margin: '0 0 28px' },

  ctaRow: { display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' },
  ctaBtn: {
    padding: '12px 24px', borderRadius: theme.radiusSm, border: 'none',
    background: theme.primary, color: theme.onTeal,
    fontSize: 14, fontWeight: 600, cursor: 'pointer',
    fontFamily: 'inherit', transition: 'background 0.15s ease',
  },
  ctaBtnSecondary: {
    padding: '12px 24px', borderRadius: theme.radiusSm,
    border: `0.5px solid ${theme.line}`,
    background: theme.card, color: theme.inkSoft,
    fontSize: 14, fontWeight: 600, cursor: 'pointer',
    fontFamily: 'inherit', transition: 'background 0.15s ease',
  },
};
