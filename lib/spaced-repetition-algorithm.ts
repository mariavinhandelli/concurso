// lib/spaced-repetition-algorithm.ts
// Vocabulário base compartilhado por todos os algoritmos de revisão espaçada.
// SM-2 (spaced-repetition.ts) e o algoritmo de juris (juris-review.ts) estendem estes tipos.

export interface BaseReviewState {
  intervalDays: number;
  repetitions: number;
}

export interface BaseScheduleResult extends BaseReviewState {
  nextReviewDate: Date;
  lastReviewed: Date;
}
