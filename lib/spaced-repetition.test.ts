import { describe, expect, it } from 'vitest';
import {
  INITIAL_SR_STATE,
  calculateNextReview,
  daysOverdue,
  isDue,
} from '@/lib/spaced-repetition';
import { toDbRow } from '@/lib/spaced-repetition.mapper';

describe('spaced repetition', () => {
  it('agenda a primeira revisão graduando por nota (dificil=1, bom=2, facil=4 dias)', () => {
    const now = new Date(2026, 5, 27, 22, 0, 0);

    const dificil = calculateNextReview(INITIAL_SR_STATE, 'dificil', now);
    expect(dificil.intervalDays).toBe(1);
    expect(dificil.repetitions).toBe(1);
    expect(toDbRow(dificil).next_review_date).toBe('2026-06-28');

    const bom = calculateNextReview(INITIAL_SR_STATE, 'bom', now);
    expect(bom.intervalDays).toBe(2);
    expect(bom.repetitions).toBe(1);
    expect(toDbRow(bom).next_review_date).toBe('2026-06-29');

    const facil = calculateNextReview(INITIAL_SR_STATE, 'facil', now);
    expect(facil.intervalDays).toBe(4);
    expect(facil.repetitions).toBe(1);
    expect(toDbRow(facil).next_review_date).toBe('2026-07-01');
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

  describe('intervalModifier (SRS adaptativo por matéria)', () => {
    const maduro = { easeFactor: 2.5, intervalDays: 10, repetitions: 3 };

    it('alonga intervalos maduros quando a retenção da matéria é alta', () => {
      const sem = calculateNextReview(maduro, 'bom', new Date(2026, 5, 27, 10));
      const com = calculateNextReview(maduro, 'bom', new Date(2026, 5, 27, 10), 1.2);
      expect(com.intervalDays).toBe(Math.round(sem.intervalDays * 1.2));
    });

    it('encurta intervalos maduros quando a retenção da matéria é baixa', () => {
      const sem = calculateNextReview(maduro, 'bom', new Date(2026, 5, 27, 10));
      const com = calculateNextReview(maduro, 'bom', new Date(2026, 5, 27, 10), 0.7);
      expect(com.intervalDays).toBeLessThan(sem.intervalDays);
      expect(com.intervalDays).toBeGreaterThanOrEqual(1);
    });

    it('não mexe nos degraus de graduação (1ª/2ª repetição) nem no reset por erro', () => {
      expect(calculateNextReview(INITIAL_SR_STATE, 'bom', new Date(), 0.7).intervalDays).toBe(2);
      expect(calculateNextReview({ easeFactor: 2.5, intervalDays: 2, repetitions: 1 }, 'bom', new Date(), 1.3).intervalDays).toBe(6);
      expect(calculateNextReview(maduro, 'errou', new Date(), 1.3).intervalDays).toBe(1);
    });

    it('clampa modificadores fora da faixa e trata 0 como neutro', () => {
      const quando = new Date(2026, 5, 27, 10);
      const base = calculateNextReview(maduro, 'bom', quando);
      const teto = calculateNextReview(maduro, 'bom', quando, 1.3);
      expect(calculateNextReview(maduro, 'bom', quando, 5).intervalDays).toBe(teto.intervalDays);
      expect(calculateNextReview(maduro, 'bom', quando, 0).intervalDays).toBe(base.intervalDays);
    });
  });
});
