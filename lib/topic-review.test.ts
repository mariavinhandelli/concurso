import { describe, expect, it } from 'vitest';
import {
  INITIAL_TOPIC_STATE,
  calculateNextTopicReview,
  topicReviewDaysOverdue,
  isTopicReviewDue,
  toTopicDbRow,
} from '@/lib/topic-review';

describe('revisão de tópicos (método 24h/7/30, calendário fixo sem nota de dificuldade)', () => {
  it('avança pelo calendário fixo ao revisar: 1ª revisão → 7 dias, 2ª → 30 dias', () => {
    const now = new Date(2026, 5, 27, 22, 0, 0);

    // Tópico entra na fila vencendo em 24h via activateReview (fora deste módulo).
    // A 1ª vez que o usuário de fato clica "Revisei" completa o marco de 24h e
    // agenda o próximo em 7 dias.
    const primeira = calculateNextTopicReview(INITIAL_TOPIC_STATE, 'revisei', now);
    expect(primeira.intervalDays).toBe(7);
    expect(primeira.repetitions).toBe(1);
    expect(toTopicDbRow(primeira).next_review_date).toBe('2026-07-04');

    // 2ª revisão completa o marco de 7 dias e agenda o de 30.
    const segunda = calculateNextTopicReview(
      { intervalDays: primeira.intervalDays, repetitions: primeira.repetitions }, 'revisei', now,
    );
    expect(segunda.intervalDays).toBe(30);
    expect(segunda.repetitions).toBe(2);

    // 3ª revisão em diante mantém o platô de 30 dias (não cresce mais).
    const terceira = calculateNextTopicReview(
      { intervalDays: segunda.intervalDays, repetitions: segunda.repetitions }, 'revisei', now,
    );
    expect(terceira.intervalDays).toBe(30);
    expect(terceira.repetitions).toBe(3);

    const quarta = calculateNextTopicReview(
      { intervalDays: terceira.intervalDays, repetitions: terceira.repetitions }, 'revisei', now,
    );
    expect(quarta.intervalDays).toBe(30);
    expect(quarta.repetitions).toBe(4);
  });

  it('considera uma revisão vencida durante todo o dia civil', () => {
    const now = new Date(2026, 5, 28, 23, 30, 0);

    expect(isTopicReviewDue('2026-06-28', now)).toBe(true);
    expect(topicReviewDaysOverdue('2026-06-27', now)).toBe(1);
  });

  it('reinicia o intervalo (1 dia) depois de esquecer, não importa a maturidade', () => {
    const result = calculateNextTopicReview(
      { intervalDays: 30, repetitions: 5 }, 'esqueci', new Date(2026, 5, 27, 10),
    );
    expect(result.intervalDays).toBe(1);
    expect(result.repetitions).toBe(0);
  });

  describe('intervalModifier (SRS adaptativo por matéria)', () => {
    const maduro = { intervalDays: 30, repetitions: 3 };

    it('ajusta o platô de manutenção (30 dias) conforme a retenção da matéria', () => {
      const alta = calculateNextTopicReview(maduro, 'revisei', new Date(2026, 5, 27, 10), 1.2);
      expect(alta.intervalDays).toBe(Math.round(30 * 1.2));

      const baixa = calculateNextTopicReview(maduro, 'revisei', new Date(2026, 5, 27, 10), 0.7);
      expect(baixa.intervalDays).toBe(Math.round(30 * 0.7));
    });

    it('não mexe nos marcos fixos de 7/30 na graduação nem no reset por esquecimento', () => {
      expect(calculateNextTopicReview(INITIAL_TOPIC_STATE, 'revisei', new Date(), 1.3).intervalDays).toBe(7);
      expect(calculateNextTopicReview(
        { intervalDays: 7, repetitions: 1 }, 'revisei', new Date(), 1.3,
      ).intervalDays).toBe(30);
      expect(calculateNextTopicReview(maduro, 'esqueci', new Date(), 1.3).intervalDays).toBe(1);
    });

    it('clampa modificadores fora da faixa e trata 0 como neutro', () => {
      const quando = new Date(2026, 5, 27, 10);
      const base = calculateNextTopicReview(maduro, 'revisei', quando);
      const teto = calculateNextTopicReview(maduro, 'revisei', quando, 1.3);
      expect(calculateNextTopicReview(maduro, 'revisei', quando, 5).intervalDays).toBe(teto.intervalDays);
      expect(calculateNextTopicReview(maduro, 'revisei', quando, 0).intervalDays).toBe(base.intervalDays);
    });
  });
});
