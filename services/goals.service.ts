// services/goals.service.ts
// Meta diária agora mora em profiles.settings (vale para TODOS os dias).
// O tempo estudado continua vindo de study_logs.

import { createClient } from '@/lib/supabase/client';
import { toLocalDateString as localDateStr } from '@/lib/local-date';

export interface GoalsSummary {
  targetMinutesPerDay: number;
  todayMinutes: number;
  weekMinutes: number;
  weekTargetMinutes: number;
}

export interface QuestionsSummary {
  targetQuestionsPerDay: number;
  todayQuestions: number;
  weekQuestions: number;
  weekTargetQuestions: number;
  todayAcerto: number | null;     // % de acerto de hoje
  yesterdayAcerto: number | null; // % de acerto de ontem — para o delta ↑↓
}

function startOfDayDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

// Lê a meta diária (em minutos) das configurações do perfil.
export async function getDailyTarget(): Promise<number> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  const { data } = await supabase
    .from('profiles')
    .select('settings')
    .eq('id', user.id)
    .maybeSingle();

  const settings = (data?.settings ?? {}) as { dailyTargetMinutes?: number };
  return settings.dailyTargetMinutes ?? 0;
}

// Define a meta diária (em minutos), gravando no settings do perfil.
// Usa jsonb_set atômico para não sobrescrever outras chaves em cenário multi-aba.
export async function setDailyTarget(minutes: number): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Você precisa estar logado.');

  const { error } = await supabase.rpc('merge_profile_settings', {
    p_user_id: user.id,
    p_patch: { dailyTargetMinutes: minutes },
  });

  if (error) throw new Error('Erro ao salvar meta: ' + error.message);
}

// ---------- Meta de questões ----------

export async function getDailyTargetQuestions(): Promise<number> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;
  const { data } = await supabase.from('profiles').select('settings').eq('id', user.id).maybeSingle();
  return ((data?.settings ?? {}) as { dailyTargetQuestions?: number }).dailyTargetQuestions ?? 0;
}

export async function setDailyTargetQuestions(count: number): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Você precisa estar logado.');

  const { error } = await supabase.rpc('merge_profile_settings', {
    p_user_id: user.id,
    p_patch: { dailyTargetQuestions: count },
  });

  if (error) throw new Error('Erro ao salvar meta de questões: ' + error.message);
}

export async function getQuestionsSummary(): Promise<QuestionsSummary> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { targetQuestionsPerDay: 0, todayQuestions: 0, weekQuestions: 0, weekTargetQuestions: 0, todayAcerto: null, yesterdayAcerto: null };

  const [target, { data: logs }] = await Promise.all([
    getDailyTargetQuestions(),
    supabase
      .from('study_logs')
      .select('questions_total, questions_correct, started_at')
      .eq('user_id', user.id)
      .not('questions_total', 'is', null)
      .gt('questions_total', 0)
      .gte('started_at', startOfDayDaysAgo(6)),
  ]);

  const todayStr = localDateStr(new Date());
  const yesterdayStr = localDateStr(new Date(Date.now() - 86_400_000));
  let todayQ = 0, weekQ = 0, todayCorrect = 0, todayTotal = 0;
  let yesterdayCorrect = 0, yesterdayTotal = 0;

  for (const log of logs ?? []) {
    const q = log.questions_total ?? 0;
    const logDate = localDateStr(new Date(log.started_at));
    weekQ += q;
    if (logDate === todayStr) {
      todayQ += q;
      todayCorrect += log.questions_correct ?? 0;
      todayTotal += q;
    }
    if (logDate === yesterdayStr) {
      yesterdayCorrect += log.questions_correct ?? 0;
      yesterdayTotal += log.questions_total ?? 0;
    }
  }

  return {
    targetQuestionsPerDay: target,
    todayQuestions: todayQ,
    weekQuestions: weekQ,
    weekTargetQuestions: target * 7,
    todayAcerto: todayTotal > 0 ? Math.round((todayCorrect / todayTotal) * 100) : null,
    yesterdayAcerto: yesterdayTotal > 0 ? Math.round((yesterdayCorrect / yesterdayTotal) * 100) : null,
  };
}

export async function getGoalsSummary(): Promise<GoalsSummary> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { targetMinutesPerDay: 0, todayMinutes: 0, weekMinutes: 0, weekTargetMinutes: 0 };
  }

  const [target, { data: logs, error }] = await Promise.all([
    getDailyTarget(),
    supabase
      .from('study_logs')
      .select('duration_sec, started_at')
      .eq('user_id', user.id)
      .gte('started_at', startOfDayDaysAgo(6)),
  ]);

  if (error) throw new Error('Erro ao calcular metas: ' + error.message);

  const todayStr = localDateStr(new Date());
  let todaySec = 0;
  let weekSec = 0;

  for (const log of logs ?? []) {
    const dur = log.duration_sec ?? 0;
    weekSec += dur;
    if (localDateStr(new Date(log.started_at)) === todayStr) {
      todaySec += dur;
    }
  }

  return {
    targetMinutesPerDay: target,
    todayMinutes: Math.round(todaySec / 60),
    weekMinutes: Math.round(weekSec / 60),
    weekTargetMinutes: target * 7,
  };
}
