// services/badges.service.ts
// MOTOR DE CONQUISTAS. Lê study_logs (paginado), deriva badges ao vivo,
// e calcula o ritmo dos últimos 30 dias para estimar ETA de cada conquista.

import { createClient } from '@/lib/supabase/client';
import { getStreak } from '@/services/streak.service';
import { toLocalDateString as localDateStr } from '@/lib/local-date';

export type BadgeFamily = 'volume' | 'maestria' | 'tempo' | 'consistencia';

export interface Badge {
  id: string;
  family: BadgeFamily;
  label: string;
  description: string;
  unlocked: boolean;
  current: number;
  target: number;
  unit: string;
  progress: number;
  hint?: string;
  tier?: 'bronze' | 'prata' | 'ouro';
  etaDays?: number;
}

export interface BadgeStats {
  totalQuestions: number;
  totalCorrect: number;
  accuracy: number;
  totalHours: number;
  questoesBronze: number;
  questoesPrata: number;
  questoesOuro: number;
}

export interface RhythmStats {
  avgQuestionsPerDay: number; // questões dos últimos 30 dias / 30
  avgHoursPerDay: number;     // horas dos últimos 30 dias / 30
  activeDaysLast30: number;   // dias com pelo menos 1 sessão no período
}

export interface ConsistencyStats {
  current: number;
  longest: number;
}

export interface BadgeState {
  stats: BadgeStats;
  consistency: ConsistencyStats;
  rhythm: RhythmStats;
  badges: Badge[];
  unlockedCount: number;
  totalCount: number;
}

// Marcos de volume: 100 (1ª semana) → 500 (1 mês) → 2k (3-6 meses) → 6k (federal)
const VOLUME_TARGETS = [100, 500, 2000, 6000];
// Horas: 50 (iniciante) → 200 (comprometido) → 500 (federal médio) → 1000 (fiscal federal)
const TEMPO_TARGETS_HORAS = [50, 200, 500, 1000];
// Dias: 7 (1ª semana) → 30 (hábito formado) → 100 (elite, referência Duolingo)
const CONSISTENCIA_TARGETS_DIAS = [7, 30, 100];

const MAESTRIA_TIERS: {
  tier: 'bronze' | 'prata' | 'ouro';
  rotulo: string;
  meta: number; // metas inversas ao nível: mais fácil manter 90%+ → exige menos volume
}[] = [
  { tier: 'bronze', rotulo: '70–80%', meta: 300 }, // mais questões pois é a faixa mais fácil de atingir casualmente
  { tier: 'prata',  rotulo: '80–90%', meta: 200 },
  { tier: 'ouro',   rotulo: '90%+',   meta: 100 }, // menos volume: manter 90%+ já é a conquista
];

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

function etaDaysCalc(remaining: number, avgPerDay: number): number | undefined {
  if (avgPerDay <= 0 || remaining <= 0) return undefined;
  return Math.ceil(remaining / avgPerDay);
}

type SupabaseClient = ReturnType<typeof createClient>;

// ─── Query interna consolidada (QW6) ─────────────────────────────────────────
// Uma única passagem paginada sobre study_logs calcula tanto as estatísticas
// globais (stats) quanto o ritmo dos últimos 30 dias (rhythm).
// Elimina a segunda query separada de _getRhythm.

interface BadgeData {
  stats: BadgeStats;
  rhythm: RhythmStats;
}

