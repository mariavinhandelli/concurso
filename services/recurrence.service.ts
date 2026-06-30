// services/recurrence.service.ts
// Gerência das regras de recorrência (criar, listar, versionar ao editar, encerrar).
// NÃO gera blocos aqui — só guarda a regra. A geração virtual vem em outro service.

import { createClient } from '@/lib/supabase/client';
import { toLocalDateString as localDateStr } from '@/lib/local-date';

export type RecurrenceMode = 'dia_fixo' | 'ciclo';

export interface RecurrenceItemInput {
  subjectId: string;
  topicId?: string | null;
  plannedMinutes?: number;
  weekday?: number | null;      // 0=dom..6=sab (modo dia_fixo)
  cycleOrder?: number | null;   // posição na sequência (modo ciclo)
  position?: number;
}

export interface RecurrenceRule {
  id: string;
  user_id: string;
  mode: RecurrenceMode;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  cycle_per_day: number;
  cycle_weekdays: number[] | null;
  cycle_daily_minutes: number;
  created_at: string;
  items?: RecurrenceItem[];
}

export interface RecurrenceItem {
  id: string;
  rule_id: string;
  subject_id: string;
  topic_id: string | null;
  planned_minutes: number;
  weekday: number | null;
  cycle_order: number | null;
  position: number;
}

export async function listRules(includeInactive = false): Promise<RecurrenceRule[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  let query = supabase
    .from('recurrence_rules')
    .select('*, recurrence_items(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (!includeInactive) query = query.eq('is_active', true);

  const { data, error } = await query;
  if (error) throw new Error('Erro ao listar regras: ' + error.message);

  return (data ?? []).map((r) => ({
    ...r,
    items: (r.recurrence_items ?? []) as RecurrenceItem[],
  }));
}

// Cria uma regra nova com seus itens.
export async function createRule(input: {
  mode: RecurrenceMode;
  startDate?: string;
  endDate?: string | null;
  cyclePerDay?: number;
  cycleWeekdays?: number[] | null;
  cycleDailyMinutes?: number;
  items: RecurrenceItemInput[];
}): Promise<string> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Você precisa estar logado.');

  const start = input.startDate ?? localDateStr(new Date());

  const { data: rule, error: rErr } = await supabase
    .from('recurrence_rules')
    .insert({
      user_id: user.id,
      mode: input.mode,
      start_date: start,
      end_date: input.endDate ?? null,
      cycle_per_day: input.cyclePerDay ?? 1,
      cycle_weekdays: input.cycleWeekdays ?? null,
      cycle_daily_minutes: input.cycleDailyMinutes ?? 180,
      is_active: true,
    })
    .select()
    .single();

  if (rErr || !rule) throw new Error('Erro ao criar regra: ' + rErr?.message);

  if (input.items.length > 0) {
    const rows = input.items.map((it) => ({
      rule_id: rule.id,
      subject_id: it.subjectId,
      topic_id: it.topicId ?? null,
      planned_minutes: it.plannedMinutes ?? 60,
      weekday: it.weekday ?? null,
      cycle_order: it.cycleOrder ?? null,
      position: it.position ?? 0,
    }));
    const { error: iErr } = await supabase.from('recurrence_items').insert(rows);
    if (iErr) throw new Error('Erro ao criar itens da regra: ' + iErr.message);
  }

  return rule.id;
}

