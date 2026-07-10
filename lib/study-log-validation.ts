import { SESSION_MODES } from '@/lib/session-modes';
import type { LogMode, PendingSession } from '@/lib/timer-storage';

interface StudyLogValues {
  mode: LogMode;
  energyLevel: number;
  questionsTotal?: number;
  questionsCorrect?: number;
}

export function validateStudyLogInput(
  session: PendingSession,
  values: StudyLogValues,
): void {
  if (!session.sessionId.trim()) {
    throw new Error('A sessão não possui um identificador válido.');
  }
  if (
    !Number.isFinite(session.startedAt)
    || !Number.isFinite(session.endedAt)
    || session.endedAt < session.startedAt
  ) {
    throw new Error('O período da sessão é inválido.');
  }
  if (!Number.isFinite(session.durationSec) || session.durationSec <= 0) {
    throw new Error('A duração da sessão precisa ser maior que zero.');
  }
  // Energia é opcional: 0 = não informado (vira null no banco); 1-5 = informado.
  if (!Number.isInteger(values.energyLevel) || values.energyLevel < 0 || values.energyLevel > 5) {
    throw new Error('O nível de energia deve estar entre 1 e 5.');
  }
  if (!SESSION_MODES.some((item) => item.value === values.mode)) {
    throw new Error('O tipo da sessão é inválido.');
  }

  const total = values.questionsTotal ?? 0;
  const correct = values.questionsCorrect ?? 0;
  if (!Number.isInteger(total) || total < 0 || !Number.isInteger(correct) || correct < 0) {
    throw new Error('As quantidades de questões devem ser números inteiros positivos.');
  }
  if (correct > total) {
    throw new Error('O número de acertos não pode ser maior que o total de questões.');
  }
}
