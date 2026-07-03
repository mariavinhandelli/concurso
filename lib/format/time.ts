// Formatação de duração em minutos → string legível.
// Única definição canônica — substitui as cópias inline em TodayBlock e TimePieCard.
export function fmtMin(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  return m > 0 ? `${h}h${String(m).padStart(2, '0')}min` : `${h}h`;
}
