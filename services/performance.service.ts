// services/performance.service.ts
// Agregações de performance para a página de análise: resumo de constância
// (período + total) e cruzamento energia × desempenho. Leitura de study_logs.

import { createClient } from '@/lib/supabase/client';
import { getCachedUser } from '@/lib/supabase/authCache';
import { getStreak } from '@/services/streak.service';
import { getStudyDayTotals } from '@/services/studyTotals.service';
import { toLocalDateString as localDateStr } from '@/lib/local-date';

export interface ConstanciaResumo {
  // Período (últimos N dias)
  horasPeriodo: number;
  sessoesPeriodo: number;
  diasAtivosPeriodo: number;   // dias com estudo no período — o número honesto de ritmo
  mediaHorasDiaAtivo: number;  // média sobre os dias ESTUDADOS (não sobre os 30 corridos)
  sessoesPorSemana: number;    // média semanal no período
  questoesPeriodo: number;
  acertoPct: number | null;    // % de acerto no período (null = sem questões)
  // M5 — "você vs. você": a MESMA janela imediatamente anterior (dias..2×dias
  // atrás). Janelas móveis comparáveis — nunca "26 de julho vs. junho inteiro".
  prevHorasPeriodo: number;
  prevDiasAtivos: number;
  prevQuestoes: number;
  prevAcertoPct: number | null;
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
// Perf: antes isto paginava a tabela INTEIRA de study_logs no cliente só para
// somar horas e contar sessões. Agora as horas vêm agregadas do servidor
// (get_study_day_totals — a mesma RPC que streak/metas já usam, deduplicada
// por request) e as sessões vêm de dois COUNT head-only. Nenhuma linha crua
// trafega.
export async function getConstanciaResumo(dias = 30): Promise<ConstanciaResumo | null> {
  const supabase = createClient();
  const user = await getCachedUser();
  if (!user) return null;

  const corte = new Date();
  corte.setDate(corte.getDate() - dias);
  corte.setHours(0, 0, 0, 0);
  const corteDia = localDateStr(corte);
  // Janela anterior (M5): [2×dias atrás, dias atrás) — mesmo tamanho, comparável.
  const cortePrev = new Date(corte);
  cortePrev.setDate(cortePrev.getDate() - dias);
  const cortePrevDia = localDateStr(cortePrev);

  const [dayTotals, streak, totalRes, periodoRes] = await Promise.all([
    getStudyDayTotals(),
    getStreak(),
    supabase
      .from('study_logs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id),
    supabase
      .from('study_logs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('started_at', corte.toISOString()),
  ]);

  if (totalRes.error) throw new Error('Erro ao carregar resumo de constância: ' + totalRes.error.message);
  if (periodoRes.error) throw new Error('Erro ao carregar resumo de constância: ' + periodoRes.error.message);

  let segTotal = 0;
  let segPeriodo = 0;
  let diasAtivosPeriodo = 0;
  let questoesPeriodo = 0, certasPeriodo = 0;
  let segPrev = 0, prevDiasAtivos = 0, prevQuestoes = 0, prevCertas = 0;
  for (const d of dayTotals) {
    segTotal += d.seconds;
    if (d.day >= corteDia) {
      segPeriodo += d.seconds;
      questoesPeriodo += d.questions;
      certasPeriodo += d.correct;
      if (d.seconds > 0) diasAtivosPeriodo += 1;
    } else if (d.day >= cortePrevDia) {
      segPrev += d.seconds;
      prevQuestoes += d.questions;
      prevCertas += d.correct;
      if (d.seconds > 0) prevDiasAtivos += 1;
    }
  }

  const sessoesTotal = totalRes.count ?? 0;
  const sessoesPeriodo = periodoRes.count ?? 0;
  const horasPeriodo = segPeriodo / 3600;
  const horasTotal = segTotal / 3600;

  return {
    horasPeriodo,
    sessoesPeriodo,
    diasAtivosPeriodo,
    // Média sobre os DIAS ESTUDADOS, não sobre os 30 dias corridos: quem estuda
    // 3x por semana não se reconhece numa média diluída pelos dias de folga.
    mediaHorasDiaAtivo: diasAtivosPeriodo > 0 ? horasPeriodo / diasAtivosPeriodo : 0,
    sessoesPorSemana: (sessoesPeriodo / dias) * 7,
    questoesPeriodo,
    acertoPct: questoesPeriodo > 0 ? Math.round((certasPeriodo / questoesPeriodo) * 100) : null,
    prevHorasPeriodo: segPrev / 3600,
    prevDiasAtivos,
    prevQuestoes,
    prevAcertoPct: prevQuestoes > 0 ? Math.round((prevCertas / prevQuestoes) * 100) : null,
    horasTotal,
    sessoesTotal,
    sequenciaAtual: streak.current,
    recorde: streak.longest,
  };
}

// Energia × desempenho: acerto médio por nível de energia (1..5).
export async function getEnergiaDesempenho(): Promise<EnergiaPonto[]> {
  const supabase = createClient();
  const user = await getCachedUser();
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
