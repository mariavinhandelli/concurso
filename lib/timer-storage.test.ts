import { describe, expect, it } from 'vitest';
import { computeElapsedSec, sumPauses, type PersistedTimer } from '@/lib/timer-storage';

const timer: PersistedTimer = {
  userId: 'user_test',
  sessionId: 'sess_test',
  startedAt: 1_000,
  mode: 'teoria',
  topicId: null,
  subjectId: null,
  boardId: null,
  pauses: [
    { from: 11_000, to: 21_000 },
  ],
};

describe('timer calculations', () => {
  it('desconta as pausas do tempo decorrido', () => {
    expect(computeElapsedSec(timer, 71_000)).toBe(60);
  });

  it('contabiliza uma pausa ainda aberta até agora', () => {
    expect(sumPauses([{ from: 11_000, to: null }], 31_000)).toBe(20_000);
  });

  it('nunca retorna duração negativa', () => {
    expect(computeElapsedSec(timer, 0)).toBe(0);
  });
});
