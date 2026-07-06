// services/topics.service.ts
// Camada de aplicação: resolve auth, delega SQL ao repositório, aplica regras de negócio.
// Tipos Confidence e Topic são definidos no repositório e re-exportados aqui para
// manter compatibilidade com todos os importadores existentes.

import { requireUser } from '@/lib/supabase/requireUser';
import * as repo from '@/services/topics.repository';

export type { Confidence, Topic } from '@/services/topics.repository';
export type { PickerOption } from '@/services/subjects.service';

export async function listTopics(subjectId: string) {
  const { supabase, userId } = await requireUser();
  return repo.fetchTopics(supabase, userId, subjectId);
}

export async function listAllTopics() {
  const { supabase, userId } = await requireUser();
  return repo.fetchAllTopics(supabase, userId);
}

export async function createTopic(
  subjectId: string,
  name: string,
  parentId: string | null = null,
) {
  const { supabase, userId } = await requireUser();
  return repo.insertTopic(supabase, userId, subjectId, name, parentId);
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
