// services/missoes.service.ts
// Missões semanais: 3 desafios da semana atual (segunda a domingo), derivados
// dos dados reais do usuário — sem tabela nova. A rotação semanal é
// determinística: a semana (segunda-feira) escolhe o ponto de partida no
// pool de missões, então elas mudam sozinhas toda semana sem precisar
// persistir "quais são as missões desta semana".
// Diferença de badges.service: badges são ESTOQUE (acumulado, nunca reseta);
// missões são FLUXO (renovam toda semana, dão motivo de voltar esta semana).

import type { SupabaseClient } from '@supabase/supabase-js';
import { tryGetUser } from '@/lib/supabase/requireUser';
import { countDueReviews } from '@/services/reviews.service';
import { countDueCards } from '@/services/flashcards.service';
import { mondayOf } from '@/lib/schedule-utils';
import { toLocalDateString } from '@/lib/local-date';

export interface Missao {
  id: string;
  label: string;
  descricao: string;
  current: number;
  target: number;
  unit: string;
  progress: number; // 0-1
  concluida: boolean;
}

interface MissaoContexto {
  userId: string;
  supabase: SupabaseClient;
  weekStartIso: string; // início da semana (segunda), 'YYYY-MM-DDT00:00:00'
}

type MissaoDef = {
  id: string;
  label: string;
  descricao: (target: number) => string;
  target: number;
  unit: string;
  compute: (ctx: MissaoContexto) => Promise<number>;
};

async function diasEstudadosNaSemana(ctx: MissaoContexto): Promise<number> {
  const { data } = await ctx.supabase
    .from('study_logs')
    .select('started_at')
    .eq('user_id', ctx.userId)
    .gte('started_at', ctx.weekStartIso);
  const dias = new Set((data ?? []).map((r) => toLocalDateString(new Date(r.started_at as string))));
  return dias.size;
}

async function questoesNaSemana(ctx: MissaoContexto): Promise<number> {
  const { data } = await ctx.supabase
    .from('study_logs')
    .select('questions_total')
    .eq('user_id', ctx.userId)
    .eq('mode', 'questoes')
    .gte('started_at', ctx.weekStartIso);
  return (data ?? []).reduce((s, r) => s + (r.questions_total ?? 0), 0);
}

async function acertoNaSemanaAcima70(ctx: MissaoContexto): Promise<number> {
  const { data } = await ctx.supabase
    .from('study_logs')
    .select('questions_total, questions_correct')
    .eq('user_id', ctx.userId)
    .eq('mode', 'questoes')
    .gte('started_at', ctx.weekStartIso);
  const total = (data ?? []).reduce((s, r) => s + (r.questions_total ?? 0), 0);
  const certas = (data ?? []).reduce((s, r) => s + (r.questions_correct ?? 0), 0);
  if (total < 30) return 0; // amostra pequena não conta — evita "100% em 2 questões"
  return (certas / total) * 100 >= 70 ? 1 : 0;
}

async function topicosNovosNaSemana(ctx: MissaoContexto): Promise<number> {
  const { data: logsSemana } = await ctx.supabase
    .from('study_logs')
    .select('topic_id')
    .eq('user_id', ctx.userId)
    .not('topic_id', 'is', null)
    .gte('started_at', ctx.weekStartIso);
  const idsSemana = [...new Set((logsSemana ?? []).map((r) => r.topic_id as string))];
  if (idsSemana.length === 0) return 0;

  const { data: logsAntes } = await ctx.supabase
    .from('study_logs')
    .select('topic_id')
    .eq('user_id', ctx.userId)
    .in('topic_id', idsSemana)
    .lt('started_at', ctx.weekStartIso);
  const jaEstudadosAntes = new Set((logsAntes ?? []).map((r) => r.topic_id as string));
  return idsSemana.filter((id) => !jaEstudadosAntes.has(id)).length;
}

// "Zerar a fila" só é mérito quando existe fila: usuário sem nenhum item em
// rotação (conta nova, módulo nunca usado) não ganha a missão de graça.
async function filaRevisoesZerada(ctx: MissaoContexto): Promise<number> {
  const { count } = await ctx.supabase
    .from('topics')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', ctx.userId)
    .eq('is_review_active', true);
  if ((count ?? 0) === 0) return 0;
  const n = await countDueReviews();
  return n === 0 ? 1 : 0;
}

async function filaFlashcardsZerada(ctx: MissaoContexto): Promise<number> {
  const { count } = await ctx.supabase
    .from('flashcards')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', ctx.userId);
  if ((count ?? 0) === 0) return 0;
  const n = await countDueCards();
  return n === 0 ? 1 : 0;
}

// Pool de missões — 3 são escolhidas por semana (rotação determinística).
const POOL: MissaoDef[] = [
  {
    id: 'dias-estudados',
    label: 'Estude 5 dias esta semana',
    descricao: (t) => `Registre estudo em ${t} dias diferentes.`,
    target: 5, unit: 'dias',
    compute: diasEstudadosNaSemana,
  },
  {
    id: 'questoes-semana',
    label: 'Resolva 50 questões',
    descricao: (t) => `Treine ${t} questões nesta semana.`,
    target: 50, unit: 'questões',
    compute: questoesNaSemana,
  },
  {
    id: 'acerto-70',
    label: '70%+ de acerto na semana',
    descricao: () => 'Mantenha 70% ou mais de acerto em pelo menos 30 questões.',
    target: 1, unit: '',
    compute: acertoNaSemanaAcima70,
  },
  {
    id: 'topicos-novos',
    label: 'Estude 3 tópicos novos',
    descricao: (t) => `Dê a primeira estudada em ${t} tópicos que você nunca tinha estudado.`,
    target: 3, unit: 'tópicos',
    compute: topicosNovosNaSemana,
  },
  {
    id: 'revisoes-zeradas',
    label: 'Zere a fila de revisões',
    descricao: () => 'Deixe a fila de revisões de tópicos em dia.',
    target: 1, unit: '',
    compute: filaRevisoesZerada,
  },
  {
    id: 'flashcards-zerados',
    label: 'Zere a fila de flashcards',
    descricao: () => 'Deixe a fila de flashcards em dia.',
    target: 1, unit: '',
    compute: filaFlashcardsZerada,
  },
];

// Hash simples e estável da data (string) → número. Não precisa ser
// criptográfico, só determinístico e razoavelmente bem distribuído.
function hashDeString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export interface MissoesSemana {
  weekLabel: string; // 'YYYY-MM-DD' da segunda-feira
  missoes: Missao[];
}

export async function getMissoesSemana(): Promise<MissoesSemana> {
  const auth = await tryGetUser();
  const monday = mondayOf(new Date());
  const weekLabel = toLocalDateString(monday);
  if (!auth) return { weekLabel, missoes: [] };

  const inicio = hashDeString(weekLabel) % POOL.length;
  const escolhidas = [POOL[inicio], POOL[(inicio + 1) % POOL.length], POOL[(inicio + 2) % POOL.length]];

  const ctx: MissaoContexto = {
    userId: auth.userId,
    supabase: auth.supabase,
    weekStartIso: monday.toISOString(),
  };

  const missoes = await Promise.all(escolhidas.map(async (def) => {
    const current = Math.min(await def.compute(ctx), def.target);
    return {
      id: def.id,
      label: def.label,
      descricao: def.descricao(def.target),
      current,
      target: def.target,
      unit: def.unit,
      progress: def.target > 0 ? current / def.target : 0,
      concluida: current >= def.target,
    };
  }));

  return { weekLabel, missoes };
}
