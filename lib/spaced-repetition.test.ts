import { describe, expect, it } from 'vitest';
import {
  INITIAL_SR_STATE,
  calculateNextReview,
  daysOverdue,
  isDue,
  toDbRow,
} from '@/lib/spaced-repetition';

describe('spaced repetition', () => {
  it('agenda a primeira revisão para o próximo dia local', () => {
    const now = new Date(2026, 5, 27, 22, 0, 0);
    const result = calculateNextReview(INITIAL_SR_STATE, 'bom', now);

    expect(result.intervalDays).toBe(1);
    expect(result.repetitions).toBe(1);
    expect(toDbRow(result).next_review_date).toBe('2026-06-28');
  });

  it('considera uma revisão vencida durante todo o dia civil', () => {
    const now = new Date(2026, 5, 28, 23, 30, 0);

    expect(isDue('2026-06-28', now)).toBe(true);
    expect(daysOverdue('2026-06-27', now)).toBe(1);
  });

  it('reinicia o intervalo depois de um erro', () => {
    const result = calculateNextReview({
      easeFactor: 2.5,
      intervalDays: 20,
      repetitions: 5,
    }, 'errou', new Date(2026, 5, 27, 10));

    expect(result.intervalDays).toBe(1);
    expect(result.repetitions).toBe(0);
  });
});
