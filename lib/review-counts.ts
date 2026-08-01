'use client';
// lib/review-counts.ts
//
// Chame após QUALQUER ativação, desativação, criação-já-em-revisão ou exclusão
// de item em revisão, em qualquer das quatro fontes (tópicos, flashcards, lei
// seca, jurisprudências).
//
// O problema que isto resolve: agendar uma revisão acontece em telas que NÃO
// usam React Query para os próprios dados (Matérias, Vade Mecum, Jurisprudências,
// CardForm, FlashcardModal do Caderno, Meus Cards) — mas quem CONTA as revisões
// (Plano de Hoje, fila unificada, "mais antiga há N dias") usa. Sem esta chamada
// o usuário agendava uma revisão e a Home seguia dizendo "0 revisões" por até
// um minuto — ou continuava cobrando um item que ele acabou de cancelar.
//
// A LISTA DE CHAVES NÃO MORA MAIS AQUI: vive em lib/cache-invalidation.ts, no
// domínio 'review'.

import type { QueryClient } from '@tanstack/react-query';
import { invalidateAfter } from '@/lib/cache-invalidation';

export function invalidateReviewCounts(queryClient: QueryClient): void {
  invalidateAfter(queryClient, 'review');
}
