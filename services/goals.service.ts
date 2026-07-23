// services/goals.service.ts
// Meta diária agora mora em profiles.settings (vale para TODOS os dias).
// O tempo estudado continua vindo de study_logs.

import { createClient } from '@/lib/supabase/client';
import { getCachedUser } from '@/lib/supabase/authCache';
import { getStudyDayTotals } from '@/services/studyTotals.service';
import { getProfileSettings, invalidateProfileSettingsCache } from '@/services/profileSettingsCache';
import { toLocalDateString as localDateStr } from '@/lib/local-date';
import { track, EV } from '@/lib/analytics';

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
// H12 — cache compartilhado: goals-summary, suggested-target e streak liam
// profiles.settings cada um por conta própria (3 round-trips da mesma coluna).
export async function getDailyTarget(): Promise<number> {
  const settings = await getProfileSettings();
  return settings.dailyTargetMinutes ?? 0;
}

// Define a meta diária (em minutos), gravando no settings do perfil.
// Usa jsonb_set atômico para não sobrescrever outras chaves em cenário multi-aba.
export async function setDailyTarget(minutes: number): Promise<void> {
  const supabase = createClient();
  const user = await getCachedUser();
  if (!user) throw new Error('Você precisa estar logado.');

  const { error } = await supabase.rpc('merge_profile_settings', {
    p_user_id: user.id,
    p_patch: { dailyTargetMinutes: minutes },
  });

  if (error) throw new Error('Erro ao salvar meta: ' + error.message);
  invalidateProfileSettingsCache();
  track(EV.goalAdjusted, { minutes });
}

// ---------- Meta de questões ----------

// H12 — mesmo cache compartilhado (ver getDailyTarget acima).
export async function getDailyTargetQuestions(): Promise<number> {
  const settings = await getProfileSettings();
  return settings.dailyTargetQuestions ?? 0;
}

export async function setDailyTargetQuestions(count: number): Promise<void> {
  const supabase = createClient();
  const user = await getCachedUser();
  if (!user) throw new Error('Você precisa estar logado.');

  const { error } = await supabase.rpc('merge_profile_settings', {
    p_user_id: user.id,
    p_patch: { dailyTargetQuestions: count },
  });

  if (error) throw new Error('Erro ao salvar meta de questões: ' + error.message);
  invalidateProfileSettingsCache();
}

