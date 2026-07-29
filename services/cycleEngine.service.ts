// services/cycleEngine.service.ts
// MOTOR DO CICLO (modelo de acúmulo). Soma os minutos estudados de cada matéria;
// voltas = floor(minutos / planejado); progresso da volta = resto. A próxima
// sugerida é a mais atrasada (menos voltas, depois menos progresso).

import { requireUser, tryGetUser } from '@/lib/supabase/requireUser';
import { toLocalDateString as localDateStr } from '@/lib/local-date';
import { distributeMinutesAcrossSlots } from '@/lib/cycle-distribution';

export interface CycleSubject {
  itemId: string;
  subjectId: string;
  subjectName: string;
  subjectColor: string;
  plannedMinutes: number;
  cycleOrder: number;
  totalMinutes: number;
  laps: number;
  lapProgress: number;
  isSuggested: boolean;
}

export interface CycleState {
  ruleId: string;
  dailyMinutes: number;
  todayMinutes: number;
  subjects: CycleSubject[];
  totalLaps: number;
}

export async function getActiveCycleRule(): Promise<string | null> {
  const ctx = await tryGetUser();
  if (!ctx) return null;
  const { supabase, userId } = ctx;

  const { data, error } = await supabase
    .from('recurrence_rules')
    .select('id')
    .eq('user_id', userId)
    .eq('mode', 'ciclo')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw new Error('Erro ao buscar ciclo ativo: ' + error.message);

  return data?.[0]?.id ?? null;
}

export async function getCycleState(ruleId: string): Promise<CycleState | null> {
  const ctx = await tryGetUser();
  if (!ctx) return null;
  const { supabase, userId } = ctx;

  const { data: rule, error: ruleError } = await supabase
    .from('recurrence_rules')
    .select('*, recurrence_items(*)')
    .eq('id', ruleId)
    .eq('user_id', userId)
    .single();
  // PGRST116 = nenhuma linha encontrada (.single() sem match) — caso legítimo
  // (ex: ciclo arquivado/excluído em outra aba), não é uma falha real.
  if (ruleError && ruleError.code !== 'PGRST116') {
    throw new Error('Erro ao buscar ciclo: ' + ruleError.message);
  }
  if (!rule) return null;

  const { data: subjects, error: subjectsError } = await supabase
    .from('subjects').select('id, name, color').eq('user_id', userId);
  if (subjectsError) throw new Error('Erro ao buscar matérias: ' + subjectsError.message);
  const subjMap: Record<string, { name: string; color: string }> = {};
  for (const s of subjects ?? []) subjMap[s.id] = { name: s.name, color: s.color ?? '#C9B8DD' };

  // Limita pelo start_date da regra (data civil local, mesma régua de
  // completed_date). Usar created_at cortava em UTC: ciclo criado depois das 21h
  // no Brasil nascia com cycleStart no dia seguinte e escondia para sempre o
  // crédito do próprio dia da criação.
  const cycleStart = (rule.start_date as string | null)
    ?? (rule.created_at ? localDateStr(new Date(rule.created_at as string)) : '2000-01-01');

  const { data: completions, error: completionsError } = await supabase
    .from('cycle_completions')
    .select('subject_id, completed_date, minutes')
    .eq('rule_id', ruleId)
    .gte('completed_date', cycleStart);
  if (completionsError) throw new Error('Erro ao buscar progresso do ciclo: ' + completionsError.message);

  const minutesBySubject: Record<string, number> = {};
  for (const c of completions ?? []) {
    minutesBySubject[c.subject_id] = (minutesBySubject[c.subject_id] ?? 0) + (c.minutes ?? 0);
  }

  const hoje = localDateStr(new Date());
  const todayMinutes = (completions ?? [])
    .filter((c) => c.completed_date === hoje)
    .reduce((s, c) => s + (c.minutes ?? 0), 0);

  const items = ((rule.recurrence_items ?? []) as {
    id: string; subject_id: string; planned_minutes: number; cycle_order: number | null;
  }[]).sort((a, b) => (a.cycle_order ?? 0) - (b.cycle_order ?? 0));

  // Uma matéria pode ocupar VÁRIOS slots do ciclo (ex.: Direito Adm nas posições
  // 0 e 5). Os minutos dela são DISTRIBUÍDOS entre esses slots em ordem — enche
  // um antes de passar ao próximo — em vez de replicados em cada um. Replicar
  // fazia a mesma hora estudada aparecer como duas voltas cumpridas, e a volta
  // do ciclo fechava com menos estudo do que o planejado.
  const slotsBySubject = new Map<string, typeof items>();
  for (const it of items) {
    const arr = slotsBySubject.get(it.subject_id);
    if (arr) arr.push(it);
    else slotsBySubject.set(it.subject_id, [it]);
  }

  const minutesByItem: Record<string, number> = {};
  for (const [subjectId, slots] of slotsBySubject) {
    Object.assign(minutesByItem, distributeMinutesAcrossSlots(
      minutesBySubject[subjectId] ?? 0,
      slots.map((it) => ({ id: it.id, plannedMinutes: it.planned_minutes || 60 })),
    ));
  }

  const subjectsOut: CycleSubject[] = items.map((it) => {
    const planned = it.planned_minutes || 60;
    const total = minutesByItem[it.id] ?? 0;
    const laps = Math.floor(total / planned);
    const lapProgress = total % planned;
    return {
      itemId: it.id,
      subjectId: it.subject_id,
      subjectName: subjMap[it.subject_id]?.name ?? 'Matéria',
      subjectColor: subjMap[it.subject_id]?.color ?? '#C9B8DD',
      plannedMinutes: planned,
      cycleOrder: it.cycle_order ?? 0,
      totalMinutes: total,
      laps,
      lapProgress,
      isSuggested: false,
    };
  });

  // Próxima sugerida: menos voltas; empate → menos progresso.
  if (subjectsOut.length > 0) {
    let best = 0;
    for (let i = 1; i < subjectsOut.length; i++) {
      const a = subjectsOut[i], b = subjectsOut[best];
      if (a.laps < b.laps || (a.laps === b.laps && a.lapProgress < b.lapProgress)) best = i;
    }
    subjectsOut[best].isSuggested = true;
  }

  const totalLaps = subjectsOut.length > 0 ? Math.min(...subjectsOut.map((s) => s.laps)) : 0;

  return { ruleId, dailyMinutes: rule.cycle_daily_minutes ?? 180, todayMinutes, subjects: subjectsOut, totalLaps };
}

