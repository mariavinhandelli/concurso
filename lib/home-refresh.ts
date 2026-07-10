// lib/home-refresh.ts
// Invalida as queries da Home após salvar uma sessão de estudo, para que o
// Plano de Hoje (revisões, flashcards, sugestões, cronograma, metas, streak)
// reflita o progresso na hora — sem depender de refetch ao focar a janela.

import type { QueryClient } from '@tanstack/react-query';

const HOME_KEYS: readonly (readonly string[])[] = [
  ['due-reviews-count'],
  ['due-cards-count'],
  ['home-suggestions'],
  ['today-blocks'],     // casa por prefixo com ['today-blocks', <data>]
  ['edital-coverage'],
  ['raiox'],
  ['missoes-semana'],
  ['coach-semanal'],
  ['goals-summary'],
  ['questions-summary'],
  ['streak'],
  ['due-lei-count'],
  ['cycle-state'],      // casa por prefixo com ['cycle-state', <ruleId>] (passo Ciclo do Plano de Hoje)
];

export function refreshHomeAfterSession(queryClient: QueryClient): void {
  for (const key of HOME_KEYS) {
    queryClient.invalidateQueries({ queryKey: key });
  }
}
