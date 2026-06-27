// services/catalog.service.ts
// Camada de dados do "Banco de Matérias" (catálogo global) e das matérias
// do usuário (instância). Espelha o padrão de topics.service.ts.
//
// Conceito:
//  - Catálogo = subjects_catalog / topics_catalog (global, read-only).
//  - Ativar uma matéria copia tudo para subjects/topics do usuário via RPC.
//  - O usuário edita/arquiva/cria por cima da SUA cópia, sem afetar o catálogo.

import { createClient } from '@/lib/supabase/client';

// ---------- Tipos ----------

export interface CatalogArea {
  id: string;
  name: string;
  slug: string;
  position: number;
}

// Uma matéria do catálogo, já com a info de quantos tópicos tem,
// a quais áreas pertence, e se o usuário logado já ativou.
export interface CatalogSubject {
  id: string;
  name: string;
  slug: string;
  position: number;
  area_slugs: string[];     // áreas a que pertence (para filtro)
  topic_count: number;      // total de tópicos (pais + filhos)
  parent_count: number;     // só os tópicos "pai/simples" (parent_id null)
  is_activated: boolean;    // o usuário logado já ativou esta matéria?
}

export type SubjectStatus = 'ativo' | 'arquivado';

// Uma matéria do usuário (instância), com progresso agregado por is_completed.
export interface MySubject {
  id: string;
  name: string;
  color: string | null;
  position: number;
  status: SubjectStatus;
  catalog_id: string | null;   // null = matéria criada pelo próprio usuário
  is_own: boolean;             // atalho: catalog_id === null
  leaf_total: number;          // total de tópicos-folha (estudáveis)
  leaf_done: number;           // folhas com is_completed = true
  progress: number;            // 0-100, arredondado
}

// ---------- Catálogo: leitura ----------

// As 6 áreas, na ordem de exibição (position).
export async function getCatalogAreas(): Promise<CatalogArea[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('catalog_areas')
    .select('id, name, slug, position')
    .order('position', { ascending: true });

  if (error) throw new Error('Erro ao listar áreas: ' + error.message);
  return data ?? [];
}

// Todas as matérias do catálogo, com contagem de tópicos, áreas e
// flag de "já ativada" pelo usuário logado. Ordenadas por position.
export async function getCatalogSubjects(): Promise<CatalogSubject[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // 1) matérias do catálogo
  const { data: subjects, error: subErr } = await supabase
    .from('subjects_catalog')
    .select('id, name, slug, position, is_active')
    .eq('is_active', true)
    .order('position', { ascending: true });
  if (subErr) throw new Error('Erro ao listar catálogo: ' + subErr.message);
  if (!subjects || subjects.length === 0) return [];

  const subjectIds = subjects.map((s) => s.id);

  // 2) tópicos do catálogo (só id, matéria e parent) p/ contar pais e filhos
  const { data: topics, error: topErr } = await supabase
    .from('topics_catalog')
    .select('id, subject_catalog_id, parent_id')
    .in('subject_catalog_id', subjectIds);
  if (topErr) throw new Error('Erro ao contar tópicos: ' + topErr.message);

  // 3) vínculos área <-> matéria, com o slug da área
  const { data: links, error: linkErr } = await supabase
    .from('subject_catalog_areas')
    .select('subject_catalog_id, catalog_areas(slug)')
    .in('subject_catalog_id', subjectIds);
  if (linkErr) throw new Error('Erro ao buscar áreas das matérias: ' + linkErr.message);

  // 4) quais o usuário já ativou (subjects com catalog_id preenchido)
  let activatedIds = new Set<string>();
  if (user) {
    const { data: mine, error: mineErr } = await supabase
      .from('subjects')
      .select('catalog_id')
      .eq('user_id', user.id)
      .not('catalog_id', 'is', null);
    if (mineErr) throw new Error('Erro ao verificar ativadas: ' + mineErr.message);
    activatedIds = new Set((mine ?? []).map((r) => r.catalog_id as string));
  }

  // monta os mapas de contagem e áreas
  const topicCount = new Map<string, number>();
  const parentCount = new Map<string, number>();
  for (const t of topics ?? []) {
    topicCount.set(t.subject_catalog_id, (topicCount.get(t.subject_catalog_id) ?? 0) + 1);
    if (t.parent_id === null) {
      parentCount.set(t.subject_catalog_id, (parentCount.get(t.subject_catalog_id) ?? 0) + 1);
    }
  }

  const areaMap = new Map<string, string[]>();
  for (const row of links ?? []) {
    // catalog_areas pode vir como objeto OU array, dependendo da inferência
    // do supabase-js. Normalizamos para extrair o slug nos dois casos.
    const rel = (row as { catalog_areas: { slug: string } | { slug: string }[] | null }).catalog_areas;
    const slug = Array.isArray(rel) ? rel[0]?.slug : rel?.slug;
    if (!slug) continue;
    const arr = areaMap.get(row.subject_catalog_id) ?? [];
    arr.push(slug);
    areaMap.set(row.subject_catalog_id, arr);
  }

  return subjects.map((s) => ({
    id: s.id,
    name: s.name,
    slug: s.slug,
    position: s.position,
    area_slugs: areaMap.get(s.id) ?? [],
    topic_count: topicCount.get(s.id) ?? 0,
    parent_count: parentCount.get(s.id) ?? 0,
    is_activated: activatedIds.has(s.id),
  }));
}

