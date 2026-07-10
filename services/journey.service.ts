// services/journey.service.ts
// Estatísticas acumuladas de toda a jornada de estudos do usuário.
// Usado no widget JourneyStats (Home) e na cobertura do ExamCountdown.

import { createClient } from '@/lib/supabase/client';
import { getCachedUser } from '@/lib/supabase/authCache';

export interface JourneyStats {
  totalMinutes: number;          // tempo total de estudo (all-time)
  sessionsThisMonth: number;     // sessões no mês corrente
  topicsCovered: number;         // tópicos distintos com ≥1 sessão (all-time)
  totalTopics: number;           // tópicos criados pelo usuário
  coveragePct: number;           // topicsCovered / totalTopics × 100
  avgTopicsPerWeek4w: number;    // tópicos distintos estudados nas últimas 4 semanas ÷ 4
  topicsThisWeek: number;        // tópicos distintos estudados nos últimos 7 dias
}

const EMPTY: JourneyStats = {
  totalMinutes: 0,
  sessionsThisMonth: 0,
  topicsCovered: 0,
  totalTopics: 0,
  coveragePct: 0,
  avgTopicsPerWeek4w: 0,
  topicsThisWeek: 0,
};

export async function getJourneyStats(): Promise<JourneyStats> {
  const supabase = createClient();
  const user = await getCachedUser();
  if (!user) return EMPTY;

  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const thirtyDaysAgo = new Date(now.getTime() - 28 * 86_400_000).toISOString();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString();

  // 4 queries em paralelo — duas all-time leves (só colunas necessárias) e duas filtradas
  const [
    { data: allLogs },
    { count: sessionsMesCount },
    { data: recent30Logs },
    { count: totalTopicsCount },
  ] = await Promise.all([
    // All-time: só duration_sec + topic_id — coluna numérica leve mesmo com centenas de linhas
    supabase
      .from('study_logs')
      .select('duration_sec, topic_id')
      .eq('user_id', user.id),

    // Sessões do mês — apenas contagem, sem dados
    supabase
      .from('study_logs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('started_at', firstOfMonth),

    // Últimos 30 dias — para calcular pace (tópicos/semana)
    supabase
      .from('study_logs')
      .select('started_at, topic_id')
      .eq('user_id', user.id)
      .not('topic_id', 'is', null)
      .gte('started_at', thirtyDaysAgo),

    // Total de tópicos criados
    supabase
      .from('topics')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id),
  ]);

  // Totais all-time
  const totalMinutes = Math.round(
    (allLogs?.reduce((s, l) => s + (l.duration_sec ?? 0), 0) ?? 0) / 60,
  );
  const topicsCovered = new Set(
    allLogs?.filter((l) => l.topic_id).map((l) => l.topic_id as string),
  ).size;

  const totalTopics = totalTopicsCount ?? 0;
  const coveragePct = totalTopics > 0 ? Math.round((topicsCovered / totalTopics) * 100) : 0;

  // Pace: tópicos distintos nos últimos 7 e 28 dias
  const topicsThisWeek = new Set(
    recent30Logs?.filter((l) => l.started_at >= sevenDaysAgo).map((l) => l.topic_id as string),
  ).size;
  const topicsCovered28d = new Set(recent30Logs?.map((l) => l.topic_id as string)).size;
  const avgTopicsPerWeek4w = topicsCovered28d > 0
    ? Math.round((topicsCovered28d / 4) * 10) / 10
    : 0;

  return {
    totalMinutes,
    sessionsThisMonth: sessionsMesCount ?? 0,
    topicsCovered,
    totalTopics,
    coveragePct,
    avgTopicsPerWeek4w,
    topicsThisWeek,
  };
}
