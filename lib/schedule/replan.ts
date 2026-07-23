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
  // Matérias já presentes em cada dia: usado para não empilhar a mesma matéria
  // duas vezes no mesmo dia quando existe alternativa equivalente.
  const materiasPorDia = new Map<string, Set<string>>();
  for (const dia of dias) { cargaPorDia.set(dia, 0); materiasPorDia.set(dia, new Set()); }
  for (const b of blocks) {
    if (idsAtrasados.has(b.id)) continue;
    if (!cargaPorDia.has(b.block_date)) continue;
    cargaPorDia.set(b.block_date, (cargaPorDia.get(b.block_date) ?? 0) + b.planned_minutes);
    materiasPorDia.get(b.block_date)!.add(b.subject_id);
  }

  const cargaMaxima = Math.max(CARGA_MINIMA_PADRAO, ...[...cargaPorDia.values()]);

  const moves: ReplanMove[] = [];
  // Atrasados mais antigos primeiro — quem espera há mais tempo entra antes
  // nos dias mais vazios.
  const ordenados = [...atrasados].sort((a, b) => a.block_date.localeCompare(b.block_date));

  for (const bloco of ordenados) {
    // 1ª passada: dias dentro do teto e SEM a mesma matéria (evita "Português
    // 2× na sexta" quando outro dia comporta igual). 2ª passada: relaxa a
    // restrição de matéria. Fallback: o dia menos carregado, custe o que custar.
    let melhorDia: string | null = null;
    let melhorCarga = Infinity;
    for (const evitarRepeticao of [true, false]) {
      for (const dia of dias) {
        const carga = cargaPorDia.get(dia) ?? 0;
        if (evitarRepeticao && materiasPorDia.get(dia)!.has(bloco.subject_id)) continue;
        if (carga + bloco.planned_minutes <= cargaMaxima && carga < melhorCarga) {
          melhorDia = dia;
          melhorCarga = carga;
        }
      }
      if (melhorDia) break;
    }
    if (!melhorDia) {
      melhorDia = dias.reduce((min, d) => ((cargaPorDia.get(d) ?? 0) < (cargaPorDia.get(min) ?? 0) ? d : min), dias[0]);
    }
    cargaPorDia.set(melhorDia, (cargaPorDia.get(melhorDia) ?? 0) + bloco.planned_minutes);
    materiasPorDia.get(melhorDia)!.add(bloco.subject_id);
    moves.push({ block: bloco, fromDate: bloco.block_date, toDate: melhorDia });
  }

  return moves;
}