// ---------- Tópicos do catálogo ----------

export interface CatalogTopic {
  id: string;
  name: string;
  parent_id: string | null;
  position: number;
}

export async function getCatalogTopics(subjectCatalogId: string): Promise<CatalogTopic[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('topics_catalog')
    .select('id, name, parent_id, position')
    .eq('subject_catalog_id', subjectCatalogId)
    .order('position', { ascending: true });
  if (error) throw new Error('Erro ao buscar tópicos: ' + error.message);
  return data ?? [];
}

// ---------- Ativação ----------

// Ativa uma matéria do catálogo: copia matéria + tópicos para o usuário.
// Idempotente no banco (a função RPC não duplica). Retorna o id da subject.
export async function activateSubject(catalogId: string): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('activate_catalog_subject', {
    p_catalog_id: catalogId,
  });
  if (error) throw new Error('Erro ao ativar matéria: ' + error.message);
  return data as string;
}

// ---------- Matérias do usuário (instância) ----------

// Lista as matérias do usuário por status, já com progresso (is_completed)
// agregado nos tópicos-folha (parent_id não-nulo). Pais são pastas: não contam.
export async function getMySubjects(status: SubjectStatus = 'ativo'): Promise<MySubject[]> {
  const supabase = createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) throw new Error('Você precisa estar logado.');

  // 1) matérias do usuário no status pedido
  const { data: subjects, error: subErr } = await supabase
    .from('subjects')
    .select('id, name, color, position, status, catalog_id')
    .eq('user_id', user.id)
    .eq('status', status)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });
  if (subErr) throw new Error('Erro ao listar matérias: ' + subErr.message);
  if (!subjects || subjects.length === 0) return [];

  const subjectIds = subjects.map((s) => s.id);

  // 2) tópicos dessas matérias — só o necessário p/ o progresso das folhas
  const { data: topics, error: topErr } = await supabase
    .from('topics')
    .select('subject_id, parent_id, is_completed')
    .in('subject_id', subjectIds);
  if (topErr) throw new Error('Erro ao calcular progresso: ' + topErr.message);

  const total = new Map<string, number>();
  const done = new Map<string, number>();
  for (const t of topics ?? []) {
    if (t.parent_id === null) continue; // pai = pasta, não conta no progresso
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
      leaf_total: leafTotal,
      leaf_done: leafDone,
      progress,
    };
  });
}

// Arquiva uma matéria do usuário (não apaga — preserva histórico).
export async function archiveSubject(subjectId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('subjects')
    .update({ status: 'arquivado' })
    .eq('id', subjectId);
  if (error) throw new Error('Erro ao arquivar matéria: ' + error.message);
}

// Desarquiva (volta para ativo).
export async function unarchiveSubject(subjectId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('subjects')
    .update({ status: 'ativo' })
    .eq('id', subjectId);
  if (error) throw new Error('Erro ao reativar matéria: ' + error.message);
}