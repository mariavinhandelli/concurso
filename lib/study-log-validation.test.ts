import { describe, expect, it } from 'vitest';
import { validateStudyLogInput } from '@/lib/study-log-validation';
import type { PendingSession } from '@/lib/timer-storage';

const validSession: PendingSession = {
  sessionId: 'sess_test',
  startedAt: 1_000,
  endedAt: 61_000,
  durationSec: 60,
  mode: 'questoes',
  topicId: null,
  subjectId: null,
  boardId: null,
  source: 'timer',
};

describe('study log validation', () => {
  it('aceita uma sessão coerente', () => {
    expect(() => validateStudyLogInput(validSession, {
      mode: 'questoes',
      energyLevel: 4,
      questionsTotal: 10,
      questionsCorrect: 8,
    })).not.toThrow();
  });

  it('rejeita mais acertos do que questões', () => {
    expect(() => validateStudyLogInput(validSession, {
      mode: 'questoes',
      energyLevel: 4,
      questionsTotal: 10,
      questionsCorrect: 11,
    })).toThrow('acertos não pode ser maior');
  });

  it('rejeita energia fora da escala', () => {
    expect(() => validateStudyLogInput(validSession, {
      mode: 'teoria',
      energyLevel: 6,
    })).toThrow('energia deve estar entre 1 e 5');
  });

  it('rejeita duração zerada', () => {
    expect(() => validateStudyLogInput({ ...validSession, durationSec: 0 }, {
      mode: 'teoria',
      energyLevel: 3,
    })).toThrow('duração da sessão precisa ser maior');
  });
});
