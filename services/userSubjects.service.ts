// services/userSubjects.service.ts
// Matérias do usuário (instância): listagem com progresso, archive e restore.
// Separado de catalog.service.ts, que é read-only sobre dados globais.

import { createClient } from '@/lib/supabase/client';
import { invalidateArchivedCache } from '@/services/archivedCache';
import { invalidateCatalogCache } from '@/services/catalog.service';
import { buildFolderIdSet } from '@/lib/topic-tree';

export type SubjectStatus = 'ativo' | 'arquivado';

// Uma matéria do usuário com progresso agregado nos tópicos-folha.
export interface MySubject {
  id: string;
  name: string;
  color: string | null;
  position: number;
  status: SubjectStatus;
  catalog_id: string | null;   // null = matéria criada pelo próprio usuário
  is_own: boolean;             // atalho: catalog_id === null
  created_at: string;          // para a ordenação "Recentes" da aba Minhas
  leaf_total: number;          // total de tópicos-folha (estudáveis)
  leaf_done: number;           // folhas com is_completed = true
  progress: number;            // 0-100, arredondado
}

// Lista as matérias do usuário por status, já com progresso calculado sobre folhas.
// Pais (tópicos que têm filhos) são pastas e não contam no progresso.
export async function getMySubjects(status: SubjectStatus = 'ativo'): Promise<MySubject[]> {
  const supabase = createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) throw new Error('Você precisa estar logado.');

  const { data: subjects, error: subErr } = await supabase
    .from('subjects')
    .select('id, name, color, position, status, catalog_id, created_at')
    .eq('user_id', user.id)
    .eq('status', status)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });
  if (subErr) throw new Error('Erro ao listar matérias: ' + subErr.message);
  if (!subjects || subjects.length === 0) return [];

  const subjectIds = subjects.map((s) => s.id);

  const { data: topics, error: topErr } = await supabase
    .from('topics')
    .select('id, subject_id, parent_id, is_completed')
    .in('subject_id', subjectIds);
  if (topErr) throw new Error('Erro ao calcular progresso: ' + topErr.message);

  const rows = topics ?? [];
  const folderIds = buildFolderIdSet(rows);

  const total = new Map<string, number>();
  const done = new Map<string, number>();
  for (const t of rows) {
    if (folderIds.has(t.id)) continue; // pasta — não conta no progresso
    total.set(t.subject_id, (total.get(t.subject_id) ?? 0) + 1);
    if (t.is_completed) done.set(t.subject_id, (done.get(t.subject_id) ?? 0) + 1);
  }

  return subjects.map((s) => {
    const leafTotal = total.get(s.id) ?? 0;
    const leafDone = done.get(s.id) ?? 0;
    const progress = leafTotal > 0 ? Math.round((leafDone / leafTotal) * 100) : 0;
    return {
      id: s.id,
      name: s.name,
      color: s.color,
      position: s.position,
      status: s.status as SubjectStatus,
      catalog_id: s.catalog_id,
      is_own: s.catalog_id === null,
      created_at: s.created_at,
      leaf_total: leafTotal,
      leaf_done: leafDone,
      progress,
    };
  });
}

// Arquiva uma matéria do usuário (não apaga — preserva histórico).
export async function archiveSubject(subjectId: string): Promise<void> {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Você precisa estar logado.');

  const { error } = await supabase
    .from('subjects')
    .update({ status: 'arquivado' })
    .eq('id', subjectId)
    .eq('user_id', user.id);
  if (error) throw new Error('Erro ao arquivar matéria: ' + error.message);
  invalidateArchivedCache();
  invalidateCatalogCache(); // some do "explorar" imediatamente (deixa de aparecer como ativada)
}

// Desarquiva (volta para ativo).
export async function unarchiveSubject(subjectId: string): Promise<void> {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Você precisa estar logado.');

  const { error } = await supabase
    .from('subjects')
    .update({ status: 'ativo' })
    .eq('id', subjectId)
    .eq('user_id', user.id);
  if (error) throw new Error('Erro ao reativar matéria: ' + error.message);
  invalidateArchivedCache();
  invalidateCatalogCache(); // reativada volta a aparecer como ativada no "explorar"
}
