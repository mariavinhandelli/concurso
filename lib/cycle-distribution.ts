// lib/cycle-distribution.ts
// Distribuição dos minutos de UMA matéria entre os slots que ela ocupa no ciclo.
//
// Uma matéria pode aparecer várias vezes na sequência do ciclo (ex.: Direito
// Administrativo nas posições 0 e 5). O crédito é gravado por matéria, então na
// hora de exibir é preciso repartir esse total entre os slots dela — enchendo um
// antes de passar ao próximo.
//
// Antes isso não existia: o total da matéria era REPLICADO em cada slot, e uma
// hora estudada aparecia como duas voltas cumpridas. A volta do ciclo fechava
// com menos estudo do que o planejado.
//
// Pura e isolada do Supabase para poder ser testada.

export interface CycleSlotPlan {
  /** id do recurrence_item */
  id: string;
  /** minutos planejados para este slot */
  plannedMinutes: number;
}

/**
 * Reparte `totalMinutes` entre `slots`, na ordem recebida (que deve ser a ordem
 * do ciclo). Uma "volta cheia" = todos os slots da matéria cumpridos; o resto
 * enche os slots em sequência.
 *
 * Invariante: a soma dos valores devolvidos é sempre igual a `totalMinutes`.
 */
export function distributeMinutesAcrossSlots(
  totalMinutes: number,
  slots: CycleSlotPlan[],
): Record<string, number> {
  const out: Record<string, number> = {};
  if (slots.length === 0) return out;

  const plannedTotal = slots.reduce((sum, s) => sum + Math.max(0, s.plannedMinutes), 0);
  let restante = Math.max(0, totalMinutes);

  // Voltas em que TODOS os slots da matéria foram cumpridos.
  const voltasCheias = plannedTotal > 0 ? Math.floor(restante / plannedTotal) : 0;
  restante -= voltasCheias * plannedTotal;

  for (const slot of slots) {
    const planned = Math.max(0, slot.plannedMinutes);
    const naVoltaAtual = Math.min(restante, planned);
    restante -= naVoltaAtual;
    out[slot.id] = voltasCheias * planned + naVoltaAtual;
  }

  // plannedTotal === 0 (todos os slots com 0 planejado): não há como repartir
  // por volta; joga tudo no primeiro para não sumir com os minutos.
  if (restante > 0) out[slots[0].id] = (out[slots[0].id] ?? 0) + restante;

  return out;
}
