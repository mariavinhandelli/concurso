// lib/schedule/replan.ts
// Cronograma vivo — algoritmo puro (sem I/O) que decide para onde realocar
// blocos atrasados dentro da MESMA semana. Greedy: cada bloco atrasado vai
// para o dia restante (hoje em diante) com menor carga atual, respeitando um
// teto de carga diária (o maior dia já planejado nesta semana, com piso de
// 4h para semanas ainda vazias) — nunca empilha tudo no mesmo dia.
import type { ScheduleBlock } from '@/services/scheduleEngine.service';
import { toLocalDateString as localDateStr } from '@/lib/local-date';

export interface ReplanMove {
  block: ScheduleBlock;
  fromDate: string;
  toDate: string;
}

const CARGA_MINIMA_PADRAO = 240; // 4h — piso quando a semana ainda não tem nada planejado

export function computeReplan(blocks: ScheduleBlock[], weekStart: Date, hoje: Date = new Date()): ReplanMove[] {
  const hojeStr = localDateStr(hoje);

  const atrasados = blocks.filter((b) => !b.is_done && b.block_date < hojeStr);
  if (atrasados.length === 0) return [];

  // Dias candidatos a receber: de hoje até domingo desta semana.
  const dias: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    const dStr = localDateStr(d);
    if (dStr >= hojeStr) dias.push(dStr);
  }
  if (dias.length === 0) return [];

  // Carga atual por dia candidato — exclui os próprios atrasados (eles ainda
  // não têm dia novo definido; senão o cálculo ficaria circular).
  const idsAtrasados = new Set(atrasados.map((b) => b.id));
  const cargaPorDia = new Map<string, number>();
  for (const dia of dias) cargaPorDia.set(dia, 0);
  for (const b of blocks) {
    if (idsAtrasados.has(b.id)) continue;
    if (!cargaPorDia.has(b.block_date)) continue;
    cargaPorDia.set(b.block_date, (cargaPorDia.get(b.block_date) ?? 0) + b.planned_minutes);
  }

  const cargaMaxima = Math.max(CARGA_MINIMA_PADRAO, ...[...cargaPorDia.values()]);

  const moves: ReplanMove[] = [];
  // Atrasados mais antigos primeiro — quem espera há mais tempo entra antes
  // nos dias mais vazios.
  const ordenados = [...atrasados].sort((a, b) => a.block_date.localeCompare(b.block_date));

  for (const bloco of ordenados) {
    let melhorDia: string | null = null;
    let melhorCarga = Infinity;
    for (const dia of dias) {
      const carga = cargaPorDia.get(dia) ?? 0;
      if (carga + bloco.planned_minutes <= cargaMaxima && carga < melhorCarga) {
        melhorDia = dia;
        melhorCarga = carga;
      }
    }
    // Nenhum dia comporta sem estourar o teto — usa o menos carregado mesmo assim
    // (melhor um dia um pouco cheio do que o bloco ficar perdido no passado).
    if (!melhorDia) {
      melhorDia = dias.reduce((min, d) => ((cargaPorDia.get(d) ?? 0) < (cargaPorDia.get(min) ?? 0) ? d : min), dias[0]);
    }
    cargaPorDia.set(melhorDia, (cargaPorDia.get(melhorDia) ?? 0) + bloco.planned_minutes);
    moves.push({ block: bloco, fromDate: bloco.block_date, toDate: melhorDia });
  }

  return moves;
}
