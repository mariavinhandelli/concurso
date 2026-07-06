'use client';
// services/catalog.service.ts
// Banco de Matérias: catálogo global (read-only) e ativação por RPC.
//
// 'use client' é obrigatório: módulo usa estado de módulo (caches singleton).
// Em RSC/SSR, esse estado seria compartilhado entre requests — vazamento de dados.
//
// Cache de áreas:    1h TTL (dados globais; mudam só com deploy de admin).
// Cache de matérias: 60s TTL + promise coalescing (tem flag user-específica is_activated).
// Cache de tópicos:  permanente por sessão (topics_catalog é imutável pós-deploy).

import { createClient } from '@/lib/supabase/client';
import { tryGetUser, requireUser } from '@/lib/supabase/requireUser';

// ---------- Tipos ----------

export interface CatalogArea {
  id: string;
  name: string;
  slug: string;
  position: number;
}

export interface CatalogSubject {
  id: string;
  name: string;
  slug: string;
  position: number;
  area_slugs: string[];
  topic_count: number;
  parent_count: number;
  is_activated: boolean;
}

export interface CatalogTopic {
  id: string;
  name: string;
  parent_id: string | null;
  position: number;
}

// ---------- Cache ----------

let _areasCache: CatalogArea[] | null = null;
let _areasExpiry = 0;

let _subjectsCache: Promise<CatalogSubject[]> | null = null;
let _subjectsExpiry = 0;
let _subjectsCachedUserId: string | null = null;

const _topicsCache = new Map<string, CatalogTopic[]>();

// Chamada automaticamente em activateSubject() e pode ser chamada externamente.
export function invalidateCatalogCache(): void {
  _subjectsCache = null;
  _subjectsExpiry = 0;
  _subjectsCachedUserId = null;
}

// ---------- Áreas ----------

export async function getCatalogAreas(): Promise<CatalogArea[]> {
  if (_areasCache && Date.now() < _areasExpiry) return _areasCache;
  const supabase = createClient();
  const { data, error } = await supabase
    .from('catalog_areas')
    .select('id, name, slug, position')
    .order('position', { ascending: true });
  if (error) throw new Error('Erro ao listar áreas: ' + error.message);
  _areasCache = data ?? [];
  _areasExpiry = Date.now() + 3_600_000; // 1h — áreas quase nunca mudam
  return _areasCache;
}

// ---------- Matérias ----------

export async function getCatalogSubjects(): Promise<CatalogSubject[]> {
  const now = Date.now();
  if (_subjectsCache && now < _subjectsExpiry) return _subjectsCache;
  _subjectsExpiry = now + 60_000;
  _subjectsCache = _fetchSubjects();
  _subjectsCache.catch(() => { _subjectsCache = null; _subjectsExpiry = 0; });
  return _subjectsCache;
}

async function _fetchSubjects(): Promise<CatalogSubject[]> {
  const auth = await tryGetUser();
  const userId = auth?.userId ?? null;
  // Supabase client: usa o autenticado quando disponível, senão cria um público
  const supabase = auth?.supabase ?? createClient();

  // Invalida automaticamente se o usuário mudou (logout → login de outro)
  if (_subjectsCachedUserId !== null && _subjectsCachedUserId !== userId) {
    _subjectsCache = null;
    _subjectsExpiry = 0;
  }
  _subjectsCachedUserId = userId;

  const { data: subjects, error: subErr } = await supabase
    .from('subjects_catalog')
    .select('id, name, slug, position, is_active')
    .eq('is_active', true)
    .order('position', { ascending: true });
  if (subErr) throw new Error('Erro ao listar catálogo: ' + subErr.message);
  if (!subjects || subjects.length === 0) return [];

  const subjectIds = subjects.map((s) => s.id);

  // Queries 2, 3 e 4 em paralelo — antes eram sequenciais, custando 3 round-trips extras
  const [topicsRes, linksRes, mineRes] = await Promise.all([
    supabase
      .from('topics_catalog')
      .select('id, subject_catalog_id, parent_id')
      .in('subject_catalog_id', subjectIds),
    supabase
      .from('subject_catalog_areas')
      .select('subject_catalog_id, catalog_areas(slug)')
      .in('subject_catalog_id', subjectIds),
    userId
      ? supabase
          .from('subjects')
          .select('catalog_id')
          .eq('user_id', userId)
          .eq('status', 'ativo')   // arquivada NÃO conta como ativada no catálogo (evita mostrar "ativa" no explorar)
          .not('catalog_id', 'is', null)
      : Promise.resolve({ data: [] as { catalog_id: string | null }[], error: null }),
  ]);

  if (topicsRes.error) throw new Error('Erro ao contar tópicos: ' + topicsRes.error.message);
  if (linksRes.error) throw new Error('Erro ao buscar áreas: ' + linksRes.error.message);
  if (mineRes.error) throw new Error('Erro ao verificar ativadas: ' + mineRes.error.message);

  const topicCount = new Map<string, number>();
  const parentCount = new Map<string, number>();
  for (const t of topicsRes.data ?? []) {
    topicCount.set(t.subject_catalog_id, (topicCount.get(t.subject_catalog_id) ?? 0) + 1);
    if (t.parent_id === null) {
      parentCount.set(t.subject_catalog_id, (parentCount.get(t.subject_catalog_id) ?? 0) + 1);
    }
  }

  const areaMap = new Map<string, string[]>();
  for (const row of linksRes.data ?? []) {
    const rel = (row as { catalog_areas: { slug: string } | { slug: string }[] | null }).catalog_areas;
    const slug = Array.isArray(rel) ? rel[0]?.slug : rel?.slug;
    if (!slug) continue;
    const arr = areaMap.get(row.subject_catalog_id) ?? [];
    arr.push(slug);
    areaMap.set(row.subject_catalog_id, arr);
  }

  const activatedIds = new Set((mineRes.data ?? []).map((r) => r.catalog_id as string));

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

// ---------- Tópicos de uma matéria (modal + prefetch no hover) ----------

// Cache permanente por sessão: topics_catalog não muda sem deploy de admin.
// Usado também para prefetch silencioso via onMouseEnter no card.
export async function getCatalogTopics(subjectCatalogId: string): Promise<CatalogTopic[]> {
  if (_topicsCache.has(subjectCatalogId)) return _topicsCache.get(subjectCatalogId)!;
  const supabase = createClient();
  const { data, error } = await supabase
    .from('topics_catalog')
    .select('id, name, parent_id, position')
    .eq('subject_catalog_id', subjectCatalogId)
    .order('position', { ascending: true });
  if (error) throw new Error('Erro ao buscar tópicos: ' + error.message);
  const result = data ?? [];
  _topicsCache.set(subjectCatalogId, result);
  return result;
}

// ---------- Ativação ----------

export async function activateSubject(catalogId: string): Promise<string> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc('activate_catalog_subject', {
    p_catalog_id: catalogId,
  });
  if (error) throw new Error('Erro ao ativar matéria: ' + error.message);
  // Invalida o cache de matérias: is_activated mudou para esta entry
  invalidateCatalogCache();
  return data as string;
}
