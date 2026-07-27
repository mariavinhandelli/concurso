// services/badges.service.ts
// MOTOR DE CONQUISTAS. Lê study_logs (paginado), deriva badges ao vivo,
// e calcula o ritmo dos últimos 30 dias para estimar ETA de cada conquista.

import { createClient } from '@/lib/supabase/client';
import { getCachedUser } from '@/lib/supabase/authCache';
import { getStreak } from '@/services/streak.service';
import { getEditalCoverage, type EditalCoverage } from '@/services/coverage.service';
import { getRaioX, type RaioX } from '@/services/raiox.service';
import { track, EV } from '@/lib/analytics';
import { toLocalDateString as localDateStr } from '@/lib/local-date';

export type BadgeFamily = 'edital' | 'volume' | 'maestria' | 'tempo' | 'consistencia';

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
  /** ISO de quando foi desbloqueada (user_badges). Ausente = ainda trancada. */
  unlockedAt?: string;
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
  /** Desbloqueadas NESTA computação (persistidas agora) — celebrar/animar. */
  newlyUnlocked: Badge[];
}

// Marcos de volume: 100 (1ª semana) → 500 (1 mês) → 2k (3-6 meses) → 6k (federal)
const VOLUME_TARGETS = [100, 500, 2000, 6000];
// Horas: 50 (iniciante) → 200 (comprometido) → 500 (federal médio) → 1000 (fiscal federal)
const TEMPO_TARGETS_HORAS = [50, 200, 500, 1000];
// Dias: 7 (1ª semana) → 30 (hábito formado) → 100 (elite, referência Duolingo)
const CONSISTENCIA_TARGETS_DIAS = [7, 30, 100];

// Faixas CUMULATIVAS: uma sessão a 92% conta para ouro, prata E bronze. O que
// separa os tiers é a exigência de acerto, e o volume compensa na direção
// inversa (bronze pede mais questões porque a barra de 70% é mais fácil).
// Antes as faixas eram exclusivas (70–80 / 80–90 / 90+), o que travava bronze e
// prata para sempre em quem acerta 90%+ — a maestria punia a maestria.
const MAESTRIA_TIERS: {
  tier: 'bronze' | 'prata' | 'ouro';
  rotulo: string;
  minPct: number;
  meta: number; // metas inversas ao nível: mais fácil manter 90%+ → exige menos volume
}[] = [
  { tier: 'bronze', rotulo: '70% ou mais', minPct: 70, meta: 300 },
  { tier: 'prata',  rotulo: '80% ou mais', minPct: 80, meta: 200 },
  { tier: 'ouro',   rotulo: '90% ou mais', minPct: 90, meta: 100 }, // menos volume: manter 90%+ já é a conquista
];

// Amostra mínima por sessão para a maestria. Sem isso, 100 sessões de 1 questão
// certa desbloqueiam Maestria Ouro — o streak já tem piso de 30 min pelo mesmo
// motivo. 10 é o mesmo limiar que o coach usa para apontar "melhor matéria".
const MIN_QUESTOES_SESSAO_MAESTRIA = 10;

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

