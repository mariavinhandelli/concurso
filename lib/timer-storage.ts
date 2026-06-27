// lib/timer-storage.ts
import type { SessionMode } from '@/lib/session-modes';

export type LogMode = SessionMode;

const ACTIVE_STORAGE_KEY = 'study_timer_active_session';
const PENDING_STORAGE_KEY = 'study_timer_pending_session';

export interface PauseInterval {
  from: number;
  to: number | null;
}

export interface PersistedTimer {
  sessionId: string;
  startedAt: number;
  mode: LogMode;
  topicId: string | null;
  subjectId: string | null;
  boardId: string | null;
  pauses: PauseInterval[];
}

export interface PendingSession {
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

export function loadTimer(): PersistedTimer | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(ACTIVE_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedTimer;
  } catch {
    return null;
  }
}

export function saveTimer(state: PersistedTimer): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ACTIVE_STORAGE_KEY, JSON.stringify(state));
}

export function clearTimer(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(ACTIVE_STORAGE_KEY);
}

export function loadPendingSession(): PendingSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(PENDING_STORAGE_KEY);
    if (!raw) return null;
    const pending = JSON.parse(raw) as PendingSession;
    if (!pending.sessionId || pending.durationSec < 0 || pending.endedAt < pending.startedAt) {
      clearPendingSession();
      return null;
    }
    return pending;
  } catch {
    clearPendingSession();
    return null;
  }
}

export function savePendingSession(session: PendingSession): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PENDING_STORAGE_KEY, JSON.stringify(session));
}

export function clearPendingSession(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(PENDING_STORAGE_KEY);
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
