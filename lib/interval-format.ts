// lib/interval-format.ts
// Formata um intervalo em dias para o rótulo humano exibido nos botões de
// avaliação das quatro filas de revisão (tópicos, flashcards, lei, juris).

export function fmtInterval(days: number): string {
  if (days <= 1) return 'amanhã';
  if (days < 7)  return `${days} dias`;
  if (days === 7) return '1 semana';
  if (days < 30) return `${Math.round(days / 7)} sem.`;
  if (days < 60) return '1 mês';
  return `${Math.round(days / 30)} meses`;
}
