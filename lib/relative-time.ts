// lib/relative-time.ts
// "há 5 min / ontem / há 12 dias / 20 de jun." — rótulo relativo de atualização
// usado nos cards do hub Caderno. Antes duplicado em AnotacoesView e TudoView.

/** Epoch (ms) de N dias atrás — corte de janelas "recentes". */
export function cutoffDaysAgo(days: number): number {
  return Date.now() - days * 86_400_000;
}

export function fmtRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'ontem';
  if (d < 30) return `há ${d} dias`;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}
