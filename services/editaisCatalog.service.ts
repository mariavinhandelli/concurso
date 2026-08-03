// services/editaisCatalog.service.ts
// Banco de Editais: catálogo de concursos prontos (read-only). Ativar em 1 clique
// compõe um concurso-alvo completo via RPC activate_catalog_edital.
'use client';

import { createClient } from '@/lib/supabase/client';
import { getCachedUser } from '@/lib/supabase/authCache';
import { invalidatePrimaryTargetCache } from '@/services/primaryTargetCache';
import { rpcErrorMessage } from '@/lib/rpc-error';

export type EditalSituacao = 'vigente' | 'em_expectativa' | 'encerrado';

// Ordem canônica de exibição: vigente primeiro, encerrado por último.
export const SITUACAO_ORDER: Record<EditalSituacao, number> = { vigente: 0, em_expectativa: 1, encerrado: 2 };

export interface CatalogEdital {
  id: string;
  slug: string;
  orgao: string;
  cargo: string;
  banca: string | null;
  ano: number | null;
  uf: string | null;
  nivel: string | null;          // escolaridade (texto curado: "superior", "médio"…)
  concursoKey: string | null;    // agrupa edições do mesmo concurso
  orgaoSlug: string | null;      // órgão do catálogo (rota /editais/orgao/[slug])
  verificadoEm: string | null;   // data em que a ficha foi conferida contra as fontes
  // Conteúdo programático é PREVISÃO (edital não publicado) e não curadoria de
  // edital oficial — a UI precisa dizer isso em voz alta.
  gradeProvisoria: boolean;
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

// URL pública da nossa cópia do edital oficial. Serve o PDF mesmo que o
// servidor do órgão saia do ar ou reorganize o site (Lei 9.610 art. 8º, IV —
// ato oficial não tem proteção autoral). A fonte original continua exibida.
export function editalMirrorUrl(storagePath: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  return `${base}/storage/v1/object/public/editais-oficiais/${storagePath}`;
}

export interface EditalPdfMirror {
  url: string;
  bytes: number;
  capturedAt: string;
  sourceUrl: string;
}

export async function getEditalPdfMirror(catalogEditalId: string): Promise<EditalPdfMirror | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('edital_pdf_mirrors')
    .select('storage_path, bytes, captured_at, source_url')
    .eq('edital_catalog_id', catalogEditalId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    url: editalMirrorUrl(data.storage_path),
    bytes: data.bytes,
    capturedAt: data.captured_at,
    sourceUrl: data.source_url,
  };
}

type EmbeddedCount = { count: number }[] | null;
interface EditalRow {
  id: string;
  slug: string;
  orgao: string;
  cargo: string;
  banca: string | null;
  ano: number | null;
  uf: string | null;
  nivel: string | null;
  concurso_key: string | null;
  situacao: EditalSituacao;
  ultima_edicao: number | null;
  vagas: number | null;
  remuneracao: number | null;
  exam_date: string | null;
  inscricoes_ate: string | null;
  edital_url: string | null;
  aviso: string | null;
  verificado_em: string | null;
  grade_provisoria: boolean | null;
  catalog_areas: { name: string } | { name: string }[] | null;
  orgaos_catalog: { slug: string } | { slug: string }[] | null;
  edital_catalog_subjects: EmbeddedCount;
  edital_catalog_topics: EmbeddedCount;
}

function orgaoSlugOf(rel: EditalRow['orgaos_catalog']): string | null {
  const o = Array.isArray(rel) ? rel[0] : rel;
  return o?.slug ?? null;
}

function countOf(rel: EmbeddedCount): number {
  return rel && rel.length > 0 ? rel[0].count : 0;
}