async function _getBadgeData(
  supabase: SupabaseClient,
  userId: string,
): Promise<BadgeData | null> {
  const since30 = new Date();
  since30.setDate(since30.getDate() - 30);
  const since30Iso = since30.toISOString();

  const PAGE_SIZE = 1000;
  type LogRow = {
    questions_total:   number | null;
    questions_correct: number | null;
    duration_sec:      number | null;
    started_at:        string;
  };
  const logs: LogRow[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('study_logs')
      .select('questions_total, questions_correct, duration_sec, started_at')
      .eq('user_id', userId)
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error('Erro ao calcular conquistas: ' + error.message);
    if (!data || data.length === 0) break;
    logs.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  let totalQuestions = 0, totalCorrect = 0, totalSec = 0;
  let questoesBronze = 0, questoesPrata = 0, questoesOuro = 0;
  // Métricas dos últimos 30 dias (rhythm) — calculadas na mesma iteração
  let totalQ30 = 0, totalSec30 = 0;
  const activeDays30 = new Set<string>();

  for (const l of logs) {
    const q = l.questions_total  ?? 0;
    const c = l.questions_correct ?? 0;
    totalQuestions += q;
    totalCorrect   += c;
    totalSec       += l.duration_sec ?? 0;
    if (q > 0) {
      const pct = (c / q) * 100;
      if (pct >= 90)      questoesOuro   += q;
      else if (pct >= 80) questoesPrata  += q;
      else if (pct >= 70) questoesBronze += q;
    }
    if (l.started_at >= since30Iso) {
      totalQ30   += q;
      totalSec30 += l.duration_sec ?? 0;
      activeDays30.add(localDateStr(new Date(l.started_at)));
    }
  }

  return {
    stats: {
      totalQuestions,
      totalCorrect,
      accuracy: totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0,
      totalHours: totalSec / 3600,
      questoesBronze,
      questoesPrata,
      questoesOuro,
    },
    rhythm: {
      avgQuestionsPerDay: totalQ30 / 30,
      avgHoursPerDay:     totalSec30 / 3600 / 30,
      activeDaysLast30:   activeDays30.size,
    },
  };
}

// ─── buildBadges ─────────────────────────────────────────────────────────────

function buildBadges(
  stats: BadgeStats,
  consistency: ConsistencyStats,
  rhythm: RhythmStats,
): Badge[] {
  const badges: Badge[] = [];

  // Volume
  for (const target of VOLUME_TARGETS) {
    const remaining = Math.max(0, target - stats.totalQuestions);
    badges.push({
      id: `volume-${target}`,
      family: 'volume',
      label: `${target.toLocaleString('pt-BR')} questões`,
      description: `Resolva ${target.toLocaleString('pt-BR')} questões no total.`,
      unlocked: stats.totalQuestions >= target,
      current: stats.totalQuestions,
      target,
      unit: 'questões',
      progress: clamp01(stats.totalQuestions / target),
      etaDays: etaDaysCalc(remaining, rhythm.avgQuestionsPerDay),
    });
  }

  // Tempo
  for (const target of TEMPO_TARGETS_HORAS) {
    const remaining = Math.max(0, target - stats.totalHours);
    badges.push({
      id: `tempo-${target}`,
      family: 'tempo',
      label: `${target}h de estudo`,
      description: `Acumule ${target} horas de estudo cronometrado.`,
      unlocked: stats.totalHours >= target,
      current: Math.floor(stats.totalHours),
      target,
      unit: 'horas',
      progress: clamp01(stats.totalHours / target),
      etaDays: etaDaysCalc(remaining, rhythm.avgHoursPerDay),
    });
  }

  // Maestria
  const volumePorTier: Record<string, number> = {
    bronze: stats.questoesBronze,
    prata:  stats.questoesPrata,
    ouro:   stats.questoesOuro,
  };
  for (const { tier, rotulo, meta } of MAESTRIA_TIERS) {
    const atual    = volumePorTier[tier];
    const unlocked = atual >= meta;
    const restante = Math.max(0, meta - atual);
    badges.push({
      id: `maestria-${tier}`,
      family: 'maestria',
      label: `Maestria ${tier.charAt(0).toUpperCase() + tier.slice(1)}`,
      description: `${meta} questões em sessões com ${rotulo} de acerto.`,
      unlocked,
      current: atual,
      target: meta,
      unit: 'questões',
      progress: clamp01(atual / meta),
      hint: unlocked ? undefined : `faltam ${restante.toLocaleString('pt-BR')} questões nessa faixa`,
      tier,
      etaDays: unlocked ? undefined : etaDaysCalc(restante, rhythm.avgQuestionsPerDay),
    });
  }

  // Consistência
  for (const target of CONSISTENCIA_TARGETS_DIAS) {
    const unlocked = consistency.longest >= target;
    // Usar o melhor histórico (longest) para que o progresso não regride
    const best = Math.max(consistency.current, consistency.longest);
    badges.push({
      id: `consistencia-${target}`,
      family: 'consistencia',
      label: `${target} dias seguidos`,
      description: `Estude ${target} dias consecutivos (mínimo 30 min por dia).`,
      unlocked,
      current: unlocked ? target : best,
      target,
      unit: 'dias',
      progress: unlocked ? 1 : clamp01(best / target),
      // ETA de consistência não se aplica — depende de dias consecutivos
    });
  }

  return badges;
}

// ─── Exports públicos ─────────────────────────────────────────────────────────

export async function getBadgeStats(): Promise<BadgeStats | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const result = await _getBadgeData(supabase, user.id);
  return result?.stats ?? null;
}

export async function getBadgeState(): Promise<BadgeState | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // QW5+QW6: getUser() uma vez; duas queries em paralelo; streak recebe o client
  // já autenticado para evitar um segundo getUser() interno.
  const [badgeData, streak] = await Promise.all([
    _getBadgeData(supabase, user.id),
    getStreak(supabase, user.id),
  ]);
  if (!badgeData) return null;

  const { stats, rhythm } = badgeData;
  const consistency: ConsistencyStats = { current: streak.current, longest: streak.longest };
  const badges        = buildBadges(stats, consistency, rhythm);
  const unlockedCount = badges.filter(b => b.unlocked).length;

  return {
    stats,
    consistency,
    rhythm,
    badges,
    unlockedCount,
    totalCount: badges.length,
  };
}
