// services/scheduleEngine.service.ts
// MOTOR DE GERAÇÃO (modo dia_fixo). Recebe um intervalo de datas e devolve os
// blocos já mesclados: manuais reais + virtuais gerados pelas regras + overrides.
// O ciclo NÃO entra aqui — terá motor próprio.

import { createClient } from '@/lib/supabase/client';
import { toLocalDateString as localDateStr } from '@/lib/local-date';

export type BlockOrigin = 'manual' | 'recorrencia';

// Bloco unificado que a tela consome — não importa se veio manual ou de regra.
export interface ScheduleBlock {
  // id real (manual ou override materializado) OU id virtual "virtual:rule:item:data"
  id: string;
  origin: BlockOrigin;
  block_date: string;          // 'YYYY-MM-DD'
  subject_id: string;
  topic_id: string | null;
  planned_minutes: number;
  is_done: boolean;
  position: number;
  // enriquecidos:
  subjectName: string;
  subjectColor: string;
  topicName: string | null;
  // só para recorrência:
  rule_id?: string;
  item_id?: string;
  is_virtual?: boolean;        // true = ainda não materializado (sem override)
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

// Resolve nome/cor de matéria e nome de tópico a partir de mapas pré-carregados.
interface SubjMap { [id: string]: { name: string; color: string } }
interface TopMap { [id: string]: string }

export async function getScheduleBlocks(startDate: string, endDate: string): Promise<ScheduleBlock[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // 1) Carrega matérias e tópicos do usuário (pra enriquecer nomes/cores).
  const [{ data: subjects }, { data: topics }] = await Promise.all([
    supabase.from('subjects').select('id, name, color').eq('user_id', user.id),
    supabase.from('topics').select('id, name').eq('user_id', user.id),
  ]);
  const subjMap: SubjMap = {};
  for (const s of subjects ?? []) subjMap[s.id] = { name: s.name, color: s.color ?? '#C9B8DD' };
  const topMap: TopMap = {};
  for (const t of topics ?? []) topMap[t.id] = t.name;

  const enrich = (subjectId: string, topicId: string | null) => ({
    subjectName: subjMap[subjectId]?.name ?? 'Matéria',
    subjectColor: subjMap[subjectId]?.color ?? '#C9B8DD',
    topicName: topicId ? (topMap[topicId] ?? null) : null,
  });

  const out: ScheduleBlock[] = [];

  // 2) BLOCOS MANUAIS reais (study_blocks) no intervalo.
  const { data: manuais } = await supabase
    .from('study_blocks')
    .select('*')
    .eq('user_id', user.id)
    .gte('block_date', startDate)
    .lte('block_date', endDate);

  for (const b of manuais ?? []) {
    out.push({
      id: b.id, origin: 'manual', block_date: b.block_date,
      subject_id: b.subject_id, topic_id: b.topic_id,
      planned_minutes: b.planned_minutes, is_done: b.is_done, position: b.position,
      ...enrich(b.subject_id, b.topic_id),
    });
  }

  // 3) REGRAS dia_fixo ativas que se sobrepõem ao intervalo.
  const { data: rules } = await supabase
    .from('recurrence_rules')
    .select('*, recurrence_items(*)')
    .eq('user_id', user.id)
    .eq('mode', 'dia_fixo')
    .lte('start_date', endDate);
  // (filtramos end_date >= startDate em memória, por causa do NULL = indeterminado)

  // 4) OVERRIDES do intervalo (cumprido/editado/pulado).
  const { data: overrides } = await supabase
    .from('recurrence_overrides')
    .select('*')
    .eq('user_id', user.id)
    .gte('occur_date', startDate)
    .lte('occur_date', endDate);

  // Tipo de uma linha de override (só os campos que usamos).
  interface OverrideRow {
    id: string;
    rule_id: string;
    item_id: string;
    occur_date: string;
    is_done: boolean;
    is_skipped: boolean;
    override_subject_id: string | null;
    override_topic_id: string | null;
    override_minutes: number | null;
  }

  // Indexa overrides por chave "ruleId:itemId:data" pra lookup rápido.
  const ovMap = new Map<string, OverrideRow>();
  for (const o of (overrides ?? []) as OverrideRow[]) {
    ovMap.set(`${o.rule_id}:${o.item_id}:${o.occur_date}`, o);
  }

  const dias = eachDate(startDate, endDate);

  // 5) Para cada regra, gera os blocos virtuais dos dias que casam.
  for (const rule of rules ?? []) {
    // Vigência: regra vale de start_date até end_date (ou pra sempre se null).
    const ruleStart = rule.start_date;
    const ruleEnd = rule.end_date; // pode ser null

    for (const d of dias) {
      const dStr = localDateStr(d);
      if (dStr < ruleStart) continue;
      if (ruleEnd && dStr > ruleEnd) continue;

      const weekday = d.getDay(); // 0=dom..6=sab

      // Itens da regra que caem neste dia da semana.
      const items = (rule.recurrence_items ?? []).filter((it: { weekday: number | null }) => it.weekday === weekday);

      for (const it of items) {
        const ovKey = `${rule.id}:${it.id}:${dStr}`;
        const ov = ovMap.get(ovKey);

        // Pulado nesse dia → não aparece.
        if (ov?.is_skipped) continue;

        // Conteúdo: override sobrepõe o item original.
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
          is_virtual: !ov,   // sem override = ainda virtual
          ...enrich(subjectId, topicId),
        });
      }
    }
  }

  // 6) Ordena por data e position.
  out.sort((a, b) => a.block_date.localeCompare(b.block_date) || a.position - b.position);

  return out;
}

// Marca/desmarca um bloco de RECORRÊNCIA como feito — materializa um override.
// (Blocos manuais continuam usando o toggleBlockDone do studyBlocks.service.)
export async function toggleRecurrenceDone(block: ScheduleBlock, done: boolean): Promise<void> {
  if (block.origin !== 'recorrencia' || !block.rule_id || !block.item_id) return;
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  if (block.is_virtual) {
    // Ainda não existe override → cria um, já marcando o estado.
    const { error } = await supabase.from('recurrence_overrides').insert({
      user_id: user.id,
      rule_id: block.rule_id,
      item_id: block.item_id,
      occur_date: block.block_date,
      is_done: done,
      done_at: done ? new Date().toISOString() : null,
    });
    if (error) throw new Error('Erro ao registrar: ' + error.message);
  } else {
    // Já tem override (id real) → só atualiza.
    const { error } = await supabase
      .from('recurrence_overrides')
      .update({ is_done: done, done_at: done ? new Date().toISOString() : null })
      .eq('id', block.id)
      .eq('user_id', user.id);
    if (error) throw new Error('Erro ao atualizar: ' + error.message);
  }

}
// Pular UMA ocorrência de recorrência (só aquele dia) — materializa override is_skipped.
export async function skipOccurrence(block: ScheduleBlock): Promise<void> {
  if (block.origin !== 'recorrencia' || !block.rule_id || !block.item_id) return;
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  if (block.is_virtual) {
    const { error } = await supabase.from('recurrence_overrides').insert({
      user_id: user.id,
      rule_id: block.rule_id,
      item_id: block.item_id,
      occur_date: block.block_date,
      is_skipped: true,
    });
    if (error) throw new Error('Erro ao pular: ' + error.message);
  } else {
    const { error } = await supabase
      .from('recurrence_overrides')
      .update({ is_skipped: true })
      .eq('id', block.id)
      .eq('user_id', user.id);
    if (error) throw new Error('Erro ao pular: ' + error.message);
  }
}
