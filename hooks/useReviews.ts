// hooks/useReviews.ts
// Hook central do módulo de revisão.
// Encapsula todo estado, fetching (React Query) e handlers de evento.
// ReviewsClient importa apenas este hook e fica responsável só por renderização.
'use client';

import { useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listDueReviews, submitReview, deactivateReview, rescheduleReview,
  type ReviewItem, type ReviewRating,
} from '@/services/reviews.service';
import { countDailyQueue } from '@/services/flashcards.service';
import { useConfirm } from '@/hooks/useConfirm';
import { REVIEWS_DUE_KEY, FLASHCARD_COUNT_KEY } from '@/hooks/reviews.keys';

// Re-exporta para retrocompatibilidade com imports existentes.
export { REVIEWS_DUE_KEY, FLASHCARD_COUNT_KEY };

export function useReviews() {
  const queryClient = useQueryClient();
  const { confirm, dialog } = useConfirm();
  // processingRef bloqueia double-click antes do primeiro re-render (síncrono).
  const processingRef = useRef(new Set<string>());

  // ── Queries ──────────────────────────────────────────────────────────────

  const {
    data: items = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: REVIEWS_DUE_KEY,
    queryFn: listDueReviews,
    staleTime: Infinity,         // dados invalidados só por mutation — sem refetch por staleness
    refetchOnWindowFocus: false, // evita refetch ao retomar aba
  });

  const { data: cardCounts = null } = useQuery({
    queryKey: FLASHCARD_COUNT_KEY,
    queryFn: countDailyQueue,
  });

  // ── Helpers de optimistic update ─────────────────────────────────────────

  function removeOptimistically(topicId: string) {
    queryClient.setQueryData(
      REVIEWS_DUE_KEY,
      (old: ReviewItem[] = []) => old.filter(i => i.id !== topicId),
    );
  }

  function restoreSnapshot(snapshot: ReviewItem[] | undefined) {
    if (snapshot !== undefined) queryClient.setQueryData(REVIEWS_DUE_KEY, snapshot);
  }

  // ── Mutations ─────────────────────────────────────────────────────────────

  const rateMutation = useMutation({
    mutationFn: ({ topicId, rating }: { topicId: string; rating: ReviewRating }) =>
      submitReview(topicId, rating),
    onMutate: async ({ topicId }) => {
      processingRef.current.add(topicId);
      await queryClient.cancelQueries({ queryKey: REVIEWS_DUE_KEY });
      const snapshot = queryClient.getQueryData<ReviewItem[]>(REVIEWS_DUE_KEY);
      removeOptimistically(topicId);
      return { snapshot, topicId };
    },
    onError: (_err, _vars, ctx) => restoreSnapshot(ctx?.snapshot),
    onSettled: (_data, _err, vars) => {
      processingRef.current.delete(vars.topicId);
      queryClient.invalidateQueries({ queryKey: REVIEWS_DUE_KEY });
    },
  });

  const rescheduleMutation = useMutation({
    mutationFn: ({ topicId, dateStr }: { topicId: string; dateStr: string }) =>
      rescheduleReview(topicId, dateStr),
    onMutate: async ({ topicId }) => {
      await queryClient.cancelQueries({ queryKey: REVIEWS_DUE_KEY });
      const snapshot = queryClient.getQueryData<ReviewItem[]>(REVIEWS_DUE_KEY);
      removeOptimistically(topicId);
      return { snapshot };
    },
    onError: (_err, _vars, ctx) => restoreSnapshot(ctx?.snapshot),
    onSettled: () => queryClient.invalidateQueries({ queryKey: REVIEWS_DUE_KEY }),
  });

  const removeMutation = useMutation({
    mutationFn: (topicId: string) => deactivateReview(topicId),
    onMutate: async (topicId) => {
      await queryClient.cancelQueries({ queryKey: REVIEWS_DUE_KEY });
      const snapshot = queryClient.getQueryData<ReviewItem[]>(REVIEWS_DUE_KEY);
      removeOptimistically(topicId);
      return { snapshot };
    },
    onError: (_err, _vars, ctx) => restoreSnapshot(ctx?.snapshot),
    onSettled: () => queryClient.invalidateQueries({ queryKey: REVIEWS_DUE_KEY }),
  });

  // ── Handlers públicos — useCallback estabiliza as refs para React.memo nos cards ──

  const handleRate = useCallback((topicId: string, rating: ReviewRating) => {
    if (processingRef.current.has(topicId)) return;
    rateMutation.mutate({ topicId, rating });
  }, [rateMutation]);

  const handleReschedule = useCallback((topicId: string, dateStr: string) => {
    rescheduleMutation.mutate({ topicId, dateStr });
  }, [rescheduleMutation]);

  const handleRemove = useCallback(async (topicId: string) => {
    const confirmed = await confirm({
      title: 'Tirar este tópico do ciclo de revisão?',
      description: 'Ele sairá das revisões agendadas.',
    });
    if (confirmed) removeMutation.mutate(topicId);
  }, [confirm, removeMutation]);

  return {
    items,
    isLoading,
    error: error instanceof Error ? error.message : error ? 'Erro ao carregar.' : null,
    cardCounts,
    dialog,
    handleRate,
    handleReschedule,
    handleRemove,
  };
}