export async function listCatalogEditais(): Promise<CatalogEdital[]> {
  const supabase = createClient();
  const user = await getCachedUser();

  const [editaisRes, minhasRes] = await Promise.all([
    supabase
      .from('editais_catalog')
      .select('id, slug, orgao, cargo, banca, ano, uf, nivel, concurso_key, situacao, ultima_edicao, vagas, remuneracao, exam_date, inscricoes_ate, edital_url, aviso, verificado_em, grade_provisoria, catalog_areas(name), orgaos_catalog(slug), edital_catalog_subjects(count), edital_catalog_topics(count)')
      .eq('is_active', true)
      .order('position', { ascending: true }),
    user
      ? supabase.from('target_exams').select('slug').eq('user_id', user.id)
      : Promise.resolve({ data: [] as { slug: string }[], error: null }),
  ]);

  if (editaisRes.error) throw new Error('Erro ao listar editais: ' + editaisRes.error.message);
  if (minhasRes.error) throw new Error('Erro ao verificar editais ativados: ' + minhasRes.error.message);

  const ativados = new Set((minhasRes.data ?? []).map((r) => r.slug));

  return ((editaisRes.data ?? []) as EditalRow[])
    .map((e) => {
      const area = Array.isArray(e.catalog_areas) ? e.catalog_areas[0] : e.catalog_areas;
      return {
        id: e.id,
        slug: e.slug,
        orgao: e.orgao,
        cargo: e.cargo,
        banca: e.banca,
        ano: e.ano,
        uf: e.uf,
        nivel: e.nivel,
        concursoKey: e.concurso_key,
        orgaoSlug: orgaoSlugOf(e.orgaos_catalog),
        verificadoEm: e.verificado_em,
        gradeProvisoria: e.grade_provisoria ?? false,
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
  slug: string;                 // rota /editais/[slug] — o hub do concurso linka para cá
  situacao: EditalSituacao;
  banca: string | null;
  ultimaEdicao: number | null;
  vagas: number | null;
  remuneracao: number | null;
  examDate: string | null;
  inscricoesAte: string | null;
  editalUrl: string | null;
  aviso: string | null;
  // Existência real das seções da página do edital — o checklist da Central de
  // preparação usa isto para não navegar para âncora que não renderiza.
  subjectCount: number;
  statsCount: number;
  papersCount: number;
}

// Conteúdo programático de um edital do catálogo — para o painel de detalhes
// (o usuário vê tudo ANTES de ativar).
export interface CatalogEditalSubject {
  name: string;
  weight: number;
  numQuestions: number | null;
  topicCount: number;
  // Lista de tópicos conferida contra o conteúdo programático oficial DESTE
  // edital (Anexo II), em vez da lista padrão do catálogo para a matéria.
  // Sem isso a UI não tem como distinguir "esta é a grade do edital" de
  // "estes são os tópicos que o catálogo tem para a matéria".
  topicosCurados: boolean;
}

export async function getCatalogEditalSubjects(catalogEditalId: string): Promise<CatalogEditalSubject[]> {
  const supabase = createClient();
  const [subjectsRes, topicsRes] = await Promise.all([
    supabase
      .from('edital_catalog_subjects')
      .select('subject_catalog_id, weight, num_questions_expected, position, topicos_curados, subjects_catalog(name)')
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
      topicosCurados: row.topicos_curados ?? false,
    };
  });
}

// Programa oficial (verbatim do Anexo II) por matéria — quando existe, a UI
// mostra o texto que fundamenta a curadoria em vez de pedir fé no selo
// "tópicos conferidos". Chaveado por NOME da matéria (o painel de disciplinas
// só tem nomes em mãos).
export interface EditalPrograma {
  texto: string;
  fonteUrl: string | null;
  conferidoEm: string | null;
}

export async function getEditalProgramas(catalogEditalId: string): Promise<Record<string, EditalPrograma>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('edital_programas')
    .select('texto, fonte_url, conferido_em, subjects_catalog(name)')
    .eq('edital_catalog_id', catalogEditalId);
  if (error) throw new Error('Erro ao carregar o programa oficial: ' + error.message);
  const map: Record<string, EditalPrograma> = {};
  for (const row of data ?? []) {
    const sc = Array.isArray(row.subjects_catalog) ? row.subjects_catalog[0] : row.subjects_catalog;
    if (!sc?.name) continue;
    map[sc.name] = { texto: row.texto, fonteUrl: row.fonte_url, conferidoEm: row.conferido_em };
  }
  return map;
}

// Notícias, retificações e resultados de um edital — linha do tempo do hub.
export type EditalUpdateTipo = 'noticia' | 'retificacao' | 'aviso' | 'resultado';

// Diff estruturado e curado de uma retificação — permite mostrar o
// antes/depois visual sem versionar o edital inteiro.
export interface EditalUpdateChanges {
  campos?: { campo: string; antes: string; depois: string }[];
  conteudo?: { disciplina: string; adicionados?: string[]; removidos?: string[] }[];
}

export interface EditalUpdate {
  id: string;
  tipo: EditalUpdateTipo;
  titulo: string;
  url: string | null;
  publishedAt: string;
  changes: EditalUpdateChanges | null;
}

export async function listEditalUpdates(catalogEditalId: string): Promise<EditalUpdate[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('edital_updates')
    .select('id, tipo, titulo, url, published_at, changes')
    .eq('edital_catalog_id', catalogEditalId)
    .order('published_at', { ascending: false })
    .limit(20);
  if (error) throw new Error('Erro ao listar atualizações do edital: ' + error.message);
  return (data ?? []).map((u) => ({
    id: u.id, tipo: u.tipo, titulo: u.titulo, url: u.url, publishedAt: u.published_at,
    changes: (u.changes as EditalUpdateChanges | null) ?? null,
  }));
}

export async function getCatalogEditalInfo(catalogEditalId: string): Promise<CatalogEditalInfo | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('editais_catalog')
    .select('slug, situacao, banca, ultima_edicao, vagas, remuneracao, exam_date, inscricoes_ate, edital_url, aviso, concurso_key')
    .eq('id', catalogEditalId)
    .maybeSingle();
  if (error || !data) return null;
  // Contagens head-only. Chaves DIFERENTES de propósito: o histórico segue por
  // concurso_key (compartilhado entre edições do mesmo concurso), mas as provas
  // passaram a ser por edital_catalog_id — cada cargo tem a sua (migration
  // 20260731210000 dropou past_papers.concurso_key). Consultar a coluna morta
  // devolvia erro do PostgREST que o `?? 0` engolia, zerando papersCount para
  // sempre e quebrando o item "Resolver a última prova" da Central de
  // preparação, que nunca navegava. '' nunca casa e devolve 0 sem erro.
  const key = data.concurso_key ?? '';
  const [subjRes, statsRes, papersRes] = await Promise.all([
    supabase.from('edital_catalog_subjects').select('id', { count: 'exact', head: true }).eq('edital_catalog_id', catalogEditalId),
    supabase.from('edital_concurso_stats').select('id', { count: 'exact', head: true }).eq('concurso_key', key),
    supabase.from('edital_past_papers').select('id', { count: 'exact', head: true }).eq('edital_catalog_id', catalogEditalId),
  ]);
  return {
    slug: data.slug,
    situacao: data.situacao,
    banca: data.banca,
    ultimaEdicao: data.ultima_edicao,
    vagas: data.vagas,
    remuneracao: data.remuneracao == null ? null : Number(data.remuneracao),
    examDate: data.exam_date,
    inscricoesAte: data.inscricoes_ate,
    editalUrl: data.edital_url,
    aviso: data.aviso,
    subjectCount: subjRes.count ?? 0,
    statsCount: statsRes.count ?? 0,
    papersCount: papersRes.count ?? 0,
  };
}