export async function getQuestionsSummary(): Promise<QuestionsSummary> {
  const user = await getCachedUser();
  if (!user) return { targetQuestionsPerDay: 0, todayQuestions: 0, weekQuestions: 0, weekTargetQuestions: 0, todayAcerto: null, yesterdayAcerto: null };

  // Perf F4: agregados por dia (questions/correct) vêm da RPC compartilhada.
  const [target, days] = await Promise.all([getDailyTargetQuestions(), getStudyDayTotals()]);

  const todayStr = localDateStr(new Date());
  const yesterdayStr = localDateStr(new Date(Date.now() - 86_400_000));
  const weekStart = localDateStr(new Date(Date.now() - 6 * 86_400_000));
  let todayQ = 0, weekQ = 0, todayCorrect = 0, todayTotal = 0;
  let yesterdayCorrect = 0, yesterdayTotal = 0;

  for (const d of days) {
    if (d.day >= weekStart) weekQ += d.questions;
    if (d.day === todayStr) {
      todayQ += d.questions;
      todayCorrect += d.correct;
      todayTotal += d.questions;
    }
    if (d.day === yesterdayStr) {
      yesterdayCorrect += d.correct;
      yesterdayTotal += d.questions;
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
  const user = await getCachedUser();
  if (!user) {
    return { targetMinutesPerDay: 0, todayMinutes: 0, weekMinutes: 0, weekTargetMinutes: 0 };
  }

  // Perf F4: minutos por dia derivam da RPC compartilhada (segundos por dia).
  const [target, days] = await Promise.all([getDailyTarget(), getStudyDayTotals()]);

  const todayStr = localDateStr(new Date());
  const weekStart = localDateStr(new Date(Date.now() - 6 * 86_400_000));
  let todaySec = 0;
  let weekSec = 0;

  for (const d of days) {
    if (d.day >= weekStart) weekSec += d.seconds;
    if (d.day === todayStr) todaySec += d.seconds;
  }

  return {
    targetMinutesPerDay: target,
    todayMinutes: Math.round(todaySec / 60),
    weekMinutes: Math.round(weekSec / 60),
    weekTargetMinutes: target * 7,
  };
}

// ---------- Pacto de estudo (intenção de implementação) ----------
// Atomic Habits: "Depois de [âncora], eu estudo." Ligar o estudo a um hábito
// que já existe é o gatilho mais confiável que há. A âncora fica em
// profiles.settings.studyAnchor e vira o cue diário no Plano de Hoje.

// H12 — mesmo cache compartilhado (ver getDailyTarget acima).
export async function getStudyAnchor(): Promise<string | null> {
  const settings = await getProfileSettings();
  const anchor = settings.studyAnchor;
  return anchor && anchor.trim() ? anchor.trim() : null;
}

export async function setStudyAnchor(anchor: string | null): Promise<void> {
  const supabase = createClient();
  const user = await getCachedUser();
  if (!user) throw new Error('Você precisa estar logado.');
  const { error } = await supabase.rpc('merge_profile_settings', {
    p_user_id: user.id,
    p_patch: { studyAnchor: anchor?.trim() ?? '' },
  });
  if (error) throw new Error('Erro ao salvar o pacto: ' + error.message);
  invalidateProfileSettingsCache();
  track(EV.pactSet, { hasAnchor: !!anchor?.trim() });
}

// ---------- Meta adaptativa (N3) ----------
// Sugere uma meta diária ACHIEVABLE a partir do histórico real — a filosofia é
// "começar pequeno e crescer com a constância": uma meta que a pessoa bate quase
// todo dia sustenta a sequência; uma meta heroica (ex.: 4h) garante o fracasso
// diário. Nunca grava nada — só informa a UI, que aplica com o toque do usuário.

export interface SuggestedTarget {
  suggestedMinutes: number;   // meta gentil derivada do que a pessoa realmente sustenta
  activeDays: number;         // dias estudados na janela (30d)
  currentTargetMinutes: number; // meta atual (0 = nenhuma)
  metRate: number | null;     // fração dos dias ativos que bateram a meta ATUAL (null se não há meta/histórico)
}

// Buckets gentis: a sugestão nunca "promete" mais do que a pessoa costuma fazer.
const META_BUCKETS = [20, 25, 30, 40, 45, 60, 75, 90, 120];

function bucketize(minutes: number): number {
  if (minutes <= META_BUCKETS[0]) return META_BUCKETS[0];
  if (minutes >= 120) return 120;
  // maior bucket <= minutes (mantém a meta alcançável, sem arredondar pra cima)
  let best = META_BUCKETS[0];
  for (const b of META_BUCKETS) if (b <= minutes) best = b;
  return best;
}

export async function getSuggestedDailyTarget(): Promise<SuggestedTarget> {
  const supabase = createClient();
  const user = await getCachedUser();
  if (!user) return { suggestedMinutes: 25, activeDays: 0, currentTargetMinutes: 0, metRate: null };

  const [currentTarget, { data: logs }] = await Promise.all([
    getDailyTarget(),
    supabase
      .from('study_logs')
      .select('duration_sec, started_at')
      .eq('user_id', user.id)
      .gte('started_at', startOfDayDaysAgo(29)),
  ]);

  // Minutos por dia local. Soma os SEGUNDOS e converte no fim (arredondar cada
  // log antes de somar zeraria as micro-sessões e inflaria a mediana).
  const perDaySec = new Map<string, number>();
  for (const l of logs ?? []) {
    const d = localDateStr(new Date(l.started_at));
    perDaySec.set(d, (perDaySec.get(d) ?? 0) + (l.duration_sec ?? 0));
  }
  const dayMins = [...perDaySec.values()]
    .map((sec) => Math.round(sec / 60))
    .filter((m) => m > 0)
    .sort((a, b) => a - b);
  const activeDays = dayMins.length;

  // Sugestão = mediana dos dias ativos (o ritmo que a pessoa sustenta), com piso
  // gentil de 20 min. Sem histórico → 25 min (um começo leve e concreto).
  let suggested = 25;
  if (activeDays > 0) {
    const mid = Math.floor(activeDays / 2);
    const median = activeDays % 2 ? dayMins[mid] : Math.round((dayMins[mid - 1] + dayMins[mid]) / 2);
    suggested = bucketize(median);
  }

  const metRate = currentTarget > 0 && activeDays > 0
    ? dayMins.filter((m) => m >= currentTarget).length / activeDays
    : null;

  return { suggestedMinutes: suggested, activeDays, currentTargetMinutes: currentTarget, metRate };
}
