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

interface JourneyStatsRow {
  total_minutes:        number | null;
  sessions_this_month:  number | null;
  topics_covered:       number | null;
  topics_this_week:     number | null;
  topics_28d:           number | null;
}

export async function getJourneyStats(): Promise<JourneyStats> {
  const supabase = createClient();
  const user = await getCachedUser();
  if (!user) return EMPTY;

  const tz = (typeof Intl !== 'undefined' && Intl.DateTimeFormat().resolvedOptions().timeZone) || 'America/Sao_Paulo';

  // Auditoria de performance (02/08) — antes buscava study_logs (duration_sec,
  // topic_id) INTEIRO e sem `.limit()`, duas vezes (all-time + últimos 30
  // dias), pra derivar somas e distintos de tópico em JS. get_journey_stats
  // agrega tudo no servidor numa passagem só (migration 20260802222000).
  const [{ data: statsData, error }, { count: totalTopicsCount }] = await Promise.all([
    supabase.rpc('get_journey_stats', { p_tz: tz }).maybeSingle(),
    supabase
      .from('topics')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id),
  ]);
  if (error) throw new Error('Erro ao calcular jornada: ' + error.message);

  const row = (statsData ?? {}) as JourneyStatsRow;
  const topicsCovered = row.topics_covered ?? 0;
  const totalTopics = totalTopicsCount ?? 0;
  const coveragePct = totalTopics > 0 ? Math.round((topicsCovered / totalTopics) * 100) : 0;

  const topicsCovered28d = row.topics_28d ?? 0;
  const avgTopicsPerWeek4w = topicsCovered28d > 0
    ? Math.round((topicsCovered28d / 4) * 10) / 10
    : 0;

  return {
    totalMinutes: row.total_minutes ?? 0,
    sessionsThisMonth: row.sessions_this_month ?? 0,
    topicsCovered,
    totalTopics,
    coveragePct,
    avgTopicsPerWeek4w,
    topicsThisWeek: row.topics_this_week ?? 0,
  };
}
