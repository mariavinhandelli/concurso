// services/badges.service.ts
// MOTOR DE CONQUISTAS (cálculo ao vivo). Lê todas as sessões de study_logs e
// deriva o estado de cada badge na hora — nada é persistido. A "verdade" mora
// sempre nos dados reais de estudo, então o badge nunca mente.

import { createClient } from '@/lib/supabase/client';
import { getStreak } from '@/services/streak.service';

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
}

export interface BadgeStats {
  totalQuestions: number;  // soma de questions_total em todas as sessões
  totalCorrect: number;    // soma de questions_correct
  accuracy: number;        // 0..100 (taxa de acerto geral)
  totalHours: number;      // soma de duration_sec convertida em horas
  // Volume de questões por faixa de qualidade da SESSÃO (maestria):
  questoesBronze: number;  // sessões com acerto em [70, 80)
  questoesPrata: number;   // sessões com acerto em [80, 90)
  questoesOuro: number;    // sessões com acerto em [90, 100]
}

export interface ConsistencyStats {
  current: number;
  longest: number;
}

export interface BadgeState {
  stats: BadgeStats;
  consistency: ConsistencyStats;
  badges: Badge[];
  unlockedCount: number;
  totalCount: number;
}

const VOLUME_TARGETS = [100, 500, 1000, 5000];
const TEMPO_TARGETS_HORAS = [50, 150, 300, 500];
const CONSISTENCIA_TARGETS_DIAS = [15, 45, 100];

// Maestria: cada tier acumula questões de sessões na SUA faixa de acerto.
const MAESTRIA_META_QUESTOES = 200; // questões na faixa para conquistar o tier
const MAESTRIA_TIERS: {
  tier: 'bronze' | 'prata' | 'ouro';
  min: number;   // acerto mínimo da faixa (inclusivo)
  max: number;   // acerto máximo da faixa (exclusivo, exceto ouro)
  rotulo: string;
}[] = [
  { tier: 'bronze', min: 70, max: 80, rotulo: '70–80%' },
  { tier: 'prata', min: 80, max: 90, rotulo: '80–90%' },
  { tier: 'ouro', min: 90, max: 101, rotulo: '90%+' },
];

function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

// Lê todas as sessões e agrega os totais — incluindo o volume por faixa de maestria.
export async function getBadgeStats(): Promise<BadgeStats | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: logs } = await supabase
    .from('study_logs')
    .select('questions_total, questions_correct, duration_sec')
    .eq('user_id', user.id);

  let totalQuestions = 0;
  let totalCorrect = 0;
  let totalSec = 0;
  let questoesBronze = 0;
  let questoesPrata = 0;
  let questoesOuro = 0;

  for (const l of logs ?? []) {
    const q = l.questions_total ?? 0;
    const c = l.questions_correct ?? 0;
    totalQuestions += q;
    totalCorrect += c;
    totalSec += l.duration_sec ?? 0;

    // Classifica a SESSÃO pela sua própria % de acerto e soma o volume na faixa.
    if (q > 0) {
      const acertoSessao = (c / q) * 100;
      if (acertoSessao >= 90) questoesOuro += q;
      else if (acertoSessao >= 80) questoesPrata += q;
      else if (acertoSessao >= 70) questoesBronze += q;
      // abaixo de 70%: não conta para nenhuma faixa de maestria.
    }
  }

  const accuracy = totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0;
  const totalHours = totalSec / 3600;

  return {
    totalQuestions,
    totalCorrect,
    accuracy,
    totalHours,
    questoesBronze,
    questoesPrata,
    questoesOuro,
  };
}

function buildBadges(stats: BadgeStats, consistency: ConsistencyStats): Badge[] {
  const badges: Badge[] = [];

  // --- Volume (questões resolvidas) ---
  for (const target of VOLUME_TARGETS) {
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
    });
  }

  // --- Tempo (horas de estudo) ---
  for (const target of TEMPO_TARGETS_HORAS) {
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
    });
  }

  // --- Maestria (volume por faixa de qualidade da sessão) ---
  // Cada tier é independente: acumula só as questões de sessões na sua faixa de
  // acerto. 200 questões na faixa = conquistado. Os cards nunca compartilham número.
  const volumePorTier: Record<string, number> = {
    bronze: stats.questoesBronze,
    prata: stats.questoesPrata,
    ouro: stats.questoesOuro,
  };
  for (const { tier, rotulo } of MAESTRIA_TIERS) {
    const atual = volumePorTier[tier];
    const unlocked = atual >= MAESTRIA_META_QUESTOES;
    const restante = Math.max(0, MAESTRIA_META_QUESTOES - atual);
    badges.push({
      id: `maestria-${tier}`,
      family: 'maestria',
      label: `Maestria ${tier}`,
      description: `${MAESTRIA_META_QUESTOES} questões em sessões com ${rotulo} de acerto.`,
      unlocked,
      current: atual,
      target: MAESTRIA_META_QUESTOES,
      unit: 'questões',
      progress: clamp01(atual / MAESTRIA_META_QUESTOES),
      hint: unlocked ? '' : `faltam ${restante.toLocaleString('pt-BR')} questões nessa faixa`,
      tier,
    });
  }

  // --- Consistência (dias seguidos) ---
  for (const target of CONSISTENCIA_TARGETS_DIAS) {
    const unlocked = consistency.longest >= target;
    badges.push({
      id: `consistencia-${target}`,
      family: 'consistencia',
      label: `${target} dias seguidos`,
      description: `Estude ${target} dias consecutivos (mínimo 25 min por dia).`,
      unlocked,
      current: unlocked ? target : consistency.current,
      target,
      unit: 'dias',
      progress: unlocked ? 1 : clamp01(consistency.current / target),
    });
  }

  return badges;
}

export async function getBadgeState(): Promise<BadgeState | null> {
  const stats = await getBadgeStats();
  if (!stats) return null;

  const streak = await getStreak();
  const consistency: ConsistencyStats = { current: streak.current, longest: streak.longest };

  const badges = buildBadges(stats, consistency);
  const unlockedCount = badges.filter((b) => b.unlocked).length;

  return {
    stats,
    consistency,
    badges,
    unlockedCount,
    totalCount: badges.length,
  };
}