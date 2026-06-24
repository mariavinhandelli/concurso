// hooks/useStudyTimer.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type PersistedTimer,
  type PauseInterval,
  type LogMode,
  loadTimer,
  saveTimer,
  clearTimer,
  computeElapsedSec,
  isPaused as isPausedFn,
} from '@/lib/timer-storage';

export type TimerStatus = 'idle' | 'running' | 'paused' | 'awaiting_feedback';

export interface PendingSession {
  startedAt: number;
  endedAt: number;
  durationSec: number;
  mode: LogMode;
  topicId: string | null;
  subjectId: string | null;
  boardId: string | null;
}

export interface StartParams {
  mode: LogMode;
  topicId?: string | null;
  subjectId?: string | null;
  boardId?: string | null;
}

const TICK_MS = 1000;

function formatHMS(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function makeSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function useStudyTimer() {
  const [status, setStatus] = useState<TimerStatus>('idle');
  const [elapsedSec, setElapsedSec] = useState(0);
  const [pendingSession, setPendingSession] = useState<PendingSession | null>(null);

  const timerRef = useRef<PersistedTimer | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const syncElapsed = useCallback(() => {
    const state = timerRef.current;
    if (!state) return;
    setElapsedSec(computeElapsedSec(state, Date.now()));
  }, []);

  const startTicking = useCallback(() => {
    if (intervalRef.current) return;
    intervalRef.current = setInterval(syncElapsed, TICK_MS);
  }, [syncElapsed]);

  const stopTicking = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    const restored = loadTimer();
    if (restored) {
      timerRef.current = restored;
      const paused = isPausedFn(restored);
      setStatus(paused ? 'paused' : 'running');
      syncElapsed();
      if (!paused) startTicking();
    }
    return () => stopTicking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') syncElapsed();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [syncElapsed]);

  const start = useCallback(
    ({ mode, topicId = null, subjectId = null, boardId = null }: StartParams) => {
      if (timerRef.current) return;
      const state: PersistedTimer = {
        sessionId: makeSessionId(),
        startedAt: Date.now(),
        mode, topicId, subjectId, boardId,
        pauses: [],
      };
      timerRef.current = state;
      saveTimer(state);
      setElapsedSec(0);
      setStatus('running');
      startTicking();
    },
    [startTicking],
  );

  const pause = useCallback(() => {
    const state = timerRef.current;
    if (!state || isPausedFn(state)) return;
    const updated: PersistedTimer = {
      ...state,
      pauses: [...state.pauses, { from: Date.now(), to: null }],
    };
    timerRef.current = updated;
    saveTimer(updated);
    stopTicking();
    syncElapsed();
    setStatus('paused');
  }, [stopTicking, syncElapsed]);

  const resume = useCallback(() => {
    const state = timerRef.current;
    if (!state || !isPausedFn(state)) return;
    const pauses: PauseInterval[] = state.pauses.map((p) =>
      p.to === null ? { ...p, to: Date.now() } : p,
    );
    const updated: PersistedTimer = { ...state, pauses };
    timerRef.current = updated;
    saveTimer(updated);
    setStatus('running');
    startTicking();
  }, [startTicking]);

  const stop = useCallback(() => {
    const state = timerRef.current;
    if (!state) return;
    const endedAt = Date.now();
    const durationSec = computeElapsedSec(state, endedAt);
    stopTicking();
    const pending: PendingSession = {
      startedAt: state.startedAt,
      endedAt, durationSec,
      mode: state.mode,
      topicId: state.topicId,
      subjectId: state.subjectId,
      boardId: state.boardId,
    };
    clearTimer();
    timerRef.current = null;
    setElapsedSec(durationSec);
    setPendingSession(pending);
    setStatus('awaiting_feedback');
  }, [stopTicking]);

  const discardPending = useCallback(() => {
    setPendingSession(null);
    setElapsedSec(0);
    setStatus('idle');
  }, []);

  return {
    status,
    elapsedSec,
    formatted: formatHMS(elapsedSec),
    isRunning: status === 'running',
    isPaused: status === 'paused',
    pendingSession,
    start, pause, resume, stop, discardPending,
  };
}