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
  ['due-juris-count'],  // o passo "Revisar" soma juris — sem isto a parcela ficava defasada
  ['due-oldest-date'],  // "mais antiga há N dias" — senão fica com a data vencida antiga por até 60s
  ['cycle-state'],      // casa por prefixo com ['cycle-state', <ruleId>] (passo Ciclo do Plano de Hoje)
  ['retomada'],         // estudar encerra o hiato — o card "Bem-vindo de volta" deve sumir na hora
  ['time-by-category'], // casa por prefixo com ['time-by-category', view, offset] (TimePieCard)
  ['journey-stats'],    // totais de horas/sessões da Jornada
  ['suggested-target'], // nudge da Meta Adaptativa depende de todayMinutes
];

export function refreshHomeAfterSession(queryClient: QueryClient): void {
  for (const key of HOME_KEYS) {
    queryClient.invalidateQueries({ queryKey: key });
  }
}
