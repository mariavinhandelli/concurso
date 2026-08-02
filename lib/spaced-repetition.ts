// lib/spaced-repetition.ts
import { startOfLocalDay } from '@/lib/local-date';
import type { BaseReviewState, BaseScheduleResult } from '@/lib/spaced-repetition-algorithm';

export type RecallGrade = 'errou' | 'dificil' | 'bom' | 'facil';

const GRADE_TO_QUALITY: Record<RecallGrade, number> = {
  errou: 0, dificil: 3, bom: 4, facil: 5,
};

export interface SpacedRepetitionState extends BaseReviewState {
  easeFactor: number;
  // intervalDays, repetitions herdados de BaseReviewState
}

export interface ReviewResult extends BaseScheduleResult, SpacedRepetitionState {
  // nextReviewDate, lastReviewed de BaseScheduleResult
  // easeFactor, intervalDays, repetitions de SpacedRepetitionState
}

const MIN_EASE_FACTOR = 1.3;
export const DEFAULT_EASE_FACTOR = 2.5;

// Degraus de graduação das duas primeiras repetições bem-sucedidas, por nota.
// No SM-2 clássico esses dois passos são fixos (1 e 6 dias) pra qualquer nota
// >= "dificil" — mas isso faz Difícil/Médio/Fácil caírem no mesmo intervalo
// na 1ª e 2ª revisão de um tópico, e os botões mostram todos "amanhã" ao
// mesmo tempo (confuso). Diferenciamos por nota, igual aos learning steps do Anki.
const GRADUATION_STEPS: Record<Exclude<RecallGrade, 'errou'>, { first: number; second: number }> = {
  dificil: { first: 1, second: 3 },
  bom:     { first: 2, second: 6 },
  facil:   { first: 4, second: 10 },
};

export const INITIAL_SR_STATE: SpacedRepetitionState = {
  easeFactor: DEFAULT_EASE_FACTOR, intervalDays: 0, repetitions: 0,
};

function addDays(from: Date, days: number): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  d.setHours(0, 0, 0, 0);
  return d;
}

// intervalModifier: ajuste pessoal por matéria vindo do feature store
// (user_features.srs_adjust — taxa de acerto real em questões). Só alonga/encurta
// intervalos MADUROS (3ª repetição em diante); os degraus fixos de 1 e 6 dias e o
// reset por erro ficam intactos. Clamp defensivo caso o banco traga valor fora da faixa.
const MIN_INTERVAL_MODIFIER = 0.7;
const MAX_INTERVAL_MODIFIER = 1.3;

export function calculateNextReview(
  state: SpacedRepetitionState,
  grade: RecallGrade,
  now: Date = new Date(),
  intervalModifier: number = 1,
): ReviewResult {
  const quality = GRADE_TO_QUALITY[grade];
  let { easeFactor, intervalDays, repetitions } = state;

  const mod = Math.min(MAX_INTERVAL_MODIFIER, Math.max(MIN_INTERVAL_MODIFIER, intervalModifier || 1));

  easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  easeFactor = Math.max(MIN_EASE_FACTOR, easeFactor);

  if (quality < 3) {
    repetitions = 0;
    intervalDays = 1;
  } else {
    repetitions += 1;
    const steps = GRADUATION_STEPS[grade as Exclude<RecallGrade, 'errou'>];
    if (repetitions === 1) intervalDays = steps.first;
    else if (repetitions === 2) intervalDays = steps.second;
    else intervalDays = Math.max(1, Math.round(intervalDays * easeFactor * mod));
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
  const due = startOfLocalDay(nextReviewDate);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return due.getTime() <= today.getTime();
}

export function daysOverdue(nextReviewDate: Date | string | null, now: Date = new Date()): number {
  if (!nextReviewDate) return 0;
  const due = startOfLocalDay(nextReviewDate);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return Math.round((today.getTime() - due.getTime()) / 86_400_000);
}

