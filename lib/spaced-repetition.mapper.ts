// lib/spaced-repetition.mapper.ts
// Serialização banco ↔ domínio SM-2.
// Separado do algoritmo para que spaced-repetition.ts não tenha dependência do schema.

import { toLocalDateString } from '@/lib/local-date';
import { DEFAULT_EASE_FACTOR } from '@/lib/spaced-repetition';
import type { SpacedRepetitionState, ReviewResult } from '@/lib/spaced-repetition';

export function fromDbRow(row: {
  ease_factor: number | null;
  interval_days: number | null;
  repetitions: number | null;
}): SpacedRepetitionState {
  return {
    easeFactor: row.ease_factor ?? DEFAULT_EASE_FACTOR,
    intervalDays: row.interval_days ?? 0,
    repetitions: row.repetitions ?? 0,
  };
}

export function toDbRow(result: ReviewResult) {
  return {
    ease_factor: result.easeFactor,
    interval_days: result.intervalDays,
    repetitions: result.repetitions,
    last_reviewed: result.lastReviewed.toISOString(),
    next_review_date: toLocalDateString(result.nextReviewDate),
  };
}