export async function completeCycleSubject(input: {
  ruleId: string;
  itemId: string;
  subjectId: string;
  minutes?: number;
  source?: 'manual' | 'timer';
  clientSessionId?: string;
  /** Data civil (YYYY-MM-DD) da SESSÃO. Sem isso, uma sessão retroativa de
   *  domingo registrada na segunda creditava o ciclo na segunda, enquanto meta e
   *  streak creditavam no domingo. Omitido = hoje. */
  sessionDate?: string;
}): Promise<void> {
  const { supabase, userId } = await requireUser();

  const payload = {
    user_id: userId,
    rule_id: input.ruleId,
    item_id: input.itemId,
    subject_id: input.subjectId,
    completed_date: input.sessionDate ?? localDateStr(new Date()),
    minutes: input.minutes ?? 0,
    source: input.source ?? 'manual',
    client_session_id: input.clientSessionId ?? null,
  };

  const { error } = input.clientSessionId
    ? await supabase.from('cycle_completions').upsert(payload, {
        onConflict: 'user_id,client_session_id',
        ignoreDuplicates: true,
      })
    : await supabase.from('cycle_completions').insert(payload);
  if (error) throw new Error('Erro ao registrar: ' + error.message);
}

// Usa RPC para fazer SELECT + DELETE atomicamente (evita race TOCTOU).
export async function undoLastCompletion(ruleId: string, subjectId: string): Promise<void> {
  const ctx = await tryGetUser();
  if (!ctx) return;
  const { supabase } = ctx;

  const { error } = await supabase.rpc('undo_last_cycle_completion', {
    p_rule_id: ruleId,
    p_subject_id: subjectId,
  });
  if (error) throw new Error('Erro ao desfazer: ' + error.message);
}

// Gancho do timer: retorna o item do ciclo ativo para uma matéria, se existir.
export async function findCycleItemForSubject(subjectId: string): Promise<{ ruleId: string; itemId: string; plannedMinutes: number } | null> {
  const ctx = await tryGetUser();
  if (!ctx) return null;
  const { supabase } = ctx;

  const ruleId = await getActiveCycleRule();
  if (!ruleId) return null;

  // Ordena por cycle_order: sem ORDER BY, a matéria que ocupa mais de um slot
  // gravava o crédito num item arbitrário a cada sessão.
  const { data: items } = await supabase
    .from('recurrence_items')
    .select('id, subject_id, planned_minutes')
    .eq('rule_id', ruleId)
    .eq('subject_id', subjectId)
    .order('cycle_order', { ascending: true, nullsFirst: false })
    .limit(1);

  if (!items || items.length === 0) return null;
  return { ruleId, itemId: items[0].id, plannedMinutes: items[0].planned_minutes || 60 };
}

export async function archiveCycle(ruleId: string): Promise<void> {
  const { supabase, userId } = await requireUser();

  const { error } = await supabase
    .from('recurrence_rules')
    .update({ is_active: false })
    .eq('id', ruleId)
    .eq('user_id', userId);
  if (error) throw new Error('Erro ao arquivar ciclo: ' + error.message);
}

export async function deleteCycle(ruleId: string): Promise<void> {
  const { supabase, userId } = await requireUser();

  const { error } = await supabase
    .from('recurrence_rules')
    .delete()
    .eq('id', ruleId)
    .eq('user_id', userId);
  if (error) throw new Error('Erro ao excluir ciclo: ' + error.message);
}

export async function listArchivedCycles(): Promise<{ id: string; createdAt: string }[]> {
  const ctx = await tryGetUser();
  if (!ctx) return [];
  const { supabase, userId } = ctx;

  const { data } = await supabase
    .from('recurrence_rules')
    .select('id, created_at')
    .eq('user_id', userId)
    .eq('mode', 'ciclo')
    .eq('is_active', false)
    .order('created_at', { ascending: false });

  return (data ?? []).map((r) => ({ id: r.id, createdAt: r.created_at }));
}

export async function reactivateCycle(ruleId: string): Promise<void> {
  const { supabase, userId } = await requireUser();

  const { error: archErr } = await supabase
    .from('recurrence_rules')
    .update({ is_active: false })
    .eq('user_id', userId)
    .eq('mode', 'ciclo')
    .eq('is_active', true)
    .neq('id', ruleId);
  if (archErr) throw new Error('Erro ao arquivar o ciclo atual: ' + archErr.message);

  const { error } = await supabase
    .from('recurrence_rules')
    .update({ is_active: true })
    .eq('id', ruleId)
    .eq('user_id', userId);
  if (error) throw new Error('Erro ao reativar ciclo: ' + error.message);
}
