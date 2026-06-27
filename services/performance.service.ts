// services/performance.service.ts
// Agregações de performance para a página de análise: resumo de constância
// (período + total) e cruzamento energia × desempenho. Leitura de study_logs.

import { createClient } from '@/lib/supabase/client';
import { getStreak } from '@/services/streak.service';

export interface ConstanciaResumo {
  // Período (últimos N dias)
  horasPeriodo: number;
  sessoesPeriodo: number;
  mediaHorasDia: number;       // média sobre os dias do período
  sessoesPorSemana: number;    // média semanal no período
  // Total geral (toda a história)
  horasTotal: number;
  sessoesTotal: number;
  // Constância (reusa o streak)
  sequenciaAtual: number;
  recorde: number;
}

export interface EnergiaPonto {
  energia: number;         // 1..5
  acertoMedio: number;     // 0..100
  sessoes: number;         // quantas sessões nesse nível (para peso/tooltip)
}

// Resumo de constância: período (últimos `dias`) + total geral + streak.
export async function getConstanciaResumo(dias = 30): Promise<ConstanciaResumo | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Todas as sessões (para o total geral).
  const { data: todas, error } = await supabase
    .from('study_logs')
    .select('duration_sec, started_at')
    .eq('user_id', user.id);
  if (error) throw new Error('Erro ao carregar resumo de constância: ' + error.message);

  let segTotal = 0;
  let sessoesTotal = 0;
  let segPeriodo = 0;
  let sessoesPeriodo = 0;

  const corte = new Date();
  corte.setDate(corte.getDate() - dias);
  corte.setHours(0, 0, 0, 0);

  for (const l of todas ?? []) {
    const sec = l.duration_sec ?? 0;
    segTotal += sec;
    sessoesTotal += 1;
    if (new Date(l.started_at) >= corte) {
      segPeriodo += sec;
      sessoesPeriodo += 1;
    }
  }

  const horasPeriodo = segPeriodo / 3600;
  const horasTotal = segTotal / 3600;
  const mediaHorasDia = horasPeriodo / dias;
  const sessoesPorSemana = (sessoesPeriodo / dias) * 7;

  const streak = await getStreak();

  return {
    horasPeriodo,
    sessoesPeriodo,
    mediaHorasDia,
    sessoesPorSemana,
    horasTotal,
    sessoesTotal,
    sequenciaAtual: streak.current,
    recorde: streak.longest,
  };
}

// Energia × desempenho: acerto médio por nível de energia (1..5).
export async function getEnergiaDesempenho(): Promise<EnergiaPonto[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: logs, error } = await supabase
    .from('study_logs')
    .select('energy_level, questions_total, questions_correct')
    .eq('user_id', user.id)
    .not('energy_level', 'is', null);
  if (error) throw new Error('Erro ao analisar energia e desempenho: ' + error.message);

  // Acumula questões por nível de energia (só sessões com questões).
  const acc: Record<number, { total: number; correct: number; sessoes: number }> = {};
  for (const l of logs ?? []) {
    const e = l.energy_level as number;
    const q = l.questions_total ?? 0;
    const c = l.questions_correct ?? 0;
    if (q <= 0) continue; // sem questões não há acerto a medir
    if (!acc[e]) acc[e] = { total: 0, correct: 0, sessoes: 0 };
    acc[e].total += q;
    acc[e].correct += c;
    acc[e].sessoes += 1;
  }

  // Monta os pontos dos níveis 1..5 que têm dados.
  const pontos: EnergiaPonto[] = [];
  for (let nivel = 1; nivel <= 5; nivel++) {
    const a = acc[nivel];
    if (!a || a.total === 0) continue;
    pontos.push({
      energia: nivel,
      acertoMedio: Math.round((a.correct / a.total) * 100),
      sessoes: a.sessoes,
    });
  }

  return pontos;
}