// Ativa um edital do banco. Retorna o id do concurso-alvo criado (ou existente).
export async function activateCatalogEdital(editalId: string): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('activate_catalog_edital', { p_edital_id: editalId });
  if (error) {
    throw new Error(rpcErrorMessage(
      error,
      'Não foi possível ativar este edital agora. Nada foi criado na sua conta — tente de novo em instantes e, se persistir, me avise.',
      'activate_catalog_edital',
    ));
  }
  invalidatePrimaryTargetCache();
  return data as string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Órgãos do catálogo — a hierarquia é órgão → cargos (editais) → especificações
// ─────────────────────────────────────────────────────────────────────────────

export interface OrgaoCatalog {
  id: string;
  slug: string;
  sigla: string;
  nome: string;
  uf: string | null;
  esfera: string | null;   // 'estadual' | 'federal' | 'municipal'
  poder: string | null;    // 'executivo' | 'judiciario' | 'legislativo' | 'controle'
  siteUrl: string | null;
  descricao: string | null;
  editalCount: number;
}

interface OrgaoRow {
  id: string;
  slug: string;
  sigla: string;
  nome: string;
  uf: string | null;
  esfera: string | null;
  poder: string | null;
  site_url: string | null;
  descricao: string | null;
  editais_catalog: EmbeddedCount;
}

function mapOrgao(o: OrgaoRow): OrgaoCatalog {
  return {
    id: o.id, slug: o.slug, sigla: o.sigla, nome: o.nome, uf: o.uf,
    esfera: o.esfera, poder: o.poder, siteUrl: o.site_url, descricao: o.descricao,
    editalCount: countOf(o.editais_catalog),
  };
}

