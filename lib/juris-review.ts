// lib/juris-review.ts
// Repetição espaçada de jurisprudências — intervalos fixos por avaliação,
// crescendo em repetições consecutivas. Mais simples que o SM-2 (lib/spaced-repetition.ts)
// porque o usuário pediu marcos explícitos (1 / 3 / 15 / 45 dias).
import { startOfLocalDay, toLocalDateString } from '@/lib/local-date';
import type { BaseReviewState, BaseScheduleResult } from '@/lib/spaced-repetition-algorithm';

export type JurisRating = 'errei' | 'dificil' | 'ok' | 'dominei';

// JurisReviewState já satisfaz BaseReviewState (mesma forma: intervalDays + repetitions).
export interface JurisReviewState extends BaseReviewState {
  // intervalDays, repetitions herdados de BaseReviewState
}

export interface JurisReviewResult extends BaseScheduleResult, JurisReviewState {
  // nextReviewDate, lastReviewed de BaseScheduleResult
  // intervalDays, repetitions de JurisReviewState
}

export const INITIAL_JURIS_STATE: JurisReviewState = { intervalDays: 0, repetitions: 0 };

const BASE_INTERVAL: Record<JurisRating, number> = {
  errei: 1,
  dificil: 3,
  ok: 15,
  dominei: 45,
};
const GROWTH_FACTOR: Record<JurisRating, number> = {
  errei: 1,
  dificil: 1.2,
  ok: 1.5,
  dominei: 1.4,
};
const MAX_INTERVAL_DAYS = 180;

function addDays(from: Date, days: number): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function calculateNextJurisReview(
  state: JurisReviewState,
  rating: JurisRating,
  now: Date = new Date(),
): JurisReviewResult {
  let { repetitions } = state;
  let intervalDays: number;

  if (rating === 'errei') {
    repetitions = 0;
    intervalDays = BASE_INTERVAL.errei;
  } else {
    repetitions += 1;
    intervalDays = repetitions <= 1
      ? BASE_INTERVAL[rating]
      : Math.min(MAX_INTERVAL_DAYS, Math.max(1, Math.round(state.intervalDays * GROWTH_FACTOR[rating])));
  }

  return {
    intervalDays,
    repetitions,
    lastReviewed: now,
    nextReviewDate: addDays(now, intervalDays),
  };
}

export function isJurisDue(nextReviewDate: Date | string | null, now: Date = new Date()): boolean {
  if (!nextReviewDate) return false;
  const due = startOfLocalDay(nextReviewDate);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return due.getTime() <= today.getTime();
}

export function jurisDaysOverdue(nextReviewDate: Date | string | null, now: Date = new Date()): number {
  if (!nextReviewDate) return 0;
  const due = startOfLocalDay(nextReviewDate);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return Math.round((today.getTime() - due.getTime()) / 86_400_000);
}

export function fromJurisDbRow(row: {
  interval_days: number | null;
  repetitions: number | null;
}): JurisReviewState {
  return {
    intervalDays: row.interval_days ?? 0,
    repetitions: row.repetitions ?? 0,
  };
}

export function toJurisDbRow(result: JurisReviewResult) {
  return {
    interval_days: result.intervalDays,
    repetitions: result.repetitions,
    last_reviewed: result.lastReviewed.toISOString(),
    next_review_date: toLocalDateString(result.nextReviewDate),
  };
}

export const RATING_LABEL: Record<JurisRating, string> = {
  errei: 'Errei', dificil: 'Difícil', ok: 'Ok', dominei: 'Dominei',
};

export const INTERVALOS_RAPIDOS = [
  { label: '1 dia', days: 1 },
  { label: '7 dias', days: 7 },
  { label: '15 dias', days: 15 },
  { label: '30 dias', days: 30 },
];
