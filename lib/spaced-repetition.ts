// lib/spaced-repetition.ts
export type RecallGrade = 'errou' | 'dificil' | 'bom' | 'facil';

const GRADE_TO_QUALITY: Record<RecallGrade, number> = {
  errou: 0, dificil: 3, bom: 4, facil: 5,
};

export interface SpacedRepetitionState {
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
}

export interface ReviewResult extends SpacedRepetitionState {
  nextReviewDate: Date;
  lastReviewed: Date;
}

const MIN_EASE_FACTOR = 1.3;
const DEFAULT_EASE_FACTOR = 2.5;
const FIRST_INTERVAL = 1;
const SECOND_INTERVAL = 6;

export const INITIAL_SR_STATE: SpacedRepetitionState = {
  easeFactor: DEFAULT_EASE_FACTOR, intervalDays: 0, repetitions: 0,
};

function addDays(from: Date, days: number): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Converte 'YYYY-MM-DD' para Date no fuso LOCAL (evita o off-by-one de UTC).
function parseLocalDate(value: Date | string): Date {
  if (value instanceof Date) {
    const d = new Date(value);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  const [y, m, day] = value.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, day, 0, 0, 0, 0);
}

export function calculateNextReview(
  state: SpacedRepetitionState,
  grade: RecallGrade,
  now: Date = new Date(),
): ReviewResult {
  const quality = GRADE_TO_QUALITY[grade];
  let { easeFactor, intervalDays, repetitions } = state;

  easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  easeFactor = Math.max(MIN_EASE_FACTOR, easeFactor);

  if (quality < 3) {
    repetitions = 0;
    intervalDays = FIRST_INTERVAL;
  } else {
    repetitions += 1;
    if (repetitions === 1) intervalDays = FIRST_INTERVAL;
    else if (repetitions === 2) intervalDays = SECOND_INTERVAL;
    else intervalDays = Math.round(intervalDays * easeFactor);
  }

  return {
    easeFactor: Number(easeFactor.toFixed(2)),
    intervalDays, repetitions,
    lastReviewed: now,
    nextReviewDate: addDays(now, intervalDays),
  };
}

export function isDue(nextReviewDate: Date | string | null, now: Date = new Date()): boolean {
  if (!nextReviewDate) return false;
  const due = parseLocalDate(nextReviewDate);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return due.getTime() <= today.getTime();
}

export function daysOverdue(nextReviewDate: Date | string | null, now: Date = new Date()): number {
  if (!nextReviewDate) return 0;
  const due = parseLocalDate(nextReviewDate);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return Math.round((today.getTime() - due.getTime()) / 86_400_000);
}

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
    next_review_date: result.nextReviewDate.toISOString().slice(0, 10),
  };
}