export async function listOrgaos(): Promise<OrgaoCatalog[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('orgaos_catalog')
    .select('id, slug, sigla, nome, uf, esfera, poder, site_url, descricao, editais_catalog(count)')
    .order('position', { ascending: true });
  if (error) throw new Error('Erro ao listar órgãos: ' + error.message);
  return ((data ?? []) as unknown as OrgaoRow[]).map(mapOrgao);
}

export async function getOrgaoBySlug(slug: string): Promise<OrgaoCatalog | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('orgaos_catalog')
    .select('id, slug, sigla, nome, uf, esfera, poder, site_url, descricao, editais_catalog(count)')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw new Error('Erro ao carregar órgão: ' + error.message);
  return data ? mapOrgao(data as unknown as OrgaoRow) : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Escolha do usuário: pedido de edital (fila de demanda) e prova social
// ─────────────────────────────────────────────────────────────────────────────

export interface EditalRequestInput {
  concurso: string;
  cargo?: string;
  uf?: string;
  detalhes?: string;
}

// Registra a lacuna do catálogo como demanda. A curadoria prioriza por aqui —
// cada linha é alguém que procurou e não achou.
export async function requestEdital(input: EditalRequestInput): Promise<void> {
  const supabase = createClient();
  const user = await getCachedUser();
  if (!user) throw new Error('Entre na sua conta para pedir um edital.');
  const { error } = await supabase.from('edital_requests').insert({
    user_id: user.id,
    concurso: input.concurso.trim(),
    cargo: input.cargo?.trim() || null,
    uf: input.uf || null,
    detalhes: input.detalhes?.trim() || null,
  });
  if (error) throw new Error(error.message.includes('10 pedidos')
    ? error.message
    : 'Erro ao registrar o pedido: ' + error.message);
}

export async function listMyEditalRequests(): Promise<{ concurso: string; status: string }[]> {
  const supabase = createClient();
  const user = await getCachedUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from('edital_requests')
    .select('concurso, status')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  if (error) return [];
  return data ?? [];
}

// "N pessoas estudando" por edital (ativos nos últimos 30 dias). O RPC devolve
// o número cru; o LIMIAR de exibição é decisão da UI — contagem pequena não
// aparece porque "1 pessoa estudando" depõe contra o produto.
export const STUDYING_BADGE_MIN = 3;

export async function getEditalStudyingCounts(): Promise<Record<string, number>> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('edital_studying_counts');
  if (error) return {};
  const map: Record<string, number> = {};
  for (const row of (data ?? []) as { edital_catalog_id: string; estudando: number }[]) {
    map[row.edital_catalog_id] = row.estudando;
  }
  return map;
}

// ── Seguir concurso (push de novidades) ──
// Seguidor explícito recebe web push quando sai edital_update novo. Quem
// ativou o concurso é seguidor implícito (a Edge Function notify-edital-updates
// une os dois conjuntos) — o follow explícito serve para acompanhar sem ativar.

export async function isFollowingEdital(editalId: string): Promise<boolean> {
  const supabase = createClient();
  const user = await getCachedUser();
  if (!user) return false;
  const { data, error } = await supabase
    .from('edital_follows')
    .select('edital_catalog_id')
    .eq('user_id', user.id)
    .eq('edital_catalog_id', editalId)
    .maybeSingle();
  if (error) return false;
  return data != null;
}

export async function followEdital(editalId: string): Promise<void> {
  const supabase = createClient();
  const user = await getCachedUser();
  if (!user) throw new Error('Sessão expirada — entre de novo.');
  const { error } = await supabase
    .from('edital_follows')
    .insert({ user_id: user.id, edital_catalog_id: editalId });
  if (error && error.code !== '23505') throw new Error('Erro ao seguir edital: ' + error.message);
}

export async function unfollowEdital(editalId: string): Promise<void> {
  const supabase = createClient();
  const user = await getCachedUser();
  if (!user) throw new Error('Sessão expirada — entre de novo.');
  const { error } = await supabase
    .from('edital_follows')
    .delete()
    .eq('user_id', user.id)
    .eq('edital_catalog_id', editalId);
  if (error) throw new Error('Erro ao deixar de seguir edital: ' + error.message);
}

