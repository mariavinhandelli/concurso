'use client';
// hooks/useStudySession.ts
// Estado e lógica de uma sessão de estudo de flashcards.

import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { submitCardReview, type ReviewRating, type QueueCard } from '@/services/flashcards.service';

export interface StudySessionState {
  index: number;
  current: QueueCard | undefined;
  total: number;
  remaining: number;
  progress: number;
  pendingCount: number;
  newCount: number;
  newLearned: number;
  flipped: boolean;
  saving: boolean;
  isFinished: boolean;
}

export interface StudySessionActions {
  flip: () => void;
  setFlipped: (v: boolean) => void;
  rate: (rating: ReviewRating) => Promise<void>;
}

export function useStudySession(
  queue: QueueCard[],
  onError: (msg: string) => void,
): StudySessionState & StudySessionActions {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newLearned, setNewLearned] = useState(0);
  const savingRef = useRef(false);
  const onErrorRef = useRef(onError);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  const total = queue.length;
  const current = queue[index];
  const remaining = total - index;
  const isFinished = index >= total;
  const progress = total > 0 ? Math.round((index / total) * 100) : 0;

  const pendingCount = useMemo(
    () => queue.slice(index).filter(c => !c.isNew).length,
    [queue, index],
  );
  const newCount = useMemo(
    () => queue.slice(index).filter(c => c.isNew).length,
    [queue, index],
  );

  const flip = useCallback(() => setFlipped(v => !v), []);

  const rate = useCallback(async (rating: ReviewRating) => {
    if (!current || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await submitCardReview(current.id, rating);
      if (current.isNew) setNewLearned(n => n + 1);
      setFlipped(false);
      setIndex(i => i + 1);
    } catch (e) {
      onErrorRef.current(e instanceof Error ? e.message : 'Erro ao salvar avaliação. Tente novamente.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [current]);

  return {
    index, current, total, remaining, isFinished,
    progress, pendingCount, newCount, newLearned,
    flipped, saving,
    flip, setFlipped, rate,
  };
}
