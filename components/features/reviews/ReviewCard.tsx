'use client';

import { useState, useEffect, memo } from 'react';
import { TriangleAlert } from 'lucide-react';
import { theme } from '@/lib/theme';
import type { ReviewItem, ReviewRating } from '@/services/reviews.service';

interface ReviewCardProps {
  item: ReviewItem;
  isExiting: boolean;
  onRate: (topicId: string, rating: ReviewRating) => void;
}

function fmtInterval(days: number): string {
  if (days <= 1) return 'amanhã';
  if (days < 7)  return `${days} dias`;
  if (days === 7) return '1 semana';
  if (days < 30) return `${Math.round(days / 7)} sem.`;
  if (days < 60) return '1 mês';
  return `${Math.round(days / 30)} meses`;
}

// Usa as variáveis --review-* do globals.css que já garantem contraste WCAG AA
// (texto escuro sobre fundo claro), resolvendo o falha de contraste do pressed state anterior.
const RATINGS: {
  key:       ReviewRating;
  label:     string;
  fg:        string;
  pressedBg: string;
  pressedFg: string;
}[] = [
  { key: 'dificil',       label: 'Difícil',      fg: theme.crit, pressedBg: 'var(--review-hard)',   pressedFg: 'var(--review-hard-text)'   },
  { key: 'intermediario', label: 'Médio',         fg: theme.warn, pressedBg: 'var(--review-medium)', pressedFg: 'var(--review-medium-text)' },
  { key: 'facil',         label: 'Fácil',         fg: theme.ok,   pressedBg: 'var(--review-easy)',   pressedFg: 'var(--review-easy-text)'   },
];

export const ReviewCard = memo(function ReviewCard({ item, isExiting, onRate }: ReviewCardProps) {
  // Entrada: monta invisível, transiciona após 10ms para evitar flash.
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  const [hovered, setHovered] = useState<ReviewRating | null>(null);
  const [pressed, setPressed] = useState<ReviewRating | null>(null);

  const cardStyle: React.CSSProperties = {
    ...s.card,
    opacity:   isExiting ? 0 : visible ? 1 : 0,
    transform: isExiting ? 'translateY(10px)' : visible ? 'translateY(0)' : 'translateY(14px)',
    transition: 'opacity 0.15s ease, transform 0.15s ease',
  };

  return (
    <div style={cardStyle}>
      {/* Cabeçalho: badge de matéria + alerta de atraso com SVG */}
      <div style={s.meta}>
        <span style={{ ...s.badge, background: item.subjectColor }}>{item.subjectName}</span>
        {item.overdueDays > 0 && (
          <span
            style={s.overdue}
            title={`Esta revisão venceu há ${item.overdueDays} ${item.overdueDays === 1 ? 'dia' : 'dias'}. Avalie como Difícil para reiniciar o intervalo.`}
          >
            <TriangleAlert size={12} color={theme.crit} strokeWidth={2} aria-hidden="true" style={{ flexShrink: 0 }} />
            {item.overdueDays} {item.overdueDays === 1 ? 'dia' : 'dias'} atrasada
          </span>
        )}
      </div>

      {/* Nome do tópico */}
      <p style={s.topicName}>{item.name}</p>

      {/* Botões de avaliação:
          Rest   → fundo neutro (muted), texto colorido — cor não distrai em repouso.
          Hover  → fundo branco (card) — leve elevação, feedback sem cor.
          Pressed→ --review-* bg + text com contraste WCAG AA garantido. */}
      <div style={s.ratings}>
        {RATINGS.map((r) => {
          const interval = item.nextIntervals[r.key];
          const isHov    = hovered === r.key;
          const isPress  = pressed === r.key;

          return (
            <button
              key={r.key}
              onMouseEnter={() => setHovered(r.key)}
              onMouseLeave={() => { setHovered(null); setPressed(null); }}
              onPointerDown={() => setPressed(r.key)}
              onPointerUp={() => setPressed(null)}
              onClick={() => onRate(item.id, r.key)}
              style={{
                ...s.ratingBtn,
                background: isPress ? r.pressedBg : isHov ? theme.card : theme.muted,
                transform:  isPress ? 'scale(0.97)' : 'scale(1)',
                transition: 'background 0.1s ease, transform 0.08s ease',
              }}
            >
              <span style={{ ...s.ratingLabel, color: isPress ? r.pressedFg : r.fg }}>
                {r.label}
              </span>
              <span style={{ ...s.ratingInterval, color: isPress ? r.pressedFg : r.fg }}>
                → {fmtInterval(interval)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
});

const s: Record<string, React.CSSProperties> = {
  card: {
    background:   theme.card,
    borderRadius: theme.radius,
    border:       `0.5px solid ${theme.line}`,
    // Sombra reduzida: hairline + leve drop. Evita o efeito "carta voando".
    boxShadow: '0 1px 3px rgba(15,23,42,.05), 0 1px 2px rgba(15,23,42,.04)',
    padding: '28px',
  },
  meta: {
    display: 'flex', alignItems: 'center', gap: 10,
    marginBottom: 16, flexWrap: 'wrap',
  },
  badge: {
    fontSize: 11, color: '#fff',
    padding: '3px 10px', borderRadius: theme.radiusXs,
    fontWeight: 700, letterSpacing: 0.3,
  },
  overdue: {
    display: 'flex', alignItems: 'center', gap: 4,
    fontSize: 12, color: theme.crit,
    fontWeight: 500, cursor: 'help',
  },
  topicName: {
    fontSize: 20, fontWeight: 700,
    color: theme.ink, margin: '0 0 24px',
    lineHeight: 1.35, letterSpacing: -0.3,
  },
  ratings: { display: 'flex', gap: 10 },
  ratingBtn: {
    flex: 1,
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
    padding: '14px 8px', borderRadius: theme.radiusSm,
    border: 'none', cursor: 'pointer', fontFamily: 'inherit',
  },
  ratingLabel:    { fontSize: 13, fontWeight: 600 },
  ratingInterval: { fontSize: 12, fontWeight: 500, opacity: 0.85 },
};
