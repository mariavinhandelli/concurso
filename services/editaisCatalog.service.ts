// services/editaisCatalog.service.ts
// Banco de Editais: catálogo de concursos prontos (read-only). Ativar em 1 clique
// compõe um concurso-alvo completo via RPC activate_catalog_edital.
'use client';

import { createClient } from '@/lib/supabase/client';

export type EditalSituacao = 'vigente' | 'em_expectativa' | 'encerrado';

export interface CatalogEdital {
  id: string;
  orgao: string;
  cargo: string;
  banca: string | null;
  ano: number | null;
  areaName: string | null;
  situacao: EditalSituacao;
  ultimaEdicao: number | null;
  vagas: number | null;
  remuneracao: number | null;
  examDate: string | null;
  inscricoesAte: string | null;
  editalUrl: string | null;
  aviso: string | null;
  subjectCount: number;
  topicCount: number;
  isActivated: boolean;   // usuário já ativou este edital (tem alvo com o mesmo slug)?
}

type EmbeddedCount = { count: number }[] | null;
interface EditalRow {
  id: string;
  slug: string;
  orgao: string;
  cargo: string;
  banca: string | null;
  ano: number | null;
  situacao: EditalSituacao;
  ultima_edicao: number | null;
  vagas: number | null;
  remuneracao: number | null;
  exam_date: string | null;
  inscricoes_ate: string | null;
  edital_url: string | null;
  aviso: string | null;
  catalog_areas: { name: string } | { name: string }[] | null;
  edital_catalog_subjects: EmbeddedCount;
  edital_catalog_topics: EmbeddedCount;
}

function countOf(rel: EmbeddedCount): number {
  return rel && rel.length > 0 ? rel[0].count : 0;
}

export async function listCatalogEditais(): Promise<CatalogEdital[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [editaisRes, minhasRes] = await Promise.all([
    supabase
      .from('editais_catalog')
      .select('id, slug, orgao, cargo, banca, ano, situacao, ultima_edicao, vagas, remuneracao, exam_date, inscricoes_ate, edital_url, aviso, catalog_areas(name), edital_catalog_subjects(count), edital_catalog_topics(count)')
      .eq('is_active', true)
      .order('position', { ascending: true }),
    user
      ? supabase.from('target_exams').select('slug').eq('user_id', user.id)
      : Promise.resolve({ data: [] as { slug: string }[], error: null }),
  ]);

  if (editaisRes.error) throw new Error('Erro ao listar editais: ' + editaisRes.error.message);
  if (minhasRes.error) throw new Error('Erro ao verificar editais ativados: ' + minhasRes.error.message);

  const ativados = new Set((minhasRes.data ?? []).map((r) => r.slug));

  const SITUACAO_ORDER: Record<EditalSituacao, number> = { vigente: 0, em_expectativa: 1, encerrado: 2 };

  return ((editaisRes.data ?? []) as EditalRow[])
    .map((e) => {
      const area = Array.isArray(e.catalog_areas) ? e.catalog_areas[0] : e.catalog_areas;
      return {
        id: e.id,
        orgao: e.orgao,
        cargo: e.cargo,
        banca: e.banca,
        ano: e.ano,
        areaName: area?.name ?? null,
        situacao: e.situacao,
        ultimaEdicao: e.ultima_edicao,
        vagas: e.vagas,
        remuneracao: e.remuneracao == null ? null : Number(e.remuneracao),
        examDate: e.exam_date,
        inscricoesAte: e.inscricoes_ate,
        editalUrl: e.edital_url,
        aviso: e.aviso,
        subjectCount: countOf(e.edital_catalog_subjects),
        topicCount: countOf(e.edital_catalog_topics),
        isActivated: ativados.has(e.slug),
      };
    })
    .sort((a, b) => SITUACAO_ORDER[a.situacao] - SITUACAO_ORDER[b.situacao]);
}