// VERSIONAR: editar uma regra = encerrar a antiga (ontem) e criar uma nova hoje.
export async function editRuleVersioned(
  oldRuleId: string,
  input: {
    mode: RecurrenceMode;
    endDate?: string | null;
    cyclePerDay?: number;
    cycleWeekdays?: number[] | null;
    cycleDailyMinutes?: number;
    items: RecurrenceItemInput[];
  },
): Promise<string> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Você precisa estar logado.');

  const ontem = new Date();
  ontem.setDate(ontem.getDate() - 1);
  const { error: endErr } = await supabase
    .from('recurrence_rules')
    .update({ is_active: false, end_date: localDateStr(ontem) })
    .eq('id', oldRuleId)
    .eq('user_id', user.id);
  if (endErr) throw new Error('Erro ao encerrar regra antiga: ' + endErr.message);

  return createRule({
    mode: input.mode,
    startDate: localDateStr(new Date()),
    endDate: input.endDate ?? null,
    cyclePerDay: input.cyclePerDay,
    cycleWeekdays: input.cycleWeekdays,
    cycleDailyMinutes: input.cycleDailyMinutes,
    items: input.items,
  });
}

export async function stopRule(ruleId: string): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const ontem = new Date();
  ontem.setDate(ontem.getDate() - 1);
  const { error } = await supabase
    .from('recurrence_rules')
    .update({ is_active: false, end_date: localDateStr(ontem) })
    .eq('id', ruleId)
    .eq('user_id', user.id);
  if (error) throw new Error('Erro ao parar regra: ' + error.message);
}

export async function deleteRule(ruleId: string): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Você precisa estar logado.');

  const { error } = await supabase.from('recurrence_rules').delete().eq('id', ruleId).eq('user_id', user.id);
  if (error) throw new Error('Erro ao apagar regra: ' + error.message);
}

// Resumo legível de uma regra, pra exibir no painel e pré-preencher o editor.
export interface RuleSummary {
  id: string;
  mode: RecurrenceMode;
  startDate: string;
  endDate: string | null;
  cycleDailyMinutes: number;
  // por matéria: nome, cor, dias (dia_fixo), minutos e ordem (ciclo)
  materias: {
    subjectId: string;
    subjectName: string;
    subjectColor: string;
    weekdays: number[];
    minutes: number;
    cycleOrder: number;
  }[];
}

export async function listRuleSummaries(): Promise<RuleSummary[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: rules, error } = await supabase
    .from('recurrence_rules')
    .select('*, recurrence_items(*)')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) throw new Error('Erro ao listar regras: ' + error.message);

  const { data: subjects } = await supabase
    .from('subjects').select('id, name, color').eq('user_id', user.id);
  const subjMap: Record<string, { name: string; color: string }> = {};
  for (const s of subjects ?? []) subjMap[s.id] = { name: s.name, color: s.color ?? '#C9B8DD' };

  return (rules ?? []).map((r) => {
    // Agrupa itens por matéria, juntando os dias; guarda a menor cycle_order da matéria.
    const porMateria = new Map<string, { weekdays: number[]; minutes: number; cycleOrder: number }>();
    for (const it of (r.recurrence_items ?? []) as {
      subject_id: string; weekday: number | null; planned_minutes: number; cycle_order: number | null;
    }[]) {
      const cur = porMateria.get(it.subject_id) ?? { weekdays: [], minutes: it.planned_minutes, cycleOrder: it.cycle_order ?? 0 };
      if (it.weekday !== null) cur.weekdays.push(it.weekday);
      if (it.cycle_order !== null) cur.cycleOrder = it.cycle_order;
      porMateria.set(it.subject_id, cur);
    }
    let materias = Array.from(porMateria.entries()).map(([subjectId, v]) => ({
      subjectId,
      subjectName: subjMap[subjectId]?.name ?? 'Matéria',
      subjectColor: subjMap[subjectId]?.color ?? '#C9B8DD',
      weekdays: v.weekdays.sort(),
      minutes: v.minutes,
      cycleOrder: v.cycleOrder,
    }));
    // No ciclo, ordena pela sequência.
    if (r.mode === 'ciclo') materias = materias.sort((a, b) => a.cycleOrder - b.cycleOrder);

    return {
      id: r.id,
      mode: r.mode,
      startDate: r.start_date,
      endDate: r.end_date,
      cycleDailyMinutes: r.cycle_daily_minutes ?? 180,
      materias,
    };
  });
}
