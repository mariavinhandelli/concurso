// services/cycleEngine.service.ts
// MOTOR DO CICLO (modelo de acúmulo). Soma os minutos estudados de cada matéria;
// voltas = floor(minutos / planejado); progresso da volta = resto. A próxima
// sugerida é a mais atrasada (menos voltas, depois menos progresso).

import { createClient } from '@/lib/supabase/client';
import { toLocalDateString as localDateStr } from '@/lib/local-date';

export interface CycleSubject {
  itemId: string;
  subjectId: string;
  subjectName: string;
  subjectColor: string;
  plannedMinutes: number;
  cycleOrder: number;
  totalMinutes: number;    // minutos acumulados no total
  laps: number;            // voltas completas = floor(total / planejado)
  lapProgress: number;     // minutos na volta atual (resto)
  isSuggested: boolean;
}

export interface CycleState {
  ruleId: string;
  dailyMinutes: number;
  todayMinutes: number;
  subjects: CycleSubject[];
  totalLaps: number;       // voltas completas do ciclo inteiro (menor entre as matérias)
}

export async function getActiveCycleRule(): Promise<string | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('recurrence_rules')
    .select('id')
    .eq('user_id', user.id)
    .eq('mode', 'ciclo')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1);

  return data?.[0]?.id ?? null;
}

export async function getCycleState(ruleId: string): Promise<CycleState | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: rule } = await supabase
    .from('recurrence_rules')
    .select('*, recurrence_items(*)')
    .eq('id', ruleId)
    .single();
  if (!rule) return null;

  const { data: subjects } = await supabase
    .from('subjects').select('id, name, color').eq('user_id', user.id);
  const subjMap: Record<string, { name: string; color: string }> = {};
  for (const s of subjects ?? []) subjMap[s.id] = { name: s.name, color: s.color ?? '#C9B8DD' };

  // Todas as conclusões dessa regra (cada uma com minutos).
  const { data: completions } = await supabase
    .from('cycle_completions')
    .select('subject_id, completed_date, minutes')
    .eq('rule_id', ruleId);

  // Soma minutos por matéria.
  const minutesBySubject: Record<string, number> = {};
  for (const c of completions ?? []) {
    minutesBySubject[c.subject_id] = (minutesBySubject[c.subject_id] ?? 0) + (c.minutes ?? 0);
  }

  // Minutos girados hoje.
  const hoje = localDateStr(new Date());
  const todayMinutes = (completions ?? [])
    .filter((c) => c.completed_date === hoje)
    .reduce((s, c) => s + (c.minutes ?? 0), 0);

  const items = ((rule.recurrence_items ?? []) as {
    id: string; subject_id: string; planned_minutes: number; cycle_order: number | null;
  }[]).sort((a, b) => (a.cycle_order ?? 0) - (b.cycle_order ?? 0));

  const subjectsOut: CycleSubject[] = items.map((it) => {
    const planned = it.planned_minutes || 60;
    const total = minutesBySubject[it.subject_id] ?? 0;
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

  // Próxima sugerida: menos voltas; empate → menos progresso; empate → menor ordem.
  if (subjectsOut.length > 0) {
    let best = 0;
    for (let i = 1; i < subjectsOut.length; i++) {
      const a = subjectsOut[i], b = subjectsOut[best];
      if (a.laps < b.laps || (a.laps === b.laps && a.lapProgress < b.lapProgress)) {
        best = i;
      }
    }
    subjectsOut[best].isSuggested = true;
  }

  const totalLaps = subjectsOut.length > 0 ? Math.min(...subjectsOut.map((s) => s.laps)) : 0;

  return {
    ruleId,
    dailyMinutes: rule.cycle_daily_minutes ?? 180,
    todayMinutes,
    subjects: subjectsOut,
    totalLaps,
  };
}

// Registra minutos estudados de uma matéria do ciclo (manual ou timer).
export async function completeCycleSubject(input: {
  ruleId: string;
  itemId: string;
  subjectId: string;
  minutes?: number;
  source?: 'manual' | 'timer';
  clientSessionId?: string;
}): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Você precisa estar logado.');

  const payload = {
    user_id: user.id,
    rule_id: input.ruleId,
    item_id: input.itemId,
    subject_id: input.subjectId,
    completed_date: localDateStr(new Date()),
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

// Desfaz o último registro de minutos de uma matéria.
export async function undoLastCompletion(ruleId: string, subjectId: string): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data } = await supabase
    .from('cycle_completions')
    .select('id')
    .eq('user_id', user.id)
    .eq('rule_id', ruleId)
    .eq('subject_id', subjectId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (data?.[0]) {
    await supabase.from('cycle_completions').delete().eq('id', data[0].id);
  }
}

// Dado o id de uma matéria, retorna o item do ciclo ativo dela (pra o gancho do timer).
// Retorna null se a matéria não está num ciclo ativo.
export async function findCycleItemForSubject(subjectId: string): Promise<{ ruleId: string; itemId: string; plannedMinutes: number } | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const ruleId = await getActiveCycleRule();
  if (!ruleId) return null;

  const { data: items } = await supabase
    .from('recurrence_items')
    .select('id, subject_id, planned_minutes')
    .eq('rule_id', ruleId)
    .eq('subject_id', subjectId)
    .limit(1);

  if (!items || items.length === 0) return null;
  return { ruleId, itemId: items[0].id, plannedMinutes: items[0].planned_minutes || 60 };
}
// Arquiva o ciclo ativo: sai do "ativo" mas guarda todo o histórico.
export async function archiveCycle(ruleId: string): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Você precisa estar logado.');

  const { error } = await supabase
    .from('recurrence_rules')
    .update({ is_active: false })
    .eq('id', ruleId)
    .eq('user_id', user.id);
  if (error) throw new Error('Erro ao arquivar ciclo: ' + error.message);
}

// Exclui um ciclo de vez (regra + itens + conclusões em cascata pelo banco).
export async function deleteCycle(ruleId: string): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Você precisa estar logado.');

  const { error } = await supabase
    .from('recurrence_rules')
    .delete()
    .eq('id', ruleId)
    .eq('user_id', user.id);
  if (error) throw new Error('Erro ao excluir ciclo: ' + error.message);
}

// Lista ciclos arquivados (is_active = false), do mais recente ao mais antigo.
export async function listArchivedCycles(): Promise<{ id: string; createdAt: string }[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from('recurrence_rules')
    .select('id, created_at')
    .eq('user_id', user.id)
    .eq('mode', 'ciclo')
    .eq('is_active', false)
    .order('created_at', { ascending: false });

  return (data ?? []).map((r) => ({ id: r.id, createdAt: r.created_at }));
}
// Reativa um ciclo arquivado: ele volta a ser o ativo. Se já houver um ciclo
// ativo, ele é arquivado antes (troca — mantém o "1 ativo por vez").
export async function reactivateCycle(ruleId: string): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Você precisa estar logado.');

  // Arquiva qualquer ciclo ativo atual (exceto o próprio, por segurança).
  const { error: archErr } = await supabase
    .from('recurrence_rules')
    .update({ is_active: false })
    .eq('user_id', user.id)
    .eq('mode', 'ciclo')
    .eq('is_active', true)
    .neq('id', ruleId);
  if (archErr) throw new Error('Erro ao arquivar o ciclo atual: ' + archErr.message);

  // Ativa o escolhido.
  const { error } = await supabase
    .from('recurrence_rules')
    .update({ is_active: true })
    .eq('id', ruleId)
    .eq('user_id', user.id);
  if (error) throw new Error('Erro ao reativar ciclo: ' + error.message);
}