// Ficha de um edital do catálogo — alimenta o card "Sobre o concurso" no hub.
export interface CatalogEditalInfo {
  situacao: EditalSituacao;
  banca: string | null;
  ultimaEdicao: number | null;
  vagas: number | null;
  remuneracao: number | null;
  examDate: string | null;
  inscricoesAte: string | null;
  editalUrl: string | null;
  aviso: string | null;
}

// Conteúdo programático de um edital do catálogo — para o painel de detalhes
// (o usuário vê tudo ANTES de ativar).
export interface CatalogEditalSubject {
  name: string;
  weight: number;
  numQuestions: number | null;
  topicCount: number;
}

export async function getCatalogEditalSubjects(catalogEditalId: string): Promise<CatalogEditalSubject[]> {
  const supabase = createClient();
  const [subjectsRes, topicsRes] = await Promise.all([
    supabase
      .from('edital_catalog_subjects')
      .select('subject_catalog_id, weight, num_questions_expected, position, subjects_catalog(name)')
      .eq('edital_catalog_id', catalogEditalId)
      .order('position', { ascending: true }),
    supabase
      .from('edital_catalog_topics')
      .select('topic_catalog_id, topics_catalog(subject_catalog_id)')
      .eq('edital_catalog_id', catalogEditalId),
  ]);
  if (subjectsRes.error) throw new Error('Erro ao carregar disciplinas do edital: ' + subjectsRes.error.message);
  if (topicsRes.error) throw new Error('Erro ao carregar tópicos do edital: ' + topicsRes.error.message);

  const countBySubject: Record<string, number> = {};
  for (const row of topicsRes.data ?? []) {
    const tc = Array.isArray(row.topics_catalog) ? row.topics_catalog[0] : row.topics_catalog;
    const sid = tc?.subject_catalog_id;
    if (sid) countBySubject[sid] = (countBySubject[sid] ?? 0) + 1;
  }

  return (subjectsRes.data ?? []).map((row) => {
    const sc = Array.isArray(row.subjects_catalog) ? row.subjects_catalog[0] : row.subjects_catalog;
    return {
      name: sc?.name ?? 'Disciplina',
      weight: row.weight,
      numQuestions: row.num_questions_expected,
      topicCount: countBySubject[row.subject_catalog_id] ?? 0,
    };
  });
}

// Notícias, retificações e resultados de um edital — linha do tempo do hub.
export type EditalUpdateTipo = 'noticia' | 'retificacao' | 'aviso' | 'resultado';

export interface EditalUpdate {
  id: string;
  tipo: EditalUpdateTipo;
  titulo: string;
  url: string | null;
  publishedAt: string;
}

export async function listEditalUpdates(catalogEditalId: string): Promise<EditalUpdate[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('edital_updates')
    .select('id, tipo, titulo, url, published_at')
    .eq('edital_catalog_id', catalogEditalId)
    .order('published_at', { ascending: false })
    .limit(20);
  if (error) throw new Error('Erro ao listar atualizações do edital: ' + error.message);
  return (data ?? []).map((u) => ({
    id: u.id, tipo: u.tipo, titulo: u.titulo, url: u.url, publishedAt: u.published_at,
  }));
}

export async function getCatalogEditalInfo(catalogEditalId: string): Promise<CatalogEditalInfo | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('editais_catalog')
    .select('situacao, banca, ultima_edicao, vagas, remuneracao, exam_date, inscricoes_ate, edital_url, aviso')
    .eq('id', catalogEditalId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    situacao: data.situacao,
    banca: data.banca,
    ultimaEdicao: data.ultima_edicao,
    vagas: data.vagas,
    remuneracao: data.remuneracao == null ? null : Number(data.remuneracao),
    examDate: data.exam_date,
    inscricoesAte: data.inscricoes_ate,
    editalUrl: data.edital_url,
    aviso: data.aviso,
  };
}

// Ativa um edital do banco. Retorna o id do concurso-alvo criado (ou existente).
export async function activateCatalogEdital(editalId: string): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('activate_catalog_edital', { p_edital_id: editalId });
  if (error) throw new Error('Erro ao ativar edital: ' + error.message);
  return data as string;
}
