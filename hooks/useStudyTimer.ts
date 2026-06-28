// hooks/useStudyTimer.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  type PersistedTimer,
  type PendingSession,
  type PauseInterval,
  type LogMode,
  createSessionId,
  loadTimer,
  saveTimer,
  clearTimer,
  loadPendingSession,
  savePendingSession,
  clearPendingSession,
  clearLegacyTimerData,
  computeElapsedSec,
  isPaused as isPausedFn,
} from '@/lib/timer-storage';

export type TimerStatus = 'idle' | 'running' | 'paused' | 'awaiting_feedback';

export type { PendingSession } from '@/lib/timer-storage';

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

export function useStudyTimer() {
  const [status, setStatus] = useState<TimerStatus>('idle');
  const [elapsedSec, setElapsedSec] = useState(0);
  const [pendingSession, setPendingSession] = useState<PendingSession | null>(null);

  const timerRef = useRef<PersistedTimer | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // userId da sessão atual — null enquanto carrega
  const userIdRef = useRef<string | null>(null);

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

  // Para e limpa o timer de um usuário específico
  const resetForUser = useCallback((uid: string) => {
    stopTicking();
    timerRef.current = null;
    clearTimer(uid);
    clearPendingSession(uid);
    setPendingSession(null);
    setElapsedSec(0);
    setStatus('idle');
  }, [stopTicking]);

  // Centralizado no onAuthStateChange — o Supabase dispara INITIAL_SESSION
  // imediatamente ao subscrever, antes de qualquer interação do usuário.
  // Isso garante que userIdRef.current esteja sempre preenchido antes do
  // primeiro clique, sem depender de getUser() assíncrono.
  useEffect(() => {
    const supabase = createClient();

    // Limpa chaves legadas (formato antigo sem userId)
    clearLegacyTimerData();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const newUid = session?.user?.id ?? null;
      const prevUid = userIdRef.current;

      // Sem mudança de usuário — ignora (evita loop no INITIAL_SESSION)
      if (newUid === prevUid) return;

      // Limpa timer do usuário anterior
      if (prevUid) resetForUser(prevUid);
      userIdRef.current = newUid;

      if (!newUid) return;

      // Restaura estado do novo usuário (timer ou pending session)
      const pending = loadPendingSession(newUid);
      if (pending) {
        setPendingSession(pending);
        setElapsedSec(pending.durationSec);
        setStatus('awaiting_feedback');
        return;
      }
      const restored = loadTimer(newUid);
      if (restored) {
        timerRef.current = restored;
        const paused = isPausedFn(restored);
        setStatus(paused ? 'paused' : 'running');
        syncElapsed();
        if (!paused) startTicking();
      }
    });

    return () => {
      stopTicking();
      subscription.unsubscribe();
    };
  }, [resetForUser, syncElapsed, startTicking, stopTicking]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') syncElapsed();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [syncElapsed]);

  const start = useCallback(
    ({ mode, topicId = null, subjectId = null, boardId = null }: StartParams) => {
      const uid = userIdRef.current;
      if (!uid || timerRef.current) return;
      const state: PersistedTimer = {
        userId: uid,
        sessionId: createSessionId(),
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
    const uid = state.userId;
    const endedAt = Date.now();
    const durationSec = computeElapsedSec(state, endedAt);
    stopTicking();
    const pending: PendingSession = {
      userId: uid,
      sessionId: state.sessionId,
      startedAt: state.startedAt,
      endedAt, durationSec,
      mode: state.mode,
      topicId: state.topicId,
      subjectId: state.subjectId,
      boardId: state.boardId,
      source: 'timer',
    };
    savePendingSession(pending);
    clearTimer(uid);
    timerRef.current = null;
    setElapsedSec(durationSec);
    setPendingSession(pending);
    setStatus('awaiting_feedback');
  }, [stopTicking]);

  const discardPending = useCallback(() => {
    const uid = userIdRef.current;
    if (uid) clearPendingSession(uid);
    setPendingSession(null);
    setElapsedSec(0);
    setStatus('idle');
  }, []);

  /**
   * Para e descarta o timer imediatamente, sem salvar log.
   * Deve ser chamado ANTES de fazer logout para garantir que o
   * localStorage seja limpo antes da navegação desmontar o componente.
   */
  const abandon = useCallback(() => {
    const uid = userIdRef.current;
    stopTicking();
    timerRef.current = null;
    if (uid) {
      clearTimer(uid);
      clearPendingSession(uid);
    }
    setPendingSession(null);
    setElapsedSec(0);
    setStatus('idle');
  }, [stopTicking]);

  return {
    status,
    elapsedSec,
    formatted: formatHMS(elapsedSec),
    isRunning: status === 'running',
    isPaused: status === 'paused',
    pendingSession,
    start, pause, resume, stop, discardPending, abandon,
  };
}
