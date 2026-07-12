// lib/schedule/distributor.ts
// Algoritmo puro de distribuição de matérias por dias da semana.
// Extraído de GeneratorModal para ser testável e reutilizável sem React.

import type { GeneratorSubject } from '@/services/scheduleGenerator.service';
import type { RecurrenceItemInput } from '@/services/recurrence.service';

export function distribuirDiaFixo(
  subjects: GeneratorSubject[],
  diasSemana: number[],
  materiasPorDia: number,
  floorMin: number = 30,
): RecurrenceItemInput[] {
  if (subjects.length === 0 || diasSemana.length === 0) return [];

  const totalSlots = diasSemana.length * materiasPorDia;
  const somaPeso = subjects.reduce((s, x) => s + x.weight, 0);

  // 1) Quantos slots cada matéria ganha (proporcional ao peso, piso 1).
  const slotsPorMateria = subjects.map((s) => ({
    subject: s,
    slots: Math.max(1, Math.round((s.weight / somaPeso) * totalSlots)),
  }));

  // 2) Tempo por aparição: minutesPerCycle dividido pelos slots (piso pessoal,
  //    vindo de user_features.floor_minutes via GeneratorPreview).
  const tempoPorSlot = (sm: { subject: GeneratorSubject; slots: number }) => {
    const base = Math.round((sm.subject.minutesPerCycle / sm.slots) / 5) * 5;
    return Math.max(floorMin, base);
  };

  // 3) Monta fila de aparições em round-robin, mais frequentes primeiro.
  const fila: { subjectId: string; minutes: number }[] = [];
  const expandidas = slotsPorMateria
    .map((sm) => ({ id: sm.subject.subjectId, slots: sm.slots, minutes: tempoPorSlot(sm) }))
    .sort((a, b) => b.slots - a.slots);

  const restante = expandidas.map((e) => ({ ...e }));
  let total = restante.reduce((s, e) => s + e.slots, 0);
  while (total > 0) {
    for (const e of restante) {
      if (e.slots > 0) {
        fila.push({ subjectId: e.id, minutes: e.minutes });
        e.slots--;
        total--;
      }
    }
  }

  // 4) Distribui pelos dias, evitando repetir a mesma matéria em dias consecutivos.
  const porDia: { subjectId: string; minutes: number }[][] = diasSemana.map(() => []);
  let ultimaDoDiaAnterior: string | null = null;

  for (let d = 0; d < diasSemana.length; d++) {
    for (let k = 0; k < materiasPorDia && fila.length > 0; k++) {
      const jaHoje = new Set(porDia[d].map((x) => x.subjectId));
      let idx = fila.findIndex((f) => f.subjectId !== ultimaDoDiaAnterior && !jaHoje.has(f.subjectId));
      if (idx === -1) idx = fila.findIndex((f) => !jaHoje.has(f.subjectId));
      if (idx === -1) idx = 0;
      const escolhido = fila.splice(idx, 1)[0];
      porDia[d].push(escolhido);
    }
    if (porDia[d].length > 0) ultimaDoDiaAnterior = porDia[d][porDia[d].length - 1].subjectId;
  }

  // Sobras entram nos dias com menos carga.
  while (fila.length > 0) {
    let menorDia = 0;
    for (let d = 1; d < porDia.length; d++) if (porDia[d].length < porDia[menorDia].length) menorDia = d;
    porDia[menorDia].push(fila.shift()!);
  }

  // 5) Converte em RecurrenceItemInput.
  const items: RecurrenceItemInput[] = [];
  for (let d = 0; d < diasSemana.length; d++) {
    porDia[d].forEach((slot, pos) => {
      items.push({
        subjectId: slot.subjectId,
        plannedMinutes: slot.minutes,
        weekday: diasSemana[d],
        position: pos,
      });
    });
  }
  return items;
}
