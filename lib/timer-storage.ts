// lib/timer-storage.ts
export type LogMode = 'teoria' | 'questoes' | 'revisao' | 'leitura_lei';

const STORAGE_KEY = 'study_timer_active_session';

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

export function loadTimer(): PersistedTimer | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedTimer;
  } catch {
    return null;
  }
}

export function saveTimer(state: PersistedTimer): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function clearTimer(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
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