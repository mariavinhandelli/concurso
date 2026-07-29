// services/recurrence.service.ts
// Gerência das regras de recorrência (criar, listar, versionar ao editar, encerrar).
// NÃO gera blocos aqui — só guarda a regra. A geração virtual vem em outro service.

import { requireUser, tryGetUser } from '@/lib/supabase/requireUser';
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
  const ctx = await tryGetUser();
  if (!ctx) return [];
  const { supabase, userId } = ctx;

  let query = supabase
    .from('recurrence_rules')
    .select('*, recurrence_items(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (!includeInactive) query = query.eq('is_active', true);

  const { data, error } = await query;
  if (error) throw new Error('Erro ao listar regras: ' + error.message);

  return (data ?? []).map((r) => ({
    ...r,
    items: (r.recurrence_items ?? []) as RecurrenceItem[],
  }));
}

export async function createRule(input: {
  mode: RecurrenceMode;
  startDate?: string;
  endDate?: string | null;
  cyclePerDay?: number;
  cycleWeekdays?: number[] | null;
  cycleDailyMinutes?: number;
  items: RecurrenceItemInput[];
}): Promise<string> {
  const { supabase, userId } = await requireUser();

  const start = input.startDate ?? localDateStr(new Date());

  const { data: rule, error: rErr } = await supabase
    .from('recurrence_rules')
    .insert({
      user_id: userId,
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
    if (iErr) {
      await supabase.from('recurrence_rules').delete().eq('id', rule.id);
      throw new Error('Erro ao criar itens da regra: ' + iErr.message);
    }
  }

  return rule.id;
}

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
  const { supabase } = await requireUser();

  const itemsJson = input.items.map((it) => ({
    subject_id: it.subjectId,
    topic_id: it.topicId ?? null,
    planned_minutes: it.plannedMinutes ?? 60,
    weekday: it.weekday ?? null,
    cycle_order: it.cycleOrder ?? null,
    position: it.position ?? 0,
  }));

  const { data, error } = await supabase.rpc('edit_recurrence_rule_versioned', {
    p_old_rule_id:         oldRuleId,
    p_mode:                input.mode,
    p_end_date:            input.endDate ?? null,
    p_cycle_per_day:       input.cyclePerDay ?? 1,
    p_cycle_weekdays:      input.cycleWeekdays ?? null,
    p_cycle_daily_minutes: input.cycleDailyMinutes ?? 180,
    p_items:               itemsJson,
    // Data local do usuário: sem ela o servidor usava CURRENT_DATE (UTC) e a
    // edição feita à noite (BRT) só valia a partir do dia seguinte.
    p_today:               localDateStr(new Date()),
  });

  if (error) throw new Error('Erro ao editar regra: ' + error.message);
  return data as string;
}

export async function stopRule(ruleId: string): Promise<void> {
  const ctx = await tryGetUser();
  if (!ctx) return;
  const { supabase, userId } = ctx;

  const ontem = new Date();
  ontem.setDate(ontem.getDate() - 1);
  const { error } = await supabase
    .from('recurrence_rules')
    .update({ is_active: false, end_date: localDateStr(ontem) })
    .eq('id', ruleId)
    .eq('user_id', userId);
  if (error) throw new Error('Erro ao parar regra: ' + error.message);
}

export async function deleteRule(ruleId: string): Promise<void> {
  const { supabase, userId } = await requireUser();

  const { error } = await supabase
    .from('recurrence_rules')
    .delete()
    .eq('id', ruleId)
    .eq('user_id', userId);
  if (error) throw new Error('Erro ao apagar regra: ' + error.message);
}

export interface RuleSummary {
  id: string;
  mode: RecurrenceMode;
  startDate: string;
  endDate: string | null;
  cycleDailyMinutes: number;
  materias: {
    subjectId: string;
    subjectName: string;
    subjectColor: string;
    weekdays: number[];
    minutes: number;
    cycleOrder: number;
    archived: boolean;   // matéria arquivada segue na regra; a UI sinaliza
  }[];
}

export async function listRuleSummaries(): Promise<RuleSummary[]> {
  const ctx = await tryGetUser();
  if (!ctx) return [];
  const { supabase, userId } = ctx;

  const { data: rules, error } = await supabase
    .from('recurrence_rules')
    .select('*, recurrence_items(*)')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) throw new Error('Erro ao listar regras: ' + error.message);

  const { data: subjects } = await supabase
    .from('subjects').select('id, name, color, status').eq('user_id', userId);
  const subjMap: Record<string, { name: string; color: string; archived: boolean }> = {};
  for (const s of subjects ?? []) subjMap[s.id] = { name: s.name, color: s.color ?? '#C9B8DD', archived: s.status === 'arquivado' };

  return (rules ?? []).map((r) => {
    const rawItems = (r.recurrence_items ?? []) as {
      subject_id: string; weekday: number | null; planned_minutes: number; cycle_order: number | null;
    }[];
    const mk = (subjectId: string, weekdays: number[], minutes: number, cycleOrder: number) => ({
      subjectId,
      subjectName: subjMap[subjectId]?.name ?? 'Matéria',
      subjectColor: subjMap[subjectId]?.color ?? '#C9B8DD',
      weekdays,
      minutes,
      cycleOrder,
      archived: subjMap[subjectId]?.archived ?? false,
    });

    let materias: RuleSummary['materias'];
    if (r.mode === 'ciclo') {
      // No ciclo cada item é um SLOT da sequência, e a mesma matéria pode
      // ocupar vários (ex.: Direito Adm nas posições 0 e 5). Agrupar por
      // matéria — como o dia_fixo precisa — colapsava 11 slots em 8, e abrir
      // "Editar" e salvar sem mexer em nada encolhia o ciclo em silêncio.
      materias = rawItems
        .map((it) => mk(it.subject_id, [], it.planned_minutes, it.cycle_order ?? 0))
        .sort((a, b) => a.cycleOrder - b.cycleOrder);
    } else {
      // dia_fixo: uma linha por matéria, juntando os dias da semana dela.
      const porMateria = new Map<string, { weekdays: number[]; minutes: number; cycleOrder: number }>();
      for (const it of rawItems) {
        const cur = porMateria.get(it.subject_id) ?? { weekdays: [], minutes: it.planned_minutes, cycleOrder: it.cycle_order ?? 0 };
        if (it.weekday !== null) cur.weekdays.push(it.weekday);
        cur.minutes = it.planned_minutes;
        if (it.cycle_order !== null) cur.cycleOrder = it.cycle_order;
        porMateria.set(it.subject_id, cur);
      }
      materias = Array.from(porMateria.entries()).map(([subjectId, v]) =>
        mk(subjectId, v.weekdays.sort(), v.minutes, v.cycleOrder));
    }

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
