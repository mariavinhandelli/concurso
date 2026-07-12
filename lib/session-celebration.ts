// lib/session-celebration.ts
// Barramento mínimo do momento de celebração pós-sessão (Tiny Habits: a
// recompensa precisa acontecer IMEDIATAMENTE após o comportamento, não depois).
// saveStudyLog emite; o <SessionCelebration> (montado no layout) escuta e mostra
// o card. CustomEvent no window para não acoplar a camada de serviço à UI.

export const SESSION_SAVED_EVENT = 'focali:session-saved';

export interface SessionSavedDetail {
  minutes: number;   // duração da sessão recém-salva
  dateLocal: string; // 'YYYY-MM-DD' local do INÍCIO da sessão (registro retroativo ≠ hoje)
}

export function emitSessionSaved(detail: SessionSavedDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<SessionSavedDetail>(SESSION_SAVED_EVENT, { detail }));
}
