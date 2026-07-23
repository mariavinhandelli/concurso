// services/topics.service.ts
// Camada de aplicação: resolve auth, delega SQL ao repositório, aplica regras de negócio.
// Tipos Confidence e Topic são definidos no repositório e re-exportados aqui para
// manter compatibilidade com todos os importadores existentes.

import { requireUser, tryGetUser } from '@/lib/supabase/requireUser';
import * as repo from '@/services/topics.repository';

export type { Confidence, Topic } from '@/services/topics.repository';
export type { PickerOption } from '@/services/subjects.service';

export async function listTopics(subjectId: string) {
  const { supabase, userId } = await requireUser();
  return repo.fetchTopics(supabase, userId, subjectId);
}

// Rótulo do alvo de uma sessão (painel do timer): "Matéria · Tópico" ou só a
// matéria. Sem isso o cronômetro não dizia O QUE estava sendo cronometrado.
export async function getSessionTargetLabel(
  subjectId: string | null,
  topicId: string | null,
): Promise<string | null> {
  const ctx = await tryGetUser();
  if (!ctx) return null;
  const { supabase, userId } = ctx;

  if (topicId) {
    const { data } = await supabase
      .from('topics')
      .select('name, subjects(name)')
      .eq('id', topicId)
      .eq('user_id', userId)
      .maybeSingle();
    if (data) {
      const subj = Array.isArray(data.subjects) ? data.subjects[0] : data.subjects;
      return subj?.name ? `${subj.name} · ${data.name}` : data.name;
    }
  }
  if (subjectId) {
    const { data } = await supabase
      .from('subjects')
      .select('name')
      .eq('id', subjectId)
      .eq('user_id', userId)
      .maybeSingle();
    return data?.name ?? null;
  }
  return null;
}

export async function listAllTopics() {
  const { supabase, userId } = await requireUser();
  return repo.fetchAllTopics(supabase, userId);
}

// Igual a listAllTopics, mas só de matérias ATIVAS — para pickers de estudo
// (Modo Foco, Command Palette). Tópicos de matérias arquivadas continuam
// existindo (e contando no progresso de editais via listAllTopics), mas não
// devem ser oferecidos como alvo de nova sessão.
export async function listActiveTopics() {
  const { supabase, userId } = await requireUser();
  return repo.fetchActiveTopics(supabase, userId);
}

export async function createTopic(
  subjectId: string,
  name: string,
  parentId: string | null = null,
) {
  const { supabase, userId } = await requireUser();
  // position = max+1 — sem isso o default 0 do banco jogava o tópico novo para
  // o TOPO/meio da lista quando já existiam tópicos importados (positions 0..n).
  const position = await repo.fetchMaxTopicPosition(supabase, subjectId);
  return repo.insertTopic(supabase, userId, subjectId, name, parentId, position);
}

export async function toggleCompleted(id: string, value: boolean): Promise<void> {
  const { supabase, userId } = await requireUser();
  return repo.setTopicCompleted(supabase, userId, id, value);
}

export async function updateTopic(
  id: string,
  updates: { name?: string; notes?: string; confidence?: repo.Confidence },
) {
  const { supabase, userId } = await requireUser();
  return repo.patchTopic(supabase, userId, id, updates);
}

export async function deleteTopic(id: string): Promise<void> {
  const { supabase, userId } = await requireUser();
  return repo.removeTopic(supabase, userId, id);
}

// Lista tópicos folha (sem filhos) de uma matéria — para seletores (pickers).
// Um tópico é folha se nenhum outro tópico aponta para ele como parent_id.
// Substitui listTopicOptions do picker.service.ts.
export async function listLeaves(subjectId: string): Promise<{ id: string; name: string }[]> {
  const { supabase, userId } = await requireUser();
  const all = await repo.fetchTopics(supabase, userId, subjectId);
  const parentIds = new Set(all.filter((t) => t.parent_id !== null).map((t) => t.parent_id!));
  return all
    .filter((t) => !parentIds.has(t.id))
    .map(({ id, name }) => ({ id, name }));
}

export async function createTopicsBulk(
  subjectId: string,
  nomes: string[],
  parentId: string | null = null,
): Promise<number> {
  if (nomes.length === 0) return 0;
  if (nomes.length > 500) throw new Error('Limite de 500 tópicos por importação. Divida em partes menores.');
  const { supabase, userId } = await requireUser();
  const startPos = await repo.fetchMaxTopicPosition(supabase, subjectId);
  return repo.insertTopicsBulk(supabase, userId, subjectId, nomes, parentId, startPos);
}

// Importação com hierarquia: itens `child` viram subtópicos do item de nível
// superior imediatamente anterior. Dentro de uma pasta (parentId), a hierarquia
// colapsa — tudo vira filho direto da pasta (só há um nível de aninhamento).
export async function createTopicsTree(
  subjectId: string,
  itens: { name: string; child: boolean }[],
  parentId: string | null = null,
): Promise<number> {
  if (itens.length === 0) return 0;
  if (itens.length > 500) throw new Error('Limite de 500 tópicos por importação. Divida em partes menores.');
  if (parentId !== null || itens.every((i) => !i.child)) {
    return createTopicsBulk(subjectId, itens.map((i) => i.name), parentId);
  }

  const { supabase, userId } = await requireUser();
  const startPos = await repo.fetchMaxTopicPosition(supabase, subjectId);

  // Fase 1: insere os itens de nível superior (ordem preservada pelo insert).
  const tops = itens.filter((i) => !i.child);
  const topIds = await repo.insertTopicsBulkReturningIds(
    supabase, userId, subjectId, tops.map((t) => t.name), null, startPos,
  );

  // Fase 2: filhos apontam para o pai correspondente na sequência colada.
  const children: { name: string; parentId: string }[] = [];
  let topIdx = -1;
  for (const item of itens) {
    if (!item.child) { topIdx++; continue; }
    if (topIdx >= 0 && topIds[topIdx]) children.push({ name: item.name, parentId: topIds[topIdx] });
  }
  if (children.length > 0) {
    await repo.insertTopicChildren(supabase, userId, subjectId, children, startPos + tops.length);
  }
  return tops.length + children.length;
}
