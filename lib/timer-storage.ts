// lib/timer-storage.ts
import type { SessionMode } from '@/lib/session-modes';

export type LogMode = SessionMode;

// Chaves escopadas por userId — impede que um usuário herde o timer de outro
// no mesmo browser. Nunca use chaves globais para estado de sessão do usuário.
function activeKey(userId: string) { return `study_timer_active_${userId}`; }
function pendingKey(userId: string) { return `study_timer_pending_${userId}`; }

// Chaves legadas (sem userId) — usadas apenas para migração/limpeza.
const LEGACY_ACTIVE_KEY = 'study_timer_active_session';
const LEGACY_PENDING_KEY = 'study_timer_pending_session';

/** Remove qualquer dado de timer legado (sem userId) do localStorage. */
export function clearLegacyTimerData(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(LEGACY_ACTIVE_KEY);
  window.localStorage.removeItem(LEGACY_PENDING_KEY);
}

export interface PauseInterval {
  from: number;
  to: number | null;
}

export interface PersistedTimer {
  userId: string;       // obrigatório — chave de isolamento por usuário
  sessionId: string;
  startedAt: number;
  mode: LogMode;
  topicId: string | null;
  subjectId: string | null;
  boardId: string | null;
  pauses: PauseInterval[];
}

export interface PendingSession {
  userId: string;       // obrigatório — chave de isolamento por usuário
  sessionId: string;
  startedAt: number;
  endedAt: number;
  durationSec: number;
  mode: LogMode;
  topicId: string | null;
  subjectId: string | null;
  boardId: string | null;
  source?: 'timer' | 'manual';
}

export function createSessionId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `sess_${crypto.randomUUID()}`;
  }
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function loadTimer(userId: string): PersistedTimer | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(activeKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedTimer;
    // Dupla verificação: rejeita sessões de outro userId
    if (parsed.userId && parsed.userId !== userId) { clearTimer(userId); return null; }
    return parsed;
  } catch {
    return null;
  }
}

export function saveTimer(state: PersistedTimer): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(activeKey(state.userId), JSON.stringify(state));
}

export function clearTimer(userId: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(activeKey(userId));
}

export function loadPendingSession(userId: string): PendingSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(pendingKey(userId));
    if (!raw) return null;
    const pending = JSON.parse(raw) as PendingSession;
    if (!pending.sessionId || pending.durationSec < 0 || pending.endedAt < pending.startedAt) {
      clearPendingSession(userId);
      return null;
    }
    // Rejeita sessão de outro usuário
    if (pending.userId && pending.userId !== userId) { clearPendingSession(userId); return null; }
    return pending;
  } catch {
    clearPendingSession(userId);
    return null;
  }
}

export function savePendingSession(session: PendingSession): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(pendingKey(session.userId), JSON.stringify(session));
}

export function clearPendingSession(userId: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(pendingKey(userId));
}

export function sumPauses(pauses: PauseInterval[], now: number): number {
  return pauses.reduce((total, p) => {
    const end = p.to ?? now;
    return total + (end - p.from);
  }, 0);
}

export function computeElapsedSec(state: PersistedTimer, now: number): number {
  const gross = now - state.startedAt;
  const paused = sumPauses(state.pauses, now);
  return Math.max(0, Math.floor((gross - paused) / 1000));
}

export function isPaused(state: PersistedTimer): boolean {
  return state.pauses.some((p) => p.to === null);
}
