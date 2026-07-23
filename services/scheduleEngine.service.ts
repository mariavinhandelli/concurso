// services/scheduleEngine.service.ts
// MOTOR DE GERAÇÃO (modo dia_fixo). Recebe um intervalo de datas e devolve os
// blocos já mesclados: manuais reais + virtuais gerados pelas regras + overrides.
// O ciclo NÃO entra aqui — terá motor próprio.

import { requireUser, tryGetUser } from '@/lib/supabase/requireUser';
import { toLocalDateString as localDateStr } from '@/lib/local-date';
import { updateBlock, createBlock } from '@/services/studyBlocks.service';

export type BlockOrigin = 'manual' | 'recorrencia';

export interface ScheduleBlock {
  id: string;
  origin: BlockOrigin;
  block_date: string;
  subject_id: string;
  topic_id: string | null;
  planned_minutes: number;
  is_done: boolean;
  position: number;
  subjectName: string;
  subjectColor: string;
  topicName: string | null;
  rule_id?: string;
  item_id?: string;
  is_virtual?: boolean;
}

function eachDate(startStr: string, endStr: string): Date[] {
  const out: Date[] = [];
  const [ys, ms, ds] = startStr.split('-').map(Number);
  const [ye, me, de] = endStr.split('-').map(Number);
  const cur = new Date(ys, ms - 1, ds);
  const end = new Date(ye, me - 1, de);
  while (cur <= end) {
    out.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

interface SubjMap { [id: string]: { name: string; color: string } }
interface TopMap { [id: string]: string }

export async function getScheduleBlocks(startDate: string, endDate: string): Promise<ScheduleBlock[]> {
  const ctx = await tryGetUser();
  if (!ctx) return [];
  const { supabase, userId } = ctx;

  // Fase 1: 4 queries em paralelo — sem topics (serão filtrados por ID na fase 2).
  const [
    { data: subjects, error: subjErr },
    { data: manuais, error: manuaisErr },
    { data: rules, error: rulesErr },
    { data: overrides, error: ovErr },
  ] = await Promise.all([
    supabase.from('subjects').select('id, name, color').eq('user_id', userId),
    supabase.from('study_blocks').select('*').eq('user_id', userId).gte('block_date', startDate).lte('block_date', endDate),
    // Histórico: regras paradas/versionadas (is_active=false + end_date) continuam
    // renderizando as semanas passadas — "Parar" promete manter o passado. Só o
    // intervalo [start_date, end_date] decide; is_active limita apenas regras sem fim.
    supabase.from('recurrence_rules').select('*, recurrence_items(*)').eq('user_id', userId).eq('mode', 'dia_fixo').lte('start_date', endDate)
      .or(`end_date.gte.${startDate},and(end_date.is.null,is_active.eq.true)`),
    supabase.from('recurrence_overrides').select('*').eq('user_id', userId).gte('occur_date', startDate).lte('occur_date', endDate),
  ]);
  if (subjErr) throw new Error('Erro ao carregar matérias: ' + subjErr.message);
  if (manuaisErr) throw new Error('Erro ao carregar blocos: ' + manuaisErr.message);
  if (rulesErr) throw new Error('Erro ao carregar recorrências: ' + rulesErr.message);
  if (ovErr) throw new Error('Erro ao carregar exceções: ' + ovErr.message);

  const subjMap: SubjMap = {};
  for (const s of subjects ?? []) subjMap[s.id] = { name: s.name, color: s.color ?? '#C9B8DD' };

  // Fase 2: busca apenas os topics usados nesta semana (evita payload ilimitado).
  const topicIds = new Set<string>();
  for (const b of manuais ?? []) if (b.topic_id) topicIds.add(b.topic_id);
  for (const rule of rules ?? []) {
    for (const it of (rule.recurrence_items ?? [])) if (it.topic_id) topicIds.add(it.topic_id);
  }
  const topMap: TopMap = {};
  if (topicIds.size > 0) {
    const { data: topics, error: topErr } = await supabase
      .from('topics').select('id, name').in('id', [...topicIds]);
    if (topErr) console.error('[getScheduleBlocks] topics:', topErr.message);
    for (const t of topics ?? []) topMap[t.id] = t.name;
  }

  const enrich = (subjectId: string, topicId: string | null) => ({
    subjectName: subjMap[subjectId]?.name ?? 'Matéria',
    subjectColor: subjMap[subjectId]?.color ?? '#C9B8DD',
    topicName: topicId ? (topMap[topicId] ?? null) : null,
  });

  const out: ScheduleBlock[] = [];

  for (const b of manuais ?? []) {
    out.push({
      id: b.id, origin: 'manual', block_date: b.block_date,
      subject_id: b.subject_id, topic_id: b.topic_id,
      planned_minutes: b.planned_minutes, is_done: b.is_done, position: b.position,
      ...enrich(b.subject_id, b.topic_id),
    });
  }

  interface OverrideRow {
    id: string; rule_id: string; item_id: string; occur_date: string;
    is_done: boolean; is_skipped: boolean;
    override_subject_id: string | null; override_topic_id: string | null; override_minutes: number | null;
  }

  const ovMap = new Map<string, OverrideRow>();
  for (const o of (overrides ?? []) as OverrideRow[]) {
    ovMap.set(`${o.rule_id}:${o.item_id}:${o.occur_date}`, o);
  }

  const dias = eachDate(startDate, endDate);

  for (const rule of rules ?? []) {
    const ruleStart = rule.start_date;
    const ruleEnd = rule.end_date;

    for (const d of dias) {
      const dStr = localDateStr(d);
      if (dStr < ruleStart) continue;
      if (ruleEnd && dStr > ruleEnd) continue;

      const weekday = d.getDay();
      const items = (rule.recurrence_items ?? []).filter((it: { weekday: number | null }) => it.weekday === weekday);

      for (const it of items) {
        const ovKey = `${rule.id}:${it.id}:${dStr}`;
        const ov = ovMap.get(ovKey);

        if (ov?.is_skipped) continue;

        const subjectId = ov?.override_subject_id ?? it.subject_id;
        const topicId = ov?.override_topic_id ?? it.topic_id;
        const minutes = ov?.override_minutes ?? it.planned_minutes;

        out.push({
          id: ov ? ov.id : `virtual:${rule.id}:${it.id}:${dStr}`,
          origin: 'recorrencia',
          block_date: dStr,
          subject_id: subjectId,
          topic_id: topicId,
          planned_minutes: minutes,
          is_done: ov?.is_done ?? false,
          position: it.position ?? 0,
          rule_id: rule.id,
          item_id: it.id,
          is_virtual: !ov,
          ...enrich(subjectId, topicId),
        });
      }
    }
  }

  out.sort((a, b) => a.block_date.localeCompare(b.block_date) || a.position - b.position);
  return out;
}

export async function toggleRecurrenceDone(block: ScheduleBlock, done: boolean): Promise<void> {
  if (block.origin !== 'recorrencia' || !block.rule_id || !block.item_id) return;
  const { supabase, userId } = await requireUser();

  if (block.is_virtual) {
    // Upsert no índice único (rule_id,item_id,occur_date): dois cliques em
    // abas/dispositivos diferentes não criam override duplicado.
    const { error } = await supabase.from('recurrence_overrides').upsert({
      user_id: userId,
      rule_id: block.rule_id,
      item_id: block.item_id,
      occur_date: block.block_date,
      is_done: done,
      done_at: done ? new Date().toISOString() : null,
    }, { onConflict: 'rule_id,item_id,occur_date' });
    if (error) throw new Error('Erro ao registrar: ' + error.message);
  } else {
    const { error } = await supabase
      .from('recurrence_overrides')
      .update({ is_done: done, done_at: done ? new Date().toISOString() : null })
      .eq('id', block.id)
      .eq('user_id', userId);
    if (error) throw new Error('Erro ao atualizar: ' + error.message);
  }
}

// Cronograma vivo: aplica a redistribuição decidida por computeReplan (lib/schedule/replan.ts).
// Bloco manual → só move a data. Ocorrência de recorrência → pula a ocorrência
// original (não volta a aparecer como atrasada) e materializa um bloco manual
// equivalente no novo dia. Segue mesmo após falha individual — reorganizar 4
// de 5 blocos é melhor que travar tudo por causa de 1 erro de rede.
export async function applyReplanMoves(
  moves: { block: ScheduleBlock; toDate: string }[],
): Promise<{ ok: number; falhas: number }> {
  let ok = 0, falhas = 0;
  for (const { block, toDate } of moves) {
    try {
      if (block.origin === 'manual') {
        await updateBlock(block.id, { blockDate: toDate });
      } else {
        await skipOccurrence(block);
        await createBlock({
          blockDate: toDate,
          subjectId: block.subject_id,
          topicId: block.topic_id,
          plannedMinutes: block.planned_minutes,
        });
      }
      ok++;
    } catch (e) {
      console.error('[applyReplanMoves] falha ao mover bloco:', block.id, e);
      falhas++;
    }
  }
  return { ok, falhas };
}

export async function skipOccurrence(block: ScheduleBlock): Promise<void> {
  if (block.origin !== 'recorrencia' || !block.rule_id || !block.item_id) return;
  const { supabase, userId } = await requireUser();

  if (block.is_virtual) {
    const { error } = await supabase.from('recurrence_overrides').upsert({
      user_id: userId,
      rule_id: block.rule_id,
      item_id: block.item_id,
      occur_date: block.block_date,
      is_skipped: true,
    }, { onConflict: 'rule_id,item_id,occur_date' });
    if (error) throw new Error('Erro ao pular: ' + error.message);
  } else {
    const { error } = await supabase
      .from('recurrence_overrides')
      .update({ is_skipped: true })
      .eq('id', block.id)
      .eq('user_id', userId);
    if (error) throw new Error('Erro ao pular: ' + error.message);
  }
}