// ── Match de importação com o catálogo (Fase 3) ──
// Evita concursos "órfãos": se a usuária importa (PDF/texto) um edital que já
// existe no banco, os modais oferecem a ativação completa (ficha, pesos,
// linha do tempo) em vez de criar um target sem catalog_edital_id.
// Função pura e síncrona — os modais buscam o catálogo uma vez (React Query)
// e casam reativamente enquanto a usuária edita órgão/cargo.
function normalizeMatch(v: string): string {
  return v.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function matchCatalogEdital(
  editais: CatalogEdital[],
  orgao: string,
  cargo: string,
): CatalogEdital | null {
  const nOrgao = normalizeMatch(orgao);
  const nCargo = normalizeMatch(cargo);
  // Conservador: exige órgão idêntico E cargo compatível — melhor não sugerir
  // do que sugerir o concurso errado. Editais sem grade também casam: nesse
  // caso os modais vinculam a importação ao catálogo em vez de oferecer a
  // ativação (que criaria um concurso vazio, perdendo a grade importada).
  if (!nOrgao || !nCargo) return null;
  const candidatos = editais.filter((e) => {
    const eOrgao = normalizeMatch(e.orgao);
    const eCargo = normalizeMatch(e.cargo);
    return eOrgao === nOrgao && (eCargo === nCargo || eCargo.includes(nCargo) || nCargo.includes(eCargo));
  });
  if (candidatos.length === 0) return null;
  // Match exato ganha de match por prefixo/contido.
  const exato = candidatos.filter((e) => normalizeMatch(e.cargo) === nCargo);
  if (exato.length === 1) return exato[0];
  // AMBIGUIDADE: mais de um cargo do mesmo órgão casa com o texto. Desde que a
  // PM-GO passou a ter "Soldado Combatente" E "Soldado Músico", digitar só
  // "Soldado" casava com o primeiro por ordem de position — e um candidato a
  // Músico receberia a grade do Combatente (sem Teoria Musical, com Direito
  // Penal que não cai na prova dele). Não sugerir é melhor do que sugerir o
  // errado, que é o contrato desta função.
  if (exato.length > 1 || candidatos.length > 1) return null;
  return candidatos[0];
}

// ─────────────────────────────────────────────────────────────────────────────
// Hub de Editais — página /editais/[slug]
// ─────────────────────────────────────────────────────────────────────────────

// Detalhe completo de um edital + o concurso-alvo da usuária (se já ativado).
export interface CatalogEditalDetail extends CatalogEdital {
  targetId: string | null;
}

export async function getCatalogEditalBySlug(slug: string): Promise<CatalogEditalDetail | null> {
  const supabase = createClient();
  const user = await getCachedUser();

  const [editalRes, targetRes] = await Promise.all([
    supabase
      .from('editais_catalog')
      .select('id, slug, orgao, cargo, banca, ano, uf, nivel, concurso_key, situacao, ultima_edicao, vagas, remuneracao, exam_date, inscricoes_ate, edital_url, aviso, verificado_em, grade_provisoria, catalog_areas(name), orgaos_catalog(slug), edital_catalog_subjects(count), edital_catalog_topics(count)')
      .eq('slug', slug)
      .maybeSingle(),
    user
      ? supabase.from('target_exams').select('id').eq('user_id', user.id).eq('slug', slug).is('archived_at', null).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (editalRes.error) throw new Error('Erro ao carregar edital: ' + editalRes.error.message);
  if (!editalRes.data) return null;
  const e = editalRes.data as unknown as EditalRow;
  const area = Array.isArray(e.catalog_areas) ? e.catalog_areas[0] : e.catalog_areas;
  let targetId = (targetRes.data as { id: string } | null)?.id ?? null;
  // Alvo criado por importação/legado tem slug próprio, mas já aponta para
  // este edital via catalog_edital_id. Sem esta segunda busca a página oferece
  // "Ativar edital" a quem já tem o concurso — e o usuário acabava com dois
  // cadastros do mesmo cargo (o RPC agora recusa o duplicado, mas o rótulo
  // errado continuava mentindo).
  if (!targetId && user) {
    const { data: porVinculo } = await supabase
      .from('target_exams')
      .select('id')
      .eq('user_id', user.id)
      .eq('catalog_edital_id', e.id)
      .is('archived_at', null)
      .maybeSingle();
    targetId = (porVinculo as { id: string } | null)?.id ?? null;
  }

  return {
    id: e.id,
    slug: e.slug,
    orgao: e.orgao,
    cargo: e.cargo,
    banca: e.banca,
    ano: e.ano,
    uf: e.uf,
    nivel: e.nivel,
    concursoKey: e.concurso_key,
    orgaoSlug: orgaoSlugOf(e.orgaos_catalog),
    verificadoEm: e.verificado_em,
    gradeProvisoria: e.grade_provisoria ?? false,
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
    isActivated: targetId != null,
    targetId,
  };
}

// "Edições do mesmo cargo" e o tier "edicao" do comparador são derivados no
// cliente, direto do catálogo já cacheado (listCatalogEditais + filtro por
// orgaoSlug+cargo em app/(app)/editais/[slug]/page.tsx) — não por
// concurso_key. Um concurso unificado põe vários cargos diferentes na mesma
// edição (ex.: TJ-GO 2024 tem três, o de 2021 outros dois, sem repetir
// nenhum); agrupar por concurso_key fazia um cargo aparecer como "edição" de
// outro cargo qualquer do mesmo concurso (bug reportado em 31/07).

// Estatísticas históricas do concurso, quando curadas com dado real. Sem
// linhas = a seção não aparece. Nota de corte e nomeados saíram da UI em
// 31/07 (decisão de produto: curadoria cara demais para manter honesta) —
// as colunas seguem no banco para quando a curadoria der conta.
export interface ConcursoStat {
  ano: number;
  inscritos: number | null;
  vagas: number | null;
  fonteUrl: string | null;
}

export async function listConcursoStats(concursoKey: string): Promise<ConcursoStat[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('edital_concurso_stats')
    .select('ano, inscritos, vagas, fonte_url')
    .eq('concurso_key', concursoKey)
    .order('ano', { ascending: false });
  if (error) throw new Error('Erro ao listar histórico do concurso: ' + error.message);
  return (data ?? []).map((r) => ({
    ano: r.ano, inscritos: r.inscritos, vagas: r.vagas, fonteUrl: r.fonte_url,
  }));
}

// Provas anteriores — links oficiais (prova/gabarito), nunca questão inventada.
export interface PastPaper {
  id: string;
  ano: number;
  banca: string | null;
  provaUrl: string;
  gabaritoUrl: string | null;
}

// Escopo é o CARGO, não o concurso: num concurso unificado cada cargo tem seu
// próprio caderno, e as edições nem sequer ofertam os mesmos cargos (o TJ-GO
// 2021 teve dois e o de 2024 outros três, sem repetir nenhum). Chavear por
// concurso mostrava a prova de Contador para quem estuda Área Judiciária.
export async function listPastPapers(editalCatalogId: string): Promise<PastPaper[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('edital_past_papers')
    .select('id, ano, banca, prova_url, gabarito_url')
    .eq('edital_catalog_id', editalCatalogId)
    .order('ano', { ascending: false });
  if (error) throw new Error('Erro ao listar provas anteriores: ' + error.message);
  return (data ?? []).map((r) => ({
    id: r.id, ano: r.ano, banca: r.banca, provaUrl: r.prova_url, gabaritoUrl: r.gabarito_url,
  }));
}

// ── Comparador: edital atual × outra edição/edital ──
// O diff é calculado no cliente a partir do conteúdo programático dos dois
// editais (disciplinas, pesos, questões e tópicos por nome).
export interface EditalComparisonSubject {
  name: string;
  status: 'adicionada' | 'removida' | 'mantida';
  // true quando a disciplina mantida mudou (peso, questões ou tópicos).
  // Única fonte da verdade: o resumo ("N alteradas") e as linhas exibidas
  // usam ESTE campo — quando eram dois cálculos separados, o resumo dizia
  // "6 alteradas" e as linhas diziam "Mantida" (bug de 31/07).
  changed: boolean;
  weightAtual: number | null;
  weightAnterior: number | null;
  numQuestionsAtual: number | null;
  numQuestionsAnterior: number | null;
  topicsAdded: string[];
  topicsRemoved: string[];
}

export interface EditalComparison {
  subjects: EditalComparisonSubject[];
  totalAdded: number;
  totalRemoved: number;
  totalChanged: number;
  // Só faz sentido afirmar diferença de tópicos quando OS DOIS editais tiveram
  // a grade conferida contra o conteúdo programático oficial. Sem isso, ambos
  // usam a lista padrão do catálogo e o diff sai vazio por construção.
  ambosCurados: boolean;
}

interface ProgramaticContent {
  // por nome de disciplina: peso, questões e set de nomes de tópicos
  subjects: Map<string, { weight: number; numQuestions: number | null; topics: Set<string> }>;
  todasCuradas: boolean;
}

async function fetchProgramaticContent(catalogEditalId: string): Promise<ProgramaticContent> {
  const supabase = createClient();
  const [subjectsRes, topicsRes] = await Promise.all([
    supabase
      .from('edital_catalog_subjects')
      .select('weight, num_questions_expected, position, topicos_curados, subjects_catalog(name)')
      .eq('edital_catalog_id', catalogEditalId)
      .order('position', { ascending: true }),
    supabase
      .from('edital_catalog_topics')
      .select('topics_catalog(name, subjects_catalog(name))')
      .eq('edital_catalog_id', catalogEditalId),
  ]);
  if (subjectsRes.error) throw new Error('Erro ao carregar conteúdo do edital: ' + subjectsRes.error.message);
  if (topicsRes.error) throw new Error('Erro ao carregar tópicos do edital: ' + topicsRes.error.message);

  const subjects: ProgramaticContent['subjects'] = new Map();
  for (const row of subjectsRes.data ?? []) {
    const sc = Array.isArray(row.subjects_catalog) ? row.subjects_catalog[0] : row.subjects_catalog;
    if (!sc?.name) continue;
    subjects.set(sc.name, { weight: row.weight, numQuestions: row.num_questions_expected, topics: new Set() });
  }
  for (const row of topicsRes.data ?? []) {
    const tc = Array.isArray(row.topics_catalog) ? row.topics_catalog[0] : row.topics_catalog;
    if (!tc?.name) continue;
    const sc = Array.isArray(tc.subjects_catalog) ? tc.subjects_catalog[0] : tc.subjects_catalog;
    const subjectName = (sc as { name: string } | null)?.name;
    if (!subjectName) continue;
    const entry = subjects.get(subjectName);
    if (entry) entry.topics.add(tc.name);
  }
  const linhas = subjectsRes.data ?? [];
  const todasCuradas = linhas.length > 0 && linhas.every((r) => r.topicos_curados === true);
  return { subjects, todasCuradas };
}

export async function compareEditais(editalAtualId: string, editalAnteriorId: string): Promise<EditalComparison> {
  const [atual, anterior] = await Promise.all([
    fetchProgramaticContent(editalAtualId),
    fetchProgramaticContent(editalAnteriorId),
  ]);

  const names = new Set([...atual.subjects.keys(), ...anterior.subjects.keys()]);
  const subjects: EditalComparisonSubject[] = [];
  let totalAdded = 0, totalRemoved = 0, totalChanged = 0;

  for (const name of names) {
    const a = atual.subjects.get(name);
    const b = anterior.subjects.get(name);
    const status: EditalComparisonSubject['status'] = a && b ? 'mantida' : a ? 'adicionada' : 'removida';
    const topicsAdded = a ? [...a.topics].filter((t) => !(b?.topics.has(t))) : [];
    const topicsRemoved = b ? [...b.topics].filter((t) => !(a?.topics.has(t))) : [];

    if (status === 'adicionada') totalAdded += 1;
    if (status === 'removida') totalRemoved += 1;
    // Mudança de nº de questões também conta como alteração — sem isso uma
    // disciplina que só mudou de 10 para 12 questões sumiria do diff.
    const changed = status === 'mantida'
      && (a!.weight !== b!.weight || a!.numQuestions !== b!.numQuestions || topicsAdded.length > 0 || topicsRemoved.length > 0);
    if (changed) totalChanged += 1;

    subjects.push({
      name,
      status,
      changed,
      weightAtual: a?.weight ?? null,
      weightAnterior: b?.weight ?? null,
      numQuestionsAtual: a?.numQuestions ?? null,
      numQuestionsAnterior: b?.numQuestions ?? null,
      topicsAdded,
      topicsRemoved,
    });
  }

  // Adicionadas primeiro, depois alteradas, depois mantidas, removidas por último.
  const ORDER: Record<EditalComparisonSubject['status'], number> = { adicionada: 0, mantida: 1, removida: 2 };
  subjects.sort((x, y) => ORDER[x.status] - ORDER[y.status] || x.name.localeCompare(y.name));

  return {
    subjects, totalAdded, totalRemoved, totalChanged,
    ambosCurados: atual.todasCuradas && anterior.todasCuradas,
  };
}
