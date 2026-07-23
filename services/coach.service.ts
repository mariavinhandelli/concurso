// services/coach.service.ts
// Coach semanal: sintetiza sinais que já existem no banco (energia, causa de
// erro, tópicos negligenciados, foco do Raio-X) numa leitura de "como foi
// minha semana". SEM chamada de IA/LLM — é geração determinística a partir de
// dados reais, no mesmo espírito de badges/missões/raiox. Nunca inventa: cada
// bullet só aparece se a amostra for suficiente para dizer algo honesto.

import { tryGetUser } from '@/lib/supabase/requireUser';
import { getStreak, type StreakInfo } from '@/services/streak.service';
import { getRaioX, type RaioX } from '@/services/raiox.service';
import { getSuggestions, type SuggestionsResult } from '@/services/suggestion.service';
import { mondayOf } from '@/lib/schedule-utils';
import { toLocalDateString as localDateStr } from '@/lib/local-date';

// H10 — StreakBar, RaioXCard e PlanoHoje já buscam esses 3 dados via React
// Query ('streak', 'raiox', 'home-suggestions'). Chamar getStreak/getRaioX/
// getSuggestions direto aqui (sem passar por deps) re-executava tudo de novo —
// ~13 round-trips redundantes por carga da Home. O chamador (CoachSemanal)
// agora passa os dados já cacheados via queryClient.ensureQueryData; só
// refazemos a busca aqui se algo vier faltando (uso fora da Home, testes etc).
export interface CoachSemanalDeps {
  streak?: StreakInfo;
  raiox?: RaioX;
  suggestions?: SuggestionsResult;
}

const MIN_QUESTOES_MATERIA = 10; // amostra mínima pra apontar "melhor matéria" com confiança
const MIN_SESSOES_CAUSA = 3;     // amostra mínima pra apontar uma causa de erro predominante

export type ErrorCause = 'teoria' | 'interpretacao' | 'tempo';

const CAUSA_LABEL: Record<ErrorCause, string> = {
  teoria: 'falta de teoria',
  interpretacao: 'interpretação do enunciado',
  tempo: 'gestão de tempo',
};

export interface MateriaDestaque {
  subjectName: string;
  acertoPct: number;
  totalQuestoes: number;
}

export interface CausaDestaque {
  causa: ErrorCause;
  label: string;
  pct: number;
  total: number;
}

export interface TopicoNegligenciado {
  name: string;
  motivo: string;
}

export interface FocoPrincipal {
  subjectName: string;
  score: number;
}

export interface CoachResumo {
  hasData: boolean;
  weekStart: string;       // segunda, 'YYYY-MM-DD'
  weekEnd: string;         // domingo, 'YYYY-MM-DD'
  isCurrentWeek: boolean;  // true = semana ainda em curso (mostrado no domingo)
  totalMinutes: number;
  totalDays: number;
  topicsCount: number;
  questionsTotal: number;
  questionsCorrect: number;
  avgEnergy: number | null;
  streakAtual: number;
  melhorMateria: MateriaDestaque | null;
  causaPredominante: CausaDestaque | null;
  topicosNegligenciados: TopicoNegligenciado[];
  focoPrincipal: FocoPrincipal | null;
}

const EMPTY: CoachResumo = {
  hasData: false, weekStart: '', weekEnd: '', isCurrentWeek: false,
  totalMinutes: 0, totalDays: 0, topicsCount: 0, questionsTotal: 0, questionsCorrect: 0,
  avgEnergy: null, streakAtual: 0, melhorMateria: null, causaPredominante: null,
  topicosNegligenciados: [], focoPrincipal: null,
};

// Domingo à noite mostra a semana em curso (Seg→hoje); qualquer outro dia
// mostra a última semana COMPLETA (Seg→Dom anterior) — nunca mistura os dois.
function semanaParaExibir(hoje: Date): { start: Date; end: Date; isCurrent: boolean } {
  const isDomingo = hoje.getDay() === 0;
  if (isDomingo) {
    return { start: mondayOf(hoje), end: hoje, isCurrent: true };
  }
  const semanaPassada = new Date(hoje);
  semanaPassada.setDate(semanaPassada.getDate() - 7);
  const start = mondayOf(semanaPassada);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return { start, end, isCurrent: false };
}

