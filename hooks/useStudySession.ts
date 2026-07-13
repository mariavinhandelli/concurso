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
  // Fila interna: "Errei" re-enfileira o card no fim da sessão (rever ainda hoje),
  // então a fila da sessão pode crescer além da fila recebida.
  const [cards, setCards] = useState<QueueCard[]>(queue);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newLearned, setNewLearned] = useState(0);
  const queuePropRef = useRef(queue);
  useEffect(() => {
    if (queuePropRef.current !== queue) {
      queuePropRef.current = queue;
      setCards(queue);
      setIndex(0);
      setFlipped(false);
      setNewLearned(0);
    }
  }, [queue]);

  const savingRef = useRef(false);
  const onErrorRef = useRef(onError);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  const total = cards.length;
  const current = cards[index];
  const remaining = total - index;
  const isFinished = index >= total;
  const progress = total > 0 ? Math.round((index / total) * 100) : 0;

  const pendingCount = useMemo(
    () => cards.slice(index).filter(c => !c.isNew).length,
    [cards, index],
  );
  const newCount = useMemo(
    () => cards.slice(index).filter(c => c.isNew).length,
    [cards, index],
  );

  const flip = useCallback(() => setFlipped(v => !v), []);

  const rate = useCallback(async (rating: ReviewRating) => {
    if (!current || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await submitCardReview(current.id, rating);
      if (rating === 'errei') {
        // Estado pós-lapso (SM-2 já persistido): repetições zeradas, intervalo 1.
        // O card volta pro fim desta sessão para ser visto de novo hoje.
        setCards(prev => [...prev, { ...current, isNew: false, repetitions: 0, intervalDays: 1 }]);
      } else if (current.isNew) {
        setNewLearned(n => n + 1);
      }
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
