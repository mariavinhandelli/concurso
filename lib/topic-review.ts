// lib/topic-review.ts
// Repetição espaçada de tópicos — método 24h/7/30 (checkpoints clássicos
// contra a curva do esquecimento de Ebbinghaus, muito usado em concursos: sem
// revisão, ~50-70% do conteúdo já se perde em 24h e ~90% em 30 dias).
// Diferente dos flashcards (lib/spaced-repetition.ts, SM-2 com nota de
// dificuldade Esqueci/Difícil/Médio/Fácil): tópicos seguem um CALENDÁRIO FIXO,
// sem graduação por nota — só duas ações. 'Esqueci' reinicia em 24h; 'Revisei'
// avança pro próximo marco (o tópico entra na fila já vencendo em 24h via
// activateReview/scheduleReviewFromError — este módulo só cuida do que
// acontece a partir da 1ª revisão de fato: 24h revisado → próxima em 7 dias →
// revisado de novo → próxima em 30 dias → dali em diante mantém o platô de 30
// dias (ajustado pela retenção real da matéria), sem crescer indefinidamente
// feito SM-2 — o método é literalmente esses 3 marcos, não uma progressão.
import { startOfLocalDay, toLocalDateString } from '@/lib/local-date';
import type { BaseReviewState, BaseScheduleResult } from '@/lib/spaced-repetition-algorithm';

export type TopicRating = 'esqueci' | 'revisei';

export type TopicReviewState = BaseReviewState;

export interface TopicReviewResult extends BaseScheduleResult, TopicReviewState {}

export const INITIAL_TOPIC_STATE: TopicReviewState = { intervalDays: 0, repetitions: 0 };

const SEGUNDO_MARCO = 7;   // repetitions === 1 → revisou o marco de 24h, próxima em 7 dias
const TERCEIRO_MARCO = 30; // repetitions === 2 → revisou o marco de 7 dias, próxima em 30 dias
const PLATO_MADURO = 30;   // repetitions >= 3 → mantém o platô de 30 dias (ajustado por matéria)

const MIN_INTERVAL_MODIFIER = 0.7;
const MAX_INTERVAL_MODIFIER = 1.3;

function addDays(from: Date, days: number): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  d.setHours(0, 0, 0, 0);
  return d;
}

// intervalModifier: mesmo ajuste pessoal por matéria dos flashcards
// (user_features.srs_adjust) — só afeta o platô de manutenção (30 dias),
// nunca os marcos fixos de 7/30 na graduação nem o reset por esquecimento.
export function calculateNextTopicReview(
  state: TopicReviewState,
  rating: TopicRating,
  now: Date = new Date(),
  intervalModifier: number = 1,
): TopicReviewResult {
  let { repetitions } = state;
  let intervalDays: number;
  const mod = Math.min(MAX_INTERVAL_MODIFIER, Math.max(MIN_INTERVAL_MODIFIER, intervalModifier || 1));

  if (rating === 'esqueci') {
    repetitions = 0;
    intervalDays = 1;
  } else {
    repetitions += 1;
    if (repetitions === 1) intervalDays = SEGUNDO_MARCO;
    else if (repetitions === 2) intervalDays = TERCEIRO_MARCO;
    else intervalDays = Math.max(1, Math.round(PLATO_MADURO * mod));
  }

  return {
    intervalDays,
    repetitions,
    lastReviewed: now,
    nextReviewDate: addDays(now, intervalDays),
  };
}

export function isTopicReviewDue(nextReviewDate: Date | string | null, now: Date = new Date()): boolean {
  if (!nextReviewDate) return false;
  const due = startOfLocalDay(nextReviewDate);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return due.getTime() <= today.getTime();
}

export function topicReviewDaysOverdue(nextReviewDate: Date | string | null, now: Date = new Date()): number {
  if (!nextReviewDate) return 0;
  const due = startOfLocalDay(nextReviewDate);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return Math.round((today.getTime() - due.getTime()) / 86_400_000);
}

export function fromTopicDbRow(row: {
  interval_days: number | null;
  repetitions: number | null;
}): TopicReviewState {
  return {
    intervalDays: row.interval_days ?? 0,
    repetitions: row.repetitions ?? 0,
  };
}

export function toTopicDbRow(result: TopicReviewResult) {
  return {
    interval_days: result.intervalDays,
    repetitions: result.repetitions,
    last_reviewed: result.lastReviewed.toISOString(),
    next_review_date: toLocalDateString(result.nextReviewDate),
  };
}