export async function getCoachSemanal(deps: CoachSemanalDeps = {}): Promise<CoachResumo> {
  const auth = await tryGetUser();
  if (!auth) return EMPTY;
  const { supabase, userId } = auth;

  const hoje = new Date();
  const { start, end, isCurrent } = semanaParaExibir(hoje);
  const weekStart = localDateStr(start);
  const weekEnd = localDateStr(end);
  const endExclusive = new Date(end);
  endExclusive.setDate(endExclusive.getDate() + 1);

  const [{ data: logs }, { data: subjects }, streak, raiox, sugestoes] = await Promise.all([
    supabase
      .from('study_logs')
      .select('subject_id, topic_id, questions_total, questions_correct, energy_level, error_cause, duration_sec, started_at')
      .eq('user_id', userId)
      .gte('started_at', start.toISOString())
      .lt('started_at', endExclusive.toISOString()),
    supabase.from('subjects').select('id, name').eq('user_id', userId),
    deps.streak ?? getStreak(),
    deps.raiox ?? getRaioX(),
    deps.suggestions ?? getSuggestions(),
  ]);

  if (!logs || logs.length === 0) {
    return { ...EMPTY, hasData: false, weekStart, weekEnd, isCurrentWeek: isCurrent };
  }

  const subjMap = new Map((subjects ?? []).map((s) => [s.id, s.name] as const));

  const totalMinutes = Math.round(logs.reduce((s, l) => s + (l.duration_sec ?? 0), 0) / 60);
  const diasSet = new Set(logs.map((l) => localDateStr(new Date(l.started_at as string))));
  const topicosSet = new Set(logs.filter((l) => l.topic_id).map((l) => l.topic_id as string));
  const questionsTotal = logs.reduce((s, l) => s + (l.questions_total ?? 0), 0);
  const questionsCorrect = logs.reduce((s, l) => s + (l.questions_correct ?? 0), 0);
  const energias = logs.map((l) => l.energy_level).filter((e): e is number => e != null);
  const avgEnergy = energias.length > 0 ? energias.reduce((s, e) => s + e, 0) / energias.length : null;

  // Melhor matéria — só entra se tiver amostra mínima de questões.
  const porMateria = new Map<string, { total: number; certas: number }>();
  for (const l of logs) {
    if (!l.subject_id || !l.questions_total) continue;
    const cur = porMateria.get(l.subject_id) ?? { total: 0, certas: 0 };
    cur.total += l.questions_total ?? 0;
    cur.certas += l.questions_correct ?? 0;
    porMateria.set(l.subject_id, cur);
  }
  let melhorMateria: MateriaDestaque | null = null;
  for (const [subjId, v] of porMateria) {
    if (v.total < MIN_QUESTOES_MATERIA) continue;
    const pct = Math.round((v.certas / v.total) * 100);
    if (!melhorMateria || pct > melhorMateria.acertoPct) {
      melhorMateria = { subjectName: subjMap.get(subjId) ?? 'Matéria', acertoPct: pct, totalQuestoes: v.total };
    }
  }

  // Causa de erro predominante — só entra com amostra mínima de sessões marcadas.
  const causaCount = new Map<ErrorCause, number>();
  let totalCausas = 0;
  for (const l of logs) {
    const causa = l.error_cause as ErrorCause | null;
    if (!causa) continue;
    causaCount.set(causa, (causaCount.get(causa) ?? 0) + 1);
    totalCausas += 1;
  }
  let causaPredominante: CausaDestaque | null = null;
  if (totalCausas >= MIN_SESSOES_CAUSA) {
    let top: ErrorCause | null = null;
    let topCount = 0;
    for (const [causa, count] of causaCount) {
      if (count > topCount) { top = causa; topCount = count; }
    }
    if (top) {
      causaPredominante = { causa: top, label: CAUSA_LABEL[top], pct: Math.round((topCount / totalCausas) * 100), total: totalCausas };
    }
  }

  // Tópicos negligenciados — reusa o mesmo sinal do Plano de Hoje (Bloco C).
  const topicosNegligenciados: TopicoNegligenciado[] = sugestoes.items
    .filter((s) => s.kind === 'recuperar')
    .slice(0, 2)
    .map((s) => ({ name: s.name, motivo: s.motivo }));

  const focoPrincipal: FocoPrincipal | null = raiox.focoPrincipal
    ? { subjectName: raiox.focoPrincipal.subjectName, score: raiox.focoPrincipal.score }
    : null;

  return {
    hasData: true, weekStart, weekEnd, isCurrentWeek: isCurrent,
    totalMinutes, totalDays: diasSet.size, topicsCount: topicosSet.size,
    questionsTotal, questionsCorrect, avgEnergy, streakAtual: streak.current,
    melhorMateria, causaPredominante, topicosNegligenciados, focoPrincipal,
  };
}