function etaDaysCalc(remaining: number, avgPerDay: number): number | undefined {
  if (avgPerDay <= 0 || remaining <= 0) return undefined;
  const dias = Math.ceil(remaining / avgPerDay);
  // Ritmo quase nulo produz estimativas grotescas ("~34338 meses no seu
  // ritmo") — acima de 1 ano a previsão deixa de informar e passa a zombar.
  // Melhor não prometer nada do que prometer o absurdo.
  return dias > 365 ? undefined : dias;
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
    // Faixas cumulativas (ver MAESTRIA_TIERS): 92% soma nos três tiers.
    if (q >= MIN_QUESTOES_SESSAO_MAESTRIA) {
      const pct = (c / q) * 100;
      if (pct >= 70) questoesBronze += q;
      if (pct >= 80) questoesPrata  += q;
      if (pct >= 90) questoesOuro   += q;
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

// ─── Conquistas de edital (M2) ───────────────────────────────────────────────
// Marcos ancorados no concurso-alvo PRIMÁRIO — a diferenciação real: "metade
// do SEU edital", não "500 questões de qualquer coisa". Os ids embutem o
// targetId: trocar de concurso-alvo começa uma coleção nova; as conquistas do
// alvo antigo ficam persistidas em user_badges mas deixam de ser exibidas
// (fato histórico preservado, tela sempre coerente com o alvo atual).

const EDITAL_COBERTURA_ALVOS = [
  { pct: 25,  label: 'Um quarto do edital' },
  { pct: 50,  label: 'Metade do edital' },
  { pct: 100, label: 'Edital coberto' },
];
const EDITAL_PRONTIDAO_ALVO = 70; // mesma régua "quase_la" do Raio-X e do domínio da cobertura

function buildEditalBadges(cov: EditalCoverage | null, raiox: RaioX | null): Badge[] {
  // Sem alvo ou sem tópicos vinculados → a família simplesmente não existe.
  if (!cov || !cov.hasTarget || !cov.targetId || cov.total === 0) return [];
  const badges: Badge[] = [];

  // Cobertura: estudar ≥1 vez N% dos tópicos vinculados.
  for (const { pct, label } of EDITAL_COBERTURA_ALVOS) {
    const alvoTopicos = Math.ceil((pct / 100) * cov.total);
    badges.push({
      id: `edital-${cov.targetId}-cobertura-${pct}`,
      family: 'edital',
      label,
      description: `Estude ${pct}% dos tópicos vinculados ao seu edital.`,
      unlocked: cov.covered >= alvoTopicos,
      current: cov.covered,
      target: alvoTopicos,
      unit: 'tópicos',
      progress: clamp01(cov.covered / alvoTopicos),
    });
  }

  // Domínio: metade do edital com saúde de domínio (≥70) — qualidade, não só passagem.
  const alvoDominio = Math.ceil(cov.total / 2);
  badges.push({
    id: `edital-${cov.targetId}-dominio-50`,
    family: 'edital',
    label: 'Metade dominada',
    description: 'Metade dos tópicos do edital com saúde de domínio (70+).',
    unlocked: cov.mastered >= alvoDominio,
    current: cov.mastered,
    target: alvoDominio,
    unit: 'tópicos',
    progress: clamp01(cov.mastered / alvoDominio),
  });

  // Prioridade: a matéria de MAIOR PESO do edital em prontidão de prova.
  // Só existe quando há blueprint com pesos (senão não há "maior peso").
  if (raiox?.hasBlueprint && raiox.materias.length > 0) {
    const top = raiox.materias.reduce((a, m) => (m.weight > a.weight ? m : a), raiox.materias[0]);
    badges.push({
      id: `edital-${cov.targetId}-prioridade`,
      family: 'edital',
      label: 'Prioridade em dia',
      description: `Leve ${top.subjectName} — a matéria de maior peso — a ${EDITAL_PRONTIDAO_ALVO} de prontidão.`,
      unlocked: top.score >= EDITAL_PRONTIDAO_ALVO,
      current: top.score,
      target: EDITAL_PRONTIDAO_ALVO,
      unit: 'pontos',
      progress: clamp01(top.score / EDITAL_PRONTIDAO_ALVO),
      hint: top.score >= EDITAL_PRONTIDAO_ALVO
        ? undefined
        : `${top.subjectName}: ${top.score}/${EDITAL_PRONTIDAO_ALVO} de prontidão`,
    });
  }

  return badges;
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
  // O progresso das TRANCADAS acompanha a sequência ATUAL, não o recorde: uma
  // sequência de 25 dias interrompida há meses não deixa ninguém a "5 dias" de
  // 30 — é preciso recomeçar do zero. Usar o recorde aqui prometia o que o
  // produto não podia cumprir. O recorde vira contexto (hint), não progresso.
  // Uma vez desbloqueada, a conquista nunca regride (unlocked usa longest).
  for (const target of CONSISTENCIA_TARGETS_DIAS) {
    const unlocked = consistency.longest >= target;
    const atual    = consistency.current;
    const restante = Math.max(0, target - atual);
    badges.push({
      id: `consistencia-${target}`,
      family: 'consistencia',
      label: `${target} dias seguidos`,
      description: `Estude ${target} dias consecutivos (mínimo 30 min por dia).`,
      unlocked,
      current: unlocked ? target : atual,
      target,
      unit: 'dias',
      progress: unlocked ? 1 : clamp01(atual / target),
      hint: unlocked || consistency.longest <= atual
        ? undefined
        : `${restante} ${restante === 1 ? 'dia restante' : 'dias restantes'} · recorde ${consistency.longest}`,
      // ETA de consistência não se aplica — depende de dias consecutivos
    });
  }

  return badges;
}

// ─── Raridade (M4) ────────────────────────────────────────────────────────────
// % de usuários da plataforma que têm cada conquista global (RPC agregada,
// sem dados individuais). Badges de edital ficam de fora — id é por usuário.

export async function getBadgeRarity(): Promise<Record<string, number>> {
  const supabase = createClient();
  const user = await getCachedUser();
  if (!user) return {};
  const { data, error } = await supabase.rpc('get_badge_rarity');
  if (error) {
    // Raridade é tempero, não estrutura — sem ela a página segue inteira.
    console.error('Raridade de conquistas indisponível:', error.message);
    return {};
  }
  const mapa: Record<string, number> = {};
  for (const r of (data ?? []) as { badge_id: string; pct: number }[]) {
    mapa[r.badge_id] = r.pct;
  }
  return mapa;
}

// ─── Exports públicos ─────────────────────────────────────────────────────────

export async function getBadgeState(): Promise<BadgeState | null> {
  const supabase = createClient();
  const user = await getCachedUser();
  if (!user) return null;

  // QW5+QW6: getUser() uma vez; queries em paralelo; streak recebe o client
  // já autenticado para evitar um segundo getUser() interno.
  // Cobertura e Raio-X alimentam a família "edital" (M2). Falha em qualquer um
  // não derruba as conquistas globais — a família só fica ausente nesta carga.
  const [badgeData, streak, { data: persistedRows }, coverage, raiox] = await Promise.all([
    _getBadgeData(supabase, user.id),
    getStreak(supabase, user.id),
    supabase.from('user_badges').select('badge_id, unlocked_at').eq('user_id', user.id),
    getEditalCoverage().catch(() => null),
    getRaioX().catch(() => null),
  ]);
  if (!badgeData) return null;

  const { stats, rhythm } = badgeData;
  const consistency: ConsistencyStats = { current: streak.current, longest: streak.longest };
  const badges = [
    ...buildEditalBadges(coverage, raiox),
    ...buildBadges(stats, consistency, rhythm),
  ];

  // ── Persistência do desbloqueio (user_badges) ──────────────────────────────
  // O que já está persistido CONTINUA desbloqueado mesmo que o cálculo mude
  // (ex.: meta recalibrada, sessão apagada) — conquista é fato histórico.
  // O que o cálculo desbloqueou agora é gravado com a data de hoje.
  const persisted = new Map((persistedRows ?? []).map(r => [r.badge_id as string, r.unlocked_at as string]));
  const isBackfill = persisted.size === 0 && badges.some(b => b.unlocked);

  const paraGravar: Badge[] = [];
  for (const b of badges) {
    const at = persisted.get(b.id);
    if (at) {
      b.unlocked = true;               // persistido nunca regride
      b.progress = 1;
      b.unlockedAt = at;
    } else if (b.unlocked) {
      paraGravar.push(b);
    }
  }

  let newlyUnlocked: Badge[] = [];
  if (paraGravar.length > 0) {
    const { error } = await supabase.from('user_badges').upsert(
      paraGravar.map(b => ({ user_id: user.id, badge_id: b.id })),
      { onConflict: 'user_id,badge_id', ignoreDuplicates: true },
    );
    if (!error) {
      const agora = new Date().toISOString();
      for (const b of paraGravar) b.unlockedAt = agora;
      // Primeira computação de uma conta com histórico é BACKFILL, não uma
      // enxurrada de conquistas novas — grava sem celebrar nem instrumentar.
      if (!isBackfill) {
        newlyUnlocked = paraGravar;
        for (const b of paraGravar) track(EV.badgeUnlocked, { badgeId: b.id });
      }
    }
    // Falha ao gravar: segue com o estado derivado — persiste na próxima visita.
  }

  const unlockedCount = badges.filter(b => b.unlocked).length;

  return {
    stats,
    consistency,
    rhythm,
    badges,
    unlockedCount,
    totalCount: badges.length,
    newlyUnlocked,
  };
}
