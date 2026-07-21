'use client';
// hooks/useFlashcardNavigation.ts
// Máquina de estados da navegação em 3 níveis: matérias → tópicos → cards.
// Extraído de CardsTab para isolar a lógica de estado da renderização.

import { useState, useCallback, useRef } from 'react';
import {
  listFlashcards, countFlashcardsBySubject,
  type Flashcard,
} from '@/services/flashcards.service';
import { listLeaves as listTopicOptions, type PickerOption } from '@/services/topics.service';
import type { SubjectColorOption } from '@/services/subjects.service';

export type NavLevel = 'subjects' | 'topics' | 'cards';

export interface FlashcardNavState {
  level: NavLevel;
  subjects: SubjectColorOption[];
  topics: PickerOption[];
  cards: Flashcard[];
  counts: Record<string, number>;
  curSubject: PickerOption | null;
  curTopic: PickerOption | null | 'none';
  loadError: string | null;
}

export interface FlashcardNavActions {
  setSubjects: (s: SubjectColorOption[]) => void;
  setCounts: (c: Record<string, number>) => void;
  setLoadError: (e: string | null) => void;
  openSubject: (s: PickerOption, onError: (msg: string) => void) => void;
  openTopic: (t: PickerOption | 'none', onError: (msg: string) => void) => void;
  goBackToSubjects: () => void;
  goBackToTopics: () => void;
  reloadCards: (onError: (msg: string) => void) => void;
  updateCard: (id: string, updates: Partial<Flashcard>) => void;
}

export function useFlashcardNavigation(): FlashcardNavState & FlashcardNavActions {
  const [level, setLevel] = useState<NavLevel>('subjects');
  const [subjects, setSubjects] = useState<SubjectColorOption[]>([]);
  const [topics, setTopics] = useState<PickerOption[]>([]);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [curSubject, setCurSubject] = useState<PickerOption | null>(null);
  const [curTopic, setCurTopic] = useState<PickerOption | null | 'none'>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Guardas contra respostas obsoletas: navegação rápida entre matérias/tópicos
  // não pode deixar uma resposta antiga sobrescrever o estado do destino atual.
  const topicsRequestRef = useRef<string | null>(null);
  const cardsRequestRef = useRef<string | null>(null);

  const loadCards = useCallback(async (
    subjectId: string,
    topicId: string | null,
    onError: (msg: string) => void,
  ) => {
    const requestKey = `${subjectId}:${topicId ?? ''}`;
    cardsRequestRef.current = requestKey;
    try {
      const result = await listFlashcards({ subjectId, topicId });
      if (cardsRequestRef.current === requestKey) setCards(result);
    } catch (e) {
      if (cardsRequestRef.current === requestKey) {
        onError(e instanceof Error ? e.message : 'Erro ao carregar os cards. Tente novamente.');
      }
    }
  }, []);

  const openSubject = useCallback((s: PickerOption, onError: (msg: string) => void) => {
    setCurSubject(s);
    setLevel('topics');
    topicsRequestRef.current = s.id;
    listTopicOptions(s.id)
      .then((ts) => { if (topicsRequestRef.current === s.id) setTopics(ts); })
      .catch(e => {
        if (topicsRequestRef.current === s.id) {
          onError(e instanceof Error ? e.message : 'Erro ao carregar tópicos.');
        }
      });
  }, []);

  const openTopic = useCallback((t: PickerOption | 'none') => {
    setCurTopic(t);
    setLevel('cards');
  }, []);

  const goBackToSubjects = useCallback(() => {
    setLevel('subjects');
    setCurSubject(null);
    setCurTopic(null);
  }, []);

  const goBackToTopics = useCallback(() => {
    setLevel('topics');
    setCurTopic(null);
  }, []);

  const updateCard = useCallback((id: string, updates: Partial<Flashcard>) => {
    setCards(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  }, []);

  const reloadCards = useCallback((onError: (msg: string) => void) => {
    if (!curSubject) return;
    const topicId = curTopic === 'none' ? null : (curTopic?.id ?? null);
    loadCards(curSubject.id, topicId, onError);
    countFlashcardsBySubject()
      .then(setCounts)
      .catch(e => onError(e instanceof Error ? e.message : 'Erro ao atualizar contagem.'));
  }, [curSubject, curTopic, loadCards]);

  // Exposto para que CardsTab possa acionar a carga de cards após openTopic.
  const openTopicWithLoad = useCallback((t: PickerOption | 'none', onError: (msg: string) => void) => {
    openTopic(t);
    if (!curSubject) return;
    loadCards(curSubject.id, t === 'none' ? null : (t as PickerOption).id, onError);
  }, [curSubject, openTopic, loadCards]);

  return {
    level, subjects, topics, cards, counts, curSubject, curTopic, loadError,
    setSubjects, setCounts, setLoadError,
    openSubject,
    openTopic: openTopicWithLoad,
    goBackToSubjects,
    goBackToTopics,
    reloadCards,
    updateCard,
  };
}
